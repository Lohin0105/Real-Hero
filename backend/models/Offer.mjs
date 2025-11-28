// backend/models/Offer.mjs
import mongoose from "mongoose";

const OfferSchema = new mongoose.Schema(
  {
    donorUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    donorUid: { type: String, default: null },
    donorEmail: { type: String, default: null },

    // NEW — stores donor info snapshot at the moment they offer
    donorSnapshot: {
      type: Object,
      default: {
        name: null,
        age: null,
        email: null,
        phone: null,
      },
    },

    requestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Request",
      required: true,
    },

    requestUid: { type: String, default: null },
    requestPhone: { type: String, default: null },

    token: { type: String, required: true },

    // YES/NO response from donor (from first email)
    response: { type: String, enum: ["yes", "no", null], default: null },
    respondedAt: { type: Date, default: null },

    status: {
      type: String,
      enum: ["pending", "accepted", "declined"],
      default: "pending",
    },

    // FOLLOW-UP SYSTEM (AFTER 24 HOURS)
    followUpAt: { type: Date, default: null },
    followUpSent: { type: Boolean, default: false },
    followUpSentAt: { type: Date, default: null },

    followUpResponse: { type: String, enum: ["yes", "no", null], default: null },
    followUpRespondedAt: { type: Date, default: null },

    coinsAwarded: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default mongoose.model("Offer", OfferSchema);
