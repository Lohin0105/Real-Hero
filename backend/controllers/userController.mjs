// backend/controllers/userController.mjs
import User from "../models/User.mjs";
import Gamification from "../models/Gamification.mjs";
import admin from "../config/firebaseAdmin.mjs";

/** Utility: get single user by uid or _id */
async function getActiveUser(uid) {
  if (!uid) return null;
  return (await User.findOne({ uid })) || (await User.findOne({ _id: uid }).catch(() => null));
}

/** Create or update user */
export const saveUser = async (req, res) => {
  try {
    // If Authorization header present, verify Firebase ID token and set uid
    let uidFromToken = null;
    try {
      const authHeader = req.headers.authorization || "";
      if (authHeader.startsWith("Bearer ")) {
        const idToken = authHeader.split(" ")[1];
        const decoded = await admin.auth().verifyIdToken(idToken);
        uidFromToken = decoded.uid;
      }
    } catch (e) {
      console.warn("Failed to verify ID token in saveUser:", e?.message || e);
    }

    const payload = { ...req.body };

    // Protect server against extremely large embedded payloads for profilePhoto
    if (payload.profilePhoto && typeof payload.profilePhoto === 'string') {
      // base64 strings can be large; enforce an upper bound (e.g., ~4MB of base64 chars)
      const maxBase64 = Number(process.env.MAX_PROFILE_PHOTO_BASE64_LENGTH) || 4 * 1024 * 1024; // chars
      if (payload.profilePhoto.length > maxBase64) {
        return res.status(413).json({ message: 'Profile photo is too large. Please use an image smaller than 2MB.' });
      }
    }

    // Normalize/sanitize any location info to prevent partial GeoJSON objects
    const sanitizeLocationPayload = (p) => {
      if (!p) return;

      // If caller supplies `location` with lat/lng, convert to locationGeo
      if (p.location && typeof p.location.lat === 'number' && typeof p.location.lng === 'number') {
        p.locationGeo = { type: 'Point', coordinates: [p.location.lng, p.location.lat] };
      }

      // If payload includes a locationGeo, ensure it has valid coordinates
      if (p.locationGeo) {
        const coords = p.locationGeo.coordinates;
        if (Array.isArray(coords)) {
          if (coords.length !== 2 || typeof coords[0] !== 'number' || typeof coords[1] !== 'number') {
            // invalid coords -> remove the field entirely
            delete p.locationGeo;
          }
        } else if (p.locationGeo.lat !== undefined && p.locationGeo.lng !== undefined) {
          // allow {lat,lng} shape and convert
          const lat = Number(p.locationGeo.lat);
          const lng = Number(p.locationGeo.lng);
          if (Number.isFinite(lat) && Number.isFinite(lng)) {
            p.locationGeo = { type: 'Point', coordinates: [lng, lat] };
          } else {
            delete p.locationGeo;
          }
        } else {
          // Any other shape is removed to prevent bad inserts
          delete p.locationGeo;
        }
      }
    };

    sanitizeLocationPayload(payload);
    if (uidFromToken) payload.uid = uidFromToken;

    // try to find existing by uid or email
    let user = null;
    if (payload.uid) user = await User.findOne({ uid: payload.uid });
    if (!user && payload.email) user = await User.findOne({ email: payload.email });

    if (user) {
      // update allowed fields
      user.name = payload.name || user.name;
      user.email = payload.email || user.email;
      user.age = payload.age || user.age;
      user.phone = payload.phone || user.phone;
      user.blood = payload.blood || user.blood;
      user.bloodGroup = payload.bloodGroup || user.bloodGroup;
      user.uid = payload.uid || user.uid;
      // New profile fields
      if (payload.profilePhoto !== undefined) user.profilePhoto = payload.profilePhoto;
      if (payload.gender !== undefined) user.gender = payload.gender;
      if (payload.dateOfBirth !== undefined) user.dateOfBirth = payload.dateOfBirth;
      if (payload.weight !== undefined) user.weight = payload.weight;
      // Clean up existing user.locationGeo if malformed
      if (user.locationGeo && (!Array.isArray(user.locationGeo.coordinates) || user.locationGeo.coordinates.length !== 2)) {
        user.locationGeo = undefined;
      }
      await user.save();
      return res.json(user);
    }

    // Try to map email -> firebase uid if possible
    if (!payload.uid && payload.email) {
      try {
        const fb = await admin.auth().getUserByEmail(payload.email).catch(() => null);
        if (fb && fb.uid) payload.uid = fb.uid;
      } catch (e) {
        console.warn("saveUser: failed to lookup firebase user by email:", e?.message || e);
      }
    }

    // Require uid to create stable user record
    if (!payload.uid) {
      return res.status(400).json({ message: "UID missing. Please include a valid Firebase ID token." });
    }

    // create new user (payload.uid present)
    // sanitize payload again before create (after attempted firebase lookup)
    sanitizeLocationPayload(payload);

    try {
      const created = await User.create(payload);
      return res.json(created);
    } catch (createErr) {
      console.warn("saveUser: create failed, attempting to find existing user:", createErr?.message || createErr);
      const existing = (await User.findOne({ uid: payload.uid })) || (payload.email ? await User.findOne({ email: payload.email }) : null);
      if (existing) {
        existing.name = payload.name || existing.name;
        existing.email = payload.email || existing.email;
        existing.age = payload.age || existing.age;
        existing.phone = payload.phone || existing.phone;
        existing.blood = payload.blood || existing.blood;
        existing.bloodGroup = payload.bloodGroup || existing.bloodGroup;
        // New profile fields
        if (payload.profilePhoto !== undefined) existing.profilePhoto = payload.profilePhoto;
        if (payload.gender !== undefined) existing.gender = payload.gender;
        if (payload.dateOfBirth !== undefined) existing.dateOfBirth = payload.dateOfBirth;
        if (payload.weight !== undefined) existing.weight = payload.weight;
        // Fix malformed existing locationGeo if present
        if (existing.locationGeo && (!Array.isArray(existing.locationGeo.coordinates) || existing.locationGeo.coordinates.length !== 2)) {
          existing.locationGeo = undefined;
        }
        await existing.save();
        return res.json(existing);
      }
      throw createErr;
    }
  } catch (err) {
    console.error("saveUser:", err);
    return res.status(500).json({ error: err.message });
  }
};

