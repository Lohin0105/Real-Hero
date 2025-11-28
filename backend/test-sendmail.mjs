// 🔥 MUST load dotenv BEFORE importing sendMail
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// Resolve backend directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// FORCE LOAD .env from backend folder
dotenv.config({ path: path.join(__dirname, ".env") });

// DEBUG: print env to confirm
console.log("SMTP_HOST =", process.env.SMTP_HOST);
console.log("SMTP_USER =", process.env.SMTP_USER);
console.log("SMTP_PASS =", process.env.SMTP_PASS ? "SET" : "NOT SET");
console.log("EMAIL_FROM =", process.env.EMAIL_FROM);

// ❗ Only NOW import sendMail (after .env is loaded)
import { sendMail } from "./utils/emailNotifier.mjs";

(async () => {
  console.log("Sending test email...");

  const result = await sendMail({
    to: "vtu24199@veltech.edu.in",
    subject: "Real-Hero TEST EMAIL",
    html: `<h2>This is a test email from Real-Hero</h2>`,
  });

  console.log("RESULT:", result);
})();
