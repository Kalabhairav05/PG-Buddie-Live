const mongoose = require("mongoose");

const communityPostSchema = new mongoose.Schema(
  {
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    message: {
      type: String,
      trim: true,
      required: true,
      maxlength: 2000,
    },

    reportStatus: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("CommunityPost", communityPostSchema);
