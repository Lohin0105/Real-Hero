// frontend/src/pages/Donate.js
import React, { useEffect, useState } from "react";
import { auth as firebaseAuth } from "../firebase/firebaseConfig";
import Swal from 'sweetalert2';
import {
  Box,
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  IconButton,
  Typography,
  Avatar,
  Divider,
  useMediaQuery,
  Menu,
  MenuItem,

  Tooltip,
  Card,
  CardContent,
  Switch,
  Grid,
  Button,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  TextField,
  DialogActions,
} from "@mui/material";
import LocalShippingIcon from "@mui/icons-material/LocalShipping";
import DashboardIcon from "@mui/icons-material/Dashboard";
import MenuIcon from "@mui/icons-material/Menu";
import MedicalServicesIcon from "@mui/icons-material/MedicalServices";
import AccountCircleIcon from "@mui/icons-material/AccountCircle";
import LogoutIcon from "@mui/icons-material/Logout";
import MapIcon from "@mui/icons-material/Map";
// removed topbar icons - only profile/avatar remains

import PublicIcon from "@mui/icons-material/Public";
import { useNavigate } from "react-router-dom";
import Sidebar from "../components/Sidebar";

/**
 * If you're using Firebase in your app (recommended): ensure firebase is initialized
 * in a module like src/firebase.js and export nothing or export the app. We will
 * dynamically import firebase/auth to avoid breaking apps that do not have Firebase.
 *
 * Example src/firebase.js (if you need):
 * import { initializeApp } from "firebase/app";
 * const firebaseConfig = { apiKey: "...", authDomain: "...", ... };
 * const app = initializeApp(firebaseConfig);
 * export default app;
 *
 * The code below will attempt to use firebase auth if present.
 */

// Compute API base: allow overriding REACT_APP_API_BASE, and when it points to localhost
// replace localhost with the current host so LAN devices call the correct backend.
let API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:5000";
try {
  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    if (host && !/(^localhost$|^127\.0\.0\.1$)/.test(host) && /localhost|127\.0\.0\.1/.test(API_BASE)) {
      API_BASE = API_BASE.replace(/localhost|127\.0\.0\.1/, host);
    }
  }
} catch (e) {
  // ignore
}

