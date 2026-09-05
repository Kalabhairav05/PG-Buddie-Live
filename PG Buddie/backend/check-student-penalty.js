require("dotenv").config();

const mongoose = require("mongoose");
const User = require("./models/User");

async function main() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);

    const user = await User.findOne({
      email: "kalyan23@gmail.com",
    });

    if (!user) {
      throw new Error("Student not found.");
    }

    user.assignedRoomCancellationCount = 1;
    user.lastAssignedRoomCancellationAt =
      new Date("2026-08-25T18:05:12.932Z");

    user.bookingCooldownUntil = null;
    user.bookingCooldownReason = "";

    await user.save();

    console.log("Student penalty state initialized:");

    console.log({
      name: user.name,
      assignedRoomCancellationCount:
        user.assignedRoomCancellationCount,
      lastAssignedRoomCancellationAt:
        user.lastAssignedRoomCancellationAt,
      bookingCooldownUntil:
        user.bookingCooldownUntil,
      bookingCooldownReason:
        user.bookingCooldownReason,
    });
  } catch (error) {
    console.error(error);
  } finally {
    await mongoose.disconnect();
  }
}

main();