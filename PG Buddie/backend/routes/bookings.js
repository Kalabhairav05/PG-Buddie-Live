console.log("🔥 LOADED BOOKINGS ROUTE FILE:", __filename);
const express = require("express");
const mongoose = require("mongoose");

const Booking = require("../models/Booking");
const PG = require("../models/PG");
const Room = require("../models/Room");
const User = require("../models/User");

const authenticateToken = require("../middleware/auth");

const router = express.Router();


// ============================================================
// CONFIGURATION
// ============================================================

/*
  How long a student has to respond to a room proposal.

  Example:

    Owner proposes at 10:00 AM
    Proposal expires at 10:00 AM next day
*/

const ROOM_PROPOSAL_HOURS = 24;


// ============================================================
// OWNER-ONLY MIDDLEWARE
// ============================================================

function requireOwner(req, res, next) {

  if (req.user.role !== "owner") {

    return res.status(403).json({
      message: "Owner access required.",
    });

  }

  next();
}


// ============================================================
// STUDENT-ONLY MIDDLEWARE
// ============================================================

function requireStudent(req, res, next) {

  if (req.user.role !== "student") {

    return res.status(403).json({
      message: "Student access required.",
    });

  }

  next();
}


// ============================================================
// CREATE BOOKING
// ============================================================
// POST /api/bookings
//
// Student requests:
//
// {
//   pgId: "...",
//   requestedSharing: 4,
//   requestedCheckInDate: "2026-09-01"
// }
//
// IMPORTANT:
//
// A student MAY have active booking requests at
// MULTIPLE different PGs.
//
// But a student may have only ONE active booking
// at the SAME PG.
//
// Student does NOT choose a room.
// ============================================================

router.post(
  "/",
  authenticateToken,
  requireStudent,

  async (req, res) => {

    try {

      const {
        pgId,
        requestedSharing,
        requestedCheckInDate,
      } = req.body;


      // --------------------------------------------------------
      // BASIC VALIDATION
      // --------------------------------------------------------

      if (
        !pgId ||
        requestedSharing === undefined
      ) {

        return res.status(400).json({
          message:
            "PG and sharing type are required.",
        });

      }


      if (
        !mongoose.Types.ObjectId.isValid(pgId)
      ) {

        return res.status(400).json({
          message:
            "Invalid PG ID.",
        });

      }


      // --------------------------------------------------------
      // CHECK STUDENT
      // --------------------------------------------------------

      const student =
        await User.findById(
          req.user.userId
        );


      if (!student) {

        return res.status(404).json({
          message:
            "Student account not found.",
        });

      }


      // --------------------------------------------------------
      // CHECK STUDENT COOLDOWN
      // --------------------------------------------------------






      if (
        student.bookingCooldownUntil &&
        student.bookingCooldownUntil > new Date()
      ) {

        return res.status(429).json({

          message:
            "You are temporarily unable to make a new booking because of a recent room-assigned cancellation.",

          cooldownUntil:
            student.bookingCooldownUntil,

        });

      }


      // --------------------------------------------------------
      // VALIDATE SHARING
      // --------------------------------------------------------

      const sharing =
        Number(requestedSharing);


      if (
        !Number.isInteger(sharing) ||
        sharing < 1
      ) {

        return res.status(400).json({
          message:
            "Invalid room-sharing type.",
        });

      }


      // --------------------------------------------------------
      // FIND PG
      // --------------------------------------------------------

      const pg =
        await PG.findOne({
          _id: pgId,
          isActive: true,
        });


      if (!pg) {

        return res.status(404).json({
          message:
            "PG not found or no longer available.",
        });

      }


      // --------------------------------------------------------
      // FIND ROOM TYPE
      // --------------------------------------------------------

      const roomType =
        pg.roomTypes.find(
          (type) =>
            Number(type.sharing) === sharing
        );


      if (!roomType) {

        return res.status(400).json({
          message:
            "This sharing type is not available at this PG.",
        });

      }


      // --------------------------------------------------------
      // CHECK CURRENT AVAILABILITY
      // --------------------------------------------------------
      //
      // This is only a basic availability check.
      //
      // We do NOT reserve a room here.
      // --------------------------------------------------------

      const availableRoom =
        await Room.findOne({
          pg: pg._id,
          sharingType: sharing,
          status: "available",

          $expr: {
            $lt: [
              "$occupiedBeds",
              "$capacity",
            ],
          },

        });


      if (!availableRoom) {

        return res.status(409).json({
          message:
            "No bed is currently available for this sharing type.",
        });

      }


      // --------------------------------------------------------
      // PREVENT DUPLICATE ACTIVE BOOKING
      // AT THE SAME PG
      // --------------------------------------------------------
      //
      // IMPORTANT:
      //
      // We deliberately DO NOT prevent bookings at
      // other PGs.
      //
      // Example:
      //
      // PG A → active booking
      // PG B → active booking
      // PG C → active booking
      //
      // This is allowed.
      // --------------------------------------------------------

      const existingBooking =
        await Booking.findOne({

          student:
            req.user.userId,

          pg:
            pg._id,

          status: {
            $in: [
              "pending",
              "accepted",
              "room_assignment_pending",
              "room_assigned",
              "checked-in",
            ],
          },

        });


      if (existingBooking) {

        return res.status(409).json({
          message:
            "You already have an active booking at this PG.",
        });

      }


      // --------------------------------------------------------
      // CHECK-IN DATE
      // --------------------------------------------------------

      let checkInDate = null;


      if (requestedCheckInDate) {

        const parsedDate =
          new Date(
            requestedCheckInDate
          );


        if (
          Number.isNaN(
            parsedDate.getTime()
          )
        ) {

          return res.status(400).json({
            message:
              "Invalid check-in date.",
          });

        }


        checkInDate =
          parsedDate;

      }


      // --------------------------------------------------------
      // CREATE BOOKING
      // --------------------------------------------------------

      const booking =
        await Booking.create({

          student:
            req.user.userId,

          pg:
            pg._id,

          requestedSharing:
            sharing,

          requestedRent:
            roomType.rent,

          room:
            null,

          status:
            "pending",

          requestedCheckInDate:
            checkInDate,

        });


      // --------------------------------------------------------
      // LOAD RESPONSE DATA
      // --------------------------------------------------------

      await booking.populate([

        {
          path: "pg",

          select:
            "name address city phone roomTypes",
        },

        {
          path: "student",

          select:
            "name email phone college",
        },

      ]);


      return res.status(201).json({

        message:
          "Booking request submitted successfully.",

        booking,

      });


    } catch (error) {

      console.error(
        "Create booking error:",
        error
      );


      return res.status(500).json({
        message:
          "Unable to create booking.",
      });

    }

  }
);


// ============================================================
// GET MY BOOKINGS
// ============================================================
// GET /api/bookings/my
// ============================================================

router.get(
  "/my",
  authenticateToken,
  requireStudent,

  async (req, res) => {

    try {

      const bookings =
        await Booking.find({

          student:
            req.user.userId,

        })

        .populate({

          path: "pg",

          select:
            "name address city phone roomTypes",

        })

        .populate({

          path: "room",

          select:
            "roomNumber sharingType rent capacity occupiedBeds status",

        })

        .sort({

          createdAt: -1,

        });


      return res.status(200).json({
        bookings,
      });


    } catch (error) {

      console.error(
        "Get student bookings error:",
        error
      );


      return res.status(500).json({
        message:
          "Unable to load your bookings.",
      });

    }

  }
);


