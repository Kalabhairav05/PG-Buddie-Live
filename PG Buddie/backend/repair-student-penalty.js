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

    user.assignedRoomCancellationCount = 2;

    user.lastAssignedRoomCancellationAt =
      new Date("2026-08-25T18:29:39.606Z");

    user.bookingCooldownUntil =
      new Date("2026-08-26T06:29:39.641Z");

    user.bookingCooldownReason =
      "student_room_assigned_cancellation";

    await user.save();

    console.log("Student penalty state repaired:");

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
    console.error("Repair error:", error);
  } finally {
    await mongoose.disconnect();
  }
}

main();