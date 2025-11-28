// backend/controllers/notifyController.mjs
import Notification from "../models/Notification.mjs";
import User from "../models/User.mjs";
import Request from "../models/Request.mjs";
import Offer from "../models/Offer.mjs";
import DonorResponse from "../models/DonorResponse.mjs";
import admin from "../config/firebaseAdmin.mjs";
import { sendMail } from "../utils/emailNotifier.mjs";
import crypto from "crypto";
// Twilio is optional — if you want automatic WhatsApp sends you can configure
// TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_WHATSAPP_FROM in your .env.
let twilioClient = null;
try {
  if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
    // require lazily so the dependency is optional
    // developer note: run `npm i twilio` if you want active WhatsApp API support
    // and add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_WHATSAPP_FROM to .env
    // TWILIO_WHATSAPP_FROM should be in the format 'whatsapp:+1415xxxxxxx'
    // Twilio's WhatsApp sandbox allows testing with 'whatsapp:+14155238886'
    // but production usage requires WhatsApp Business approval.
    // Use optional import to avoid hard dependency when not used.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const twilio = require("twilio");
    twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  }
} catch (e) {
  console.warn("Twilio client not initialized (optional).", e?.message || e);
}

/* Safe token verification helper */
async function tryVerifyToken(authHeader) {
  try {
    if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
    const token = authHeader.split(" ")[1];
    const decoded = await admin.auth().verifyIdToken(token);
    return decoded;
  } catch (e) {
    return null;
  }
}

/**
 * POST /api/notify/share-availability
 * (unchanged behavior) - kept for completeness
 */
export const shareAvailability = async (req, res) => {
  try {
    console.log("notify.shareAvailability called. body:", req.body);
    const { uid: uidInBody, message, urgency } = req.body;

    let user = null;
    const decoded = await tryVerifyToken(req.headers.authorization);
    if (decoded?.uid) {
      user = await User.findOne({ uid: decoded.uid });
    }

    if (!user && uidInBody) {
      user = (await User.findOne({ uid: uidInBody })) || (await User.findById(uidInBody).catch(() => null));
    }

    if (!user && req.body.userId) user = await User.findById(req.body.userId).catch(() => null);
    if (!user && req.body.email) user = await User.findOne({ email: req.body.email });

    if (!user) return res.status(401).json({ message: "Authentication required or user not found" });

    const notification = await Notification.create({
      userId: user._id,
      title: urgency ? "Urgent Availability" : "Availability Shared",
      body: message || `${user.name || "Donor"} is available to donate.`,
      meta: { urgency: Boolean(urgency) },
    });

    return res.json({
      ok: true,
      notificationId: notification._id,
      message: "Availability broadcast saved.",
    });
  } catch (err) {
    console.error("shareAvailability:", err);
    return res.status(500).json({ error: "Failed to share availability" });
  }
};

/**
 * POST /api/notify/offer
 * Called when donor clicks CALL or NAVIGATE; creates Offer record,
 * sends email to donor (if email exists) and returns WhatsApp link (free)
 */