// ============================================================
// GET OWNER BOOKING REQUESTS
// ============================================================
// GET /api/bookings/requests
// ============================================================

router.get(
  "/requests",
  authenticateToken,
  requireOwner,

  async (req, res) => {

    try {

      const ownerPGs =
        await PG.find({

          owner:
            req.user.userId,

          isActive:
            true,

        }).select("_id");


      const pgIds =
        ownerPGs.map(
          (pg) => pg._id
        );


      const bookings =
        await Booking.find({

          pg: {
            $in: pgIds,
          },

        })

        .populate({

          path: "student",

          select:
            "name email phone college",

        })

        .populate({

          path: "pg",

          select:
            "name address city roomTypes",

        })

        .populate({

          path: "room",

          select:
            "roomNumber sharingType rent capacity occupiedBeds status",

        })

        .sort({

          createdAt: -1,

        });


      return res.status(200).json({
        bookings,
      });


    } catch (error) {

      console.error(
        "Get owner booking requests error:",
        error
      );


      return res.status(500).json({
        message:
          "Unable to load booking requests.",
      });

    }

  }
);


// ============================================================
// ACCEPT BOOKING
// ============================================================
// PATCH /api/bookings/:id/accept
//
// pending
//    ↓
// accepted
//
// Accepting a booking DOES NOT assign a room.
//
// A student may be accepted by multiple PGs.
// ============================================================

router.patch(
  "/:id/accept",
  authenticateToken,
  requireOwner,

  async (req, res) => {

    try {

      if (
        !mongoose.Types.ObjectId.isValid(
          req.params.id
        )
      ) {

        return res.status(400).json({
          message:
            "Invalid booking ID.",
        });

      }


      const booking =
        await Booking.findById(
          req.params.id
        );


      if (!booking) {

        return res.status(404).json({
          message:
            "Booking not found.",
        });

      }


      // --------------------------------------------------------
      // VERIFY OWNER
      // --------------------------------------------------------

      const pg =
        await PG.findOne({

          _id:
            booking.pg,

          owner:
            req.user.userId,

          isActive:
            true,

        });


      if (!pg) {

        return res.status(403).json({
          message:
            "You do not own this PG.",
        });

      }


      // --------------------------------------------------------
      // BOOKING MUST BE PENDING
      // --------------------------------------------------------

      if (
        booking.status !== "pending"
      ) {

        return res.status(409).json({
          message:
            "Only pending bookings can be accepted.",
        });

      }


      // --------------------------------------------------------
      // CHECK PG RESTRICTION
      // --------------------------------------------------------

      if (
        pg.bookingRestrictedUntil &&
        pg.bookingRestrictedUntil > new Date()
      ) {

        return res.status(403).json({

          message:
            "This PG is temporarily restricted from accepting new bookings.",

          restrictedUntil:
            pg.bookingRestrictedUntil,

        });

      }


      // --------------------------------------------------------
      // ACCEPT
      // --------------------------------------------------------

      booking.status =
        "accepted";


      booking.respondedAt =
        new Date();


      booking.ownerNote =
        String(
          req.body.ownerNote || ""
        ).trim();


      // No room assigned yet.
      booking.room =
        null;


      await booking.save();


      // --------------------------------------------------------
      // RESPONSE
      // --------------------------------------------------------

      await booking.populate([

        {
          path: "student",

          select:
            "name email phone college",

        },

        {
          path: "pg",

          select:
            "name address city",

        },

      ]);


      return res.status(200).json({

        message:
          "Booking accepted. Room can be proposed later.",

        booking,

      });


    } catch (error) {

      console.error(
        "Accept booking error:",
        error
      );


      return res.status(500).json({
        message:
          "Unable to accept booking.",
      });

    }

  }
);


// ============================================================
// PROPOSE ROOM
// ============================================================
// PATCH /api/bookings/:id/propose-room
//
// Body:
//
// {
//   roomId: "...",
//   ownerNote: "Room 201 is available."
// }
//
// accepted
//    ↓
// room_assignment_pending
//
// IMPORTANT:
//
// This is ONLY A PROPOSAL.
//
// It does NOT increase room occupancy.
//
// The student must explicitly accept it.
// ============================================================

router.patch(
  "/:id/propose-room",
  authenticateToken,
  requireOwner,

  async (req, res) => {

    try {

      const {
        roomId,
        ownerNote,
      } = req.body;


      // --------------------------------------------------------
      // VALIDATE IDS
      // --------------------------------------------------------

      if (
        !mongoose.Types.ObjectId.isValid(
          req.params.id
        )
      ) {

        return res.status(400).json({
          message:
            "Invalid booking ID.",
        });

      }


      if (
        !roomId ||
        !mongoose.Types.ObjectId.isValid(
          roomId
        )
      ) {

        return res.status(400).json({
          message:
            "A valid room ID is required.",
        });

      }


      // --------------------------------------------------------
      // FIND BOOKING
      // --------------------------------------------------------

      const booking =
        await Booking.findById(
          req.params.id
        );


      if (!booking) {

        return res.status(404).json({
          message:
            "Booking not found.",
        });

      }


      // --------------------------------------------------------
      // BOOKING MUST BE ACCEPTED
      // --------------------------------------------------------

      if (
        booking.status !== "accepted"
      ) {

        return res.status(409).json({
          message:
            "A room can only be proposed after the booking has been accepted.",
        });

      }


      // --------------------------------------------------------
      // VERIFY OWNER
      // --------------------------------------------------------

      const pg =
        await PG.findOne({

          _id:
            booking.pg,

          owner:
            req.user.userId,

          isActive:
            true,

        });


      if (!pg) {

        return res.status(403).json({
          message:
            "You do not own this PG.",
        });

      }


      // --------------------------------------------------------
      // MAKE SURE STUDENT HAS NOT ALREADY
      // CHOSEN ANOTHER PG
      // --------------------------------------------------------

      const existingAssignment =
        await Booking.findOne({

          student:
            booking.student,

          status: {
            $in: [
              "room_assigned",
              "checked-in",
            ],
          },

          room: {
            $ne: null,
          },

          _id: {
            $ne: booking._id,
          },

        });


      if (existingAssignment) {

        return res.status(409).json({
          message:
            "This student has already selected another PG and room.",
        });

      }


      // --------------------------------------------------------
      // FIND ROOM
      // --------------------------------------------------------

      const room =
        await Room.findOne({

          _id:
            roomId,

          pg:
            pg._id,

        });


      if (!room) {

        return res.status(404).json({
          message:
            "Room not found in this PG.",
        });

      }


      // --------------------------------------------------------
      // VERIFY SHARING TYPE
      // --------------------------------------------------------

      if (
        Number(room.sharingType) !==
        Number(booking.requestedSharing)
      ) {

        return res.status(409).json({

          message:
            `Room ${room.roomNumber} is not a ${booking.requestedSharing}-sharing room.`,

        });

      }


      // --------------------------------------------------------
      // ROOM MUST NOT BE UNDER MAINTENANCE
      // --------------------------------------------------------

      if (
        room.status === "maintenance"
      ) {

        return res.status(409).json({
          message:
            "This room is currently under maintenance.",
        });

      }


      // --------------------------------------------------------
      // ROOM MUST HAVE A FREE BED
      // --------------------------------------------------------

      if (
        room.occupiedBeds >=
        room.capacity
      ) {

        return res.status(409).json({
          message:
            "This room is already full.",
        });

      }


      // --------------------------------------------------------
      // CREATE PROPOSAL
      // --------------------------------------------------------

      const proposedAt =
        new Date();


      const expiresAt =
        new Date(

          proposedAt.getTime() +
          ROOM_PROPOSAL_HOURS *
          60 *
          60 *
          1000

        );


      booking.room =
        room._id;


      booking.status =
        "room_assignment_pending";


      booking.roomAssignmentProposedAt =
        proposedAt;


      booking.roomAssignmentExpiresAt =
        expiresAt;


      booking.roomAssignmentResponse =
        null;


      booking.roomAssignmentRespondedAt =
        null;


      booking.roomAssignmentAcceptedAt =
        null;


      booking.roomAssignmentDeclinedAt =
        null;


      booking.ownerNote =
        String(

          ownerNote ||
          `Room ${room.roomNumber} proposed.`

        ).trim();


      await booking.save();


      // --------------------------------------------------------
      // RESPONSE
      // --------------------------------------------------------

      await booking.populate([

        {
          path: "student",

          select:
            "name email phone college",

        },

        {
          path: "pg",

          select:
            "name address city",

        },

        {
          path: "room",

          select:
            "roomNumber sharingType rent capacity occupiedBeds status",

        },

      ]);


      return res.status(200).json({

        message:
          "Room proposed. Waiting for student acknowledgement.",

        booking,

      });


    } catch (error) {

      console.error(
        "Propose room error:",
        error
      );


      return res.status(500).json({
        message:
          "Unable to propose room.",
      });

    }

  }
);


