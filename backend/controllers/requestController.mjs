// backend/controllers/requestController.mjs
import Request from "../models/Request.mjs";
import Notification from "../models/Notification.mjs";
import User from "../models/User.mjs";
import DonorResponse from "../models/DonorResponse.mjs";
import RewardLog from "../models/RewardLog.mjs";
import admin from "../config/firebaseAdmin.mjs";
import { sendMail } from "../utils/emailNotifier.mjs";

/**
 * POST /api/requests/create
 * body: { uid?, name, age, phone, bloodGroup, units, hospital, description, location? }
 */
export const createRequest = async (req, res) => {
  try {
    let { uid, name, age, phone, bloodGroup, units, hospital, description, location } = req.body;

    // If caller provided an Authorization token, prefer that uid (be permissive: this enables UI to pass token)
    try {
      const authHeader = req.headers?.authorization || "";
      if (authHeader && authHeader.startsWith("Bearer ")) {
        const token = authHeader.split(" ")[1];
        const decoded = await admin.auth().verifyIdToken(token).catch(() => null);
        if (decoded?.uid) uid = decoded.uid;
      }
    } catch (e) {
      // verification failed or admin not configured — that's okay
      // we intentionally swallow here to preserve existing behavior
    }
    if (!name || !phone || !bloodGroup || !hospital) return res.status(400).json({ message: "Missing required fields" });

    // Resolve user _id from uid to set requesterId
    let requesterId = null;
    if (uid) {
      const user = await User.findOne({ uid });
      if (user) requesterId = user._id;
    }

    const payload = {
      uid,
      requesterId, // Set the requesterId
      name,
      age,
      phone,
      bloodGroup,
      units: Number(units || 1),
      hospital,
      description
    };

    if (location && typeof location.lat === "number" && typeof location.lng === "number") {
      payload.location = { lat: location.lat, lng: location.lng };
      payload.locationGeo = { type: "Point", coordinates: [location.lng, location.lat] };
    } else if (!location && hospital) {
      // Best-effort: geocode provided hospital/address text to attach coordinates.
      // Use Nominatim (OpenStreetMap) as a simple free geocoder. Keep this non-blocking
      // and fail gracefully if the geocode call fails or returns no result.
      try {
        const q = encodeURIComponent(hospital);
        const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${q}&limit=1`;
        // prefer global fetch if available (Node 18+), otherwise try to import fetch from undici
        const fetchFn = (typeof fetch === 'function') ? fetch : null;
        let geocodeRes = null;
        if (fetchFn) {
          geocodeRes = await fetchFn(url, { headers: { 'User-Agent': 'Real-Hero-Backend' } });
        } else {
          // dynamic import of undici as fallback if installed
          try {
            const { fetch: undiciFetch } = await import('undici');
            geocodeRes = await undiciFetch(url, { headers: { 'User-Agent': 'Real-Hero-Backend' } });
          } catch (e) {
            geocodeRes = null;
          }
        }
        if (geocodeRes && geocodeRes.ok) {
          const hits = await geocodeRes.json().catch(() => null);
          if (Array.isArray(hits) && hits.length > 0) {
            const first = hits[0];
            const latN = parseFloat(first.lat);
            const lonN = parseFloat(first.lon);
            if (!Number.isNaN(latN) && !Number.isNaN(lonN)) {
              payload.location = { lat: latN, lng: lonN };
              payload.locationGeo = { type: 'Point', coordinates: [lonN, latN] };
            }
          }
        }
      } catch (e) {
        console.warn('createRequest: geocode failed for hospital', hospital, e?.message || e);
      }
    }

    const reqDoc = await Request.create(payload);

    // Notification Logic: Find users within 50km and notify them
    if (payload.locationGeo && payload.locationGeo.coordinates) {
      try {
        const [lng, lat] = payload.locationGeo.coordinates;
        const radiusInMeters = 50000; // 50 km

        console.log(`createRequest: Checking for users near [${lng}, ${lat}] within ${radiusInMeters}m`);
        console.log(`createRequest: Requester UID: ${uid}, Requester ID: ${requesterId}`);

        // Find users with locationGeo within 50km
        // Find users with locationGeo within 50km
        const nearbyUsers = await User.find({
          locationGeo: {
            $near: {
              $geometry: { type: "Point", coordinates: [lng, lat] },
              $maxDistance: radiusInMeters,
            },
          },
          // Exclude the requester (by uid and _id)
          $and: [
            { uid: { $ne: uid } },
            { _id: { $ne: requesterId } }
          ]
        }).select("_id name locationGeo email");

        console.log(`createRequest: Found ${nearbyUsers.length} nearby users (excluding requester)`);

        if (nearbyUsers.length > 0) {
          // Create in-app notifications
          const notifications = nearbyUsers.map((u) => ({
            userId: u._id,
            title: "Urgent: Blood Donor Needed",
            body: `Our user ${name} requires blood, so please open the app and check the details.`,
            meta: { requestId: reqDoc._id, urgency: true },
            createdAt: new Date(),
          }));

          await Notification.insertMany(notifications);
          console.log(`createRequest: Created ${notifications.length} in-app notifications.`);

          // Send Emails (Async)
          (async () => {
            let sentCount = 0;
            for (const u of nearbyUsers) {
              if (!u.email) continue;

              const emailHtml = `
                <p>Hi ${u.name || "Donor"},</p>
                <p><b>Urgent: Blood Donor Needed</b></p>
                <p>Our user <b>${name}</b> requires blood.</p>
                <p><b>Details:</b></p>
                <ul>
                  <li>Blood Group: ${bloodGroup}</li>
                  <li>Hospital: ${hospital}</li>
                  <li>Units: ${units}</li>
                  <li>Phone: ${phone}</li>
                </ul>
                <p>Please open the app to view more details and help if you can.</p>
                <p>Thanks — Real-Hero</p>
              `;

              const emailRes = await sendMail({
                to: u.email,
                subject: `URGENT: Blood Request Nearby - ${bloodGroup}`,
                html: emailHtml,
              });

              if (emailRes.ok) sentCount++;
              else console.warn(`Failed to send email to ${u.email}:`, emailRes.error);
            }
            console.log(`createRequest: Sent emails to ${sentCount}/${nearbyUsers.length} users.`);
          })();
        }
      } catch (notifErr) {
        console.error("createRequest: notification error", notifErr);
        // Don't fail the request if notifications fail
      }
    } else {
      console.log("createRequest: payload.locationGeo missing or invalid, skipping notifications", payload.locationGeo);
    }

    return res.json({ ok: true, requestId: reqDoc._id, request: reqDoc });
  } catch (err) {
    console.error("createRequest:", err);
    return res.status(500).json({ error: "Failed to create request" });
  }
};

/**
 * GET /api/requests/recent?limit=6&lat=&lng=&maxDistance=20000
 * returns open requests ordered by proximity or recency
 */
export const getRecentRequests = async (req, res) => {
  try {
    const limit = Number(req.query.limit || 6);
    const lat = parseFloat(req.query.lat);
    const lng = parseFloat(req.query.lng);

    if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
      const maxDistance = Number(req.query.maxDistance || 20000);
      const docs = await Request.aggregate([
        {
          $geoNear: {
            near: { type: "Point", coordinates: [lng, lat] },
            distanceField: "dist.calculated",
            query: { status: { $in: ["open", "primary_assigned", "backup_assigned"] } },
            spherical: true,
            maxDistance,
          },
        },
        { $limit: limit },
        {
          $project: {
            name: 1,
            phone: 1,
            bloodGroup: 1,
            units: 1,
            hospital: 1,
            description: 1,
            createdAt: 1,
            distanceMeters: "$dist.calculated",
            location: 1,
            locationGeo: 1,
            status: 1
          },
        },
      ]);
      const out = docs.map(d => ({
        _id: d._id,
        name: d.name,
        phone: d.phone,
        bloodGroup: d.bloodGroup,
        units: d.units,
        hospital: d.hospital,
        description: d.description,
        createdAt: d.createdAt,
        distanceKm: d.distanceMeters ? (d.distanceMeters / 1000).toFixed(1) : null,
        location: d.location || null,
        locationGeo: d.locationGeo || null,
        status: d.status
      }));
      return res.json(out);
    }

    // fallback: return open requests by latest
    const docs = await Request.find({ status: { $in: ["open", "primary_assigned", "backup_assigned"] } }).sort({ createdAt: -1 }).limit(limit).lean();
    const out = docs.map(d => ({
      _id: d._id,
      name: d.name,
      phone: d.phone,
      bloodGroup: d.bloodGroup,
      units: d.units,
      hospital: d.hospital,
      description: d.description,
      createdAt: d.createdAt,
      location: d.location || null,
      locationGeo: d.locationGeo || null,
      status: d.status
    }));
    return res.json(out);
  } catch (err) {
    console.error("getRecentRequests:", err);
    return res.status(500).json({ error: "Failed to fetch requests" });
  }
};

/**
 * POST /api/requests/geocode-missing
 * Admin endpoint (protected by GEOCODER_SECRET env) to geocode missing request locations
 * body/query: { limit?: number }
 */
export const geocodeMissingRequests = async (req, res) => {
  try {
    const secret = process.env.GEOCODER_SECRET || null;
    const provided = req.headers['x-geocode-secret'] || req.query.secret || req.body?.secret || null;
    if (!secret || !provided || String(provided) !== String(secret)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const limit = Number(req.query.limit || req.body?.limit || 50);
    // find open requests missing locationGeo
    const docs = await Request.find({ status: 'open', $or: [{ locationGeo: { $exists: false } }, { locationGeo: null }] }).limit(limit).lean();
    if (!docs || docs.length === 0) return res.json({ ok: true, processed: 0 });

    const results = [];
    for (const d of docs) {
      if (!d.hospital) {
        results.push({ id: d._id, ok: false, reason: 'no hospital text' });
        continue;
      }
      try {
        const q = encodeURIComponent(d.hospital);
        const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${q}&limit=1`;
        let fetchFn = (typeof fetch === 'function') ? fetch : null;
        let r = null;
        if (fetchFn) {
          r = await fetchFn(url, { headers: { 'User-Agent': 'Real-Hero-Backend' } });
        } else {
          try {
            const { fetch: undiciFetch } = await import('undici');
            r = await undiciFetch(url, { headers: { 'User-Agent': 'Real-Hero-Backend' } });
          } catch (e) {
            r = null;
          }
        }
        if (!r || !r.ok) {
          results.push({ id: d._id, ok: false, reason: 'geocode failed' });
        } else {
          const hits = await r.json().catch(() => null);
          if (!Array.isArray(hits) || hits.length === 0) {
            results.push({ id: d._id, ok: false, reason: 'no hits' });
          } else {
            const first = hits[0];
            const lat = parseFloat(first.lat);
            const lon = parseFloat(first.lon);
            if (Number.isNaN(lat) || Number.isNaN(lon)) {
              results.push({ id: d._id, ok: false, reason: 'invalid coords' });
            } else {
              // persist back to DB
              await Request.updateOne({ _id: d._id }, { $set: { location: { lat, lng: lon }, locationGeo: { type: 'Point', coordinates: [lon, lat] } } });
              results.push({ id: d._id, ok: true, lat, lon });
            }
          }
        }
      } catch (e) {
        results.push({ id: d._id, ok: false, reason: e?.message || e });
      }
      // polite delay
      await new Promise((r) => setTimeout(r, 1200));
    }

    return res.json({ ok: true, processed: results.length, results });
  } catch (err) {
    console.error('geocodeMissingRequests:', err);
    return res.status(500).json({ error: err.message || 'geocode failure' });
  }
};