/** GET /api/user?uid=... */
export const getUserByQuery = async (req, res) => {
  try {
    const uid = req.query.uid;
    const user = await getActiveUser(uid);
    if (!user) return res.status(404).json({ message: "User not found" });
    return res.json(user);
  } catch (err) {
    console.error("getUserByQuery:", err);
    return res.status(500).json({ error: err.message });
  }
};

/** GET /api/user/me */
export const getCurrentUser = async (req, res) => {
  try {
    // Prefer token-based authentication and sync Firebase profile into Mongo
    let uid = null;
    let decoded = null;
    try {
      const authHeader = req.headers.authorization || "";
      if (authHeader.startsWith("Bearer ")) {
        const idToken = authHeader.split(" ")[1];
        decoded = await admin.auth().verifyIdToken(idToken);
        uid = decoded.uid;
      }
    } catch (e) {
      console.warn("getCurrentUser: failed to verify token:", e?.message || e);
    }

    // fallback to query param if provided
    if (!uid && req.query.uid) uid = req.query.uid;

    if (!uid) return res.status(401).json({ message: "Authentication required" });

    // get or create user record
    let user = await getActiveUser(uid);
    if (!user) {
      // try to create user from Firebase profile if available
      try {
        const fbUser = decoded ? await admin.auth().getUser(decoded.uid).catch(() => null) : null;
        const payload = {
          uid,
          email: fbUser?.email || req.body?.email || undefined,
          name: fbUser?.displayName || req.body?.name || undefined,
        };
        user = await User.create(payload);
        console.log("getCurrentUser: created user for uid", uid);
      } catch (e) {
        console.warn("getCurrentUser: failed to create user for uid", uid, e?.message || e);
      }
    }

    if (!user) return res.status(404).json({ message: "User not found" });

    // If we have Firebase profile, ensure Mongo user is synced (email / name)
    try {
      if (decoded) {
        const fb = await admin.auth().getUser(decoded.uid).catch(() => null);
        let changed = false;
        if (fb) {
          if (fb.email && user.email !== fb.email) {
            user.email = fb.email;
            changed = true;
          }
          if (fb.displayName && user.name !== fb.displayName) {
            user.name = fb.displayName;
            changed = true;
          }
          if (!user.uid) {
            user.uid = decoded.uid;
            changed = true;
          }
          if (changed) await user.save();
        }
      }
    } catch (e) {
      console.warn("getCurrentUser: firebase sync failed", e?.message || e);
    }

    const gamification =
      (await Gamification.findOne({ userId: user._id })) || {
        heroCoins: user.heroCoins || 0,
        level: 1,
        progressPercent: 0,
      };

    return res.json({
      _id: user._id,
      uid: user.uid,
      name: user.name,
      email: user.email,
      phone: user.phone,
      age: user.age,
      gender: user.gender,
      weight: user.weight,
      dateOfBirth: user.dateOfBirth,
      bloodGroup: user.blood || user.bloodGroup,
      lastDonation: user.updatedAt || user.lastDonation,
      isAvailable: Boolean(user.available),
      location: user.location,
      locationGeo: user.locationGeo,
      coins: user.coins || 0,
      leaderboardPoints: user.leaderboardPoints || 0,
      profilePhoto: user.profilePhoto,
      gamification,
    });
  } catch (err) {
    console.error("getCurrentUser:", err);
    return res.status(500).json({ error: err.message });
  }
};