// ============================================================
// STUDENT ACCEPTS PROPOSED ROOM
// ============================================================
// PATCH /api/bookings/:id/accept-room
//
// room_assignment_pending
//          ↓
// room_assigned
//
// THIS is the commitment point.
//
// At this exact point:
//
// 1. Student explicitly accepts room.
// 2. Room occupancy increases.
// 3. Booking becomes room_assigned.
// 4. All competing student bookings are superseded.
// 5. Those superseded bookings do NOT count as cancellations.
//
// This entire operation happens in ONE transaction.
// ============================================================

router.patch(
  "/:id/accept-room",
  authenticateToken,
  requireStudent,

  async (req, res) => {

    const session =
      await mongoose.startSession();


    try {

      if (
        !mongoose.Types.ObjectId.isValid(
          req.params.id
        )
      ) {

        await session.endSession();

        return res.status(400).json({
          message:
            "Invalid booking ID.",
        });

      }


      session.startTransaction();


      // --------------------------------------------------------
      // FIND STUDENT BOOKING
      // --------------------------------------------------------

      const booking =
        await Booking.findOne({

          _id:
            req.params.id,

          student:
            req.user.userId,

          status:
            "room_assignment_pending",

        })
        .session(session);


      if (!booking) {

        await session.abortTransaction();
        await session.endSession();

        return res.status(404).json({
          message:
            "No pending room proposal was found.",
        });

      }


      // --------------------------------------------------------
      // CHECK PROPOSAL EXPIRY
      // --------------------------------------------------------

      if (
        booking.roomAssignmentExpiresAt &&
        booking.roomAssignmentExpiresAt <=
          new Date()
      ) {

        /*
          The proposal has expired.

          We return the booking to "accepted".

          This is NOT a cancellation.
          No cooldown.
          No student penalty.
        */

        booking.status =
          "accepted";


        booking.room =
          null;


        booking.roomAssignmentResponse =
          null;


        booking.roomAssignmentRespondedAt =
          null;


        await booking.save({
          session,
        });


        await session.commitTransaction();
        await session.endSession();


        return res.status(409).json({

          message:
            "This room proposal has expired. Please wait for another room proposal.",

          booking,

        });

      }


      // --------------------------------------------------------
      // ROOM MUST EXIST
      // --------------------------------------------------------

      if (!booking.room) {

        await session.abortTransaction();
        await session.endSession();

        return res.status(409).json({
          message:
            "This room proposal is no longer valid.",
        });

      }


      // --------------------------------------------------------
      // FIND ROOM
      // --------------------------------------------------------

      const room =
        await Room.findOne({

          _id:
            booking.room,

          pg:
            booking.pg,

        })
        .session(session);


      if (!room) {

        await session.abortTransaction();
        await session.endSession();

        return res.status(404).json({
          message:
            "The proposed room no longer exists.",
        });

      }


      // --------------------------------------------------------
      // VERIFY SHARING TYPE
      // --------------------------------------------------------

      if (
        Number(room.sharingType) !==
        Number(booking.requestedSharing)
      ) {

        await session.abortTransaction();
        await session.endSession();

        return res.status(409).json({
          message:
            "The proposed room no longer matches your requested sharing type.",
        });

      }


      // --------------------------------------------------------
      // ROOM MUST NOT BE UNDER MAINTENANCE
      // --------------------------------------------------------

      if (
        room.status === "maintenance"
      ) {

        await session.abortTransaction();
        await session.endSession();

        return res.status(409).json({
          message:
            "This room is currently under maintenance and cannot be assigned.",
        });

      }


      // --------------------------------------------------------
      // ROOM MUST STILL HAVE FREE BED
      // --------------------------------------------------------

      if (
        room.occupiedBeds >=
        room.capacity
      ) {

        await session.abortTransaction();
        await session.endSession();

        return res.status(409).json({
          message:
            "Unfortunately, this room is no longer available.",
        });

      }


      // --------------------------------------------------------
      // CRITICAL:
      // MAKE SURE STUDENT DOES NOT ALREADY
      // HAVE ANOTHER ASSIGNED ROOM
      // --------------------------------------------------------

      const existingAssignment =
        await Booking.findOne({

          student:
            booking.student,

          status: {
            $in: [
              "room_assigned",
              "checked-in",
            ],
          },

          room: {
            $ne: null,
          },

          _id: {
            $ne: booking._id,
          },

        })
        .session(session);


      if (existingAssignment) {

        await session.abortTransaction();
        await session.endSession();

        return res.status(409).json({
          message:
            "You already have another assigned room.",
        });

      }


      // --------------------------------------------------------
      // STUDENT ACCEPTED THE ROOM
      // --------------------------------------------------------

      const now =
        new Date();


      booking.status =
        "room_assigned";


      booking.roomAssignmentResponse =
        "accepted";


      booking.roomAssignmentRespondedAt =
        now;


      booking.roomAssignmentAcceptedAt =
        now;


      // Proposal has now been consumed.
      booking.roomAssignmentExpiresAt =
        null;


      // --------------------------------------------------------
      // INCREASE OCCUPANCY
      // --------------------------------------------------------

      room.occupiedBeds += 1;


      // --------------------------------------------------------
      // UPDATE ROOM STATUS
      // --------------------------------------------------------

      if (
        room.occupiedBeds >=
        room.capacity
      ) {

        room.status =
          "full";

      } else {

        room.status =
          "available";

      }


      // --------------------------------------------------------
      // SAVE SELECTED BOOKING + ROOM
      // --------------------------------------------------------

      await booking.save({
        session,
      });


      await room.save({
        session,
      });


      // --------------------------------------------------------
      // AUTOMATICALLY CLOSE COMPETING BOOKINGS
      // --------------------------------------------------------
      //
      // IMPORTANT:
      //
      // These are NOT student cancellations.
      //
      // They are being closed because the student has
      // officially selected another PG.
      //
      // Therefore:
      //
      // - no cooldown
      // - no cancellation count
      // - no penalty
      // - no owner strike
      //
      // Also:
      //
      // Any other room proposal is withdrawn.
      // Since proposal never increased occupancy,
      // there is normally no room occupancy to release.
      // --------------------------------------------------------

      await Booking.updateMany(

        {

          student:
            booking.student,

          _id: {
            $ne: booking._id,
          },

          status: {
            $in: [
              "pending",
              "accepted",
              "room_assignment_pending",
            ],
          },

        },

        {

          $set: {

            status:
              "superseded",

            cancelledBy:
              null,

            cancelledAt:
              null,

            cancellationReason:
              "Booking superseded because the student accepted a room at another PG.",

            mutualCancellation:
              false,

            studentConfirmedCancellation:
              null,

            cooldownUntil:
              null,

            cooldownReason:
              "",

            ownerStrikeApplied:
              false,

            /*
              We deliberately preserve the room reference
              for historical audit if there was a proposal.

              Because room_assignment_pending never increased
              occupiedBeds, no occupancy decrement is needed.
            */

          },

        },

        {
          session,
        }

      );


      // --------------------------------------------------------
      // COMMIT
      // --------------------------------------------------------

      await session.commitTransaction();
      await session.endSession();


      // --------------------------------------------------------
      // LOAD RESPONSE DATA
      // --------------------------------------------------------

      await booking.populate([

        {
          path: "student",

          select:
            "name email phone college",

        },

        {
          path: "pg",

          select:
            "name address city",

        },

        {
          path: "room",

          select:
            "roomNumber sharingType rent capacity occupiedBeds status",

        },

      ]);


      return res.status(200).json({

        message:
          "Room accepted successfully. Your room is now officially assigned and your other active PG bookings have been closed.",

        booking,

      });


    } catch (error) {

      try {

        await session.abortTransaction();

      } catch (abortError) {

        console.error(
          "Accept room rollback error:",
          abortError
        );

      }


      await session.endSession();


      console.error(
        "Accept room error:",
        error
      );


      return res.status(500).json({
        message:
          "Unable to accept the room.",
      });

    }

  }
);