/**
 * POST /api/requests/claim/:id
 * Body: { uid, location? }
 */
export const claimRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { uid, location } = req.body;

    // Resolve user
    let user = null;
    if (uid) {
      // Check if uid is a valid ObjectId to avoid CastError
      const isObjectId = /^[0-9a-fA-F]{24}$/.test(uid);
      if (isObjectId) {
        user = await User.findOne({ $or: [{ uid }, { _id: uid }] });
      } else {
        user = await User.findOne({ uid });
      }
    }

    if (!user) return res.status(401).json({ error: "User not identified" });

    const request = await Request.findById(id);
    if (!request) return res.status(404).json({ error: "Request not found" });

    if (request.status === 'fulfilled' || request.status === 'cancelled') {
      return res.status(400).json({ error: "Request is already closed" });
    }

    // Check if already claimed by this user
    const existingResponse = await DonorResponse.findOne({ requestId: id, donorId: user._id });
    if (existingResponse) {
      return res.status(400).json({ error: "You have already claimed/responded to this request" });
    }

    // Prevent self-donation
    if (request.requesterId && user._id && request.requesterId.toString() === user._id.toString()) {
      return res.status(400).json({ error: "You cannot donate to your own request." });
    }

    let role = 'backup';
    let message = "You are a Backup Donor. Standby!";

    if (request.status === 'open' || !request.primaryDonor?.donorId) {
      // Assign Primary
      role = 'primary';
      request.status = 'primary_assigned';
      request.primaryDonor = {
        donorId: user._id,
        acceptedAt: new Date(),
        confirmedAt: null,
        arrived: false
      };
      message = "You are the Primary Donor! Please arrive within 2 hours.";
    } else {
      // Assign Backup
      role = 'backup';
      if (request.status === 'primary_assigned') request.status = 'backup_assigned';
      request.backupDonors.push({
        donorId: user._id,
        acceptedAt: new Date(),
        promoted: false,
        reachedHospital: false,
        gpsVerified: false
      });
    }

    await request.save();

    // Create DonorResponse
    await DonorResponse.create({
      requestId: id,
      donorId: user._id,
      role,
      status: 'active',
      hospital: request.hospital // Snapshot hospital name
    });

    // Notify User (Email)
    if (user.email) {
      const subject = role === 'primary' ? "URGENT: You are the Primary Donor" : "You are a Backup Donor";
      const html = role === 'primary'
        ? `<p>Hi ${user.name},</p><p>You have been assigned as the <b>Primary Donor</b> for the request at <b>${request.hospital}</b>.</p><p>Please arrive within 2 hours to confirm your donation.</p><p>If you cannot make it, please cancel via the app so we can notify a backup.</p>`
        : `<p>Hi ${user.name},</p><p>You are a <b>Backup Donor</b> for the request at <b>${request.hospital}</b>.</p><p>Please standby. If the primary donor fails, you will be promoted and notified immediately.</p>`;

      sendMail({ to: user.email, subject, html }).catch(console.error);
    }

    // Notify Requester
    let requester = null;
    if (request.requesterId) {
      requester = await User.findById(request.requesterId);
    }
    if (requester?.email) {
      sendMail({
        to: requester.email,
        subject: "Donor Found!",
        html: `<p>Hi ${requester.name},</p><p>A donor (${user.name}) has accepted your request!</p><p>They are currently: <b>${role === 'primary' ? 'Primary Donor' : 'Backup Donor'}</b>.</p>`
      }).catch(console.error);
    }

    return res.json({ ok: true, role, message });

  } catch (err) {
    console.error("claimRequest:", err);
    return res.status(500).json({ error: "Failed to claim request: " + err.message });
  }
};

