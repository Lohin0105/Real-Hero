import express from "express";
import { sendMail } from "../utils/emailNotifier.mjs";
import User from "../models/User.mjs";

const router = express.Router();

// POST /api/test/email
// Body: { to, subject, html }
router.post("/email", async (req, res) => {
    try {
        const { to, subject, html } = req.body;
        if (!to) return res.status(400).json({ error: "Missing 'to' address" });

        const result = await sendMail({
            to,
            subject: subject || "Test Email from Real-Hero",
            html: html || "<p>This is a test email.</p>",
        });

        return res.json(result);
    } catch (err) {
        console.error("Test email error:", err);
        return res.status(500).json({ error: err.message });
    }
});

// POST /api/test/nearby
// Body: { lat, lng, radius }
router.post("/nearby", async (req, res) => {
    try {
        const { lat, lng, radius } = req.body;
        if (typeof lat !== "number" || typeof lng !== "number") {
            return res.status(400).json({ error: "Missing lat/lng (numbers)" });
        }

        const radiusInMeters = Number(radius || 50000);
        console.log(`Test Nearby: [${lng}, ${lat}], radius=${radiusInMeters}`);

        const users = await User.find({
            locationGeo: {
                $near: {
                    $geometry: { type: "Point", coordinates: [lng, lat] },
                    $maxDistance: radiusInMeters,
                },
            },
        }).select("_id name email locationGeo");

        return res.json({ count: users.length, users });
    } catch (err) {
        console.error("Test nearby error:", err);
        return res.status(500).json({ error: err.message });
    }
});

// GET /api/test/users-location
// List all users with their location data
router.get("/users-location", async (req, res) => {
    try {
        const users = await User.find({}).select("name email location locationGeo");
        return res.json({ count: users.length, users });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

export default router;
