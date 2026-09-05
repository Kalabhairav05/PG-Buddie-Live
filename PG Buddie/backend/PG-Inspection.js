require("dotenv").config();

const mongoose = require("mongoose");
const PG = require("./models/PG");

async function checkOwnerStrike() {
  await mongoose.connect(process.env.MONGODB_URI);

  const pg = await PG.findById("6a8c775f8c253c680d5ccd49")
    .select("name ownerCancellationStrikes bookingRestrictedUntil");

  console.log("OWNER ACCOUNTABILITY STATE:");
  console.log({
    name: pg.name,
    ownerCancellationStrikes: pg.ownerCancellationStrikes,
    bookingRestrictedUntil: pg.bookingRestrictedUntil,
  });

  await mongoose.disconnect();
}

checkOwnerStrike().catch(console.error);