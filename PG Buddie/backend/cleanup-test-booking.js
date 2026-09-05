require("dotenv").config();

const mongoose = require("mongoose");

const Booking = require("./models/Booking");
const Room = require("./models/Room");

const BOOKING_ID =
  "6a8c82ad1cae078e4d976bb0";

async function cleanup() {
  try {
    await mongoose.connect(
      process.env.MONGODB_URI
    );

    console.log(
      "MongoDB connected."
    );

    // --------------------------------------------------------
    // FIND THE OLD TEST BOOKING
    // --------------------------------------------------------

    const booking =
      await Booking.findById(
        BOOKING_ID
      );

    if (!booking) {
      console.log(
        "Booking not found. Nothing to clean."
      );

      return;
    }

    console.log(
      "Found booking:",
      booking._id.toString()
    );

    console.log(
      "Current status:",
      booking.status
    );

    console.log(
      "Assigned room:",
      booking.room
        ? booking.room.toString()
        : "none"
    );


    // --------------------------------------------------------
    // RELEASE ASSIGNED ROOM
    // --------------------------------------------------------

    if (booking.room) {

      const room =
        await Room.findById(
          booking.room
        );

      if (room) {

        console.log(
          `Room ${room.roomNumber} occupied beds before cleanup:`,
          room.occupiedBeds
        );

        room.occupiedBeds =
          Math.max(
            room.occupiedBeds - 1,
            0
          );

        if (
          room.status !==
          "maintenance"
        ) {
          room.status =
            room.occupiedBeds >=
            room.capacity
              ? "full"
              : "available";
        }

        await room.save();

        console.log(
          `Room ${room.roomNumber} occupied beds after cleanup:`,
          room.occupiedBeds
        );

        console.log(
          `Room ${room.roomNumber} status:`,
          room.status
        );

      } else {

        console.log(
          "Assigned room was not found."
        );

      }
    }


    // --------------------------------------------------------
    // DELETE ONLY THE OLD TEST BOOKING
    // --------------------------------------------------------

    await Booking.findByIdAndDelete(
      BOOKING_ID
    );

    console.log(
      "Old test booking deleted."
    );

  } catch (error) {

    console.error(
      "Cleanup failed:"
    );

    console.error(
      error
    );

  } finally {

    await mongoose.disconnect();

    console.log(
      "MongoDB disconnected."
    );

  }
}


cleanup();