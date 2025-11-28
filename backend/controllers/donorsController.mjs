// backend/controllers/donorsController.mjs
import User from "../models/User.mjs";
import Notification from "../models/Notification.mjs";
import admin from "../config/firebaseAdmin.mjs";

/** POST /api/donors/availability */
export const updateAvailability = async (req, res) => {
  try {
    // DEBUG: log incoming request for troubleshooting availability update failures
    try {
      console.log("donors.updateAvailability called. body:", req.body);
      console.log("donors.updateAvailability headers.Authorization:", req.headers.authorization);
    } catch (e) {
      console.warn("Failed to log request debug info:", e);
    }
    const { uid: uidInBody, available, location } = req.body;

    // Prefer token authentication
    let uid = uidInBody;
    try {
      const authHeader = req.headers.authorization || "";
      if (authHeader.startsWith("Bearer ")) {
        const idToken = authHeader.split(" ")[1];
        const decoded = await admin.auth().verifyIdToken(idToken);
        if (decoded && decoded.uid) uid = decoded.uid;
      }
    } catch (e) {
      console.warn("donors.updateAvailability: token verify failed:", e?.message || e);
    }

    if (!uid) return res.status(401).json({ message: "Authentication required" });

    let user = await User.findOne({ uid });
    if (!user) {
      // If user not found in DB but we have a verified uid, attempt to create a user record
      try {
        // fetch firebase user record for additional profile info
        const fbUser = await admin.auth().getUser(uid).catch(() => null);
        const createPayload = {
          uid,
          email: fbUser?.email || undefined,
          name: fbUser?.displayName || fbUser?.email?.split("@")[0] || "",
          available: Boolean(available),
        };
        if (location && typeof location.lat === "number" && typeof location.lng === "number") {
          createPayload.location = { lat: location.lat, lng: location.lng };
          createPayload.locationGeo = { type: "Point", coordinates: [location.lng, location.lat] };
        }
        user = await User.create(createPayload);
        console.log("donors.updateAvailability: created missing user for uid", uid);
      } catch (e) {
        console.warn("donors.updateAvailability: failed to create user for uid", uid, e?.message || e);
      }
    }

    if (!user) return res.status(404).json({ message: "User not found" });

    user.available = Boolean(available);
    if (location && typeof location.lat === "number" && typeof location.lng === "number") {
      user.location = { lat: location.lat, lng: location.lng };
      user.locationGeo = { type: "Point", coordinates: [location.lng, location.lat] };
    }
    await user.save();

    // lightweight notification
    try {
      await Notification.create({
        userId: user._id,
        title: "Availability updated",
        body: `${user.name || "Donor"} is now ${user.available ? "available" : "unavailable"}`,
        meta: { available: user.available },
      });
    } catch (e) {
      console.warn("Failed to create notification:", e);
    }

    return res.json({ available: user.available });
  } catch (err) {
    console.error("donors.updateAvailability:", err);
    return res.status(500).json({ error: "Failed to update availability" });
  }
};

/** GET /api/donors/nearby?limit=6&lat=&lng=&maxDistance=20000 */
export const getNearbyDonors = async (req, res) => {
  try {
    const limit = Number(req.query.limit || 6);
    const lat = parseFloat(req.query.lat);
    const lng = parseFloat(req.query.lng);

    if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
      const maxDistance = Number(req.query.maxDistance || 20000); // meters
      const docs = await User.aggregate([
        {
          $geoNear: {
            near: { type: "Point", coordinates: [lng, lat] },
            distanceField: "dist.calculated",
            query: { available: true },
            spherical: true,
            maxDistance,
          },
        },
        { $limit: limit },
        {
          $project: {
            name: 1,
            email: 1,
            blood: 1,
            locationGeo: 1,
            distanceMeters: "$dist.calculated",
            heroCoins: 1,
          },
        },
      ]);

      const out = docs.map((d) => ({
        _id: d._id,
        name: d.name,
        bloodGroup: d.blood,
        distanceKm: d.distanceMeters ? (d.distanceMeters / 1000).toFixed(1) : null,
        locationGeo: d.locationGeo,
        heroCoins: d.heroCoins || 0,
      }));

      return res.json(out);
    }

    // fallback when lat/lng missing: return available users
    const donors = await User.find({ available: true }).sort({ updatedAt: -1 }).limit(limit).lean();
    const out = donors.map((d) => ({
      _id: d._id,
      name: d.name,
      bloodGroup: d.blood,
      distanceKm: null,
      location: d.location,
      heroCoins: d.heroCoins || 0,
    }));

    return res.json(out);
  } catch (err) {
    console.error("getNearbyDonors:", err);
    return res.status(500).json({ error: "Failed to fetch nearby donors" });
  }
};
