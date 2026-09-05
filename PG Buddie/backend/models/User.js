const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    // Never store the real password.
    // We store a bcrypt hash.
    passwordHash: {
      type: String,
      required: true,
    },

    role: {
      type: String,
      enum: ["student", "owner", "admin"],
      required: true,
      default: "student",
    },

    phone: {
      type: String,
      required: true,
      trim: true,
    },

    // Only used for student accounts.
    college: {
      type: String,
      trim: true,
    },

    location: {
      type: String,
      trim: true,
    },

    // ============================================================
    // STUDENT ROOM-ASSIGNED CANCELLATION ACCOUNTABILITY
    // ============================================================

    /*
      Number of times the student cancelled AFTER
      explicitly accepting a room assignment.

      Important:

      - Normal booking cancellation does NOT increase this.
      - Declining a proposed room does NOT increase this.
      - Expired room proposals do NOT increase this.
      - Automatically superseded bookings do NOT increase this.

      Only a student cancellation of a booking whose
      status was "room_assigned" increases this counter.
    */
    assignedRoomCancellationCount: {
      type: Number,
      min: 0,
      default: 0,
    },

    /*
      When the student's most recent room-assigned
      cancellation occurred.

      Used for accountability/history.
    */
    lastAssignedRoomCancellationAt: {
      type: Date,
      default: null,
    },

    // ============================================================
    // BOOKING COOLDOWN
    // ============================================================

    /*
      If a student reaches the cooldown threshold,
      they cannot create a new booking until this time.

      null = no active cooldown.
    */
    bookingCooldownUntil: {
      type: Date,
      default: null,
    },

    /*
      Why the current cooldown exists.

      Example:
        "student_room_assigned_cancellation"

      Empty string = no active cooldown.
    */
    bookingCooldownReason: {
      type: String,
      trim: true,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("User", userSchema);