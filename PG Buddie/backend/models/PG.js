const mongoose = require("mongoose");


/*
  ==========================================
  ROOM TYPE
  ==========================================

  This describes one group of rooms in a PG.

  Example:

  {
    sharing: 5,
    roomCount: 3,
    rent: 6000,
    namingStyle: "prefix-number",
    prefix: "A-",
    startNumber: 101
  }

  This produces:

  A-101  → ₹6000
  A-102  → ₹6000
  A-103  → ₹6000
*/


const roomTypeSchema = new mongoose.Schema(
  {

    /*
      Number of students who can share
      one room.

      Examples:
      1, 2, 3, 4, 5...
    */

    sharing: {
      type: Number,

      required: true,

      min: 1,
    },


    /*
      Number of rooms of this sharing type.
    */

    roomCount: {
      type: Number,

      required: true,

      min: 1,
    },


    /*
      MONTHLY RENT FOR THIS ROOM TYPE

      Example:

      5-share → ₹6000
      4-share → ₹7000
      2-share → ₹9000

      Rent belongs to the room type,
      not to the entire PG.
    */

    rent: {
      type: Number,

      required: true,

      min: 0,
    },


    /*
      How PG-Buddie should generate
      the room names.

      number:
        101, 102, 103...

      prefix-number:
        A-101, A-102, A-103...

      later:
        Temporary names such as
        Room 1, Room 2...
    */

    namingStyle: {
      type: String,

      enum: [
        "number",
        "prefix-number",
        "later",
      ],

      default: "number",
    },


    /*
      Used only when namingStyle is
      "prefix-number".

      Example:

      prefix: "A-"

      produces:

      A-101
      A-102
      A-103
    */

    prefix: {
      type: String,

      trim: true,

      default: "",
    },


    /*
      First number in the generated
      room-number sequence.

      Example:

      roomCount: 3
      startNumber: 101

      produces:

      101
      102
      103

      The backend calculates the end
      number automatically.
    */

    startNumber: {
      type: Number,

      min: 0,

      default: null,
    },

  },

  {
    _id: false,
  }
);


/*
  ==========================================
  PG SCHEMA
  ==========================================
*/

const pgSchema = new mongoose.Schema(
  {

    name: {
      type: String,

      required: true,

      trim: true,
    },


    description: {
      type: String,

      trim: true,

      default: "",
    },


    address: {
      type: String,

      required: true,

      trim: true,
    },


    city: {
      type: String,

      required: true,

      trim: true,
    },


    owner: {
      type: mongoose.Schema.Types.ObjectId,

      ref: "User",

      required: true,
    },


    amenities: {
      type: [String],

      default: [],
    },


    /*
      ======================================
      ACTUAL ROOM-SHARING STRUCTURE
      ======================================

      Example:

      [
        {
          sharing: 5,
          roomCount: 2,
          rent: 6000,
          namingStyle: "number",
          startNumber: 101
        },

        {
          sharing: 2,
          roomCount: 3,
          rent: 9000,
          namingStyle: "prefix-number",
          prefix: "B-",
          startNumber: 201
        }
      ]

      IMPORTANT:

      Rent now belongs ONLY to each
      room type.

      There is no PG-wide rent.
    */

    roomTypes: {
      type: [roomTypeSchema],

      default: [],
    },


    /*
      ======================================
      CALCULATED TOTALS
      ======================================

      These are kept for fast dashboard
      display.
    */

    totalRooms: {
      type: Number,

      min: 0,

      default: 0,
    },


    capacity: {
      type: Number,

      min: 0,

      default: 0,
    },


    /*
      Number of beds currently available.

      A newly-created PG starts with
      every bed available.
    */

    availableBeds: {
      type: Number,

      min: 0,

      default: 0,
    },


    /*
      ======================================
      OWNER RELIABILITY & ACCOUNTABILITY
      ======================================
    */


    /*
      STUDENT-FACING RELIABILITY SCORE

      100 = excellent reliability
      0   = extremely poor reliability

      This will eventually be shown to
      students when they browse/search PGs.

      It will also be used as one factor
      in PG visibility/ranking.
    */

    ownerReliabilityScore: {
      type: Number,

      min: 0,

      max: 100,

      default: 100,
    },


    /*
      INTERNAL ACCOUNTABILITY POINTS

      This is NOT shown directly to students.

      Different proven accountability events
      can contribute different amounts.

      Higher points = more concerning behavior.
    */

    ownerAccountabilityPoints: {
      type: Number,

      min: 0,

      default: 0,
    },


    /*
      PROVEN OWNER-CAUSED CANCELLATIONS

      Counts cancellation events that the
      system determines should actually count
      against the owner.

      A student's NO does NOT automatically
      mean this count increases.
    */

    ownerProvenCancellationCount: {
      type: Number,

      min: 0,

      default: 0,
    },


    /*
      STUDENT-DISPUTED OWNER CANCELLATIONS

      Counts cancellation cases where the
      student explicitly said NO.

      IMPORTANT:

      This is historical evidence only.

      It does NOT automatically mean the
      owner was at fault.
    */

    ownerCancellationDisputeCount: {
      type: Number,

      min: 0,

      default: 0,
    },


    /*
      GOOD BOOKING HISTORY

      Used to allow reliability to recover
      gradually after sustained good behavior.
    */

    ownerGoodBookingCount: {
      type: Number,

      min: 0,

      default: 0,
    },


    /*
      MOST RECENT ACCOUNTABILITY EVENT

      Used to consider recency when calculating
      reliability and recovery.
    */

    ownerLastAccountabilityEventAt: {
      type: Date,

      default: null,
    },


    /*
      ======================================
      LEGACY OWNER STRIKES
      ======================================

      TEMPORARILY KEEP THIS FIELD.

      Existing PGs already have this value,
      including Test PG-7.

      We are NOT using this as the new
      reliability system yet.

      It will be migrated/deprecated only
      after the new system is working.
    */

    ownerCancellationStrikes: {
      type: Number,

      min: 0,

      default: 0,
    },


    /*
      ======================================
      SERIOUS BOOKING RESTRICTION
      ======================================

      This is the serious-level enforcement
      mechanism.

      null = no active restriction.

      Normal accountability events should
      NOT automatically create a restriction.
    */

    bookingRestrictedUntil: {
      type: Date,

      default: null,
    },


    gender: {
      type: String,

      enum: [
        "male",
        "female",
        "co-ed",
      ],

      default: "co-ed",
    },


    phone: {
      type: String,

      trim: true,

      default: "",
    },


    images: {
      type: [String],

      default: [],
    },


    isVerified: {
      type: Boolean,

      default: false,
    },


    isActive: {
      type: Boolean,

      default: true,
    },


    /*
      ======================================
      PG LOCATION
      ======================================

      Owners don't need to manually enter
      latitude/longitude.

      The frontend can obtain them through
      browser location or the map picker.
    */

    location: {

      latitude: {
        type: Number,

        min: -90,

        max: 90,
      },


      longitude: {
        type: Number,

        min: -180,

        max: 180,
      },

    },

  },

  {
    timestamps: true,
  }

);


module.exports =
  mongoose.model(
    "PG",
    pgSchema
  );