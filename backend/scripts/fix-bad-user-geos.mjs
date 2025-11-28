#!/usr/bin/env node
import mongoose from 'mongoose';
import User from '../models/User.mjs';

const MONGO = process.env.MONGODB_URI || 'mongodb://localhost:27017/reahero';

async function run() {
  await mongoose.connect(MONGO, { autoIndex: false });
  console.log('Connected to', MONGO);

  const cursor = User.find({ 'locationGeo.type': { $exists: true }, $or: [ { 'locationGeo.coordinates': { $exists: false } }, { 'locationGeo.coordinates': { $size: 0 } } ] }).cursor();
  let repaired = 0;
  for await (const u of cursor) {
    console.log('Cleaning user', u._id.toString(), 'uid=', u.uid, 'name=', u.name);
    u.locationGeo = undefined;
    await u.save();
    repaired++;
  }

  console.log('Repaired docs:', repaired);
  await mongoose.disconnect();
}

run().catch(e => { console.error(e); process.exit(1); });
