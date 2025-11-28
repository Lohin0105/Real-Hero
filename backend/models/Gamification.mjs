// backend/models/Gamification.mjs
import mongoose from "mongoose";

const gamSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  heroCoins: { type: Number, default: 0 },
  level: { type: Number, default: 1 },
  progressPercent: { type: Number, default: 0 },
}, { timestamps: true });

export default mongoose.model("Gamification", gamSchema);
