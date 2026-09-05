require("dotenv").config();

const mongoose = require("mongoose");
const User = require("./models/User");

async function main() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);

    console.log("MongoDB connected.");

    const user = await User.findOne({
      email: "kalyan23@gmail.com"
    });

    if (!user) {
      console.log("Student not found.");
      return;
    }

    console.log("Before cleanup:");
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

    user.bookingCooldownUntil = null;
    user.bookingCooldownReason = "";

    await user.save();

    console.log("Cooldown cleared.");

    console.log("After cleanup:");
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
    console.error("Cleanup error:", error);
  } finally {
    await mongoose.disconnect();
    console.log("MongoDB disconnected.");
  }
}

main();