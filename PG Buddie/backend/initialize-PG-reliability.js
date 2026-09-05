require("dotenv").config();

const mongoose = require("mongoose");
const PG = require("./models/PG");

const PG_ID = "6a8c775f8c253c680d5ccd49";

async function initializePGReliability() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);

    /*
      Use the raw MongoDB collection here.

      This is intentional.

      We do NOT want Mongoose schema defaults to
      make us think the fields already exist.
    */

    const pg = await PG.collection.findOne({
      _id: new mongoose.Types.ObjectId(PG_ID),
    });

    if (!pg) {
      console.log(
        "PG NOT FOUND:",
        PG_ID
      );
      return;
    }

    console.log(
      "RAW DATABASE STATE BEFORE INITIALIZATION:"
    );

    console.dir(
      {
        name: pg.name,

        // Legacy field
        ownerCancellationStrikes:
          pg.ownerCancellationStrikes,

        // New fields
        ownerReliabilityScore:
          pg.ownerReliabilityScore,

        ownerAccountabilityPoints:
          pg.ownerAccountabilityPoints,

        ownerProvenCancellationCount:
          pg.ownerProvenCancellationCount,

        ownerCancellationDisputeCount:
          pg.ownerCancellationDisputeCount,

        ownerGoodBookingCount:
          pg.ownerGoodBookingCount,

        ownerLastAccountabilityEventAt:
          pg.ownerLastAccountabilityEventAt,

        bookingRestrictedUntil:
          pg.bookingRestrictedUntil,
      },
      {
        depth: null,
      }
    );


    /*
      ----------------------------------------------------------
      SAFETY CHECK
      ----------------------------------------------------------

      Only consider the new reliability system initialized if
      the reliability score actually exists in the raw MongoDB
      document.

      We intentionally use hasOwnProperty rather than checking
      the value because Mongoose defaults are not involved here.
    */

    const reliabilityAlreadyInitialized =
      Object.prototype.hasOwnProperty.call(
        pg,
        "ownerReliabilityScore"
      );


    if (
      reliabilityAlreadyInitialized
    ) {

      console.log(
        "\nRELIABILITY ALREADY EXISTS IN DATABASE."
      );

      console.log(
        "NO CHANGES WERE MADE."
      );

      return;
    }


    /*
      ----------------------------------------------------------
      INITIAL BASELINE
      ----------------------------------------------------------

      IMPORTANT:

      We preserve the existing legacy strike count.

      We DO NOT convert those old strikes into proven
      cancellations because they came from the previous
      accountability mechanism.

      The new system therefore starts with a clean,
      explicitly defined baseline.
    */


    await PG.collection.updateOne(

      {
        _id:
          new mongoose.Types.ObjectId(
            PG_ID
          ),
      },

      {
        $set: {

          ownerReliabilityScore:
            100,

          ownerAccountabilityPoints:
            0,

          ownerProvenCancellationCount:
            0,

          ownerCancellationDisputeCount:
            0,

          ownerGoodBookingCount:
            0,

          ownerLastAccountabilityEventAt:
            null,

          bookingRestrictedUntil:
            null,

        },
      }

    );


    /*
      ----------------------------------------------------------
      VERIFY
      ----------------------------------------------------------
    */

    const updatedPG =
      await PG.collection.findOne({
        _id:
          new mongoose.Types.ObjectId(
            PG_ID
          ),
      });


    console.log(
      "\nRELIABILITY INITIALIZATION COMPLETE:"
    );


    console.dir(
      {
        name:
          updatedPG.name,

        // Existing legacy history
        ownerCancellationStrikes:
          updatedPG.ownerCancellationStrikes,

        // New reliability system
        ownerReliabilityScore:
          updatedPG.ownerReliabilityScore,

        ownerAccountabilityPoints:
          updatedPG.ownerAccountabilityPoints,

        ownerProvenCancellationCount:
          updatedPG.ownerProvenCancellationCount,

        ownerCancellationDisputeCount:
          updatedPG.ownerCancellationDisputeCount,

        ownerGoodBookingCount:
          updatedPG.ownerGoodBookingCount,

        ownerLastAccountabilityEventAt:
          updatedPG.ownerLastAccountabilityEventAt,

        // Serious restriction
        bookingRestrictedUntil:
          updatedPG.bookingRestrictedUntil,
      },
      {
        depth: null,
      }
    );


  } catch (error) {

    console.error(
      "RELIABILITY INITIALIZATION ERROR:"
    );

    console.error(error);

  } finally {

    await mongoose.disconnect();

  }
}


initializePGReliability();