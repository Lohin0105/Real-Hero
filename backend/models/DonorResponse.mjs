import mongoose from "mongoose";

const DonorResponseSchema = new mongoose.Schema({
    requestId: { type: mongoose.Schema.Types.ObjectId, ref: 'Request', required: true },
    donorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String, enum: ["primary", "backup"], required: true },
    status: { type: String, enum: ["active", "promoted", "completed", "failed", "cancelled"], default: "active" },
    gpsReached: { type: Boolean, default: false },
    rewardPoints: { type: Number, default: 0 },
    hospital: { type: String }, // Snapshot of hospital name
    updatedAt: { type: Date, default: Date.now }
});

export default mongoose.model("DonorResponse", DonorResponseSchema);