export const createOffer = async (req, res) => {
  try {
    console.log("📨 createOffer body:", req.body);
    const { requestId, units } = req.body;
    if (!requestId) return res.status(400).json({ error: "requestId required" });

    const reqDoc = await Request.findById(requestId).lean().catch(() => null);
    if (!reqDoc) return res.status(404).json({ error: "Request not found" });

    // identify donor via token or body
    let donorUid = null;
    let donor = null;
    let donorEmail = null;
    let donorSnapshot = {};

    const decoded = await tryVerifyToken(req.headers.authorization);
    if (decoded?.uid) {
      donorUid = decoded.uid;
      donor = await User.findOne({ uid: donorUid }).lean().catch(() => null);

      // If donor record missing or doesn't include phone/age, try to pull profile from Firebase
      // This covers cases where the user logged in (Firebase) but DB was not yet created/updated.
      if ((!donor || !donor.phone || donor.age === undefined || donor.age === null) && decoded?.uid) {
        try {
          const fbUser = await admin.auth().getUser(decoded.uid).catch(() => null);
          if (fbUser) {
            // prefer firebase phone if DB missing
            const fbPhone = fbUser.phoneNumber || null;
            const fbEmail = fbUser.email || null;
            const fbName = fbUser.displayName || null;

            // If donor DB exists but lacks phone, persist the firebase phone
            if (donor) {
              const update = {};
              if (!donor.phone && fbPhone) update.phone = fbPhone;
              if ((!donor.email || donor.email === null) && fbEmail) update.email = fbEmail;
              if ((!donor.name || donor.name === null) && fbName) update.name = fbName;
              if (Object.keys(update).length > 0) {
                try { await User.updateOne({ uid: decoded.uid }, { $set: update }).catch(() => null); } catch (e) { /* ignore */ }
                // refresh donor object with the updated fields
                donor = await User.findOne({ uid: donorUid }).lean().catch(() => donor) || donor;
              }
            } else {
              // No DB user existed; try to create a minimal User record so we can persist phone and other fields
              try {
                const created = await User.create({ uid: decoded.uid, name: fbName || undefined, email: fbEmail || undefined, phone: fbPhone || undefined });
                donor = created.toObject ? created.toObject() : created;
              } catch (e) {
                // If create fails (maybe user record already created concurrently), just try to re-read
                donor = await User.findOne({ uid: donorUid }).lean().catch(() => null);
              }
            }
          }
        } catch (e) {
          console.warn('createOffer: firebase lookup failed', e?.message || e);
        }
      }
    }

    if (donor) {
      donorSnapshot = { name: donor.name || "", phone: donor.phone || "", email: donor.email || "", age: donor.age ?? "" };
      console.debug('createOffer: donorSnapshot for donor', donorUid, donorSnapshot);
      donorEmail = donor.email || null;
    } else {
      // allow optional donor info in body (for unauthenticated donors)
      donorSnapshot = {
        name: req.body.name || "",
        phone: req.body.phone || "",
        email: req.body.email || "",
        age: req.body.age ?? "",
      };
      donorEmail = donorSnapshot.email || null;
      if (req.body.uid) donorUid = req.body.uid;
    }

    const token = crypto.randomBytes(18).toString("hex");
    const followUpAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    // If the donor does not have a phone number yet, allow caller to pass donorPhone to attach
    // If still missing, return a clear error so frontend can ask donor to provide phone.
    if (!donorSnapshot.phone) {
      // If caller supplied a donorPhone in the body, use it and persist to user record if possible
      const fallbackPhone = (req.body && req.body.donorPhone) ? String(req.body.donorPhone).trim() : null;
      if (fallbackPhone) {
        donorSnapshot.phone = fallbackPhone;
        // persist back to user profile if we have a linked user
        if (donor && donor._id) {
          try {
            await User.updateOne({ _id: donor._id }, { $set: { phone: fallbackPhone } }).catch(() => null);
          } catch (e) {
            // non-fatal
            console.warn('createOffer: failed to persist donor phone to user record', e?.message || e);
          }
        }
      }
    }

    // Also allow an incoming donorAge field (when collected via UI) and persist it if donor exists
    if (!donorSnapshot.age && req.body && (req.body.donorAge || req.body.age)) {
      const ageVal = req.body.donorAge ?? req.body.age;
      donorSnapshot.age = ageVal;
      if (donor && donor._id) {
        try {
          await User.updateOne({ _id: donor._id }, { $set: { age: ageVal } }).catch(() => null);
        } catch (e) {
          console.warn('createOffer: failed to persist donor age to user record', e?.message || e);
        }
      }
    }

    if (!donorSnapshot.phone) {
      // phone is essential for the requester's contact — ask the frontend to prompt donor for it
      return res.status(400).json({ error: 'missing_donor_phone', message: 'Donor phone is required to create an offer. Please provide a phone number.' });
    }

    const offer = await Offer.create({
      requestId,
      donorSnapshot,
      donorUserId: donor?._id,
      donorUid: donor?.uid || donorUid,
      token,
      units: units || 1,
      createdAt: new Date(),
      followUpAt,
    });

    // Prepare email to donor (if email available)
    if (donorEmail) {
      const base = process.env.SERVER_BASE || (req.protocol + "://" + req.get("host"));
      const yesUrl = `${base}/api/notify/offer/respond?token=${token}&resp=yes`;
      const noUrl = `${base}/api/notify/offer/respond?token=${token}&resp=no`;

      const html = `
        <p>Hi ${donorSnapshot.name || "Donor"},</p>
        <p>You received a blood request from <b>${reqDoc.name}</b> at <b>${reqDoc.hospital || ""}</b>.</p>
        <p>Are you willing to donate?</p>
        <p>
          <a href="${yesUrl}">YES — I will donate</a> |
          <a href="${noUrl}">NO — I cannot</a>
        </p>
        <br/>
        <p>Thanks — Real-Hero</p>
      `;

      try {
        const r = await sendMail({ to: donorEmail, subject: "Blood Donation Confirmation Needed", html });
        console.log("createOffer: sendMail result:", r);
      } catch (e) {
        console.warn("createOffer: failed to send donor email:", e?.message || e);
      }
    } else {
      console.log("createOffer: donorEmail missing; skipping donor email");
    }

    // Build WhatsApp prefilled link (works on phones and whatsapp web)
    const phoneForWa = donorSnapshot.phone ? String(donorSnapshot.phone).replace(/[^\d+]/g, "") : null; // strip non-digits except +
    let whatsappLink = null;
    if (phoneForWa) {
      const text = encodeURIComponent(
        `Hi ${donorSnapshot.name || ""}, are you willing to donate blood to ${reqDoc.name}? Please reply YES or NO.`
      );
      const normalized = phoneForWa.startsWith("+") ? phoneForWa.slice(1) : phoneForWa;
      whatsappLink = `https://wa.me/${normalized}?text=${text}`;
    }

    return res.json({
      ok: true,
      offerId: offer._id,
      whatsapp: whatsappLink,
      message: "Offer created. Email sent to donor if available. WhatsApp link included if donor phone known.",
    });
  } catch (err) {
    console.error("createOffer error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * GET /api/notify/offer/respond?token=..&resp=yes|no
 * Donor responded via email; on YES notify requester
 */
export const respondOffer = async (req, res) => {
  try {
    const { token, resp } = req.query;
    if (!token || !resp) return res.status(400).send("Missing token or resp");
    const r = resp === "yes" ? "yes" : "no";

    const offer = await Offer.findOne({ token });
    if (!offer) return res.status(404).send("Offer not found");
    if (offer.response) return res.send("Offer already responded");

    offer.response = r;
    offer.respondedAt = new Date();
    offer.status = r === "yes" ? "accepted" : "declined";
    await offer.save();

    if (r === "yes") {
      // Integrate with Claim System
      try {
        const request = await Request.findById(offer.requestId);
        let donorUser = null;
        if (offer.donorUserId) donorUser = await User.findById(offer.donorUserId);
        else if (offer.donorUid) donorUser = await User.findOne({ uid: offer.donorUid });

        if (request && donorUser) {
          // Check if already claimed
          const existing = await DonorResponse.findOne({ requestId: request._id, donorId: donorUser._id });

          if (!existing) {
            let role = 'backup';
            if (request.status === 'open' || !request.primaryDonor?.donorId) {
              role = 'primary';
              request.status = 'primary_assigned';
              request.primaryDonor = {
                donorId: donorUser._id,
                acceptedAt: new Date(),
                confirmedAt: null,
                arrived: false
              };
            } else {
              role = 'backup';
              if (request.status === 'primary_assigned') request.status = 'backup_assigned';
              request.backupDonors = request.backupDonors || [];
              request.backupDonors.push({
                donorId: donorUser._id,
                acceptedAt: new Date(),
                promoted: false,
                reachedHospital: false,
                gpsVerified: false
              });
            }
            await request.save();

            await DonorResponse.create({
              requestId: request._id,
              donorId: donorUser._id,
              role,
              status: 'active'
            });

            // Send "You are Primary/Backup" email to Donor
            if (donorUser.email) {
              const subject = role === 'primary' ? "URGENT: You are the Primary Donor" : "You are a Backup Donor";
              const html = role === 'primary'
                ? `<p>Hi ${donorUser.name},</p><p>You have been assigned as the <b>Primary Donor</b> for the request at <b>${request.hospital}</b>.</p><p>Please arrive within 2 hours to confirm your donation.</p><p>If you cannot make it, please cancel via the app so we can notify a backup.</p>`
                : `<p>Hi ${donorUser.name},</p><p>You are a <b>Backup Donor</b> for the request at <b>${request.hospital}</b>.</p><p>Please standby. If the primary donor fails, you will be promoted and notified immediately.</p>`;
              sendMail({ to: donorUser.email, subject, html }).catch(console.error);
            }
          }
        }
      } catch (claimErr) {
        console.error("respondOffer: claim integration failed", claimErr);
      }

      try {
        const reqDoc = await Request.findById(offer.requestId).lean().catch(() => null);
        if (reqDoc) {
          let requesterEmail = null;
          let requesterEmailSource = null;
          if (reqDoc.email) {
            requesterEmail = reqDoc.email;
            requesterEmailSource = 'request';
          }
          if (!requesterEmail && reqDoc.uid) {
            const ru = await User.findOne({ uid: reqDoc.uid });
            if (ru?.email) {
              requesterEmail = ru.email;
              requesterEmailSource = 'user';
            }
          }

          if (requesterEmail) {
            let donor = offer.donorSnapshot || {};
            try {
              if ((!donor.age || !donor.phone || !donor.email) && (offer.donorUserId || offer.donorUid)) {
                const liveDonor = offer.donorUserId ? await User.findById(offer.donorUserId).lean().catch(() => null) : await User.findOne({ uid: offer.donorUid }).lean().catch(() => null);
                if (liveDonor) {
                  donor = {
                    name: donor.name || liveDonor.name || "",
                    age: donor.age ?? liveDonor.age ?? "",
                    phone: donor.phone || liveDonor.phone || "",
                    email: donor.email || liveDonor.email || "",
                  };
                }
              }
            } catch (e) {
              console.warn('respondOffer: failed to fetch live donor record, using snapshot', e?.message || e);
            }
            const html = `
              <p>Hi ${reqDoc.name || "Requester"},</p>
              <p>Good news — a donor has confirmed they are willing to donate blood.</p>
              <p><strong>Donor details</strong></p>
              <ul>
                <li>Name: ${donor.name || "—"}</li>
                <li>Age: ${donor.age ?? donor.age === 0 ? donor.age : "—"}</li>
                <li>Phone: ${donor.phone ? `<a href="tel:${donor.phone}">${donor.phone}</a>` : "—"}</li>
                <li>Email: ${donor.email ? `<a href="mailto:${donor.email}">${donor.email}</a>` : "—"}</li>
              </ul>
              <p>Please contact the donor to coordinate.</p>
              <p>Thanks — Real-Hero</p>
            `;
            try {
              const result = await sendMail({ to: requesterEmail, subject: `Donor ${donor.name || ""} is willing to donate`, html });
              console.log("respondOffer: emailed requester at", requesterEmail, "(source:", requesterEmailSource, ") offerId:", offer._id, "sendResult:", result);
            } catch (e) {
              console.error("respondOffer: sendMail failed for requester", requesterEmail, e?.message || e);
            }
          }

          // Also send a WhatsApp notification to the requester if we have a phone.
          if (reqDoc?.phone) {
            try {
              // build message text similar to the email
              const base = process.env.SERVER_BASE || (req.protocol + "://" + req.get("host"));
              // allow requester to confirm donation via a follow-up link that points to our follow-up endpoint
              const yesConfirm = `${base}/api/notify/offer/followup/respond?offerId=${offer._id}&resp=yes`;
              const noConfirm = `${base}/api/notify/offer/followup/respond?offerId=${offer._id}&resp=no`;

              const waText = `Hi ${reqDoc.name || "Requester"}, donor ${donor.name || ""} (Age: ${donor.age ?? "—"}, Phone: ${donor.phone || "—"}, Email: ${donor.email || "—"}) has confirmed they will donate for your request. Reply YES at ${yesConfirm} or NO at ${noConfirm} — or contact the donor to coordinate.`;

              const phoneForWa = String(reqDoc.phone).replace(/[^\d+]/g, "");
              const normalizedReq = phoneForWa.startsWith("+") ? phoneForWa.slice(1) : phoneForWa;

              if (twilioClient && process.env.TWILIO_WHATSAPP_FROM) {
                // send via Twilio WhatsApp API if configured (developer must provide TWILIO_* env vars)
                try {
                  await twilioClient.messages.create({
                    from: process.env.TWILIO_WHATSAPP_FROM,
                    to: `whatsapp:+${normalizedReq}`,
                    body: waText,
                  });
                  console.log("respondOffer: WhatsApp sent via Twilio to", reqDoc.phone);
                } catch (tE) {
                  console.warn("respondOffer: Twilio WhatsApp send failed, falling back to wa.me link", tE?.message || tE);
                  const waLink = `https://wa.me/${normalizedReq}?text=${encodeURIComponent(waText)}`;
                  console.log("respondOffer: wa.me fallback link:", waLink);
                  // create in-app notification with link
                  if (reqDoc.uid) {
                    const ru2 = await User.findOne({ uid: reqDoc.uid });
                    if (ru2) {
                      await Notification.create({ userId: ru2._id, title: "Donor confirmed (WhatsApp)", body: `Donor ${donor.name || ""} confirmed. Open WhatsApp to notify them.`, meta: { offerId: offer._id, whatsapp: waLink } });
                    }
                  }
                }
              } else {
                // not configured for API sending — create wa.me link and in-app notification
                const waLink = `https://wa.me/${normalizedReq}?text=${encodeURIComponent(waText)}`;
                console.log("respondOffer: requester no email, WhatsApp link:", waLink);
                if (reqDoc.uid) {
                  const ru2 = await User.findOne({ uid: reqDoc.uid });
                  if (ru2) {
                    await Notification.create({ userId: ru2._id, title: "Donor confirmed (WhatsApp)", body: `Donor ${donor.name || ""} confirmed. Open WhatsApp to view details.`, meta: { offerId: offer._id, whatsapp: waLink } });
                    console.log("respondOffer: created in-app notification with whatsapp link for requester user", ru2._id);
                  }
                }
              }
            } catch (waErr) {
              console.error("respondOffer: failed to generate/send WhatsApp notification:", waErr);
            }
          } else {
            console.log("respondOffer: requester email not found, attempting phone/notification fallback");
            try {
              let donor = offer.donorSnapshot || {};
              try {
                if ((!donor.age || !donor.phone || !donor.email) && (offer.donorUserId || offer.donorUid)) {
                  const liveDonor = offer.donorUserId ? await User.findById(offer.donorUserId).lean().catch(() => null) : await User.findOne({ uid: offer.donorUid }).lean().catch(() => null);
                  if (liveDonor) {
                    donor = {
                      name: donor.name || liveDonor.name || "",
                      age: donor.age ?? liveDonor.age ?? "",
                      phone: donor.phone || liveDonor.phone || "",
                      email: donor.email || liveDonor.email || "",
                    };
                  }
                }
              } catch (e) {
                console.warn('respondOffer fallback: failed to fetch live donor record', e?.message || e);
              }
              // If requester has a phone, build a WhatsApp prefilled link and log it (can't send via API without paid WhatsApp)
              if (reqDoc?.phone) {
                const phoneForWa = String(reqDoc.phone).replace(/[^\d+]/g, "");
                const normalizedReq = phoneForWa.startsWith("+") ? phoneForWa.slice(1) : phoneForWa;
                const text = encodeURIComponent(
                  `Hi ${reqDoc.name || "Requester"}, donor ${donor.name || ""} (Age: ${donor.age ?? "—"}, Phone: ${donor.phone || "—"}, Email: ${donor.email || "—"}) has confirmed they will donate. Please contact them to coordinate.`
                );
                const waLink = `https://wa.me/${normalizedReq}?text=${text}`;
                console.log("respondOffer: requester no email, WhatsApp link:", waLink);

                // Create an in-app notification if requester is a registered user
                if (reqDoc.uid) {
                  const ru2 = await User.findOne({ uid: reqDoc.uid });
                  if (ru2) {
                    await Notification.create({
                      userId: ru2._id,
                      title: "Donor confirmed",
                      body: `Donor ${donor.name || ""} has confirmed. Phone: ${donor.phone || "—"}`,
                      meta: { offerId: offer._id, whatsapp: waLink },
                    });
                    console.log("respondOffer: created in-app notification for requester user", ru2._id);
                  }
                }
              } else {
                console.log("respondOffer: requester has no email or phone; unable to notify by email/whatsapp");
              }
            } catch (e) {
              console.error("respondOffer fallback notify error:", e);
            }
          }
        }
      } catch (e) {
        console.error("respondOffer: failed to notify requester:", e);
      }
    }

    return res.send(`<html><body><h3>Thanks — your response was recorded as "${r}".</h3><p>You can close this window.</p></body></html>`);
  } catch (err) {
    console.error("respondOffer error:", err);
    return res.status(500).send("Failed to process response");
  }
};

/**
 * GET /api/notify/notifications
 * Returns notifications for the authenticated user
 */
export const getNotifications = async (req, res) => {
  try {
    const decoded = await tryVerifyToken(req.headers.authorization);
    if (!decoded?.uid) return res.status(401).json({ error: 'Authentication required' });

    const user = await User.findOne({ uid: decoded.uid });
    if (!user) return res.status(401).json({ error: 'User not found' });

    const notifications = await Notification.find({ userId: user._id }).sort({ createdAt: -1 }).limit(200).lean();
    return res.json({ ok: true, notifications });
  } catch (e) {
    console.error('getNotifications error:', e);
    return res.status(500).json({ error: 'Failed to fetch notifications' });
  }
};

/**
 * POST /api/notify/notifications/mark-read
 * Body: { ids: [array of notification ids], markAll: boolean }
 * Marks notifications as read for authenticated user.
 */
export const markNotificationsRead = async (req, res) => {
  try {
    const decoded = await tryVerifyToken(req.headers.authorization);
    if (!decoded?.uid) return res.status(401).json({ error: 'Authentication required' });

    const user = await User.findOne({ uid: decoded.uid });
    if (!user) return res.status(401).json({ error: 'User not found' });

    const { ids, markAll } = req.body || {};
    let result = null;
    if (markAll) {
      result = await Notification.updateMany({ userId: user._id, read: { $ne: true } }, { $set: { read: true, readAt: new Date() } });
    } else if (Array.isArray(ids) && ids.length > 0) {
      const objectIds = ids.map((i) => i);
      result = await Notification.updateMany({ _id: { $in: objectIds }, userId: user._id }, { $set: { read: true, readAt: new Date() } });
    } else {
      return res.status(400).json({ error: 'Provide ids array or set markAll=true' });
    }

    return res.json({ ok: true, modifiedCount: result?.modifiedCount ?? result?.nModified ?? 0 });
  } catch (e) {
    console.error('markNotificationsRead error:', e);
    return res.status(500).json({ error: 'Failed to mark notifications read' });
  }
};

/**
 * Background follow-up worker - sends follow-up after 24h asking requester if donor donated.
 * Marks followUpSent to avoid duplicate sends.
 */
async function startOfferFollowUpWorker() {
  try {
    const INTERVAL_MS = 60 * 1000; // every minute for dev; increase in prod
    setInterval(async () => {
      try {
        const now = new Date();
        const offers = await Offer.find({ followUpAt: { $lte: now }, followUpSent: { $ne: true } }).limit(50).lean();
        for (const o of offers) {
          try {
            const reqDoc = await Request.findById(o.requestId).lean().catch(() => null);
            if (!reqDoc) {
              await Offer.updateOne({ _id: o._id }, { $set: { followUpSent: true } }).catch(() => { });
              continue;
            }

            let requesterEmail = null;
            if (reqDoc.email) requesterEmail = reqDoc.email;
            if (!requesterEmail && reqDoc.uid) {
              const ru = await User.findOne({ uid: reqDoc.uid });
              if (ru?.email) requesterEmail = ru.email;
            }

            if (!requesterEmail) {
              console.log("followUpWorker: no requester email for offer", o._id);
              await Offer.updateOne({ _id: o._id }, { $set: { followUpSent: true } }).catch(() => { });
              continue;
            }

            const base = process.env.SERVER_BASE || "http://localhost:5000";
            const yesUrl = `${base}/api/notify/offer/followup/respond?offerId=${o._id}&resp=yes`;
            const noUrl = `${base}/api/notify/offer/followup/respond?offerId=${o._id}&resp=no`;

            const html = `
              <p>Hi ${reqDoc.name || "Requester"},</p>
              <p>Following up: did donor <strong>${o.donorSnapshot?.name || "Donor"}</strong> donate blood?</p>
              <p><a href="${yesUrl}">Yes — they donated</a> | <a href="${noUrl}">No — they did not</a></p>
              <p>Thanks — Real-Hero</p>
            `;

            await sendMail({ to: requesterEmail, subject: `Follow-up: did the donor donate?`, html });

            await Offer.updateOne({ _id: o._id }, { $set: { followUpSent: true, followUpSentAt: new Date() } });
            console.log("followUpWorker: sent followup for offer", o._id);
          } catch (e) {
            console.error("followUpWorker: error processing offer", o._id, e);
          }
        }
      } catch (e) {
        console.error("followUpWorker: scanning error", e);
      }
    }, INTERVAL_MS);
  } catch (e) {
    console.error("startOfferFollowUpWorker failed:", e);
  }
}

startOfferFollowUpWorker();

/**
 * GET /api/notify/offer/followup/respond?offerId=...&resp=yes|no
 * Records follow-up response; if yes => award coins
 */
export const followUpRespond = async (req, res) => {
  try {
    const { offerId, resp } = req.query;
    if (!offerId || !resp) return res.status(400).send("Missing offerId or resp");

    const offer = await Offer.findById(offerId);
    if (!offer) return res.status(404).send("Offer not found");
    if (offer.followUpResponse) return res.send("Already responded");

    const r = resp === "yes" ? "yes" : "no";
    offer.followUpResponse = r;
    offer.followUpRespondedAt = new Date();
    await offer.save();

    if (r === "yes") {
      try {
        let donorUser = null;
        if (offer.donorUserId) donorUser = await User.findById(offer.donorUserId);
        else if (offer.donorUid) donorUser = await User.findOne({ uid: offer.donorUid });

        if (donorUser) {
          donorUser.heroCoins = (donorUser.heroCoins || 0) + 50 * (offer.units || 1);
          donorUser.donationsCount = (donorUser.donationsCount || 0) + 1;
          await donorUser.save();
        }

        let requesterUser = null;
        const reqDoc = await Request.findById(offer.requestId).lean().catch(() => null);
        if (reqDoc?.uid) requesterUser = await User.findOne({ uid: reqDoc.uid });
        if (requesterUser) {
          requesterUser.heroCoins = (requesterUser.heroCoins || 0) + 5;
          await requesterUser.save();
        }

        if (donorUser?.email) {
          await sendMail({ to: donorUser.email, subject: "Thank you — reward credited", html: `<p>Hi ${donorUser.name || ''},<br/>Thank you for donating. Rewards have been credited.</p>` });
        }
        if (reqDoc?.email) {
          await sendMail({ to: reqDoc.email, subject: "Donation confirmed — thank you", html: `<p>Hi ${reqDoc.name || ''}, <br/>Donation confirmed. Thanks!</p>` });
        }
      } catch (e) {
        console.error("followUpRespond: reward assign error:", e);
      }
    } else {
      try {
        const reqDoc = await Request.findById(offer.requestId).lean().catch(() => null);
        if (reqDoc?.email) {
          await sendMail({ to: reqDoc.email, subject: "Thanks for your response", html: `<p>Hi ${reqDoc.name || ''},<br/>Thanks for updating this request — we appreciate you using Real-Hero.</p>` });
        }
      } catch (e) {
        console.error("followUpRespond (no) email error:", e);
      }
    }

    return res.send(`<html><body><h3>Thanks — your follow-up response "${r}" recorded.</h3></body></html>`);
  } catch (err) {
    console.error("followUpRespond error:", err);
    return res.status(500).send("Failed to process follow-up response");
  }
};
