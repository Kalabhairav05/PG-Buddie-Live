require("dotenv").config();

const mongoose = require("mongoose");
const User = require("./models/User");

async function main() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);

    const user = await User.findOne({
      email: "manish@gmail.com",
    }).lean();

    if (!user) {
      throw new Error("Student not found.");
    }

    console.log("CURRENT STUDENT PENALTY STATE:");

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
    console.error("Error:", error);
  } finally {
    await mongoose.disconnect();
  }
}

main();