/**
 * POST /api/requests/interest/:id
 * Body: { uid }
 * Triggered when user clicks "Call" or "Navigate".
 * Sends an email to the donor asking for confirmation.
 */
export const registerInterest = async (req, res) => {
  try {
    const { id } = req.params;
    const { uid } = req.body;

    // Resolve user
    let user = null;
    if (uid) {
      const isObjectId = /^[0-9a-fA-F]{24}$/.test(uid);
      if (isObjectId) {
        user = await User.findOne({ $or: [{ uid }, { _id: uid }] });
      } else {
        user = await User.findOne({ uid });
      }
    }

    if (!user) return res.status(401).json({ error: "User not identified" });

    const request = await Request.findById(id);
    if (!request) return res.status(404).json({ error: "Request not found" });

    if (request.status === 'fulfilled' || request.status === 'cancelled') {
      return res.status(400).json({ error: "Request is already closed" });
    }

    // Check if already responded
    const existingResponse = await DonorResponse.findOne({ requestId: id, donorId: user._id });
    if (existingResponse) {
      return res.status(400).json({ error: "You have already responded to this request." });
    }

    // Prevent self-donation
    if (request.requesterId && user._id && request.requesterId.toString() === user._id.toString()) {
      return res.status(400).json({ error: "You cannot donate to your own request." });
    }

    if (!user.email) {
      return res.status(400).json({ error: "Email required to confirm donation." });
    }

    // Send Confirmation Email
    const confirmYesUrl = `${process.env.SERVER_BASE || 'http://localhost:5000'}/api/requests/confirm-interest/${id}?uid=${user.uid}&response=yes`;
    const confirmNoUrl = `${process.env.SERVER_BASE || 'http://localhost:5000'}/api/requests/confirm-interest/${id}?uid=${user.uid}&response=no`;

    const emailHtml = `
      <p>Hi ${user.name},</p>
      <p>You indicated interest in donating blood for the request at <b>${request.hospital}</b>.</p>
      <p><b>Do you confirm that you want to donate?</b></p>
      <p>
        <a href="${confirmYesUrl}" style="display:inline-block;padding:12px 24px;background:#4caf50;color:#fff;text-decoration:none;border-radius:4px;margin-right:10px;">✓ YES, I will donate</a>
        <a href="${confirmNoUrl}" style="display:inline-block;padding:12px 24px;background:#f44336;color:#fff;text-decoration:none;border-radius:4px;">✗ NO, I cannot</a>
      </p>
      <p>If you confirm YES, we will assign you as a donor and notify the requester.</p>
      <p>Thanks — Real-Hero</p>
    `;

    await sendMail({
      to: user.email,
      subject: "Confirm Your Donation Pledge",
      html: emailHtml
    });

    return res.json({ ok: true, message: "Confirmation email sent. Please check your inbox." });

  } catch (err) {
    console.error("registerInterest:", err);
    return res.status(500).json({ error: "Failed to register interest: " + err.message });
  }
};

