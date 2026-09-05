const mongoose = require("mongoose");

const complaintSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    pg: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PG",
      required: true,
    },

    category: {
      type: String,
      enum: [
        "water",
        "power",
        "mess",
        "cleanliness",
        "roommate",
        "plumbing",
        "wifi",
        "carpenter",
      ],
      required: true,
    },

    comment: {
      type: String,
      trim: true,
      required: true,
    },

    status: {
      type: String,
      enum: ["reported", "acknowledged", "resolved"],
      default: "reported",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Complaint", complaintSchema);
