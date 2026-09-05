const mongoose = require("mongoose");


/*
  ============================================================
  BOOKING MODEL
  ============================================================

  Booking lifecycle:

    pending
      ↓
    accepted
      ↓
    room_assignment_pending
      ↓
    room_assigned
      ↓
    checked-in
      ↓
    checked-out


  Cancellation can happen before check-in.


  IMPORTANT:

  A student requests:

    PG + sharing type + check-in date

  The student does NOT choose a room during booking.

  The owner first accepts the booking.

  The owner then PROPOSES a room.

  The student must explicitly ACCEPT that room.

  Only after student acknowledgement does the
  booking become room_assigned.
*/


const bookingSchema = new mongoose.Schema(
  {
    /*
      ========================================================
      STUDENT
      ========================================================
    */

    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },


    /*
      ========================================================
      PG
      ========================================================
    */

    pg: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PG",
      required: true,
    },


    /*
      ========================================================
      REQUESTED SHARING
      ========================================================
    */

    requestedSharing: {
      type: Number,
      required: true,
      min: 1,
    },


    /*
      ========================================================
      REQUESTED RENT

      Snapshot of the price at booking time.
      ========================================================
    */

    requestedRent: {
      type: Number,
      required: true,
      min: 0,
    },


    /*
      ========================================================
      ROOM
      ========================================================

      IMPORTANT:

      This field represents the room being proposed
      or officially assigned.

      When status is:

        accepted:
          room = null

        room_assignment_pending:
          room = proposed room

        room_assigned:
          room = student-accepted room
    */

    room: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Room",
      default: null,
    },


    /*
      ========================================================
      STATUS
      ========================================================

      pending:
        Student submitted booking.

      accepted:
        Owner accepted the student.
        No room has been proposed yet.

      room_assignment_pending:
        Owner proposed a room.
        Student has NOT accepted it yet.

      room_assigned:
        Student explicitly accepted the proposed room.

      rejected:
        Owner rejected the request.

      cancelled:
        Booking was cancelled.

      owner_cancellation_pending:
        Owner wants to cancel an already
        student-accepted room assignment.
        Student can respond.

      owner_cancelled:
        Owner cancellation was confirmed as
        NOT mutual by the student.

      mutual_cancelled:
        Both sides agreed to cancel.

      checked-in:
        Student actually moved in.

      checked-out:
        Student left the PG.

      superseded:
        Student selected another PG and room.

        This is NOT a student cancellation.

        Therefore:

          no student cooldown
          no cancellation count
          no owner strike
    */

    status: {
      type: String,

      enum: [
        "pending",
        "accepted",
        "room_assignment_pending",
        "room_assigned",
        "rejected",
        "cancelled",
        "owner_cancellation_pending",
        "owner_cancelled",
        "mutual_cancelled",
        "checked-in",
        "checked-out",
        "superseded",
      ],

      default: "pending",
    },


    /*
      ========================================================
      REQUESTED CHECK-IN DATE
      ========================================================
    */

    requestedCheckInDate: {
      type: Date,
      default: null,
    },


    /*
      ========================================================
      ACTUAL CHECK-IN DATE
      ========================================================
    */

    actualCheckInDate: {
      type: Date,
      default: null,
    },


    /*
      ========================================================
      ACTUAL CHECK-OUT DATE
      ========================================================
    */

    actualCheckOutDate: {
      type: Date,
      default: null,
    },


    /*
      ========================================================
      OWNER RESPONSE
      ========================================================
    */

    respondedAt: {
      type: Date,
      default: null,
    },


    /*
      ========================================================
      OWNER NOTE
      ========================================================
    */

    ownerNote: {
      type: String,
      trim: true,
      default: "",
    },


    /*
      ========================================================
      ROOM PROPOSAL
      ========================================================

      These fields record the owner's proposal separately
      from the student's acknowledgement.

      This is important for dispute handling.

      Example:

        owner proposes Room 201
        student declines

      The proposal remains auditable.
    */

    roomAssignmentProposedAt: {
      type: Date,
      default: null,
    },


    /*
      ========================================================
      ROOM PROPOSAL EXPIRY
      ========================================================

      A room proposal cannot remain pending forever.

      The backend sets this when the owner proposes
      a room.

      If the student does not respond before this
      timestamp, the proposal expires.

      Expiration is NOT a cancellation and does NOT
      trigger a student cooldown.
    */

    roomAssignmentExpiresAt: {
      type: Date,
      default: null,
    },


    /*
      ========================================================
      STUDENT ROOM RESPONSE
      ========================================================

      null:
        Student has not responded.

      accepted:
        Student accepted the proposed room.

      declined:
        Student declined the proposed room.
    */

    roomAssignmentResponse: {
      type: String,

      enum: [
        "accepted",
        "declined",
        null,
      ],

      default: null,
    },


    /*
      ========================================================
      STUDENT RESPONSE TIMESTAMP
      ========================================================
    */

    roomAssignmentRespondedAt: {
      type: Date,
      default: null,
    },


    /*
      ========================================================
      ROOM ACCEPTED TIMESTAMP
      ========================================================

      This is the exact point at which the student
      acknowledges responsibility for the room.

      Cancellation penalties related to an assigned
      room should only become relevant after this point.
    */

    roomAssignmentAcceptedAt: {
      type: Date,
      default: null,
    },


    /*
      ========================================================
      ROOM DECLINED TIMESTAMP
      ========================================================
    */

    roomAssignmentDeclinedAt: {
      type: Date,
      default: null,
    },


    /*
      ========================================================
      CANCELLATION INFORMATION
      ========================================================
    */

    cancelledBy: {
      type: String,

      enum: [
        "student",
        "owner",
        null,
      ],

      default: null,
    },


    cancelledAt: {
      type: Date,
      default: null,
    },


    cancellationReason: {
      type: String,
      trim: true,
      default: "",
    },


    /*
      ========================================================
      MUTUAL CANCELLATION
      ========================================================

      true means both parties agreed.

      This means:

        no student cooldown
        no owner strike
    */

    mutualCancellation: {
      type: Boolean,
      default: false,
    },


    /*
      ========================================================
      STUDENT RESPONSE TO OWNER CANCELLATION
      ========================================================

      null:
        Student has not answered yet.

      true:
        Student says cancellation was mutual.

      false:
        Student says cancellation was NOT agreed.
    */

    studentConfirmedCancellation: {
      type: Boolean,
      default: null,
    },


    /*
      ========================================================
      STUDENT COOLDOWN
      ========================================================

      Only used when a student's cancellation
      actually counts as a booking incident.

      IMPORTANT:

      First room-assigned cancellation:

        warning only
        no cooldown

      Second:

        12 hours

      Third:

        14 hours

      Fourth:

        16 hours

      Each later cancellation:

        +2 hours
    */

    cooldownUntil: {
      type: Date,
      default: null,
    },


    /*
      ========================================================
      COOLDOWN REASON
      ========================================================
    */

    cooldownReason: {
      type: String,
      trim: true,
      default: "",
    },


    /*
      ========================================================
      OWNER ACCOUNTABILITY
      ========================================================

      True when an owner-caused cancellation has
      been counted as a strike.
    */

    ownerStrikeApplied: {
      type: Boolean,
      default: false,
    },

  },

  {
    timestamps: true,
  }
);


/*
  ============================================================
  INDEXES
  ============================================================
*/


bookingSchema.index({
  student: 1,
  createdAt: -1,
});


bookingSchema.index({
  pg: 1,
  status: 1,
  createdAt: -1,
});


bookingSchema.index({
  room: 1,
  status: 1,
});


module.exports =
  mongoose.model(
    "Booking",
    bookingSchema
  );