// ============================================================
// STUDENT DECLINES PROPOSED ROOM
// ============================================================
// PATCH /api/bookings/:id/decline-room
//
// room_assignment_pending
//          ↓
// accepted
//
// The student simply rejected that room.
//
// This is NOT cancellation.
//
// Therefore:
//
// - no cooldown
// - no cancellation count
// - no penalty
//
// The owner can propose another room later.
// ============================================================

router.patch(
  "/:id/decline-room",
  authenticateToken,
  requireStudent,

  async (req, res) => {

    try {

      if (
        !mongoose.Types.ObjectId.isValid(
          req.params.id
        )
      ) {

        return res.status(400).json({
          message:
            "Invalid booking ID.",
        });

      }


      const booking =
        await Booking.findOne({

          _id:
            req.params.id,

          student:
            req.user.userId,

          status:
            "room_assignment_pending",

        });


      if (!booking) {

        return res.status(404).json({
          message:
            "No pending room proposal was found.",
        });

      }


      // --------------------------------------------------------
      // CHECK EXPIRY
      // --------------------------------------------------------

      if (
        booking.roomAssignmentExpiresAt &&
        booking.roomAssignmentExpiresAt <=
          new Date()
      ) {

        booking.status =
          "accepted";


        booking.room =
          null;


        booking.roomAssignmentExpiresAt =
          null;


        booking.roomAssignmentResponse =
          null;


        booking.roomAssignmentRespondedAt =
          null;


        await booking.save();


        return res.status(409).json({

          message:
            "This room proposal has already expired.",

          booking,

        });

      }


      const now =
        new Date();


      booking.status =
        "accepted";


      booking.roomAssignmentResponse =
        "declined";


      booking.roomAssignmentRespondedAt =
        now;


      booking.roomAssignmentDeclinedAt =
        now;


      /*
        IMPORTANT:

        The student did NOT cancel the booking.

        They only declined the proposed room.

        Therefore:

          no cooldown
          no cancellation
          no penalty
      */


      booking.room =
        null;


      booking.roomAssignmentExpiresAt =
        null;


      booking.ownerNote =
        "";


      await booking.save();


      return res.status(200).json({

        message:
          "Room proposal declined. Your booking remains active, and you can be offered another room.",

        booking,

      });


    } catch (error) {

      console.error(
        "Decline room error:",
        error
      );


      return res.status(500).json({
        message:
          "Unable to decline the room proposal.",
      });

    }

  }
);


// ============================================================
// REJECT BOOKING
// ============================================================
// PATCH /api/bookings/:id/reject
// ============================================================

router.patch(
  "/:id/reject",
  authenticateToken,
  requireOwner,

  async (req, res) => {

    try {

      if (
        !mongoose.Types.ObjectId.isValid(
          req.params.id
        )
      ) {

        return res.status(400).json({
          message:
            "Invalid booking ID.",
        });

      }


      const booking =
        await Booking.findById(
          req.params.id
        );


      if (!booking) {

        return res.status(404).json({
          message:
            "Booking not found.",
        });

      }


      const pg =
        await PG.findOne({

          _id:
            booking.pg,

          owner:
            req.user.userId,

          isActive:
            true,

        });


      if (!pg) {

        return res.status(403).json({
          message:
            "You do not own this PG.",
        });

      }


      if (
        booking.status !==
        "pending"
      ) {

        return res.status(409).json({
          message:
            "This booking has already been processed.",
        });

      }


      booking.status =
        "rejected";


      booking.respondedAt =
        new Date();


      booking.ownerNote =
        String(
          req.body.ownerNote || ""
        ).trim();


      await booking.save();


      return res.status(200).json({

        message:
          "Booking rejected.",

        booking,

      });


    } catch (error) {

      console.error(
        "Reject booking error:",
        error
      );


      return res.status(500).json({
        message:
          "Unable to reject booking.",
      });

    }

  }
);


// ============================================================
// STUDENT CANCEL BOOKING
// ============================================================
// PATCH /api/bookings/:id/cancel
//
// Student can cancel:
//
//   pending
//   accepted
//   room_assignment_pending
//   room_assigned
//
// IMPORTANT:
//
// Declining a room proposal is NOT cancellation.
//
// If room_assignment_pending:
//   normal cancellation
//   NO cooldown
//
// If room_assigned:
//   room is released
//   student incident is recorded
//   cooldown is applied according to policy
//
// A booking that was automatically superseded can NEVER
// reach this route because its status is no longer active.
// ============================================================

