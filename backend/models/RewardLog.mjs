import mongoose from "mongoose";

const RewardLogSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    points: { type: Number, required: true },
    type: { type: String, enum: ["primary_reward", "backup_reward", "requester_reward", "donation_completed", "request_fulfilled", "backup_arrival"], required: true },
    requestId: { type: mongoose.Schema.Types.ObjectId, ref: 'Request' },
    coins: { type: Number, default: 0 },
    leaderboardPoints: { type: Number, default: 0 },
    patientName: { type: String },
    hospital: { type: String },
    createdAt: { type: Date, default: Date.now }
});

export default mongoose.model("RewardLog", RewardLogSchema);