/**
 * GET /api/requests/confirm-interest/:id
 * Query: { uid, response }
 * Handle donor's confirmation from email.
 */
export const confirmInterest = async (req, res) => {
  try {
    const { id } = req.params;
    const { uid, response } = req.query;

    if (response !== 'yes') {
      return res.send("<h1>Donation Pledge Cancelled</h1><p>Thank you for letting us know. We have not assigned you to this request.</p>");
    }

    // Resolve user
    let user = null;
    if (uid) {
      const isObjectId = /^[0-9a-fA-F]{24}$/.test(uid);
      if (isObjectId) {
        user = await User.findOne({ $or: [{ uid }, { _id: uid }] });
      } else {
        user = await User.findOne({ uid });
      }
    }

    if (!user) return res.status(404).send("User not found");

    const request = await Request.findById(id);
    if (!request) return res.status(404).send("Request not found");

    if (request.status === 'fulfilled' || request.status === 'cancelled') {
      return res.send("<h1>Request Closed</h1><p>This request has already been fulfilled or cancelled.</p>");
    }

    // Check if already claimed
    const existingResponse = await DonorResponse.findOne({ requestId: id, donorId: user._id });
    if (existingResponse) {
      return res.send(`<h1>Already Registered</h1><p>You are already registered as a ${existingResponse.role} donor.</p>`);
    }

    // --- ASSIGNMENT LOGIC (Moved from claimRequest) ---
    let role = 'backup';
    let message = "You are a Backup Donor. Standby!";

    if (request.status === 'open' || !request.primaryDonor?.donorId) {
      // Assign Primary
      role = 'primary';
      request.status = 'primary_assigned';
      request.primaryDonor = {
        donorId: user._id,
        acceptedAt: new Date(),
        confirmedAt: null,
        arrived: false
      };
      message = "You are the Primary Donor! Please arrive within 2 hours.";
    } else {
      // Assign Backup
      role = 'backup';
      if (request.status === 'primary_assigned') request.status = 'backup_assigned';
      request.backupDonors.push({
        donorId: user._id,
        acceptedAt: new Date(),
        promoted: false,
        reachedHospital: false,
        gpsVerified: false
      });
    }

    await request.save();

    // Create DonorResponse
    await DonorResponse.create({
      requestId: id,
      donorId: user._id,
      role,
      status: 'active',
      hospital: request.hospital
    });

    // Notify User (Email)
    const subject = role === 'primary' ? "URGENT: You are the Primary Donor" : "You are a Backup Donor";
    const html = role === 'primary'
      ? `<p>Hi ${user.name},</p><p>Thank you for confirming! You have been assigned as the <b>Primary Donor</b> for the request at <b>${request.hospital}</b>.</p><p>Please arrive within 2 hours.</p>`
      : `<p>Hi ${user.name},</p><p>Thank you for confirming! You are a <b>Backup Donor</b> for the request at <b>${request.hospital}</b>.</p><p>Please standby.</p>`;

    sendMail({ to: user.email, subject, html }).catch(console.error);

    // Notify Requester
    let requester = null;
    if (request.requesterId) {
      requester = await User.findById(request.requesterId);
    }
    if (requester?.email) {
      sendMail({
        to: requester.email,
        subject: "Donor Found!",
        html: `<p>Hi ${requester.name},</p><p>A donor (${user.name}) has confirmed their pledge!</p><p>They are currently: <b>${role === 'primary' ? 'Primary Donor' : 'Backup Donor'}</b>.</p>`
      }).catch(console.error);
    }

    return res.send(`<h1>Thank You!</h1><p>${message}</p><p>You can verify this in the app under 'My Donations'.</p>`);

  } catch (err) {
    console.error("confirmInterest:", err);
    return res.status(500).send("Internal Server Error: " + err.message);
  }
};
/**
 * POST /api/requests/verify-arrival/:id
 * Body: { uid, lat, lng }
 */
