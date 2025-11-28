import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import connectDB from "./config/db.mjs";
import userRoutes from "./routes/userRoutes.mjs";
import donorsRoutes from "./routes/donorsRoutes.mjs";
import notifyRoutes from "./routes/notifyRoutes.mjs";
import requestRoutes from "./routes/requestRoutes.mjs";
import rewardRoutes from "./routes/rewardRoutes.mjs";
import testRoutes from "./routes/testRoutes.mjs";
import Offer from "./models/Offer.mjs";
import { sendMail } from "./utils/emailNotifier.mjs";
import { initScheduler } from "./utils/scheduler.mjs";

dotenv.config();
const app = express();
const PORT = process.env.PORT || 5000;

// middlewares
app.use(express.json({ limit: process.env.EXPRESS_JSON_LIMIT || '6mb' }));
app.use(express.urlencoded({ limit: process.env.EXPRESS_JSON_LIMIT || '6mb', extended: true }));
app.use(cookieParser());

// CORS config
const rawOrigins = process.env.FRONTEND_ORIGINS || process.env.FRONTEND_ORIGIN || "http://localhost:3000";
const origins = Array.isArray(rawOrigins) ? rawOrigins : String(rawOrigins).split(",").map(s => s.trim()).filter(Boolean);
app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (origins.includes("*")) return callback(null, true);
    if (origins.includes(origin)) return callback(null, true);
    const normalised = origin.replace(/^https?:\/\//, "");
    if (origins.includes(normalised)) return callback(null, true);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

// connect DB
(async () => {
  try {
    await connectDB(process.env.MONGO_URI);
  } catch (err) {
    console.error("DB connect error:", err);
  }
})();

// mount routes
app.use("/api/user", userRoutes);
app.use("/api/users", userRoutes);
app.use("/api/donors", donorsRoutes);
app.use("/api/notify", notifyRoutes);
app.use("/api/requests", requestRoutes);
app.use("/api/rewards", rewardRoutes);
app.use("/api/test", testRoutes);

// root
app.get("/", (req, res) => res.send("Real-Hero backend running"));

// Global error handler
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  if (err && (err.type === 'entity.too.large' || err.status === 413)) {
    return res.status(413).json({ error: 'Payload too large. Please upload images smaller than 2MB (base64 may expand size).' });
  }
  res.status(500).json({ error: err.message || "Server error" });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`CORS origins: ${origins.join(",")}`);
  initScheduler();
});

// Background follow-up processor (unchanged)
const FOLLOWUP_INTERVAL_MS = 5 * 60 * 1000;
setInterval(async () => {
  try {
    const now = new Date();
    const pending = await Offer.find({ status: 'pending', followUpAt: { $lte: now }, coinsAwarded: { $ne: true } }).limit(50).lean();
    if (!pending || pending.length === 0) return;
    for (const ofr of pending) {
      try {
        if (ofr.donorEmail) {
          const respondUrl = `${process.env.SERVER_BASE || `http://localhost:${PORT}`}/api/notify/offer/respond?token=${ofr.token}&resp=yes`;
          const html = `<p>Reminder: are you still able to donate for the request you showed interest in?</p><p><a href="${respondUrl}">Yes — I will donate</a></p>`;
          await sendMail({ to: ofr.donorEmail, subject: 'Reminder: confirm donation', html });
        }
        await Offer.updateOne({ _id: ofr._id }, { $set: { status: 'followup_sent' } });
      } catch (e) {
        console.error('Followup send failed for offer', ofr._id, e);
      }
    }
  } catch (e) {
    console.error('Offer followup processor error:', e);
  }
}, FOLLOWUP_INTERVAL_MS);