router.patch(
  "/:id/cancel",
  authenticateToken,
  requireStudent,

  async (req, res) => {

    const session =
      await mongoose.startSession();


    try {

      if (
        !mongoose.Types.ObjectId.isValid(
          req.params.id
        )
      ) {

        await session.endSession();

        return res.status(400).json({
          message:
            "Invalid booking ID.",
        });

      }


      session.startTransaction();


      const booking =
        await Booking.findOne({

          _id:
            req.params.id,

          student:
            req.user.userId,

        })
        .session(session);


      if (!booking) {

        await session.abortTransaction();
        await session.endSession();

        return res.status(404).json({
          message:
            "Booking not found.",
        });

      }


      if (
        ![
          "pending",
          "accepted",
          "room_assignment_pending",
          "room_assigned",
        ].includes(
          booking.status
        )
      ) {

        await session.abortTransaction();
        await session.endSession();

        return res.status(409).json({
          message:
            "This booking cannot be cancelled now.",
        });

      }


      const wasRoomAssigned =
        booking.status ===
        "room_assigned";


      // --------------------------------------------------------
      // RELEASE ROOM ONLY IF STUDENT HAD ACCEPTED IT
      // --------------------------------------------------------

      if (
        wasRoomAssigned &&
        booking.room
      ) {

        const room =
          await Room.findById(
            booking.room
          )
          .session(session);


        if (room) {

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


          await room.save({
            session,
          });

        }

      }


      // --------------------------------------------------------
      // UPDATE BOOKING
      // --------------------------------------------------------

      booking.status =
        "cancelled";


      booking.cancelledBy =
        "student";


      booking.cancelledAt =
        new Date();


      booking.cancellationReason =
        String(

          req.body.reason ||
          "Student cancelled the booking."

        ).trim();


      booking.mutualCancellation =
        false;


      // --------------------------------------------------------
      // APPLY ACCOUNTABILITY ONLY AFTER
      // STUDENT-ACCEPTED ROOM ASSIGNMENT
      // --------------------------------------------------------

      /*
        These variables are declared outside the
        student block because they are also needed
        when constructing the final response.
      */

      let cancellationCount = 0;
      let cooldownHours = 0;


      if (wasRoomAssigned) {

        const student =
          await User.findById(
            req.user.userId
          )
          .session(session);


        if (student) {

          // ----------------------------------------------------
          // INCREASE STUDENT CANCELLATION COUNT
          // ----------------------------------------------------

          student.assignedRoomCancellationCount =
            (
              student.assignedRoomCancellationCount ||
              0
            ) + 1;


          cancellationCount =
            student.assignedRoomCancellationCount;


          student.lastAssignedRoomCancellationAt =
            new Date();


          /*
            ====================================================
            GRADUATED STUDENT CANCELLATION POLICY
            ====================================================

            1st room-assigned cancellation:
              WARNING ONLY
              No cooldown.

            2nd:
              12 hours.

            3rd:
              14 hours.

            4th:
              16 hours.

            5th:
              18 hours.

            Every cancellation after the 2nd:
              +2 hours.

            Formula:

              cooldownHours =
                12 + ((count - 2) * 2)
          */


          if (
            cancellationCount >= 2
          ) {

            cooldownHours =
              12 +
              (
                (cancellationCount - 2) *
                2
              );


            const cooldownUntil =
              new Date(

                Date.now() +
                cooldownHours *
                60 *
                60 *
                1000

              );


            booking.cooldownUntil =
              cooldownUntil;


            booking.cooldownReason =
              "student_room_assigned_cancellation";


            student.bookingCooldownUntil =
              cooldownUntil;


            student.bookingCooldownReason =
              "student_room_assigned_cancellation";

          } else {

            /*
              FIRST CANCELLATION

              Warning only.

              No cooldown is applied.
            */

            booking.cooldownUntil =
              null;


            booking.cooldownReason =
              "";

          }


          await student.save({
            session,
          });

        }

      }


      await booking.save({
        session,
      });


      // --------------------------------------------------------
      // COMMIT
      // --------------------------------------------------------

      await session.commitTransaction();
      await session.endSession();


      // --------------------------------------------------------
      // RESPONSE MESSAGE
      // --------------------------------------------------------

      let message =
        "Booking cancelled successfully.";


      if (wasRoomAssigned) {

        if (
          cancellationCount === 1
        ) {

          message =
            "Booking cancelled. The room was released. This is your first room-assigned cancellation. No cooldown was applied, but repeated cancellations after accepting a room may temporarily restrict new bookings.";

        } else {

          message =
            `Booking cancelled. The room was released and a ${cooldownHours}-hour booking cooldown has been applied.`;

        }

      }


      return res.status(200).json({

        message,

        booking,

      });


    } catch (error) {

      try {

        await session.abortTransaction();

      } catch (abortError) {

        console.error(
          "Cancellation rollback error:",
          abortError
        );

      }


      await session.endSession();


      console.error(
        "Student cancellation error:",
        error
      );


      return res.status(500).json({
        message:
          "Unable to cancel booking.",
      });

    }

  }
);




// ============================================================
// STUDENT CONFIRMS ACTUAL CHECK-IN
// ============================================================
// PATCH /api/bookings/:id/check-in
//
// IMPORTANT:
//
// A booking becoming accepted or room_assigned is NOT a good
// booking event for owner reliability.
//
// Owner reliability improves ONLY after the student explicitly
// confirms actual check-in.
//
// room_assigned
//      ↓
// student confirms check-in
//      ↓
// checked-in
//      ↓
// ownerGoodBookingCount + 1
//      ↓
// gradual reliability recovery
//
// ============================================================

// ============================================================
// STUDENT CHECK-IN
// ============================================================
//
// IMPORTANT RELIABILITY RULE:
//
// A GOOD BOOKING IS COUNTED ONLY WHEN THE STUDENT ACTUALLY
// CHECKS IN.
//
// These DO NOT increase ownerGoodBookingCount:
//   - booking submitted
//   - booking accepted
//   - room proposed
//   - room assignment accepted
//
// ONLY THIS EVENT increases the good-booking count:
//   - actual student check-in
//
// Reliability recovery:
//   +0.25 per genuine completed check-in
//   maximum score = 100
//
// ============================================================

