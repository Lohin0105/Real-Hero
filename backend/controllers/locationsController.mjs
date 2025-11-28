// backend/controllers/locationsController.mjs
import User from "../models/User.mjs";

/** GET /api/locations/heatmap?limit=200 */
export const getHeatmapPoints = async (req, res) => {
  try {
    const limit = Number(req.query.limit || 200);
    const users = await User.find({ available: true }).limit(limit).lean();
    const points = users.map((u) => ({
      lat: u.location?.lat ?? (u.locationGeo?.coordinates?.[1] ?? 0),
      lng: u.location?.lng ?? (u.locationGeo?.coordinates?.[0] ?? 0),
      intensity: Math.min(1, (u.heroCoins || 0) / 100),
    }));
    return res.json(points);
  } catch (err) {
    console.error("getHeatmapPoints:", err);
    return res.status(500).json({ error: "failed" });
  }
};
