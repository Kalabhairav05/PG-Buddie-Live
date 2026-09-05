require("dotenv").config();

const mongoose = require("mongoose");
const PG = require("./models/PG");

const PG_ID = "6a8c775f8c253c680d5ccd49";

async function setTestReliability() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);

    const pg = await PG.findById(PG_ID);

    if (!pg) {
      console.log("PG NOT FOUND:", PG_ID);
      return;
    }

    console.log("BEFORE:");
    console.log({
      name: pg.name,
      ownerReliabilityScore:
        pg.ownerReliabilityScore,
      ownerGoodBookingCount:
        pg.ownerGoodBookingCount,
      ownerCancellationDisputeCount:
        pg.ownerCancellationDisputeCount,
    });

    /*
      TEST ONLY

      Lower the reliability score to 99 so that
      one genuine check-in can prove that the new
      +0.25 recovery rule works.

      Historical counters are NOT changed.
    */

    pg.ownerReliabilityScore = 99;

    await pg.save();

    console.log("\nAFTER:");
    console.log({
      name: pg.name,
      ownerReliabilityScore:
        pg.ownerReliabilityScore,
      ownerGoodBookingCount:
        pg.ownerGoodBookingCount,
      ownerCancellationDisputeCount:
        pg.ownerCancellationDisputeCount,
    });

  } catch (error) {
    console.error(
      "TEST RELIABILITY ERROR:"
    );
    console.error(error);

  } finally {
    await mongoose.disconnect();
  }
}

setTestReliability();