router.patch(
  "/:id/check-in",
  authenticateToken,
  requireStudent,

  async (req, res) => {

    const session =
      await mongoose.startSession();

    try {

      // --------------------------------------------------------
      // VALIDATE BOOKING ID
      // --------------------------------------------------------

      if (
        !mongoose.Types.ObjectId.isValid(
          req.params.id
        )
      ) {

        await session.endSession();

        return res.status(400).json({
          message:
            "Invalid booking ID.",
        });

      }


      // --------------------------------------------------------
      // START TRANSACTION
      // --------------------------------------------------------

      session.startTransaction();


      // --------------------------------------------------------
      // FIND BOOKING
      // --------------------------------------------------------
      //
      // Only the student who owns the booking can check in.
      //
      // The booking MUST be:
      //
      // room_assigned
      //
      // This prevents:
      //
      // pending                  ❌
      // accepted                 ❌
      // room_assignment_pending  ❌
      // room_assigned            ✅
      // checked-in               ❌
      //
      // --------------------------------------------------------

      const booking =
        await Booking.findOne({

          _id:
            req.params.id,

          student:
            req.user.userId,

          status:
            "room_assigned",

        })
        .session(session);


      if (!booking) {

        await session.abortTransaction();
        await session.endSession();

        return res.status(409).json({
          message:
            "Only a room-assigned booking can be checked in.",
        });

      }


      // --------------------------------------------------------
      // REQUIRE ASSIGNED ROOM
      // --------------------------------------------------------

      if (!booking.room) {

        await session.abortTransaction();
        await session.endSession();

        return res.status(409).json({
          message:
            "A room must be assigned before check-in.",
        });

      }


      // --------------------------------------------------------
      // FIND PG
      // --------------------------------------------------------

      const pg =
        await PG.findById(
          booking.pg
        )
        .session(session);


      if (!pg) {

        await session.abortTransaction();
        await session.endSession();

        return res.status(404).json({
          message:
            "PG not found.",
        });

      }


      // ========================================================
      // INITIALIZE RELIABILITY FIELDS SAFELY
      // ========================================================
      //
      // This ONLY initializes missing legacy fields.
      //
      // IMPORTANT:
      //
      // Existing numeric values are NEVER overwritten.
      //
      // Therefore:
      //
      // 99 stays 99
      // 99.25 stays 99.25
      // 100 stays 100
      //
      // ========================================================

      if (
        typeof pg.ownerReliabilityScore !==
        "number"
      ) {

        pg.ownerReliabilityScore =
          100;

      }


      if (
        typeof pg.ownerAccountabilityPoints !==
        "number"
      ) {

        pg.ownerAccountabilityPoints =
          0;

      }


      if (
        typeof pg.ownerProvenCancellationCount !==
        "number"
      ) {

        pg.ownerProvenCancellationCount =
          0;

      }


      if (
        typeof pg.ownerCancellationDisputeCount !==
        "number"
      ) {

        pg.ownerCancellationDisputeCount =
          0;

      }


      if (
        typeof pg.ownerGoodBookingCount !==
        "number"
      ) {

        pg.ownerGoodBookingCount =
          0;

      }


      // ========================================================
      // MARK ACTUAL CHECK-IN
      // ========================================================

      booking.status =
        "checked-in";


      booking.actualCheckInDate =
        new Date();


      // ========================================================
      // GOOD BOOKING EVENT
      // ========================================================
      //
      // THIS is the ONLY place where a successful booking
      // contributes to the owner's good-booking history.
      //
      // Booking creation       → NO
      // Owner acceptance       → NO
      // Room proposal          → NO
      // Room acceptance        → NO
      // Actual check-in        → YES
      //
      // ========================================================

      pg.ownerGoodBookingCount =
        Number(
          pg.ownerGoodBookingCount ?? 0
        ) + 1;


      // ========================================================
      // GRADUAL RELIABILITY RECOVERY
      // ========================================================
      //
      // Each genuine check-in:
      //
      //     +0.25
      //
      // Examples:
      //
      // 99.00  → 99.25
      // 99.25  → 99.50
      // 99.50  → 99.75
      // 99.75  → 100.00
      //
      // The score can NEVER exceed 100.
      //
      // We deliberately preserve two decimal places.
      //
      // ========================================================

      const reliabilityRecovery =
        0.25;


      pg.ownerReliabilityScore =
        Math.min(

          100,

          Math.round(

            (
              Number(
                pg.ownerReliabilityScore ?? 100
              ) +
              reliabilityRecovery
            ) * 100

          ) / 100

        );


      // ========================================================
      // SAVE BOOKING
      // ========================================================

      await booking.save({
        session,
      });


      // ========================================================
      // SAVE PG
      // ========================================================

      await pg.save({
        session,
      });


      // ========================================================
      // COMMIT
      // ========================================================

      await session.commitTransaction();

      await session.endSession();


      // ========================================================
      // RESPONSE
      // ========================================================

      return res.status(200).json({

        message:
          "Check-in recorded successfully. The PG reliability score has been updated based on a completed check-in.",

        booking,

        reliability: {

          ownerGoodBookingCount:
            pg.ownerGoodBookingCount,

          ownerReliabilityScore:
            pg.ownerReliabilityScore,

        },

      });


    } catch (error) {

      // --------------------------------------------------------
      // ROLLBACK
      // --------------------------------------------------------

      try {

        await session.abortTransaction();

      } catch (abortError) {

        console.error(
          "Check-in rollback error:",
          abortError
        );

      }


      await session.endSession();


      console.error(
        "Check-in error:",
        error
      );


      return res.status(500).json({

        message:
          "Unable to record check-in.",

      });

    }

  }
);


// ============================================================
// STUDENT CHECK-OUT
// ============================================================
//
// PATCH /api/bookings/:id/check-out
//
// Lifecycle:
//
// checked-in
//      ↓
// checked-out
//
// Checkout does:
//
//   1. Verify the booking belongs to the student
//   2. Require status = checked-in
//   3. Require an assigned room
//   4. Record actualCheckOutDate
//   5. Change booking status to checked-out
//   6. Release one occupied bed
//   7. Recalculate room status
//   8. Save everything atomically
//
// IMPORTANT RELIABILITY RULE:
//
// Checkout gives ZERO reliability points.
//
// Reliability is changed only by the actual check-in event.
//
// Therefore checkout does NOT modify:
//
//   ownerReliabilityScore
//   ownerGoodBookingCount
//   ownerAccountabilityPoints
//   ownerProvenCancellationCount
//   ownerCancellationDisputeCount
//   ownerCancellationStrikes
//
// ============================================================

router.patch(
  "/:id/check-out",
  authenticateToken,
  requireStudent,

  async (req, res) => {

    const session =
      await mongoose.startSession();

    try {

      // --------------------------------------------------------
      // VALIDATE BOOKING ID
      // --------------------------------------------------------

      if (
        !mongoose.Types.ObjectId.isValid(
          req.params.id
        )
      ) {

        await session.endSession();

        return res.status(400).json({
          message:
            "Invalid booking ID.",
        });

      }


      // --------------------------------------------------------
      // START TRANSACTION
      // --------------------------------------------------------

      session.startTransaction();


      // --------------------------------------------------------
      // FIND CHECKED-IN BOOKING
      // --------------------------------------------------------
      //
      // Only the student who owns the booking can check out.
      //
      // The booking MUST currently be:
      //
      // checked-in
      //
      // This prevents:
      //
      // pending       ❌
      // accepted      ❌
      // room assigned ❌
      // checked-in    ✅
      // checked-out   ❌
      //
      // --------------------------------------------------------

      const booking =
        await Booking.findOne({

          _id:
            req.params.id,

          student:
            req.user.userId,

          status:
            "checked-in",

        })
        .session(session);


      if (!booking) {

        await session.abortTransaction();
        await session.endSession();

        return res.status(409).json({
          message:
            "Only a checked-in booking can be checked out.",
        });

      }


      // --------------------------------------------------------
      // REQUIRE ASSIGNED ROOM
      // --------------------------------------------------------

      if (!booking.room) {

        await session.abortTransaction();
        await session.endSession();

        return res.status(409).json({
          message:
            "This booking has no assigned room.",
        });

      }


      // --------------------------------------------------------
      // FIND ROOM
      // --------------------------------------------------------

      const room =
        await Room.findById(
          booking.room
        )
        .session(session);


      if (!room) {

        await session.abortTransaction();
        await session.endSession();

        return res.status(404).json({
          message:
            "Assigned room could not be found.",
        });

      }


      // --------------------------------------------------------
      // VERIFY ROOM BELONGS TO BOOKING'S PG
      // --------------------------------------------------------

      if (
        String(room.pg) !==
        String(booking.pg)
      ) {

        await session.abortTransaction();
        await session.endSession();

        return res.status(409).json({
          message:
            "The assigned room does not belong to this PG.",
        });

      }


      // ========================================================
      // RECORD ACTUAL CHECK-OUT
      // ========================================================

      booking.actualCheckOutDate =
        new Date();


      booking.status =
        "checked-out";


      // ========================================================
      // RELEASE ONE OCCUPIED BED
      // ========================================================
      //
      // The bed was counted when the student accepted the room.
      //
      // Therefore checkout releases exactly one bed.
      //
      // Never allow occupiedBeds to become negative.
      //
      // ========================================================

      room.occupiedBeds =
        Math.max(
          0,
          Number(
            room.occupiedBeds ?? 0
          ) - 1
        );


      // ========================================================
      // UPDATE ROOM STATUS
      // ========================================================
      //
      // Maintenance remains maintenance.
      //
      // Otherwise:
      //
      // occupiedBeds >= capacity
      //      → full
      //
      // occupiedBeds < capacity
      //      → available
      //
      // ========================================================

      if (
        room.status !==
        "maintenance"
      ) {

        if (
          room.occupiedBeds >=
          room.capacity
        ) {

          room.status =
            "full";

        } else {

          room.status =
            "available";

        }

      }


      // ========================================================
      // IMPORTANT:
      // NO RELIABILITY CHANGE
      // ========================================================
      //
      // DO NOT modify:
      //
      // pg.ownerReliabilityScore
      // pg.ownerGoodBookingCount
      //
      // Checkout is purely a lifecycle/occupancy event.
      //
      // ========================================================


      // ========================================================
      // SAVE BOOKING
      // ========================================================

      await booking.save({
        session,
      });


      // ========================================================
      // SAVE ROOM
      // ========================================================

      await room.save({
        session,
      });


      // ========================================================
      // COMMIT TRANSACTION
      // ========================================================

      await session.commitTransaction();

      await session.endSession();


      // ========================================================
      // LOAD RESPONSE DATA
      // ========================================================

      await booking.populate([

        {
          path: "student",

          select:
            "name email phone college",
        },

        {
          path: "pg",

          select:
            "name address city",
        },

        {
          path: "room",

          select:
            "roomNumber sharingType rent capacity occupiedBeds status",
        },

      ]);


      // ========================================================
      // RESPONSE
      // ========================================================

      return res.status(200).json({

        message:
          "Check-out recorded successfully. The room bed has been released.",

        booking,

        room: {

          roomNumber:
            room.roomNumber,

          occupiedBeds:
            room.occupiedBeds,

          availableBeds:
            Math.max(
              room.capacity -
              room.occupiedBeds,
              0
            ),

          status:
            room.status,

        },

        reliability: {

          changed:
            false,

          reason:
            "Check-out does not change PG reliability.",

        },

      });


    } catch (error) {

      // --------------------------------------------------------
      // ROLLBACK
      // --------------------------------------------------------

      try {

        await session.abortTransaction();

      } catch (abortError) {

        console.error(
          "Check-out rollback error:",
          abortError
        );

      }


      await session.endSession();


      console.error(
        "Check-out error:",
        error
      );


      return res.status(500).json({

        message:
          "Unable to record check-out.",

      });

    }

  }
);







