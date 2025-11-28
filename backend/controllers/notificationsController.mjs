// backend/controllers/notificationsController.mjs
import Notification from "../models/Notification.mjs";
import User from "../models/User.mjs";

/** GET /api/notifications/user?uid? */
export const getNotificationsForUser = async (req, res) => {
  try {
    const uid = req.query.uid;
    let user = null;
    if (uid) user = await User.findOne({ uid });
    else user = await User.findOne();

    if (!user) return res.json([]);
    const notes = await Notification.find({ userId: user._id }).sort({ createdAt: -1 }).limit(Number(req.query.limit || 20));
    return res.json(notes);
  } catch (err) {
    console.error("getNotificationsForUser:", err);
    return res.status(500).json({ error: "failed" });
  }
};