export default function Donate() {
  const [openSidebar, setOpenSidebar] = useState(false);
  const [active] = useState("donate");
  const isMobile = useMediaQuery("(max-width:900px)");
  const navigate = useNavigate();

  // Profile menu
  const [anchorEl, setAnchorEl] = useState(null);
  const profileOpen = Boolean(anchorEl);

  // Live data
  const [user, setUser] = useState(null);
  const userRef = React.useRef(user);
  useEffect(() => { userRef.current = user; }, [user]);

  const [available, setAvailable] = useState(false);
  const [savingAvail, setSavingAvail] = useState(false);

  const [matchingRequests, setMatchingRequests] = useState([]);
  const [nearbyRequests, setNearbyRequests] = useState([]);
  const [allRequests, setAllRequests] = useState([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  // Modal to collect donor phone (polite UI) when server requires it
  // const [phoneDialogOpen, setPhoneDialogOpen] = useState(false);
  const [phoneDialogValue, setPhoneDialogValue] = useState("");
  const [ageDialogValue, setAgeDialogValue] = useState("");
  const [pendingOfferRequest, setPendingOfferRequest] = useState(null);
  const [pendingAction, setPendingAction] = useState(null); // 'call' | 'navigate'
  const [phoneDialogSubmitting, setPhoneDialogSubmitting] = useState(false);
  // notNow modal state
  const [notNowDialogOpen, setNotNowDialogOpen] = useState(false);
  // Missing blood group dialog
  // const [missingBloodOpen, setMissingBloodOpen] = useState(false);
  const [selectedBlood, setSelectedBlood] = useState("A+");

  // Keep last known coords to include with availability updates
  const [coords, setCoords] = useState(null);
  const [detectedAddress, setDetectedAddress] = useState(null);
  const coordsRef = React.useRef(coords);
  useEffect(() => { coordsRef.current = coords; }, [coords]);

  // Keep ref to last attempted value so we can rollback on failure
  const [lastAttemptValue, setLastAttemptValue] = useState(null);

  // Use the app-wide Firebase `auth` instance exported from `src/firebase/firebaseConfig`
  const getFirebaseAuth = async () => {
    return firebaseAuth || null;
  };

  // helper: get ID token with a small retry loop to allow firebase to initialize after page load
  const getIdToken = async () => {
    try {
      const auth = await getFirebaseAuth();
      if (!auth) return null;
      // try immediate then retry a few times
      for (let i = 0; i < 6; i++) {
        try {
          if (auth.currentUser) {
            const t = await auth.currentUser.getIdToken(false);
            if (t) return t;
          }
        } catch (e) {
          // ignore and retry
        }
        await new Promise((r) => setTimeout(r, 250));
      }
    } catch (e) {
      console.warn("getIdToken helper failed:", e?.message || e);
    }
    return null;
  };

  useEffect(() => {
    // load user (from backend) and list of requests
    fetchUser();

    // mark as available by default when opening donate page
    (async () => {
      try {
        // small delay to allow fetchUser to populate
        await new Promise((r) => setTimeout(r, 300));
        setAvailable(true);
        updateAvailability(true);
      } catch (e) {
        // ignore
      }
    })();

    loadRequests();

    const onUpdated = () => fetchUser();
    try { window.addEventListener('user-updated', onUpdated); } catch (e) { }

    // get geolocation (non blocking)
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          setCoords({ lat: latitude, lng: longitude });
          fetchAddressFromCoords(latitude, longitude);
        },
        (err) => {
          // ignore if denied
          console.warn("Geolocation not available:", err?.message || err);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    }

    const auto = setInterval(() => loadRequests(), 12000);
    return () => { clearInterval(auto); try { window.removeEventListener('user-updated', onUpdated); } catch (e) { } };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchAddressFromCoords(lat, lng) {
    try {
      console.log("🗺️ fetchAddressFromCoords called with:", lat, lng);
      const apiKey = process.env.REACT_APP_GEOAPIFY_API_KEY;
      console.log("🔑 API Key present:", !!apiKey);
      if (!apiKey) return;

      const url = `https://api.geoapify.com/v1/geocode/reverse?lat=${lat}&lon=${lng}&apiKey=${apiKey}`;
      console.log("📡 Fetching from Geoapify...");
      const res = await fetch(url);
      console.log("📥 Response status:", res.status, res.ok);
      if (res.ok) {
        const data = await res.json();
        console.log("📦 Full response data:", data);
        if (data.features && data.features.length > 0) {
          const props = data.features[0].properties;
          console.log("🏠 Geoapify properties:", props);

          // Construct a more specific address
          // Priority: Name (e.g. Price Hostel) -> Street -> Suburb -> City
          const parts = [];
          if (props.name) parts.push(props.name);
          if (props.street) parts.push(props.street);
          if (props.suburb && props.suburb !== props.name) parts.push(props.suburb);
          if (props.city && props.city !== props.suburb) parts.push(props.city);

          let address = parts.join(", ");

          // Add postcode/state if available
          const suffix = [];
          if (props.postcode) suffix.push(props.postcode);
          if (props.state_code) suffix.push(props.state_code);
          if (props.country) suffix.push(props.country);

          if (suffix.length > 0) {
            address += (address ? " - " : "") + suffix.join(", ");
          }

          // Fallback to formatted if empty
          if (!address || address.length < 5) {
            address = props.formatted || `${props.address_line1}, ${props.address_line2}`;
          }

          setDetectedAddress(address);
          console.log("✅ Final refined address:", address);
        }
      }
    } catch (error) {
      console.error("❌ Reverse geocoding failed:", error);
    }
  }

  async function fetchUser() {
    try {
      const auth = await getFirebaseAuth();
      let idToken = null;
      try {
        idToken = await getIdToken();
      } catch (e) {
        // ignore
      }

      const headers = {};
      const opts = { credentials: "include", headers };
      if (idToken) headers.Authorization = `Bearer ${idToken}`;

      const res = await fetch(`${API_BASE}/api/user/me`, opts);
      if (!res.ok) {
        // If server says unauthenticated or missing, try to create a backend user
        const txt = await res.text().catch(() => "");
        console.warn("/api/user/me not ok:", res.status, txt);
        // If we have a firebase currentUser, attempt to create the DB user by calling POST /api/user
        if (auth && auth.currentUser) {
          const fbUser = auth.currentUser;
          try {
            const t = await getIdToken();
            const headers = { "Content-Type": "application/json" };
            if (t) headers.Authorization = `Bearer ${t}`;
            const payload = { name: fbUser.displayName || "User", email: fbUser.email };
            const createRes = await fetch(`${API_BASE}/api/user`, { method: "POST", headers, credentials: "include", body: JSON.stringify(payload) });
            if (createRes.ok) {
              // re-fetch /api/user/me to get the created record
              const meRes = await fetch(`${API_BASE}/api/user/me`, { credentials: "include", headers: t ? { Authorization: `Bearer ${t}` } : {} });
              if (meRes.ok) {
                const d = await meRes.json();
                setUser(d);
                setAvailable(Boolean(d.isAvailable || d.available));
                let newCoords = null;
                if (d.locationGeo?.coordinates?.length === 2) {
                  newCoords = { lat: d.locationGeo.coordinates[1], lng: d.locationGeo.coordinates[0] };
                  setCoords(newCoords);
                  // If we have coords but no detected address yet, try fetching it
                  if (!detectedAddress) fetchAddressFromCoords(newCoords.lat, newCoords.lng);
                } else if (d.location?.lat && d.location?.lng) {
                  newCoords = { lat: d.location.lat, lng: d.location.lng };
                  setCoords(newCoords);
                  if (!detectedAddress) fetchAddressFromCoords(newCoords.lat, newCoords.lng);
                }
                try { await loadRequests(d, newCoords); } catch (e) { /* ignore */ }
                return;
              }
            } else {
              console.warn("Creating backend user failed:", createRes.status, await createRes.text().catch(() => ""));
            }
            // fallback to setting minimal user data from Firebase, but merge any transient registration data
            try {
              const saved = localStorage.getItem("newUserProfile");
              if (saved) {
                const parsed = JSON.parse(saved);
                const merged = {
                  name: fbUser.displayName || "User",
                  email: fbUser.email,
                  uid: fbUser.uid,
                  blood: parsed.blood || parsed.bloodGroup || undefined,
                  bloodGroup: parsed.blood || parsed.bloodGroup || undefined,
                };
                setUser(merged);
                // don't keep transient data after merging
                localStorage.removeItem("newUserProfile");
                try { await loadRequests(merged); } catch (e) { /* ignore */ }
                return;
              }
            } catch (e) {
              // ignore
            }
            const fbFallback = { name: fbUser.displayName || "User", email: fbUser.email, uid: fbUser.uid };
            setUser(fbFallback);
            try { await loadRequests(fbFallback); } catch (e) { /* ignore */ }
            return;
          } catch (e) {
            console.warn("Attempt to create backend user failed:", e?.message || e);
            setUser({ name: fbUser.displayName || "User", email: fbUser.email, uid: fbUser.uid });
            return;
          }
        }
        throw new Error("Not authenticated (server).");
      }
      let data = await res.json();
      // If server returned a user but blood info is missing, merge in any recently-created profile saved at registration time
      try {
        const saved = localStorage.getItem("newUserProfile");
        if (saved) {
          const parsed = JSON.parse(saved);
          // if backend didn't provide blood, prefer whatever user submitted at registration
          if ((!(data.bloodGroup || data.blood)) && parsed) {
            data.blood = data.blood || parsed.blood || parsed.bloodGroup || data.blood;
            data.bloodGroup = data.bloodGroup || data.blood;
          }
          // clear the transient storage after merging
          localStorage.removeItem("newUserProfile");
        }
      } catch (e) {
        // ignore localStorage errors
      }

      setUser(data);
      let newCoords = null;
      if (data.locationGeo?.coordinates?.length === 2) {
        newCoords = { lat: data.locationGeo.coordinates[1], lng: data.locationGeo.coordinates[0] };
        setCoords(newCoords);
      } else if (data.location?.lat && data.location?.lng) {
        newCoords = { lat: data.location.lat, lng: data.location.lng };
        setCoords(newCoords);
      }

      try { await loadRequests(data, newCoords); } catch (e) { /* ignore */ }
      setAvailable(Boolean(data.isAvailable || data.available));

      // Do not interrupt donation flow with popups — prefer to keep data in profile and use it directly.
      // If bloodGroup missing, we'll still proceed but server may require it; createOfferOnServer will try to include profile values.
    } catch (err) {
      console.warn("fetchUser fallback:", err?.message || err);
      // If backend fails, try firebase auth current user and merge any transient registration data
      const auth = await getFirebaseAuth();
      if (auth && auth.currentUser) {
        const fbUser = auth.currentUser;
        try {
          const saved = localStorage.getItem("newUserProfile");
          if (saved) {
            const parsed = JSON.parse(saved);
            const merged = {
              name: fbUser.displayName || "User",
              email: fbUser.email,
              uid: fbUser.uid,
              blood: parsed.blood || parsed.bloodGroup || undefined,
              bloodGroup: parsed.blood || parsed.bloodGroup || undefined,
            };
            setUser(merged);
            localStorage.removeItem("newUserProfile");
            try { await loadRequests(merged); } catch (e) { /* ignore */ }
            return;
          }
        } catch (e) {
          // ignore
        }
        const fbFallback = { name: fbUser.displayName || "User", email: fbUser.email, uid: fbUser.uid };
        setUser(fbFallback);
        try { await loadRequests(fbFallback); } catch (e) { /* ignore */ }
        return;
      }

      // final fallback to a dummy local user so UI still renders
      setUser({
        name: "Uday",
        email: "vtu23036@veltech.edu.in",
        bloodGroup: "O+",
        lastDonation: "2024-11-10",
      });
    }
  }

  // deprecated

  // Load nearby blood requests (people who requested blood)
  async function loadRequests(userForMatch, coordsOverride) {
    setLoadingRequests(true);
    try {
      const globalRes = await fetch(`${API_BASE}/api/requests/recent?limit=100`, { credentials: "include" });
      const globalData = globalRes.ok ? await globalRes.json().catch(() => []) : [];
      const globalAll = globalData || [];

      const match = [];
      const others = [];
      const recent = [];

      const matchingUser = userForMatch || userRef.current;
      const userBlood = matchingUser && (matchingUser.bloodGroup || matchingUser.blood)
        ? (matchingUser.bloodGroup || matchingUser.blood)
        : null;

      const currentCoords = coordsOverride || coordsRef.current;

      if (currentCoords && typeof currentCoords.lat === "number" && typeof currentCoords.lng === "number") {
        globalAll.forEach((r) => {
          let rLat = null;
          let rLng = null;

          if (r.location && typeof r.location.lat === "number" && typeof r.location.lng === "number") {
            rLat = r.location.lat;
            rLng = r.location.lng;
          } else if (r.locationGeo?.coordinates?.length >= 2) {
            rLng = r.locationGeo.coordinates[0];
            rLat = r.locationGeo.coordinates[1];
          }

          let distance = null;
          if (typeof rLat === "number" && typeof rLng === "number") {
            try {
              distance = getDistanceKm(currentCoords.lat, currentCoords.lng, rLat, rLng);
            } catch (e) {
              distance = null;
            }
          }

          // STRICT FILTER
          if (distance !== null && distance <= 50) {
            const reqBlood = r.bloodGroup || r.blood || null;
            if (
              userBlood &&
              reqBlood &&
              reqBlood.toLowerCase() === userBlood.toLowerCase()
            ) {
              match.push({ ...r, distanceKm: Number(distance.toFixed(1)) });
            } else {
              others.push({ ...r, distanceKm: Number(distance.toFixed(1)) });
            }
          } else if (distance !== null && distance > 50) {
            // Only >50 km goes to recent
            recent.push({ ...r, distanceKm: Number(distance.toFixed(1)) });
          }
          // NOTE: distance = null DOES NOT go to recent anymore (fix!)
        });
      } else {
        // No donor coords yet: show a global recent list so users see requests
        // (we cannot compute distances without coords, so present global recent items)
        globalAll.forEach((r) => {
          recent.push({ ...r, distanceKm: r.distanceKm ?? null });
        });
      }

      const used = new Set();
      const uniqueMatch = [];
      match.forEach((r) => {
        if (!used.has(r._id)) {
          used.add(r._id);
          uniqueMatch.push(r);
        }
      });
      const uniqueNearby = [];
      others.forEach((r) => {
        if (!used.has(r._id)) {
          used.add(r._id);
          uniqueNearby.push(r);
        }
      });
      const uniqueRecent = [];
      recent.forEach((r) => {
        if (!used.has(r._id)) {
          used.add(r._id);
          uniqueRecent.push(r);
        }
      });

      // Debug info: helpful log summarizing classification
      try {
        const debugSummary = [];
        uniqueMatch.forEach((r) => debugSummary.push({ id: r._id, category: 'matching', lat: r.location?.lat ?? r.locationGeo?.coordinates?.[1], lng: r.location?.lng ?? r.locationGeo?.coordinates?.[0], distanceKm: r.distanceKm ?? null }));
        uniqueNearby.forEach((r) => debugSummary.push({ id: r._id, category: 'nearby', lat: r.location?.lat ?? r.locationGeo?.coordinates?.[1], lng: r.location?.lng ?? r.locationGeo?.coordinates?.[0], distanceKm: r.distanceKm ?? null }));
        uniqueRecent.forEach((r) => debugSummary.push({ id: r._id, category: 'recent', lat: r.location?.lat ?? r.locationGeo?.coordinates?.[1], lng: r.location?.lng ?? r.locationGeo?.coordinates?.[0], distanceKm: r.distanceKm ?? null }));
        uniqueRecent.forEach((r) => debugSummary.push({ id: r._id, category: 'recent', lat: r.location?.lat ?? r.locationGeo?.coordinates?.[1], lng: r.location?.lng ?? r.locationGeo?.coordinates?.[0], distanceKm: r.distanceKm ?? null }));
        console.debug('loadRequests categorization (donor coords):', { donorCoords: currentCoords, summary: debugSummary });
      } catch (e) {
        console.warn('Debug summary failed to build', e);
      }

      setMatchingRequests(uniqueMatch);
      setNearbyRequests(uniqueNearby);
      setAllRequests(uniqueRecent);
    } catch (e) {
      console.error("loadRequests error:", e);
      setMatchingRequests([]);
      setNearbyRequests([]);
      setAllRequests([]);
    }
    setLoadingRequests(false);
  }

  // Open Google Maps directions with source (donor) and destination (request)
  async function openMapForRequest(request) {
    try {
      // Destination: prefer explicit location, then locationGeo
      let dstLat = null;
      let dstLng = null;
      if (request.location && typeof request.location.lat === 'number' && typeof request.location.lng === 'number') {
        dstLat = request.location.lat;
        dstLng = request.location.lng;
      } else if (request.locationGeo && Array.isArray(request.locationGeo.coordinates) && request.locationGeo.coordinates.length >= 2) {
        dstLng = request.locationGeo.coordinates[0];
        dstLat = request.locationGeo.coordinates[1];
      }
      let destinationParam = null;
      if (dstLat == null || dstLng == null) {
        // Best-effort: try to geocode hospital using Nominatim (OpenStreetMap)
        const destText = request.hospital;
        if (destText) {
          try {
            // Nominatim search
            const searchUrl = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(destText)}&limit=1`;
            const r = await fetch(searchUrl, { method: 'GET' });
            if (r.ok) {
              const hits = await r.json();
              if (Array.isArray(hits) && hits.length > 0) {
                const first = hits[0];
                const latN = parseFloat(first.lat);
                const lonN = parseFloat(first.lon);
                if (!Number.isNaN(latN) && !Number.isNaN(lonN)) {
                  dstLat = latN;
                  dstLng = lonN;
                }
              }
            }
          } catch (e) {
            // geocode failed; fall back
            console.warn('Nominatim geocode failed:', e);
          }

          if (dstLat == null || dstLng == null) {
            // fallback to text destination which will show search results in Maps
            destinationParam = encodeURIComponent(destText);
          }
        } else {
          alert('Destination coordinates not available for this request.');
          return;
        }
      }

      // Source: prefer a fresh live geolocation reading (donor live location)
      let srcLat = null;
      let srcLng = null;
      if (navigator.geolocation) {
        try {
          // try to get a live, quick geolocation reading first (useful on mobile)
          const pos = await new Promise((resolve, reject) =>
            navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 5000 })
          );
          srcLat = pos.coords.latitude;
          srcLng = pos.coords.longitude;
        } catch (e) {
          // if live geolocation failed or timed out, fall back to cached coords from state (last-known)
          if (coords && typeof coords.lat === 'number' && typeof coords.lng === 'number') {
            srcLat = coords.lat;
            srcLng = coords.lng;
          }
        }
      } else if (coords && typeof coords.lat === 'number' && typeof coords.lng === 'number') {
        srcLat = coords.lat;
        srcLng = coords.lng;
      }

      // helper: calculate distance in kilometers between two lat/lng points
      function distanceKm(lat1, lon1, lat2, lon2) {
        const R = 6371; // Earth radius km
        const toRad = (d) => (d * Math.PI) / 180;
        const dLat = toRad(lat2 - lat1);
        const dLon = toRad(lon2 - lon1);
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
      }

      // If geocode found destination coordinates that are suspiciously close to the source
      // (for example geocoder returned the user's own location), prefer textual destination so
      // Google Maps displays meaningful search results instead of duplicate locations.
      if (!destinationParam && typeof dstLat === 'number' && typeof dstLng === 'number' && typeof srcLat === 'number' && typeof srcLng === 'number') {
        try {
          const d = distanceKm(srcLat, srcLng, dstLat, dstLng);
          if (d < 0.5) {
            // destination is less than ~500m from source — likely incorrect geocoding; use text search fallback
            const destText = request.hospital;
            if (destText) destinationParam = encodeURIComponent(destText);
          }
        } catch (e) {
          // ignore any math issues
        }
      }

      // Build Google Maps directions URL
      let url = 'https://www.google.com/maps/dir/?api=1';
      if (typeof srcLat === 'number' && typeof srcLng === 'number') {
        // Use lat,lng origin when available — this helps Google Maps auto-fill the 'From' field
        url += `&origin=${encodeURIComponent(`${srcLat},${srcLng}`)}`;
      }
      if (destinationParam) {
        // If destinationParam is a text address (encoded), use it directly
        url += `&destination=${destinationParam}`;
      } else {
        url += `&destination=${encodeURIComponent(`${dstLat},${dstLng}`)}`;
      }
      url += '&travelmode=driving';

      // debug: show what will be opened
      try { console.debug('Opening directions', { origin: srcLat && srcLng ? `${srcLat},${srcLng}` : null, destination: destinationParam ? decodeURIComponent(destinationParam) : `${dstLat},${dstLng}` }); } catch (e) { }

      window.open(url, '_blank');
    } catch (e) {
      console.error('openMapForRequest failed:', e);
      alert('Failed to open map.');
    }
  }

  // Create an Offer on the server which will email the donor a confirmation poll
  async function createOfferOnServer(request, extra = {}) {
    try {
      const token = await getIdToken();
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;
      const body = { requestId: request._id };
      // debug log: outgoing offer request
      try { console.debug('createOfferOnServer -> POST', `${API_BASE}/api/notify/offer`, { headers, body }); } catch (e) { }
      // attach any extra fields passed by caller (e.g. donorPhone, donorAge)
      Object.assign(body, extra || {});

      // Fill missing donor details from currently loaded user profile (avoid asking in a popup)
      try {
        // donorPhone: prefer explicitly supplied extra, otherwise user's phone
        if (!body.donorPhone && user?.phone) body.donorPhone = user.phone;

        // donorAge: prefer explicit extra, otherwise user.age or compute from dateOfBirth
        if (!body.donorAge) {
          if (user?.age) body.donorAge = Number(user.age) || user.age;
          else if (user?.dateOfBirth) {
            const dob = new Date(user.dateOfBirth);
            if (!Number.isNaN(dob.getTime())) {
              const now = new Date();
              let age = now.getFullYear() - dob.getFullYear();
              const m = now.getMonth() - dob.getMonth();
              if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age--;
              body.donorAge = age;
            }
          }
        }

        // bloodGroup: prefer explicit, otherwise try user.bloodGroup or user.blood
        if (!body.bloodGroup) body.bloodGroup = user?.bloodGroup || user?.blood || undefined;
      } catch (e) {
        // ignore any profile parsing errors
      }
      let res = await fetch(`${API_BASE}/api/notify/offer`, { method: 'POST', headers, credentials: 'include', body: JSON.stringify(body) });
      if (!res.ok) {
        // Try to parse JSON error (e.g. missing_donor_phone). If missing phone, prompt donor
        let errJson = null;
        try { errJson = await res.json(); } catch (e) { /* ignored */ }
        if (errJson && errJson.error === 'missing_donor_phone') {
          // We no longer collect donor phone via an inline dialog. Ask user to update their profile instead.
          try {
            await Swal.fire({
              title: 'Phone required',
              text: 'Your profile is missing a phone number which is required to confirm donations. Please update your profile.',
              icon: 'warning',
              showCancelButton: true,
              confirmButtonText: 'Open Profile',
            }).then((r) => {
              if (r.isConfirmed) navigate('/profile');
            });
          } catch (e) { }
          return { ok: false, error: 'missing_donor_phone' };
        }

        const txt = (errJson && (errJson.message || errJson.error)) || await res.text().catch(() => '');
        console.warn('createOfferOnServer failed', res.status, txt);
        alert('Failed to create offer on server: ' + (txt || res.status));
        return { ok: false, error: txt || res.status };
      }
      const json = await res.json().catch(() => null);
      console.debug('createOfferOnServer response', json);

      // Server may return a WhatsApp prefilled link in json.whatsapp; return it to the caller

      return { ok: true, data: json };
    } catch (e) {
      console.error('createOfferOnServer error:', e);
      alert('Failed to create offer (network error)');
      return { ok: false, error: e?.message || e };
    }
  }

  // function handlePhoneDialogSubmit() { ... } // Removed
  // function handlePhoneDialogCancel() { ... } // Removed

  function openConfirmAndProceed(request, action) {
    // Directly attempt to create an offer using profile data (no inline prompt).
    setPendingOfferRequest(request);
    setPendingAction(action);

    (async () => {
      const res = await createOfferOnServer(request, {});
      if (!res?.ok) {
        console.warn('Offer creation failed in openConfirmAndProceed', res?.error);
        // createOfferOnServer already shows an alert for missing phone; abort further action
        setPendingOfferRequest(null);
        setPendingAction(null);
        return;
      }

      // proceed with the requested external action (call / navigate)
      try {
        if (action === 'call') {
          window.open(`tel:${request.phone}`);
        } else if (action === 'navigate') {
          await openMapForRequest(request);
        }
      } catch (e) {
        console.warn('Failed to open external action after creating offer', e);
      }

      setPendingOfferRequest(null);
      setPendingAction(null);
    })();
  }

  // Robust availability update:
  // - optimistic UI update (immediate)
  // - include uid (from user state or firebase currentUser)
  // - include idToken in Authorization header when possible
  // - rollback if request fails
  async function updateAvailability(value, locationOverride) {
    // ignore if already saving
    if (savingAvail) return;

    // optimistic update
    const prev = available;
    setAvailable(value);
    setSavingAvail(true);
    setLastAttemptValue(value);

    try {
      // determine uid + token
      let uid = user?.uid;
      let idToken = null;

      // If we have firebase, get id token and uid from there (overrides)
      const auth = await getFirebaseAuth();
      if (auth && auth.currentUser) {
        const fb = auth.currentUser;
        uid = fb.uid;
        try {
          idToken = await getIdToken();
        } catch (e) {
          console.warn("Failed to get ID token from Firebase currentUser:", e?.message || e);
        }
      }

      // If no uid, try to hit /api/user/me again to fetch it (maybe session restored)
      if (!uid) {
        try {
          let headers2 = {};
          const auth2 = await getFirebaseAuth();
          if (auth2 && auth2.currentUser) {
            try {
              const t = await auth2.currentUser.getIdToken(false);
              if (t) headers2.Authorization = `Bearer ${t}`;
            } catch (e) {
              // ignore
            }
          }
          const me = await fetch(`${API_BASE}/api/user/me`, { credentials: "include", headers: headers2 });
          if (me.ok) {
            const d = await me.json();
            uid = d.uid || d._id || d.id;
          }
        } catch (e) {
          // ignore
        }
      }

      if (!uid) {
        // we cannot send availability without a UID
        // rollback and inform user
        setAvailable(prev);
        alert("User UID missing. Please re-login.");
        setSavingAvail(false);
        return;
      }

      const body = { uid, available: value };
      // locationOverride takes precedence to avoid relying on state timing
      if (locationOverride && typeof locationOverride.lat === "number" && typeof locationOverride.lng === "number") {
        body.location = { lat: locationOverride.lat, lng: locationOverride.lng };
      } else if (coords && typeof coords.lat === "number" && typeof coords.lng === "number") {
        body.location = { lat: coords.lat, lng: coords.lng };
      }

      const headers = { "Content-Type": "application/json" };
      if (idToken) headers["Authorization"] = `Bearer ${idToken}`;

      // DEBUG: log outgoing availability request details
      try {
        console.debug("updateAvailability -> uid:", uid);
        console.debug("updateAvailability -> idToken present:", Boolean(idToken));
        console.debug("updateAvailability -> body:", body);
        console.debug("updateAvailability -> headers:", headers);
      } catch (e) {
        // ignore logging failures
      }

      const res = await fetch(`${API_BASE}/api/donors/availability`, {
        method: "POST",
        credentials: "include",
        headers,
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        // read server message if possible
        let msg = `Server returned ${res.status}`;
        try {
          const json = await res.json();
          msg = json?.message || json?.error || JSON.stringify(json);
        } catch {
          const txt = await res.text().catch(() => "");
          if (txt) msg = txt;
        }
        // rollback
        setAvailable(prev);
        console.error("updateAvailability failed:", msg);
        alert(`Failed to update availability:\n${msg}`);
        setSavingAvail(false);
        return;
      }

      // success - update local available from response (trust server)
      const data = await res.json();
      setAvailable(Boolean(data.available ?? value));
    } catch (err) {
      console.error("updateAvailability unexpected error:", err);
      // rollback
      setAvailable(prev);
      alert("Failed to update availability\n(see console for details)");
    } finally {
      setSavingAvail(false);
    }
  }

  // function handleSaveBlood() { ... } // Removed

  const initials = (name) => (name ? name.charAt(0).toUpperCase() : "U");

  // Friendly display helper to avoid showing 'Unknown' when a value exists but is empty
  const displayBlood = () => {
    const b = user?.bloodGroup || user?.blood || "";
    const trimmed = String(b).trim();
    return trimmed.length ? trimmed : "Unknown";
  };

  // Compute distance between two coordinates (km)
  function getDistanceKm(lat1, lon1, lat2, lon2) {
    const R = 6371; // km
    const toRad = (d) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  // Sidebar is now imported

  return (
    <Box
      sx={{
        minHeight: "100vh",
        background: "linear-gradient(180deg,#0b0b0b 0%,#151515 100%)",
        color: "#fff",
        pb: 6,
      }}
    >
      {/* TOP NAVBAR */}
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", px: { xs: 2, md: 6 }, py: 2 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <IconButton sx={{ color: "#fff", display: { xs: "inline-flex", md: "none" } }} onClick={() => setOpenSidebar(true)}>
            <MenuIcon />
          </IconButton>

          <Typography variant="h4" sx={{ color: "#ff2b2b", fontWeight: 800, textShadow: "0 0 18px rgba(255,20,20,0.85)", display: { xs: "none", md: "block" } }}>
            Donate Blood
          </Typography>
        </Box>

        {/* NAVBUTTONS */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          {/* only profile avatar shown */}

          <IconButton onClick={(e) => setAnchorEl(e.currentTarget)}>
            <Avatar src={user?.profilePhoto} sx={{ bgcolor: "#222" }}>{!user?.profilePhoto && initials(user?.name)}</Avatar>
          </IconButton>

          <Menu anchorEl={anchorEl} open={profileOpen} onClose={() => setAnchorEl(null)}>
            <Box sx={{ px: 2, py: 1 }}>
              <Typography sx={{ fontWeight: 700 }}>{user?.name}</Typography>
              <Typography variant="caption" sx={{ color: "#777" }}>{user?.email}</Typography>
            </Box>
            <Divider />
            <MenuItem onClick={() => { setAnchorEl(null); navigate("/profile"); }}>
              <AccountCircleIcon fontSize="small" sx={{ mr: 1 }} />
              Profile
            </MenuItem>
            <MenuItem onClick={() => (window.location.href = "/login")}><LogoutIcon fontSize="small" sx={{ mr: 1 }} /> Logout</MenuItem>
          </Menu>
        </Box>
      </Box>

      {/* PAGE BODY */}
      <Box sx={{ display: "flex", gap: 4, px: { xs: 2, md: 6 } }}>
        {/* SIDEBAR */}
        {!isMobile && <Box sx={{ width: 260, mt: 2 }}><Box sx={{ position: "sticky", top: 24 }}><Sidebar /></Box></Box>}
        {isMobile && <Drawer open={openSidebar} onClose={() => setOpenSidebar(false)}><Sidebar onClose={() => setOpenSidebar(false)} /></Drawer>}

        {/* MAIN CONTENT */}
        <Box sx={{ flex: 1, pt: 3 }}>
          {/* PROFILE + AVAILABILITY */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 3, mb: 3 }}>
            <Card sx={{ flex: 1, background: "rgba(255,255,255,0.02)", boxShadow: "0 20px 60px rgba(0,0,0,0.5)" }}>
              <CardContent sx={{ display: "flex", justifyContent: "space-between", gap: 2 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                  <Avatar src={user?.profilePhoto} sx={{ bgcolor: "#222", width: 64, height: 64 }}>{!user?.profilePhoto && initials(user?.name)}</Avatar>
                  <Box>
                    <Typography sx={{ fontWeight: 700, color: "#fff", fontSize: "1.2rem" }}>
                      {user?.name}
                      {coords && <span style={{ fontSize: '0.8rem', color: '#aaa', marginLeft: '8px' }}>({coords.lat.toFixed(4)}, {coords.lng.toFixed(4)})</span>}
                    </Typography>
                    <Typography variant="caption" sx={{ color: "#aaa" }}>{user?.email}</Typography>
                    <Typography variant="caption" sx={{ color: "#bbb", display: "block", mt: 1 }}>
                      Blood group: <strong>{displayBlood()}</strong>
                      {!(user?.bloodGroup || user?.blood) && (
                        <Button size="small" variant="text" onClick={() => navigate('/profile')} sx={{ ml: 1, color: '#9ad', textTransform: 'none' }}>
                          Set profile
                        </Button>
                      )}
                      &nbsp;• Last donation: {user?.lastDonation ?? "—"}
                    </Typography>
                    {detectedAddress && (
                      <Typography variant="caption" sx={{ color: "#4caf50", display: "block", mt: 0.5 }}>
                        📍 {detectedAddress}
                      </Typography>
                    )}
                  </Box>
                </Box>

                <Box sx={{ textAlign: "right" }}>
                  <Typography variant="caption" sx={{ color: "#999" }}>Availability</Typography>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 1 }}>
                    <Switch
                      checked={available}
                      onChange={(e) => updateAvailability(e.target.checked)}
                      color="error"
                      disabled={savingAvail}
                    />
                    {savingAvail && <CircularProgress size={18} color="inherit" />}
                    <Button variant="outlined" onClick={async () => {
                      // detect location explicitly
                      if (!navigator.geolocation) {
                        alert("Geolocation not supported by your browser.");
                        return;
                      }
                      try {
                        const pos = await new Promise((resolve, reject) =>
                          navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 20000 })
                        );
                        const lat = pos.coords.latitude;
                        const lng = pos.coords.longitude;
                        // update local coords immediately
                        setCoords({ lat, lng });

                        // Use Geoapify for address
                        await fetchAddressFromCoords(lat, lng);

                        // reload requests using new coords
                        await loadRequests(null, { lat, lng });
                        // update availability with location directly (avoid relying on state timing)
                        await updateAvailability(true, { lat, lng });
                      } catch (err) {
                        console.error("Detect location failed:", err);
                        alert("Failed to detect location: " + (err?.message || "unknown"));
                      }
                    }} sx={{ ml: 1, color: '#fff', borderColor: '#666' }}>
                      Detect My Location
                    </Button>
                  </Box>

                </Box>
              </CardContent>
            </Card>

            {/* (hero removed per request) leave a small spacing box instead */}
            <Box sx={{ width: { xs: 0, md: 80 }, display: { xs: "none", md: "block" } }} />
          </Box>

          {/* NEARBY BLOOD REQUESTS */}
          <Typography sx={{ fontWeight: 700, color: "#ff2b2b", mb: 1 }}>Nearby Blood Requests (within 50 km)</Typography>
          <Divider sx={{ mb: 2, background: "#333" }} />

          <Box sx={{ display: 'flex', gap: 2, mb: 3, flexDirection: { xs: 'column', md: 'row' } }}>
            {/* Column 1: matching requests (same blood group within 50 km) */}
            <Box sx={{ flex: 1, background: "rgba(255,255,255,0.01)", p: 2, borderRadius: 2 }}>
              <Typography sx={{ fontWeight: 700, color: "#ff2b2b", mb: 1 }}>Matching Requests (Your Blood Group)</Typography>
              {loadingRequests ? (
                <Box sx={{ textAlign: "center", py: 3 }}><CircularProgress color="error" /></Box>
              ) : matchingRequests.length === 0 ? (
                <Typography sx={{ color: "#bbb", py: 2 }}>No matching requests found nearby.</Typography>
              ) : (
                <Grid container spacing={2}>
                  {matchingRequests.map((r) => (
                    <Grid item xs={12} key={r._id}>
                      <Card
                        onClick={() => setSelectedRequest(r)}
                        sx={{ p: 2, background: "rgba(255,255,255,0.02)", boxShadow: "0 8px 25px rgba(0,0,0,0.45)", cursor: 'pointer' }}
                      >
                        <Typography sx={{ fontWeight: 800 }}>{r.name} • {r.bloodGroup ?? r.blood}</Typography>
                        <Typography variant="caption" sx={{ display: "block", color: "#aaa" }}>{r.hospital}</Typography>
                        <Typography variant="caption" sx={{ color: "#777" }}>{r.distanceKm ? `${r.distanceKm} km away` : ""}</Typography>
                        <Typography sx={{ mt: 1 }}>{r.description}</Typography>
                        {/* Debug: show computed distance and request coordinates when available */}
                        <Typography variant="caption" sx={{ color: '#666', display: 'block', mt: 1 }}>
                          {r.distanceKm ? `${r.distanceKm} km away • ` : ''}
                          {r.location ? `(${r.location.lat.toFixed(5)}, ${r.location.lng.toFixed(5)})` : (r.locationGeo?.coordinates ? `(${r.locationGeo.coordinates[1].toFixed(5)}, ${r.locationGeo.coordinates[0].toFixed(5)})` : '')}
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                          <Button variant="outlined" onClick={(e) => { e.stopPropagation(); openConfirmAndProceed(r, 'call'); }} sx={{ borderColor: "#2b7bd6", color: "#2b7bd6" }}>CALL</Button>
                          <Button variant="contained" onClick={(e) => { e.stopPropagation(); openConfirmAndProceed(r, 'navigate'); }} sx={{ bgcolor: '#ff2b2b', color: '#fff' }}>NAVIGATE</Button>
                        </Box>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              )}
            </Box>

            {/* Column 2: other nearby requests within 50km (exclude matches shown above) */}
            <Box sx={{ flex: 1, background: "rgba(255,255,255,0.01)", p: 2, borderRadius: 2 }}>
              <Typography sx={{ fontWeight: 700, color: "#ff2b2b", mb: 1 }}>Nearby Requests (within 50 km)</Typography>
              {loadingRequests ? (
                <Box sx={{ textAlign: "center", py: 3 }}><CircularProgress color="error" /></Box>
              ) : nearbyRequests.length === 0 ? (
                <Typography sx={{ color: "#bbb", py: 2 }}>No other requests nearby.</Typography>
              ) : (
                <Box>
                  {nearbyRequests.map((r) => (
                    <Card key={r._id} onClick={() => setSelectedRequest(r)} sx={{ p: 2, mb: 1, background: "rgba(255,255,255,0.02)", cursor: 'pointer' }}>
                      <Typography sx={{ fontWeight: 700 }}>{r.name} • {r.bloodGroup ?? r.blood}</Typography>
                      <Typography variant="caption" sx={{ color: "#aaa" }}>{r.hospital} {r.distanceKm ? `• ${r.distanceKm} km` : ''}</Typography>
                      <Typography sx={{ fontSize: 13 }}>{r.description}</Typography>
                      <Typography variant="caption" sx={{ color: '#666', display: 'block', mt: 1 }}>
                        {r.distanceKm ? `${r.distanceKm} km away • ` : ''}
                        {r.location ? `(${r.location.lat.toFixed(5)}, ${r.location.lng.toFixed(5)})` : (r.locationGeo?.coordinates ? `(${r.locationGeo.coordinates[1].toFixed(5)}, ${r.locationGeo.coordinates[0].toFixed(5)})` : '')}
                      </Typography>
                    </Card>
                  ))}
                </Box>
              )}
            </Box>

            {/* Column 3: global recent requests (excluding items already visible above) */}
            <Box sx={{ width: { xs: '100%', md: 420 }, background: "rgba(255,255,255,0.01)", p: 2, borderRadius: 2 }}>
              <Typography sx={{ fontWeight: 700, color: "#ff2b2b", mb: 1 }}>All Recent Requests</Typography>
              {loadingRequests ? (
                <Box sx={{ textAlign: "center", py: 3 }}><CircularProgress color="error" /></Box>
              ) : allRequests.length === 0 ? (
                <Typography sx={{ color: "#bbb", py: 2 }}>No other requests found.</Typography>
              ) : (
                <Box>
                  {allRequests
                    .filter(r => r.distanceKm === null || r.distanceKm > 50)   // UI safety filter
                    .map((r) => (
                      <Card key={r._id} onClick={() => setSelectedRequest(r)} sx={{ p: 2, mb: 1, background: "rgba(255,255,255,0.02)", cursor: 'pointer' }}>
                        <Typography sx={{ fontWeight: 700 }}>{r.name} • {r.bloodGroup ?? r.blood}</Typography>
                        <Typography variant="caption" sx={{ color: "#aaa" }}>{r.hospital} {r.distanceKm ? `• ${r.distanceKm} km` : ''}</Typography>
                        <Typography sx={{ fontSize: 13 }}>{r.description}</Typography>
                        <Typography variant="caption" sx={{ color: '#666', display: 'block', mt: 1 }}>
                          {r.distanceKm ? `${r.distanceKm} km away • ` : ''}
                          {r.location ? `(${r.location.lat.toFixed(5)}, ${r.location.lng.toFixed(5)})` : (r.locationGeo?.coordinates ? `(${r.locationGeo.coordinates[1].toFixed(5)}, ${r.locationGeo.coordinates[0].toFixed(5)})` : '')}
                        </Typography>
                      </Card>
                    ))}
                </Box>
              )}
            </Box>
          </Box>

          {/* ACTION BUTTONS */}
          <Box sx={{ display: "flex", gap: 2, alignItems: "center" }}>
            <Button variant="contained" onClick={async () => {
              // sample share availability action
              try {
                const auth = await getFirebaseAuth();
                let uid = user?.uid;
                if (auth && auth.currentUser) uid = auth.currentUser.uid;
                // If uid missing, try server /api/user/me to recover session-based uid
                if (!uid) {
                  try {
                    let headers2 = {};
                    if (auth && auth.currentUser) {
                      try {
                        const t = await auth.currentUser.getIdToken(false);
                        if (t) headers2.Authorization = `Bearer ${t}`;
                      } catch (e) {
                        // ignore
                      }
                    }
                    const me = await fetch(`${API_BASE}/api/user/me`, { credentials: "include", headers: headers2 });
                    if (me.ok) {
                      const d = await me.json();
                      uid = d.uid || d._id || d.id;
                    }
                  } catch (e) {
                    // ignore
                  }
                }

                const body = { uid, userId: user?._id, message: "I am available to donate", urgency: false };
                const token = await getIdToken();
                const headers = { "Content-Type": "application/json" };
                if (token) headers.Authorization = `Bearer ${token}`;
                // debug: ensure uid present
                if (!uid) {
                  alert("Cannot share availability: user UID missing. Please re-login.");
                  return;
                }

                const res = await fetch(`${API_BASE}/api/notify/share-availability`, {
                  method: "POST",
                  headers,
                  credentials: "include",
                  body: JSON.stringify(body),
                });
                if (!res.ok) {
                  const txt = await res.text().catch(() => "");
                  alert("Failed to share availability: " + (txt || res.status));
                } else {
                  alert("Availability shared successfully.");
                }
              } catch (e) {
                console.error(e);
                alert("Failed to share availability (network error).");
              }
            }} sx={{ bgcolor: "#ff2b2b", color: "#fff", px: 3 }}>
              SHARE AVAILABILITY
            </Button>

            <Button variant="outlined" onClick={() => navigate("/my-requests")} sx={{ borderColor: "#2b7bd6", color: "#2b7bd6" }}>
              VIEW MY REQUESTS
            </Button>

            <Button variant="outlined" onClick={() => navigate("/gamification")} sx={{ borderColor: "#2b7bd6", color: "#2b7bd6" }}>
              <PublicIcon sx={{ mr: 1 }} /> REWARDS & LEADERBOARD
            </Button>
          </Box>
          {/* Request details dialog */}
          {/* Polite phone collection modal shown when server requires donor phone */}
          {/* Phone dialog removed */}

          {/* Polite 'Not now' acknowledgement modal (same look-and-feel as phone modal) */}
          <Dialog open={notNowDialogOpen} onClose={() => setNotNowDialogOpen(false)} fullWidth maxWidth="xs">
            <DialogTitle sx={{ textAlign: 'center' }}>Thank you — we appreciate you</DialogTitle>
            <DialogContent>
              <Typography sx={{ mb: 1 }}>Thanks for considering to donate — we truly appreciate your willingness to help others.</Typography>
              <Typography variant="body2">If you'd like to help later, you can return to this request from the app and offer your availability. No worries — thank you for your attention.</Typography>
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2 }}>
              <Button onClick={() => setNotNowDialogOpen(false)} autoFocus>Close</Button>
            </DialogActions>
          </Dialog>

          {/* Missing Blood Group Dialog */}
          {/* Missing Blood Group Dialog removed */}

          <RequestDetailsDialog request={selectedRequest} onClose={() => setSelectedRequest(null)} onNavigate={openMapForRequest} onCreateOffer={openConfirmAndProceed} />
        </Box>
      </Box>
    </Box >
  );
}


// Request details dialog at bottom-level to avoid duplicating code
export function RequestDetailsDialog({ request, onClose, onNavigate, onCreateOffer }) {
  if (!request) return null;
  return (
    <Dialog open={Boolean(request)} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Request Details</DialogTitle>
      <DialogContent>
        <Typography sx={{ fontWeight: 800, mb: 1 }}>{request.name} • {request.bloodGroup ?? request.blood}</Typography>
        <Typography variant="caption" sx={{ display: 'block', color: '#aaa' }}>{request.hospital}</Typography>
        <Typography variant="body2" sx={{ mt: 2 }}>{request.description}</Typography>
        <Box sx={{ mt: 2 }}>
          <Typography variant="body2"><strong>Phone:</strong> {request.phone}</Typography>
          <Typography variant="body2"><strong>Units:</strong> {request.units || '1'}</Typography>
          <Typography variant="body2"><strong>Requested:</strong> {request.createdAt ? new Date(request.createdAt).toLocaleString() : ''}</Typography>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={async () => { if (request && request.phone) { try { if (onCreateOffer) onCreateOffer(request, 'call'); } catch (e) { console.warn(e); } } }} sx={{ mr: 1 }}>Call</Button>
        <Button onClick={async () => { if (onCreateOffer && request) { try { onCreateOffer(request, 'navigate'); } catch (e) { console.warn(e); } } }} sx={{ mr: 1 }}>Navigate</Button>
        <Button onClick={onClose} autoFocus>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
