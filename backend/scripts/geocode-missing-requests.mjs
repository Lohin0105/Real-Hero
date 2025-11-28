import mongoose from 'mongoose';
import Request from '../models/Request.mjs';
import dotenv from 'dotenv';

dotenv.config();

const MONGO = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/blood-donor-app';

async function geocodeText(text) {
  try {
    const q = encodeURIComponent(text);
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${q}&limit=1`;
    const res = await fetch(url, { headers: { 'User-Agent': 'Real-Hero-Backfill' } });
    if (!res.ok) return null;
    const data = await res.json().catch(() => null);
    if (!Array.isArray(data) || data.length === 0) return null;
    const first = data[0];
    const lat = parseFloat(first.lat);
    const lon = parseFloat(first.lon);
    if (Number.isNaN(lat) || Number.isNaN(lon)) return null;
    return { lat, lng: lon };
  } catch (e) {
    console.warn('geocodeText error', e?.message || e);
    return null;
  }
}

async function main() {
  await mongoose.connect(MONGO, { useNewUrlParser: true, useUnifiedTopology: true });
  console.log('Connected to DB');

  const cursor = Request.find({ status: 'open', $or: [ { locationGeo: { $exists: false } }, { locationGeo: null } ] }).cursor();
  let count = 0;
  for await (const doc of cursor) {
    if (!doc.hospital) continue;
    console.log(`Geocoding request ${doc._id} - ${doc.hospital}`);
    const coords = await geocodeText(doc.hospital);
    if (coords) {
      doc.location = { lat: coords.lat, lng: coords.lng };
      doc.locationGeo = { type: 'Point', coordinates: [coords.lng, coords.lat] };
      await doc.save();
      console.log('Updated', doc._id, coords);
      count++;
    } else {
      console.log('No geocode for', doc._id);
    }
    // be a good citizen - small delay
    await new Promise((r) => setTimeout(r, 1200));
  }

  console.log('Done, updated', count, 'requests');
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error('Error in geocode script', e);
  process.exit(1);
});
