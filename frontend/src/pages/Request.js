// frontend/src/pages/Request.js
import React, { useEffect, useState } from "react";
import { auth as firebaseAuth } from "../firebase/firebaseConfig";
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
  Grid,
  TextField,
  Button,
  CircularProgress,
  ListItem,
  ListItemAvatar,
  ListItemText as MuiListItemText,
} from "@mui/material";

import MenuIcon from "@mui/icons-material/Menu";
import DashboardIcon from "@mui/icons-material/Dashboard";
import LocalShippingIcon from "@mui/icons-material/LocalShipping";
import MedicalServicesIcon from "@mui/icons-material/MedicalServices";
import AccountCircleIcon from "@mui/icons-material/AccountCircle";
import LogoutIcon from "@mui/icons-material/Logout";
import MapIcon from "@mui/icons-material/Map";
// removed topbar icons - keep only profile/avatar
import LocalHospitalIcon from "@mui/icons-material/LocalHospital";
import RefreshIcon from "@mui/icons-material/Refresh";
import PublicIcon from "@mui/icons-material/Public";
import GpsFixedIcon from "@mui/icons-material/GpsFixed";

import { useNavigate } from "react-router-dom";
import Sidebar from "../components/Sidebar";

const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:5000";

export default function Request() {
  const [openSidebar, setOpenSidebar] = useState(false);
  const [active, setActive] = useState("request");
  const isMobile = useMediaQuery("(max-width:900px)");
  const navigate = useNavigate();

  // Profile menu
  const [anchorEl, setAnchorEl] = useState(null);
  const profileOpen = Boolean(anchorEl);

  // Form state
  const [form, setForm] = useState({
    name: "",
    age: "",
    phone: "",
    bloodGroup: "",
    units: 1,
    hospital: "",
    description: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  // coords & detection
  const [coords, setCoords] = useState(null);
  const [detecting, setDetecting] = useState(false);
  const [attachLocation, setAttachLocation] = useState(true);

  // recent requests
  const [recent, setRecent] = useState([]);
  const [loadingRecent, setLoadingRecent] = useState(false);

  // fake user fallback (keeps UI intact)
  const [user, setUser] = useState(() => {
    try {
      const cached = localStorage.getItem("userProfile");
      return cached ? JSON.parse(cached) : { name: "Uday", email: "vtu23036@veltech.edu.in" };
    } catch (e) {
      return { name: "Uday", email: "vtu23036@veltech.edu.in" };
    }
  });

  useEffect(() => {
    // try to fetch current user profile (non-blocking)
    async function loadUser() {
      try {
        // include Firebase ID token if available so server can verify
        let headers = {};
        try {
          if (firebaseAuth && firebaseAuth.currentUser) {
            const t = await firebaseAuth.currentUser.getIdToken(false);
            if (t) headers.Authorization = `Bearer ${t}`;
          }
        } catch (e) {
          // firebase not present or no user
        }

        const res = await fetch(`${API_BASE}/api/user/me`, { credentials: "include", headers });
        if (res.ok) {
          const data = await res.json();
          setUser(data);
          localStorage.setItem("userProfile", JSON.stringify(data));
          setForm((f) => ({ ...f, name: data.name || f.name }));
          return;
        }
      } catch (e) {
        console.warn("Failed to fetch current user:", e);
      }
    }

    (async () => { await loadUser(); })();
    const onAuth = () => loadUser();
    const onUpdated = () => loadUser();
    try { window.addEventListener('auth-changed', onAuth); window.addEventListener('user-updated', onUpdated); } catch (e) { }

    loadRecentRequests();
    const auto = setInterval(loadRecentRequests, 15000);
    return () => { clearInterval(auto); try { window.removeEventListener('auth-changed', onAuth); window.removeEventListener('user-updated', onUpdated); } catch (e) { } };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sidebar is now imported

  async function loadRecentRequests() {
    setLoadingRecent(true);
    try {
      const q = coords ? `?limit=6&lat=${coords.lat}&lng=${coords.lng}` : "?limit=6";
      const res = await fetch(`${API_BASE}/api/requests/recent${q}`);
      if (!res.ok) {
        const txt = await res.text();
        console.error("GET /api/requests/recent failed", res.status, txt);
        setRecent([]);
        setLoadingRecent(false);
        return;
      }
      const data = await res.json();
      setRecent(data || []);
    } catch (err) {
      console.error("loadRecentRequests error:", err);
      setRecent([]);
    }
    setLoadingRecent(false);
  }

  function handleField(k, v) {
    setForm((s) => ({ ...s, [k]: v }));
  }

  // Try reverse geocode via Nominatim; fallback to coords string
  async function detectLocationAndAutofill() {
    setDetecting(true);
    setSubmitError(null);
    try {
      if (!navigator.geolocation) throw new Error("Geolocation not supported");
      const pos = await new Promise((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000 })
      );
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      setCoords({ lat, lng });

      // reverse geocode using Nominatim (OpenStreetMap)
      try {
        const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`;
        const r = await fetch(url, { headers: { "User-Agent": "Real-Hero-App" } });
        if (r.ok) {
          const j = await r.json();
          // Construct a more specific address
          const addr = j.address || {};
          const parts = [
            addr.road || addr.pedestrian || addr.street,
            addr.suburb || addr.neighbourhood || addr.residential,
            addr.city || addr.town || addr.village || addr.county
          ].filter(Boolean);

          const display = parts.length > 0 ? parts.join(", ") : (j.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`);
          setForm((s) => ({ ...s, hospital: display }));
        } else {
          setForm((s) => ({ ...s, hospital: `${lat.toFixed(5)}, ${lng.toFixed(5)}` }));
        }
      } catch (e) {
        console.warn("Reverse geocode failed:", e);
        setForm((s) => ({ ...s, hospital: `${lat.toFixed(5)}, ${lng.toFixed(5)}` }));
      }
    } catch (err) {
      console.error("detectLocation error:", err);
      setSubmitError("Could not detect location: " + (err?.message || "unknown"));
    }
    setDetecting(false);
  }

  async function handleSubmit(e) {
    e?.preventDefault();
    setSubmitting(true);
    setSubmitError(null);

    // basic validation
    if (!form.name || !form.phone || !form.bloodGroup || !form.hospital) {
      setSubmitError("Please fill required fields: name, phone, blood group, hospital");
      setSubmitting(false);
      return;
    }

    try {
      // Ensure we have coords available before building payload. Use a local finalCoords var
      let finalCoords = coords;

      if (attachLocation && (!finalCoords || typeof finalCoords.lat !== 'number' || typeof finalCoords.lng !== 'number')) {
        // try to get a live geolocation reading first
        try {
          if (navigator.geolocation) {
            const pos = await new Promise((resolve, reject) =>
              navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 8000 })
            );
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;
            finalCoords = { lat, lng };
            setCoords(finalCoords);

            // If hospital empty, fill it from reverse geocode
            if (!form.hospital) {
              try {
                const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`;
                const r = await fetch(url, { headers: { "User-Agent": "Real-Hero-App" } });
                if (r.ok) {
                  const j = await r.json();
                  // Construct a more specific address
                  const addr = j.address || {};
                  const parts = [
                    addr.road || addr.pedestrian || addr.street,
                    addr.suburb || addr.neighbourhood || addr.residential,
                    addr.city || addr.town || addr.village || addr.county
                  ].filter(Boolean);

                  const display = parts.length > 0 ? parts.join(", ") : (j.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`);
                  setForm((s) => ({ ...s, hospital: display }));
                } else {
                  setForm((s) => ({ ...s, hospital: `${lat.toFixed(5)}, ${lng.toFixed(5)}` }));
                }
              } catch (e) {
                // ignore reverse geocode error
              }
            }
          }
        } catch (errGeo) {
          // geolocation failed — attempt best-effort geocode from hospital text
          if (attachLocation && form.hospital) {
            try {
              const searchUrl = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(form.hospital)}&limit=1`;
              const r2 = await fetch(searchUrl, { method: 'GET' });
              if (r2.ok) {
                const hits = await r2.json();
                if (Array.isArray(hits) && hits.length > 0) {
                  const first = hits[0];
                  const latN = parseFloat(first.lat);
                  const lonN = parseFloat(first.lon);
                  if (!Number.isNaN(latN) && !Number.isNaN(lonN)) {
                    finalCoords = { lat: latN, lng: lonN };
                    setCoords(finalCoords);
                  }
                }
              }
            } catch (e2) {
              // ignore geocode failures
            }
          }
          console.warn('Geolocation attempt before submit failed:', errGeo);
        }
      }

      const payload = {
        name: form.name,
        age: form.age ? Number(form.age) : undefined,
        phone: form.phone,
        bloodGroup: form.bloodGroup,
        units: Number(form.units || 1),
        hospital: form.hospital,
        description: form.description,
      };

      if (attachLocation && finalCoords && typeof finalCoords.lat === "number" && typeof finalCoords.lng === "number") {
        payload.location = { lat: finalCoords.lat, lng: finalCoords.lng };
        payload.locationGeo = { type: "Point", coordinates: [finalCoords.lng, finalCoords.lat] };
      }

      // include Authorization header if user has an auth token so server can attach uid
      let headers = { "Content-Type": "application/json" };
      try {
        if (firebaseAuth && firebaseAuth.currentUser) {
          const t = await firebaseAuth.currentUser.getIdToken(false);
          if (t) headers.Authorization = `Bearer ${t}`;
        }
      } catch (e) {
        // ignore; server will accept unauthenticated request
      }

      const res = await fetch(`${API_BASE}/api/requests/create`, {
        method: "POST",
        credentials: "include",
        headers,
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        let msg = `Server returned ${res.status}`;
        try {
          const j = await res.json();
          msg = j.message || j.error || JSON.stringify(j);
        } catch (e) {
          const t = await res.text();
          msg = t || msg;
        }
        console.error("POST /api/requests/create failed:", msg);
        setSubmitError("Failed to submit request: " + msg);
        setSubmitting(false);
        return;
      }

      const data = await res.json();
      // success: clear main fields (but keep name/email)
      setForm((s) => ({
        ...s,
        age: "",
        phone: "",
        bloodGroup: "",
        units: 1,
        hospital: "",
        description: "",
      }));
      setCoords(null);
      // refresh recent
      await loadRecentRequests();
      alert("Request submitted successfully.");
    } catch (err) {
      console.error("handleSubmit error:", err);
      setSubmitError("Failed to submit request: " + (err?.message || "network error"));
    }
    setSubmitting(false);
  }

  return (
    <Box
      sx={{
        minHeight: "100vh",
        background: "linear-gradient(180deg,#0b0b0b 0%,#151515 100%)",
        color: "#fff",
        pb: 6,
      }}
    >
      {/* TOP NAV */}
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", px: { xs: 2, md: 6 }, py: 2 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <IconButton sx={{ color: "#fff", display: { xs: "inline-flex", md: "none" } }} onClick={() => setOpenSidebar(true)}>
            <MenuIcon />
          </IconButton>

          <Typography
            variant="h4"
            sx={{
              color: "#ff2b2b",
              fontWeight: 800,
              textShadow: "0 0 18px rgba(255,20,20,0.85)",
              display: "block",
            }}
          >
            Real-Hero
          </Typography>
        </Box>

        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          {/* only profile avatar visible */}

          <IconButton onClick={(e) => setAnchorEl(e.currentTarget)}>
            <Avatar src={user?.profilePhoto} sx={{ bgcolor: "#222" }}>{!user?.profilePhoto && (user?.name || "U").charAt(0).toUpperCase()}</Avatar>
          </IconButton>

          <Menu anchorEl={anchorEl} open={profileOpen} onClose={() => setAnchorEl(null)}>
            <Box sx={{ px: 2, py: 1 }}>
              <Typography sx={{ fontWeight: 700 }}>{user?.name}</Typography>
              <Typography variant="caption" sx={{ color: "#777" }}>
                {user?.email}
              </Typography>
            </Box>
            <Divider />
            <MenuItem onClick={() => { setAnchorEl(null); navigate("/profile"); }}>
              <AccountCircleIcon fontSize="small" sx={{ mr: 1 }} />
              Profile
            </MenuItem>
            <MenuItem
              onClick={() => {
                window.location.href = "/login";
              }}
            >
              <LogoutIcon fontSize="small" sx={{ mr: 1 }} /> Logout
            </MenuItem>
          </Menu>
        </Box>
      </Box>

      {/* BODY */}
      <Box sx={{ display: "flex", flexDirection: { xs: "column", md: "row" }, gap: 4, px: { xs: 2, md: 6 } }}>
        {!isMobile && (
          <Box sx={{ width: 260, mt: 2 }}>
            <Box sx={{ position: "sticky", top: 24 }}><Sidebar /></Box>
          </Box>
        )}

        {isMobile && <Drawer open={openSidebar} onClose={() => setOpenSidebar(false)}><Sidebar onClose={() => setOpenSidebar(false)} /></Drawer>}

        <Box sx={{ flex: 1, pt: 3 }}>
          <Card sx={{ background: "rgba(255,255,255,0.02)", boxShadow: "0 30px 80px rgba(0,0,0,0.5)", p: 3 }}>
            <Typography variant="h5" sx={{ color: "#ff2b2b", fontWeight: 800, mb: 2 }}>
              Create Emergency Request
            </Typography>

            {submitError && (
              <Box sx={{ background: "rgba(255,0,0,0.06)", border: "1px solid rgba(255,0,0,0.12)", p: 2, borderRadius: 1, mb: 2 }}>
                <Typography sx={{ color: "#ff8a8a" }}>{submitError}</Typography>
              </Box>
            )}

            <form onSubmit={handleSubmit}>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    fullWidth
                    label="Name *"
                    value={form.name}
                    onChange={(e) => handleField("name", e.target.value)}
                    variant="filled"
                    InputLabelProps={{ style: { color: "#ddd" } }}
                    sx={{
                      "& .MuiFilledInput-root": { background: "rgba(255,255,255,0.02)" },
                      input: { color: "#fff" },
                    }}
                  />
                </Grid>

                <Grid size={{ xs: 6, sm: 3 }}>
                  <TextField
                    fullWidth
                    label="Age"
                    value={form.age}
                    onChange={(e) => handleField("age", e.target.value)}
                    variant="filled"
                    InputLabelProps={{ style: { color: "#ddd" } }}
                    sx={{ "& .MuiFilledInput-root": { background: "rgba(255,255,255,0.02)" }, input: { color: "#fff" } }}
                  />
                </Grid>

                <Grid size={{ xs: 6, sm: 3 }}>
                  <TextField
                    fullWidth
                    label="Phone *"
                    value={form.phone}
                    onChange={(e) => handleField("phone", e.target.value)}
                    variant="filled"
                    InputLabelProps={{ style: { color: "#ddd" } }}
                    sx={{ "& .MuiFilledInput-root": { background: "rgba(255,255,255,0.02)" }, input: { color: "#fff" } }}
                  />
                </Grid>

                <Grid size={{ xs: 12, sm: 4 }}>
                  <TextField
                    fullWidth
                    label="Blood Group *"
                    value={form.bloodGroup}
                    onChange={(e) => handleField("bloodGroup", e.target.value)}
                    variant="filled"
                    InputLabelProps={{ style: { color: "#ddd" } }}
                    sx={{ "& .MuiFilledInput-root": { background: "rgba(255,255,255,0.02)" }, input: { color: "#fff" } }}
                  />
                </Grid>

                <Grid size={{ xs: 12, sm: 4 }}>
                  <TextField
                    fullWidth
                    label="Units Required"
                    type="number"
                    value={form.units}
                    onChange={(e) => handleField("units", e.target.value)}
                    variant="filled"
                    InputLabelProps={{ style: { color: "#ddd" } }}
                    sx={{ "& .MuiFilledInput-root": { background: "rgba(255,255,255,0.02)" }, input: { color: "#fff" } }}
                  />
                </Grid>

                <Grid size={{ xs: 12, sm: 4 }}>
                  <TextField
                    fullWidth
                    label="Hospital Name (optional) *"
                    value={form.hospital}
                    onChange={(e) => handleField("hospital", e.target.value)}
                    variant="filled"
                    InputLabelProps={{ style: { color: "#ddd" } }}
                    sx={{ "& .MuiFilledInput-root": { background: "rgba(255,255,255,0.02)" }, input: { color: "#fff" } }}
                  />
                </Grid>

                <Grid size={{ xs: 12 }}>
                  <TextField
                    fullWidth
                    multiline
                    minRows={4}
                    label="Reason / Description (optional)"
                    value={form.description}
                    onChange={(e) => handleField("description", e.target.value)}
                    variant="filled"
                    InputLabelProps={{ style: { color: "#ddd" } }}
                    sx={{ "& .MuiFilledInput-root": { background: "rgba(255,255,255,0.02)" }, textarea: { color: "#fff" } }}
                  />
                </Grid>

                <Grid size={{ xs: 12 }} sx={{ display: "flex", gap: 2, alignItems: "center" }}>
                  <Button
                    variant="contained"
                    color="error"
                    onClick={handleSubmit}
                    disabled={submitting}
                    sx={{ px: 4 }}
                  >
                    {submitting ? "SUBMITTING..." : "SEND REQUEST"}
                  </Button>

                  <Button variant="outlined" onClick={() => setForm({ name: user?.name || "", age: "", phone: "", bloodGroup: "", units: 1, hospital: "", description: "" })}>
                    CLEAR
                  </Button>

                  <Button variant="outlined" onClick={() => loadRecentRequests()} startIcon={<RefreshIcon />}>
                    REFRESH RECENT
                  </Button>

                  <Box sx={{ ml: "auto", display: "flex", alignItems: "center", gap: 1 }}>
                    <Button variant="contained" onClick={detectLocationAndAutofill} disabled={detecting} startIcon={<GpsFixedIcon />}>
                      {detecting ? "DETECTING..." : "DETECT"}
                    </Button>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, ml: 1 }}>
                      <Typography variant="caption" sx={{ color: "#999" }}>
                        {coords ? `Detected coords: ${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}` : "No coords"}
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', ml: 2 }}>
                        <Typography variant="caption" sx={{ color: '#ccc', mr: 1 }}>Attach my location</Typography>
                        <input
                          type="checkbox"
                          checked={attachLocation}
                          onChange={(e) => setAttachLocation(Boolean(e.target.checked))}
                          style={{ width: 18, height: 18 }}
                        />
                      </Box>
                    </Box>
                  </Box>
                </Grid>
              </Grid>
            </form>
          </Card>
        </Box>

        {/* RIGHT PANEL: Recent Requests */}
        <Box sx={{ width: { xs: "100%", md: 360 }, mt: 2 }}>
          <Card sx={{ background: "rgba(255,255,255,0.02)", boxShadow: "0 20px 60px rgba(0,0,0,0.5)", p: 2 }}>
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
              <Typography sx={{ fontWeight: 700, color: "#ff2b2b" }}>Recent Active Requests</Typography>
              <IconButton size="small" onClick={() => loadRecentRequests()}>
                <RefreshIcon sx={{ color: "#ddd" }} />
              </IconButton>
            </Box>

            {loadingRecent ? (
              <Box sx={{ textAlign: "center", py: 2 }}>
                <CircularProgress color="error" />
              </Box>
            ) : recent.length === 0 ? (
              <Typography sx={{ color: "#bbb" }}>No active requests nearby.</Typography>
            ) : (
              <Box>
                {recent.map((r) => (
                  <ListItem key={r._id} sx={{ background: "rgba(255,255,255,0.02)", mb: 1, borderRadius: 1 }}>
                    <ListItemAvatar>
                      <Avatar sx={{ bgcolor: "#b71c1c" }}>
                        <LocalHospitalIcon />
                      </Avatar>
                    </ListItemAvatar>
                    <MuiListItemText
                      primary={`${r.name} • ${r.bloodGroup || ""}`}
                      secondary={
                        <>
                          <Typography variant="caption" sx={{ color: "#aaa", display: "block" }}>
                            {r.hospital ? r.hospital : ""}
                            {r.distanceKm && ` • ${r.distanceKm} km`}
                          </Typography>
                          <Typography sx={{ fontSize: 13 }}>{r.description}</Typography>
                        </>
                      }
                    />
                  </ListItem>
                ))}
              </Box>
            )}
          </Card>
        </Box>
      </Box>
    </Box>
  );
}