/** POST /api/user/availability */
export const updateAvailability = async (req, res) => {
  try {
    const { uid: uidInBody, available, location } = req.body;

    // allow token in Authorization header or uid in body
    let uid = uidInBody;
    try {
      const authHeader = req.headers.authorization || "";
      if (authHeader.startsWith("Bearer ")) {
        const idToken = authHeader.split(" ")[1];
        const decoded = await admin.auth().verifyIdToken(idToken);
        uid = decoded.uid;
      }
    } catch (e) {
      // ignore
    }

    if (!uid) return res.status(401).json({ message: "Authentication required" });

    const user = await getActiveUser(uid);
    if (!user) return res.status(404).json({ message: "User not found" });

    user.available = Boolean(available);

    if (location && typeof location.lat === "number" && typeof location.lng === "number") {
      user.location = { lat: location.lat, lng: location.lng };
      user.locationGeo = { type: "Point", coordinates: [location.lng, location.lat] };
    }

    await user.save();
    return res.json({ available: user.available });
  } catch (err) {
    console.error("updateAvailability:", err);
    return res.status(500).json({ error: "Failed to update availability" });
  }
};

/** POST /api/user/location */
export const updateLocation = async (req, res) => {
  try {
    const { uid: uidInBody, lat, lng } = req.body;

    // allow token in Authorization header or uid in body
    let uid = uidInBody;
    try {
      const authHeader = req.headers.authorization || "";
      if (authHeader.startsWith("Bearer ")) {
        const idToken = authHeader.split(" ")[1];
        const decoded = await admin.auth().verifyIdToken(idToken);
        uid = decoded.uid;
      }
    } catch (e) {
      // ignore
    }

    if (!uid) return res.status(401).json({ message: "Authentication required" });

    const user = await getActiveUser(uid);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (typeof lat !== "number" || typeof lng !== "number") {
      return res.status(400).json({ message: "lat and lng required" });
    }

    user.location = { lat, lng };
    user.locationGeo = { type: "Point", coordinates: [lng, lat] };
    await user.save();

    return res.json({ message: "Location updated", location: user.location });
  } catch (err) {
    console.error("updateLocation:", err);
    return res.status(500).json({ error: err.message });
  }
};

/** GET /api/user/leaderboard */
export const getLeaderboard = async (req, res) => {
  try {
    const limit = Number(req.query.limit || 10);
    const docs = await User.find({}).sort({ leaderboardPoints: -1, coins: -1 }).limit(limit).select('name coins leaderboardPoints donationsCount').lean();
    return res.json(docs);
  } catch (err) {
    console.error('getLeaderboard:', err);
    return res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
};
