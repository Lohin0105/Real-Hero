// backend/utils/emailNotifier.mjs
import dotenv from "dotenv";
dotenv.config();

import nodemailer from "nodemailer";

const FROM_EMAIL = process.env.EMAIL_FROM || "no-reply@real-hero.local";
const SMTP_HOST = process.env.SMTP_HOST || "smtp-relay.brevo.com";
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_USER = process.env.SMTP_USER || "";
const SMTP_PASS = process.env.SMTP_PASS || "";

if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
  console.warn("emailNotifier: SMTP configuration incomplete. Check .env");
}

let transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: SMTP_PORT === 465,
  auth: {
    user: SMTP_USER,
    pass: SMTP_PASS,
  },
  tls: {
    rejectUnauthorized: false,
  },
  logger: true,
  debug: true,
});

transporter.verify((err, success) => {
  if (err) {
    console.error("❌ SMTP verification failed:", err?.message || err);
  } else {
    console.log("📧 SMTP transporter ready");
  }
});

function normalizeRecipients(to) {
  if (!to) return [];
  if (Array.isArray(to)) return to.map(String).filter(Boolean);
  return String(to)
    .split(/[;,]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function sendMail({ to, subject, html, text }) {
  try {
    const recipients = normalizeRecipients(to);
    if (recipients.length === 0) {
      const msg = "sendMail: missing recipient";
      console.warn(msg);
      return { ok: false, error: msg };
    }

    const info = await transporter.sendMail({
      from: FROM_EMAIL,
      to: recipients.join(", "),
      subject: subject || "(no subject)",
      html: html || undefined,
      text: text || (html ? html.replace(/<[^>]+>/g, "") : ""),
    });

    console.log("📧 Email sent:", {
      to: recipients,
      messageId: info?.messageId,
      accepted: info?.accepted,
      rejected: info?.rejected,
    });

    return { ok: true, info };
  } catch (err) {
    console.error("❌ sendMail error:", err?.message || err);
    return { ok: false, error: err };
  }
}

export async function sendMailToMany({ to, subject, html, text }) {
  const recipients = normalizeRecipients(to);
  if (recipients.length === 0) return { ok: false, error: "missing recipients" };

  const results = [];
  for (const r of recipients) {
    try {
      const resp = await sendMail({ to: r, subject, html, text });
      results.push({ to: r, ok: Boolean(resp.ok), info: resp.info, error: resp.error || null });
    } catch (e) {
      results.push({ to: r, ok: false, error: e?.message || e });
    }
  }
  return { ok: true, results };
}