export const verifyArrival = async (req, res) => {
  // Placeholder for GPS verification
  return res.json({ ok: true, message: "Arrival verified (mock)" });
};

/**
 * POST /api/requests/complete/:id
 * Body: { uid }
 */
export const completeDonation = async (req, res) => {
  try {
    const { id } = req.params;
    const { uid } = req.body;

    const request = await Request.findById(id).populate('requesterId');
    if (!request) return res.status(404).json({ error: "Request not found" });

    // Get donor info
    const donor = await User.findOne({ uid });
    if (!donor) return res.status(404).json({ error: "Donor not found" });

    // Don't change status - keep it as is (primary_assigned or backup_assigned)
    // Just send verification email to requester
    await request.save();

    // Update DonorResponse status to 'completed' so it shows in history
    await DonorResponse.findOneAndUpdate(
      { requestId: id, donorId: donor._id },
      { status: 'completed' }
    );

    // Send verification email to requester
    let requester = request.requesterId;

    // Fallback: if requesterId is missing (legacy), try to find user by uid
    if (!requester && request.uid) {
      requester = await User.findOne({ uid: request.uid });
    }

    console.log('Requester info:', {
      hasRequester: !!requester,
      requesterEmail: requester?.email,
      requesterName: requester?.name
    });

    if (requester?.email) {
      const verifyYesUrl = `${process.env.SERVER_BASE || 'http://localhost:5000'}/api/requests/verify-donation/${id}?response=yes`;
      const verifyNoUrl = `${process.env.SERVER_BASE || 'http://localhost:5000'}/api/requests/verify-donation/${id}?response=no`;

      const emailHtml = `
        <p>Hi ${requester.name || 'User'},</p>
        <p><b>Donation Verification Required</b></p>
        <p>${donor.name || 'A donor'} has marked their donation as complete for your blood request at <b>${request.hospital}</b>.</p>
        <p><b>Did this donor actually donate blood?</b></p>
        <p>Please confirm:</p>
        <p>
          <a href="${verifyYesUrl}" style="display:inline-block;padding:12px 24px;background:#4caf50;color:#fff;text-decoration:none;border-radius:4px;margin-right:10px;">✓ YES, They Donated</a>
          <a href="${verifyNoUrl}" style="display:inline-block;padding:12px 24px;background:#f44336;color:#fff;text-decoration:none;border-radius:4px;">✗ NO, They Did Not</a>
        </p>
        <p>This verification helps us maintain trust in the system and reward genuine donors.</p>
        <p>Thanks — Real-Hero</p>
      `;

      console.log('Sending verification email to:', requester.email);
      await sendMail({
        to: requester.email,
        subject: "Verify Blood Donation - Action Required",
        html: emailHtml
      });
      console.log('Verification email sent successfully');
    } else {
      console.warn('No requester email found - cannot send verification email');
    }

    return res.json({ ok: true, message: "Verification email sent to requester. Rewards pending confirmation." });
  } catch (e) {
    console.error("completeDonation error:", e);
    return res.status(500).json({ error: e.message });
  }
};

