require("dotenv").config();

const mongoose = require("mongoose");
const PG = require("./models/PG");

async function inspectPG() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);

    const pg = await PG.findById("6a8c775f8c253c680d5ccd49")
      .select(
        [
          "name",
          "owner",
          "ownerReliabilityScore",
          "ownerAccountabilityPoints",
          "ownerProvenCancellationCount",
          "ownerCancellationDisputeCount",
          "ownerGoodBookingCount",
          "ownerLastAccountabilityEventAt",
          "ownerCancellationStrikes",
          "bookingRestrictedUntil",
        ].join(" ")
      )
      .lean();

    if (!pg) {
      console.log("PG NOT FOUND");
      return;
    }

    console.log("CURRENT PG RELIABILITY STATE:");
    console.dir(
      {
        name: pg.name,
        owner: pg.owner,

        // New system
        ownerReliabilityScore: pg.ownerReliabilityScore,
        ownerAccountabilityPoints: pg.ownerAccountabilityPoints,
        ownerProvenCancellationCount:
          pg.ownerProvenCancellationCount,
        ownerCancellationDisputeCount:
          pg.ownerCancellationDisputeCount,
        ownerGoodBookingCount:
          pg.ownerGoodBookingCount,
        ownerLastAccountabilityEventAt:
          pg.ownerLastAccountabilityEventAt,

        // Existing system
        ownerCancellationStrikes:
          pg.ownerCancellationStrikes,
        bookingRestrictedUntil:
          pg.bookingRestrictedUntil,
      },
      { depth: null }
    );
  } catch (error) {
    console.error("PG INSPECTION ERROR:");
    console.error(error);
  } finally {
    await mongoose.disconnect();
  }
}

inspectPG();