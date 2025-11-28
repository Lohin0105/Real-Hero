import admin from "firebase-admin";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Load service account JSON safely at runtime instead of using import assertion
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// service account file is stored in backend/ (one level above config/)
const saPath = path.join(__dirname, "..", "blood-donation-14331-firebase-adminsdk-fbsvc-53a4a91572.json");
let serviceAccount = null;
try {
  const raw = fs.readFileSync(saPath, "utf8");
  serviceAccount = JSON.parse(raw);
} catch (err) {
  console.error("Failed to load Firebase service account JSON:", err);
  // rethrow so app startup fails visibly if service account missing
  throw err;
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

export default admin;