/**
 * POST /api/requests/cancel/:id
 * Body: { uid }
 */
export const cancelDonation = async (req, res) => {
  try {
    const { id } = req.params;
    const { uid } = req.body;

    // Find the request and the donor
    const request = await Request.findById(id);
    if (!request) return res.status(404).json({ error: "Request not found" });

    const donor = await User.findOne({ uid });
    if (!donor) return res.status(404).json({ error: "Donor not found" });

    // Check if this donor is the primary donor
    const isPrimaryDonor = request.primaryDonor?.donorId?.toString() === donor._id.toString();

    if (isPrimaryDonor) {
      // Primary donor is cancelling - promote first backup
      const backupDonors = request.backupDonors || [];

      if (backupDonors.length > 0) {
        // Promote first backup to primary
        const newPrimary = backupDonors[0];
        request.primaryDonor = {
          donorId: newPrimary.donorId,
          acceptedAt: new Date(),
          confirmedAt: null,
          arrived: false
        };

        // Remove promoted donor from backups
        request.backupDonors = backupDonors.slice(1);

        // Update DonorResponse for promoted donor
        await DonorResponse.findOneAndUpdate(
          { requestId: id, donorId: newPrimary.donorId },
          { role: 'primary', status: 'active' }
        );

        // Update cancelled donor's response
        await DonorResponse.findOneAndUpdate(
          { requestId: id, donorId: donor._id },
          { status: 'cancelled' }
        );

        await request.save();

        // Send email to newly promoted primary donor
        const newPrimaryUser = await User.findById(newPrimary.donorId);
        if (newPrimaryUser?.email) {
          const emailHtml = `
            <p>Hi ${newPrimaryUser.name || 'Hero'},</p>
            <p><b>URGENT: You are now the Primary Donor!</b></p>
            <p>The previous primary donor has cancelled. You have been promoted from backup to <b>Primary Donor</b> for the request at <b>${request.hospital}</b>.</p>
            <p><b>Please arrive within 2 hours to confirm your donation.</b></p>
            <p>If you cannot make it, please cancel via the app so we can notify the next backup donor.</p>
            <p>Thank you for being a real hero!</p>
            <p>— Real-Hero Team</p>
          `;

          await sendMail({
            to: newPrimaryUser.email,
            subject: "URGENT: You are now the Primary Donor!",
            html: emailHtml
          });
        }

        // Notify Requester about the change
        const requester = await User.findById(request.requesterId);
        if (requester?.email) {
          await sendMail({
            to: requester.email,
            subject: "Donor Update: New Primary Donor Assigned",
            html: `<p>Hi ${requester.name},</p><p>The previous primary donor cancelled. We have automatically promoted <b>${newPrimaryUser.name}</b> to be your new Primary Donor.</p>`
          });
        }

        return res.json({ ok: true, message: "Donation cancelled. Backup donor promoted to primary." });
      } else {
        // No backups available - mark request as open again
        request.primaryDonor = null;
        request.status = 'open';

        // Update cancelled donor's response
        await DonorResponse.findOneAndUpdate(
          { requestId: id, donorId: donor._id },
          { status: 'cancelled' }
        );

        await request.save();
        return res.json({ ok: true, message: "Donation cancelled. Request is now open for new donors." });
      }
    } else {
      // Backup donor is cancelling - just remove them from backups
      request.backupDonors = request.backupDonors.filter(
        b => b.donorId.toString() !== donor._id.toString()
      );

      // Update cancelled donor's response
      await DonorResponse.findOneAndUpdate(
        { requestId: id, donorId: donor._id },
        { status: 'cancelled' }
      );

      await request.save();
      return res.json({ ok: true, message: "Donation cancelled." });
    }
  } catch (e) {
    console.error("cancelDonation error:", e);
    return res.status(500).json({ error: e.message });
  }
};