// ============================================================
// OWNER REQUESTS CANCELLATION
// ============================================================
// PATCH /api/bookings/:id/owner-cancel
//
// Owner can cancel an already assigned room.
//
// IMPORTANT:
//
// The room is released immediately.
//
// The student's YES/NO response is NOT required to
// authorize release of the owner's property.
//
// The response is used for accountability:
//
// YES → mutual
// NO  → owner-caused report
// ============================================================

router.patch(
  "/:id/owner-cancel",
  authenticateToken,
  requireOwner,

  async (req, res) => {

    const session =
      await mongoose.startSession();


    try {

      if (
        !mongoose.Types.ObjectId.isValid(
          req.params.id
        )
      ) {

        await session.endSession();

        return res.status(400).json({
          message:
            "Invalid booking ID.",
        });

      }


      session.startTransaction();


      const booking =
        await Booking.findById(
          req.params.id
        )
        .session(session);


      if (!booking) {

        await session.abortTransaction();
        await session.endSession();

        return res.status(404).json({
          message:
            "Booking not found.",
        });

      }


      // --------------------------------------------------------
      // VERIFY OWNER
      // --------------------------------------------------------

      const pg =
        await PG.findOne({

          _id:
            booking.pg,

          owner:
            req.user.userId,

          isActive:
            true,

        })
        .session(session);


      if (!pg) {

        await session.abortTransaction();
        await session.endSession();

        return res.status(403).json({
          message:
            "You do not own this PG.",
        });

      }


      // --------------------------------------------------------
      // MUST HAVE STUDENT-ACCEPTED ROOM
      // --------------------------------------------------------

      if (
        booking.status !==
        "room_assigned"
      ) {

        await session.abortTransaction();
        await session.endSession();

        return res.status(409).json({

          message:
            "Owner cancellation through this flow is only available after the student has accepted a room.",

        });

      }


      // --------------------------------------------------------
      // RELEASE ROOM IMMEDIATELY
      // --------------------------------------------------------

      if (booking.room) {

        const room =
          await Room.findById(
            booking.room
          )
          .session(session);


        if (room) {

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


          await room.save({
            session,
          });

        }

      }


      // --------------------------------------------------------
      // UPDATE BOOKING
      // --------------------------------------------------------

      booking.status =
        "owner_cancellation_pending";


      booking.cancelledBy =
        "owner";


      booking.cancelledAt =
        new Date();


      booking.cancellationReason =
        String(

          req.body.reason ||
          "Owner cancelled the room assignment."

        ).trim();


      booking.studentConfirmedCancellation =
        null;


      booking.mutualCancellation =
        false;


      /*
        IMPORTANT:

        Room has already been released.

        We keep the booking.room reference for audit/history.

        It is NOT an active room assignment anymore because
        status is owner_cancellation_pending.
      */


      await booking.save({
        session,
      });


      // --------------------------------------------------------
      // COMMIT
      // --------------------------------------------------------

      await session.commitTransaction();
      await session.endSession();


      return res.status(200).json({

        message:
          "The room was released and the cancellation was sent to the student for confirmation.",

        booking,

      });


    } catch (error) {

      try {

        await session.abortTransaction();

      } catch (abortError) {

        console.error(
          "Owner cancellation rollback error:",
          abortError
        );

      }


      await session.endSession();


      console.error(
        "Owner cancellation error:",
        error
      );


      return res.status(500).json({
        message:
          "Unable to request cancellation.",
      });

    }

  }
);


// ============================================================
// STUDENT RESPONDS TO OWNER CANCELLATION
// ============================================================
// PATCH /api/bookings/:id/cancellation-response
//
// Body:
//
// {
//   agreed: true
// }
//
// OR:
//
// {
//   agreed: false
// }
//
// ============================================================
//
// IMPORTANT ACCOUNTABILITY POLICY
//
// YES:
//   Student agrees that the cancellation was mutual.
//
//   → mutual_cancelled
//   → no student penalty
//   → no owner penalty
//   → no reliability reduction
//
// NO:
//   Student disagrees that the cancellation was mutual.
//
//   IMPORTANT:
//   NO IS A DISPUTE, NOT AUTOMATIC PROOF OF OWNER MISCONDUCT.
//
//   → owner_cancelled
//   → student is protected
//   → dispute count increases
//   → reliability receives a small gradual reduction
//   → proven cancellation count does NOT automatically increase
//   → owner is NOT immediately restricted
//
// The system therefore avoids punishing an owner heavily merely
// because a student disagreed.
//
// Repeated accountability events can gradually reduce visibility,
// while serious / sustained behavior can eventually trigger a
// booking restriction.
//
// ============================================================


