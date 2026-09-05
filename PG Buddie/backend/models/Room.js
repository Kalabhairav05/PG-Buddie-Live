const mongoose = require("mongoose");

const roomSchema = new mongoose.Schema(
  {
    pg: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PG",
      required: true,
    },

    roomNumber: {
      type: String,
      required: true,
      trim: true,
    },

    sharingType: {
      type: Number,
      required: true,
      min: 1,
    },

    rent: {
      type: Number,
      required: true,
      min: 0,
    },

    capacity: {
      type: Number,
      required: true,
      min: 1,
    },

    occupiedBeds: {
      type: Number,
      default: 0,
      min: 0,
    },

    status: {
      type: String,
      enum: ["available", "full", "maintenance"],
      default: "available",
    },
  },
  { timestamps: true }
);

roomSchema.virtual("availableBeds").get(function () {
  return Math.max(this.capacity - this.occupiedBeds, 0);
});

roomSchema.set("toJSON", { virtuals: true });

module.exports = mongoose.model("Room", roomSchema);