/**
 * GET /api/requests/my-requests
 * Query: { uid }
 */
export const getMyRequests = async (req, res) => {
  try {
    const { uid } = req.query;
    // Resolve user _id from uid
    const user = await User.findOne({ uid });
    if (!user) return res.json([]);

    const requests = await Request.find({ requesterId: user._id }).sort({ createdAt: -1 });
    const legacy = await Request.find({ uid }).sort({ createdAt: -1 });

    // Merge and dedup
    const all = [...requests, ...legacy].filter((v, i, a) => a.findIndex(t => (t._id.toString() === v._id.toString())) === i);

    return res.json(all);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};

/**
 * GET /api/requests/my-donations
 * Query: { uid }
 */
export const getMyDonations = async (req, res) => {
  try {
    const { uid } = req.query;
    const user = await User.findOne({ uid });
    if (!user) return res.json([]);

    const responses = await DonorResponse.find({ donorId: user._id }).populate('requestId').sort({ updatedAt: -1 });
    return res.json(responses);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};

/**
 * POST /api/requests/close/:id
 * Body: { uid }
 */
export const closeRequest = async (req, res) => {
  try {
    const { id } = req.params;
    // The user explicitly asked to DELETE the request from the database
    const deleted = await Request.findByIdAndDelete(id);
    if (!deleted) return res.status(404).json({ error: "Request not found" });

    return res.json({ ok: true, message: "Request deleted successfully." });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};

/**
 * GET /api/requests/verify-donation/:id?response=yes|no
 * Handle requester's verification response from email
 */
export const verifyDonation = async (req, res) => {
  try {
    const { id } = req.params;
    const { response } = req.query; // 'yes' or 'no'

    const request = await Request.findById(id).populate('requesterId');
    if (!request) return res.status(404).json({ error: "Request not found" });

    if (response === 'yes') {
      // Requester confirmed donation - distribute rewards
      request.status = 'fulfilled';
      await request.save();

      // Get primary donor
      const primaryDonor = await User.findById(request.primaryDonor?.donorId);

      // Get requester
      let requester = request.requesterId;

      // Fallback: if requesterId is missing (legacy), try to find user by uid
      if (!requester && request.uid) {
        requester = await User.findOne({ uid: request.uid });
      }

      console.log('verifyDonation - Requester info:', {
        hasRequester: !!requester,
        requesterEmail: requester?.email,
        requesterName: requester?.name
      });

      // Get ALL backup donors (reward for willingness)
      const backupDonorResponses = await DonorResponse.find({
        requestId: id,
        role: 'backup'
      }).populate('donorId');

      // Award rewards
      const rewardLogs = [];

      // Primary Donor: 50 coins + 10 leaderboard points
      if (primaryDonor) {
        primaryDonor.coins = (primaryDonor.coins || 0) + 50;
        primaryDonor.leaderboardPoints = (primaryDonor.leaderboardPoints || 0) + 10;
        await primaryDonor.save();

        // Update DonorResponse with reward points
        await DonorResponse.findOneAndUpdate(
          { requestId: id, donorId: primaryDonor._id },
          { rewardPoints: 10 }
        );

        await RewardLog.create({
          userId: primaryDonor._id,
          requestId: id,
          points: 10,
          coins: 50,
          leaderboardPoints: 10,
          patientName: request.name,
          hospital: request.hospital,
          type: 'donation_completed',
          description: 'Primary donor reward for completing donation'
        });

        // Send success email to donor
        if (primaryDonor.email) {
          const emailHtml = `
            <p>Hi ${primaryDonor.name || 'Hero'},</p>
            <p><b>Congratulations! 🎉</b></p>
            <p>On background verifications, we have proved that you have donated successfully at <b>${request.hospital}</b>.</p>
            <p><b>You have received your rewards:</b></p>
            <ul>
              <li>50 Coins</li>
              <li>10 Leaderboard Points</li>
            </ul>
            <p>Thank you for being a real hero and saving lives!</p>
            <p>— Real-Hero Team</p>
          `;

          await sendMail({
            to: primaryDonor.email,
            subject: "Donation Verified - Rewards Credited! 🎉",
            html: emailHtml
          });
        }
      }

      // Requester: 20 coins + 3 leaderboard points
      if (requester) {
        requester.coins = (requester.coins || 0) + 20;
        requester.leaderboardPoints = (requester.leaderboardPoints || 0) + 3;
        await requester.save();

        await RewardLog.create({
          userId: requester._id,
          requestId: id,
          points: 3,
          coins: 20,
          leaderboardPoints: 3,
          patientName: request.name,
          hospital: request.hospital,
          type: 'request_fulfilled',
          description: 'Requester reward for successful blood request'
        });
      }

      // Backup Donors: 10 coins + 2 leaderboard points each
      for (const donorResponse of backupDonorResponses) {
        const backupDonor = donorResponse.donorId;
        if (backupDonor) {
          backupDonor.coins = (backupDonor.coins || 0) + 10;
          backupDonor.leaderboardPoints = (backupDonor.leaderboardPoints || 0) + 2;
          await backupDonor.save();

          // Update DonorResponse with reward points
          await DonorResponse.findOneAndUpdate(
            { _id: donorResponse._id },
            { rewardPoints: 2 }
          );

          await RewardLog.create({
            userId: backupDonor._id,
            requestId: id,
            points: 2,
            coins: 10,
            leaderboardPoints: 2,
            patientName: request.name,
            hospital: request.hospital,
            type: 'backup_arrival',
            description: 'Backup donor reward for willingness to donate'
          });

          // Send email to backup donor
          if (backupDonor.email) {
            const emailHtml = `
              <p>Hi ${backupDonor.name || 'Hero'},</p>
              <p><b>Thank You for Your Willingness! 🎉</b></p>
              <p>The blood donation request at <b>${request.hospital}</b> has been successfully fulfilled.</p>
              <p>You have received rewards for your willingness to donate:</p>
              <ul>
                <li>10 Coins</li>
                <li>2 Leaderboard Points</li>
              </ul>
              <p>Thank you for being ready to save lives!</p>
              <p>— Real-Hero Team</p>
            `;
            await sendMail({
              to: backupDonor.email,
              subject: "Thank You for Your Willingness! 🎉",
              html: emailHtml
            });
          }
        }
      }

      // Snapshot hospital name to all donor responses before deleting request
      await DonorResponse.updateMany(
        { requestId: id },
        { $set: { hospital: request.hospital } }
      );

      // Delete the request as fulfilled
      await Request.findByIdAndDelete(id);
      console.log(`verifyDonation: Request ${id} deleted after fulfillment.`);

      // Return success page
      return res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Donation Verified</title>
          <style>
            body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; text-align: center; }
            h1 { color: #4caf50; }
            p { font-size: 18px; line-height: 1.6; }
          </style>
        </head>
        <body>
          <h1>✓ Donation Verified!</h1>
          <p>Thank you for confirming the donation. Rewards have been distributed to all participants.</p>
          <p>The request has been removed from the active list.</p>
          <p>You can close this page now.</p>
        </body>
        </html>
      `);

    } else if (response === 'no') {
      // Requester said donor did NOT donate
      request.status = 'failed';
      await request.save();

      // Get primary donor
      const primaryDonor = await User.findById(request.primaryDonor?.donorId);

      // Send email to donor about verification failure
      if (primaryDonor?.email) {
        const emailHtml = `
          <p>Hi ${primaryDonor.name || 'User'},</p>
          <p>We regret to inform you that the requester has indicated that the donation was not completed for the request at <b>${request.hospital}</b>.</p>
          <p>If you believe this is an error, please contact our support team.</p>
          <p>— Real-Hero Team</p>
        `;

        await sendMail({
          to: primaryDonor.email,
          subject: "Donation Verification Failed",
          html: emailHtml
        });
      }

      // Return failure page
      return res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Verification Recorded</title>
          <style>
            body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; text-align: center; }
            h1 { color: #f44336; }
            p { font-size: 18px; line-height: 1.6; }
          </style>
        </head>
        <body>
          <h1>Verification Recorded</h1>
          <p>Thank you for your feedback. The donation has been marked as not completed.</p>
          <p>You can close this page now.</p>
        </body>
        </html>
      `);
    } else {
      return res.status(400).json({ error: "Invalid response. Use 'yes' or 'no'." });
    }

  } catch (e) {
    console.error("verifyDonation error:", e);
    return res.status(500).json({ error: e.message });
  }
};

