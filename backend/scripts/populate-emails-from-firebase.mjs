// backend/scripts/populate-emails-from-firebase.mjs

import mongoose from "mongoose";
import admin from "../config/firebaseAdmin.mjs";
import User from "../models/User.mjs";
import dotenv from "dotenv";

dotenv.config();

async function run() {
  console.log("🔄 Connecting to MongoDB…");
  await mongoose.connect(process.env.MONGO_URI);

  console.log("🔍 Finding users missing email…");

  const users = await User.find({
    $or: [
      { email: { $exists: false } },
      { email: null },
      { email: "" }
    ]
  }).lean();

  console.log(`📌 Found ${users.length} users missing email`);

  for (const u of users) {
    if (!u.uid) {
      console.log("⏭️ Skip — NO UID:", u._id);
      continue;
    }

    try {
      const fb = await admin.auth().getUser(u.uid);

      if (fb?.email) {
        console.log(`✔ Updating ${u._id} -> ${fb.email}`);

        await User.updateOne(
          { _id: u._id },
          {
            $set: {
              email: fb.email,
              name: fb.displayName || u.name,
            },
          }
        );
      } else {
        console.log(`❌ Firebase user ${u.uid} has no email`);
      }
    } catch (e) {
      console.log(`❌ Failed for UID ${u.uid}: ${e.message}`);
    }
  }

  console.log("🎉 Migration complete.");
  process.exit(0);
}

run().catch((err) => {
  console.error("❌ Migration failed:", err);
  process.exit(1);
});