router.patch(
  "/:id/cancellation-response",
  authenticateToken,
  requireStudent,

  async (req, res) => {

    const session =
      await mongoose.startSession();


    try {

      // ----------------------------------------------------------
      // VALIDATE BOOKING ID
      // ----------------------------------------------------------

      if (
        !mongoose.Types.ObjectId.isValid(
          req.params.id
        )
      ) {

        await session.endSession();

        return res.status(400).json({
          message:
            "Invalid booking ID.",
        });

      }


      // ----------------------------------------------------------
      // VALIDATE RESPONSE
      // ----------------------------------------------------------

      const agreed =
        req.body.agreed;


      if (
        typeof agreed !==
        "boolean"
      ) {

        await session.endSession();

        return res.status(400).json({
          message:
            "Please specify whether you agreed to the cancellation.",
        });

      }


      session.startTransaction();


      // ----------------------------------------------------------
      // FIND PENDING OWNER CANCELLATION
      // ----------------------------------------------------------

      const booking =
        await Booking.findOne({

          _id:
            req.params.id,

          student:
            req.user.userId,

          status:
            "owner_cancellation_pending",

        })
        .session(session);


      if (!booking) {

        await session.abortTransaction();
        await session.endSession();

        return res.status(404).json({
          message:
            "No pending owner cancellation was found.",
        });

      }


      // ----------------------------------------------------------
      // RECORD STUDENT RESPONSE
      // ----------------------------------------------------------

      booking.studentConfirmedCancellation =
        agreed;


      // ==========================================================
      // MUTUAL CANCELLATION
      // ==========================================================

      if (agreed) {

        /*
          The student explicitly agreed.

          Therefore this is a genuine mutual cancellation.

          IMPORTANT:

          - No owner strike.
          - No dispute.
          - No reliability reduction.
          - No restriction.
          - No student penalty.
        */

        booking.status =
          "mutual_cancelled";


        booking.mutualCancellation =
          true;


        booking.ownerStrikeApplied =
          false;


        // --------------------------------------------------------
        // SAVE BOOKING
        // --------------------------------------------------------

        await booking.save({
          session,
        });


        // --------------------------------------------------------
        // COMMIT
        // --------------------------------------------------------

        await session.commitTransaction();
        await session.endSession();


        return res.status(200).json({

          message:
            "Cancellation recorded as mutual. No penalty was applied.",

          booking,

        });

      }


      // ==========================================================
      // STUDENT DISAGREES
      // ==========================================================
      //
      // A NO IS A DISPUTE.
      //
      // It does NOT automatically prove owner misconduct.
      //
      // We therefore:
      //
      // 1. protect the student
      // 2. record the dispute
      // 3. apply a small reliability adjustment
      // 4. do NOT immediately create a strike
      // 5. do NOT immediately restrict the PG
      //
      // ==========================================================


      booking.status =
        "owner_cancelled";


      booking.mutualCancellation =
        false;


      /*
        The old system used this field as an immediate strike flag.

        We are deliberately NOT treating every student NO as a
        proven owner strike anymore.

        It remains false here.

        A future evidence/review mechanism can set it to true
        when an owner-caused cancellation is actually proven.
      */

      booking.ownerStrikeApplied =
        false;


      // ----------------------------------------------------------
      // LOAD PG
      // ----------------------------------------------------------

      const pg =
        await PG.findById(
          booking.pg
        )
        .session(session);


      if (!pg) {

        await session.abortTransaction();
        await session.endSession();

        return res.status(404).json({
          message:
            "PG associated with this booking was not found.",
        });

      }


      // ==========================================================
      // OWNER ACCOUNTABILITY
      // ==========================================================

      /*
        Make sure old PG documents are also handled safely.

        Older PGs may have undefined values because these fields
        were added after the PG was originally created.
      */


      if (
        typeof pg.ownerReliabilityScore !==
        "number"
      ) {

        pg.ownerReliabilityScore =
          100;

      }


      if (
        typeof pg.ownerAccountabilityPoints !==
        "number"
      ) {

        pg.ownerAccountabilityPoints =
          0;

      }


      if (
        typeof pg.ownerProvenCancellationCount !==
        "number"
      ) {

        pg.ownerProvenCancellationCount =
          0;

      }


      if (
        typeof pg.ownerCancellationDisputeCount !==
        "number"
      ) {

        pg.ownerCancellationDisputeCount =
          0;

      }


      if (
        typeof pg.ownerGoodBookingCount !==
        "number"
      ) {

        pg.ownerGoodBookingCount =
          0;

      }


      // ==========================================================
      // RECORD DISPUTE
      // ==========================================================

      pg.ownerCancellationDisputeCount +=
        1;


      pg.ownerLastAccountabilityEventAt =
        new Date();


      // ==========================================================
      // ACCOUNTABILITY POINTS
      // ==========================================================
      //
      // A dispute is weaker than a proven violation.
      //
      // Therefore:
      //
      // dispute → +1 accountability point
      //
      // proven owner-caused cancellation can later receive a
      // stronger penalty through a dedicated proven-event flow.
      //
      // ==========================================================

      pg.ownerAccountabilityPoints +=
        1;


      // ==========================================================
      // GRADUAL RELIABILITY REDUCTION
      // ==========================================================
      //
      // We intentionally make this SMALL.
      //
      // One disputed cancellation:
      //
      //     100 → 99
      //
      // Two:
      //
      //     99 → 98
      //
      // etc.
      //
      // This prevents one student's NO from destroying the PG's
      // visibility.
      //
      // ==========================================================

      pg.ownerReliabilityScore =
  Math.max(
    0,
    Math.round(
      (
        Number(
          pg.ownerReliabilityScore ?? 100
        ) - 1
      ) * 100
    ) / 100
  );

      // ==========================================================
      // IMPORTANT:
      //
      // DO NOT INCREASE:
      //
      // ownerProvenCancellationCount
      //
      // here.
      //
      // A student dispute alone is not enough to call the event
      // "proven".
      //
      // ==========================================================


      // ==========================================================
      // LEGACY STRIKE FIELD
      // ==========================================================
      //
      // Keep the existing field for backward compatibility.
      //
      // But do NOT increase it for every NO.
      //
      // The old behavior was:
      //
      //     NO → strike +1
      //
      // That is exactly what we are removing.
      //
      // ==========================================================

      pg.ownerCancellationStrikes =
        Math.max(
          0,
          Number(
            pg.ownerCancellationStrikes || 0
          )
        );


      // ==========================================================
      // NO AUTOMATIC RESTRICTION
      // ==========================================================
      //
      // A dispute alone must NOT restrict the PG.
      //
      // Therefore:
      //
      // bookingRestrictedUntil remains unchanged unless there
      // is already a genuine restriction in place.
      //
      // ==========================================================


      // ----------------------------------------------------------
      // SAVE PG
      // ----------------------------------------------------------

      await pg.save({
        session,
      });


      // ----------------------------------------------------------
      // SAVE BOOKING
      // ----------------------------------------------------------

      await booking.save({
        session,
      });


      // ----------------------------------------------------------
      // COMMIT
      // ----------------------------------------------------------

      await session.commitTransaction();
      await session.endSession();


      // ==========================================================
      // RESPONSE
      // ==========================================================

      return res.status(200).json({

        message:
          "Cancellation recorded as disputed. The student was not penalized, and the PG received a gradual reliability adjustment.",

        booking,

      });


    } catch (error) {

      try {

        await session.abortTransaction();

      } catch (abortError) {

        console.error(
          "Cancellation response rollback error:",
          abortError
        );

      }


      await session.endSession();


      console.error(
        "Cancellation response error:",
        error
      );


      return res.status(500).json({
        message:
          "Unable to process cancellation response.",
      });

    }

  }
);




// ============================================================
// STUDENT CHECK-IN
// ============================================================
//
// IMPORTANT:
//
// A booking becoming "room_assigned" does NOT improve the
// owner's reliability score.
//
// A booking becoming "accepted" does NOT improve the
// owner's reliability score.
//
// A room proposal does NOT improve the score.
//
// ONLY an actual student check-in creates a GOOD BOOKING
// event for the owner.
//
// This is intentionally conservative so owners cannot
// improve their reliability simply by accepting bookings.
// ============================================================


// ============================================================
// EXPORT
// ============================================================


console.log(
  "REGISTERED BOOKING ROUTES:",
  router.stack
    .filter(layer => layer.route)
    .map(layer => ({
      path: layer.route.path,
      methods: Object.keys(layer.route.methods)
    }))
);


module.exports =
  router;