// frontend/src/pages/Dashboard.js
import React, { useEffect, useState } from "react";
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
  Badge,
  Tooltip,
  CircularProgress,
  Card,
  ListItem,
  ListItemAvatar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
} from "@mui/material";

import MenuIcon from "@mui/icons-material/Menu";
// unused icons removed
import AccountCircleIcon from "@mui/icons-material/AccountCircle";
import LogoutIcon from "@mui/icons-material/Logout";
// unused icons removed
import LocalHospitalIcon from "@mui/icons-material/LocalHospital";
import RefreshIcon from "@mui/icons-material/Refresh";

import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import { auth as firebaseAuth } from "../firebase/firebaseConfig";

// Compute API base for LAN use (replace localhost with the current host when appropriate)
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

const HERO_URL = "https://ik.imagekit.io/Lohin/hero.png";

const QUOTES = [
  "Donate blood — be someone's hero.",
  "A single donation can save up to three lives.",
  "Share life. Donate blood regularly.",
  "Blood donation: small time, huge impact.",
  "Heroes don't always wear capes — sometimes they're donors.",
  "Give blood, give hope.",
  "Your donation matters. Save a life.",
  "Keep calm and donate blood.",
  "Every drop counts — donate today.",
  "Be the reason someone lives tomorrow.",
  "Your kindness can save lives.",
  "Donate blood, be a life saver.",
  "Donate blood — be someone's hero.",
  "A single donation can save up to three lives.",
  "Share life. Donate blood regularly.",
  "Blood donation: small time, huge impact.",
  "Heroes don't always wear capes — sometimes they're donors.",
  "Give blood, give hope.",
  "Donate today — someone needs you tomorrow.",
  "Your donation matters. Save a life.",
  "Share the gift of life: donate blood.",
  "You are stronger than you think — donate.",
  "Blood donation is a simple act of kindness.",
  "One pint can make a big difference.",
  "Donors are lifelines for patients.",
  "Keep calm and donate blood.",
  "Every donor counts. Every drop matters.",
  "Donate blood — support your community.",
  "Make a date to donate regularly.",
  "Blood banks rely on people like you.",
  "Lifesaving action: roll up a sleeve.",
  "Your blood can give others a tomorrow.",
  "Donate to bring smiles back.",
  "A few minutes from you, a lifetime for someone.",
  "Donating blood is safe and quick.",
  "Every donation is a gift of life.",
  "Help patients fight critical illnesses.",
  "Your donation supports surgeries and emergencies.",
  "Heroes live among us — donors included.",
  "Give blood: it's priceless for recipients.",
  "Donate to help victims of accidents.",
  "Your type may be needed today.",
  "Donors help cancer patients receive treatment.",
  "Be kind: donate blood when you can.",
  "Blood donation unites communities.",
  "Be a regular donor — build a habit.",
  "Donating blood is an act of compassion.",
  "Donate and inspire others to do the same.",
  "Donations keep hospitals running.",
  "One donation — three potential lives saved.",
  "You can be somebody's miracle.",
  "Blood donation builds resilience in healthcare.",
  "Be the difference: donate blood.",
  "Your small act solves a big problem.",
  "Donors create second chances.",
  "Donate blood, spread hope.",
  "Be proud — you're saving lives.",
  "A hero step: share your blood.",
  "Donors are the backbone of transfusion care.",
  "Life is precious — donate to protect it.",
  "Regular donors protect the vulnerable.",
  "Blood donation empowers communities.",
  "Donate for family, friends, strangers.",
  "Every drop makes tomorrow possible.",
  "Your generosity heals wounds.",
  "Help mothers, children, accident victims.",
  "Make the world safer — donate.",
  "Donors give more than blood — they give hope.",
  "Join the movement of lifesavers.",
  "Donate to make hospitals prepared.",
  "Your type might be urgently needed.",
  "Donating is healthy, safe, and kind.",
  "Volunteer your time — donate blood.",
  "Donate today — be part of the solution.",
  "Blood donation creates positive change.",
  "Give life, get gratitude.",
  "Every donation counts toward recovery.",
  "Donors change stories from loss to life.",
  "Be generous — save someone's life.",
  "Community heroes donate regularly.",
  "Donating blood: quick, safe, rewarding.",
  "Your act echoes in families' lives.",
  "Donate for awareness and action.",
  "Fight shortages with your donation.",
  "Be a blood donor ambassador.",
  "Share your compassion: give blood.",
  "Simple act, profound result.",
  "Support your local blood bank.",
  "Donate blood — it's human kindness in action.",
  "Shed a little blood, save a lot of life.",
  "Donors are everyday heroes.",
  "Help keep surgery rooms ready.",
  "Your donation may help newborns.",
  "Be there for patients in need.",
  "Donations reduce crisis stress for responders.",
  "Help create a safer healthcare system.",
  "Donate once — you might save a stranger.",
  "It's easy to donate — do it safely.",
  "Strength is giving when you can.",
  "Your donation reduces suffering.",
  "Help restore hope through donation.",
  "Care, give, save.",
  "Be counted among lifesavers.",
  "Blood donors bring communities together.",
  "Your contribution is medical gold.",
  "Help ensure blood supply stability.",
  "Donate now — don't wait for an emergency.",
  "Blood donation renews life.",
  "Make donation part of your lifestyle.",
  "Blood saves families.",
  "Donors help create miracles every day.",
  "Show compassion — be a donor.",
  "Life is the best gift — share it.",
  "Be a beacon of hope — donate blood."
];

export default function Dashboard() {
  const [openSidebar, setOpenSidebar] = useState(false);
  const [active, setActive] = useState("dashboard");
  const isMobile = useMediaQuery("(max-width:900px)");
  const navigate = useNavigate();

  // Profile menu
  const [anchorEl, setAnchorEl] = useState(null);
  const profileOpen = Boolean(anchorEl);

  // User data (LIVE)
  const [user, setUser] = useState(null);
  // modal/splash handling
  const [newUserLocal, setNewUserLocal] = useState(null);
  const [showNewUserModal, setShowNewUserModal] = useState(false);
  const [showWelcomeSplash, setShowWelcomeSplash] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [rewardDialogOpen, setRewardDialogOpen] = useState(false);
  const [rewardNotification, setRewardNotification] = useState(null);

  // Quotes
  const [index, setIndex] = useState(0);

  // Loading state for user fetch
  const [loadingUser, setLoadingUser] = useState(true);

  // Emergency live requests
  const [loadingReq, setLoadingReq] = useState(false);
  const [recentRequests, setRecentRequests] = useState([]);

  // =============================
  // LOAD USER FROM BACKEND
  // =============================
  const loadUser = async () => {
    try {
      // include Firebase ID token if available
      let headers = {};
      try {
        if (firebaseAuth && firebaseAuth.currentUser) {
          const t = await firebaseAuth.currentUser.getIdToken(false);
          if (t) headers.Authorization = `Bearer ${t}`;
        }
      } catch (e) {
        // ignore
      }

      const res = await fetch(`${API_BASE}/api/user/me`, {
        credentials: "include",
        headers,
      });
      if (!res.ok) {
        // fallback to Firebase currentUser if available
        console.warn("/api/user/me failed with status", res.status);
        if (firebaseAuth && firebaseAuth.currentUser) {
          setUser({
            name: firebaseAuth.currentUser.displayName || "User",
            email: firebaseAuth.currentUser.email,
          });
        }
        setLoadingUser(false);
        return;
      }

      const data = await res.json();
      setUser(data);
      localStorage.setItem("userProfile", JSON.stringify(data)); // Cache user data
      setNotifications(data.notifications || []);

      // Check for recent reward notification
      if (data.notifications && data.notifications.length > 0) {
        const rewardNoti = data.notifications.find(n => n.type === 'reward' && !n.read);
        if (rewardNoti) {
          setRewardNotification(rewardNoti);
          setRewardDialogOpen(true);
        }
      }
      // determine whether to show new-user modal or returning-user splash
      try {
        // Check if profile is incomplete (missing phone or bloodGroup)
        const isProfileIncomplete = !data.phone || !data.bloodGroup;

        if (isProfileIncomplete) {
          // New User / Incomplete Profile -> Show Popup
          setShowNewUserModal(true);
        } else {
          // Existing User with complete profile -> Show Splash (once per session)
          const seen = sessionStorage.getItem("welcomeShown");
          if (!seen) {
            setShowWelcomeSplash(true);
            sessionStorage.setItem("welcomeShown", "1");
            setTimeout(() => setShowWelcomeSplash(false), 3000);
          }
        }
      } catch (e) {
        // ignore
      }
    } catch (err) {
      console.error("loadUser error:", err);
    }
    setLoadingUser(false);
  };

  const loadRequests = async () => {
    setLoadingReq(true);
    try {
      const res = await fetch(`${API_BASE}/api/requests/recent`, {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setRecentRequests(data.requests || []);
      }
    } catch (err) {
      console.error("loadRequests error:", err);
    }
    setLoadingReq(false);
  };

  useEffect(() => {
    // Try to load from cache first for instant render
    try {
      const cached = localStorage.getItem("userProfile");
      if (cached) {
        setUser(JSON.parse(cached));
        setLoadingUser(false);
      }
    } catch (e) {
      // ignore
    }

    // wait for Firebase auth to initialize before attempting token-based user fetch
    let unsub = () => { };
    try {
      unsub = firebaseAuth.onAuthStateChanged((u) => {
        if (u) {
          loadUser();
          loadRequests();
        } else {
          // Only set loading to false if we didn't have cached data
          if (!localStorage.getItem("userProfile")) {
            setLoadingUser(false);
          }
        }
      });
    } catch (e) {
      loadUser();
      loadRequests();
    }

    const quoteInterval = setInterval(() => {
      setIndex((prev) => (prev + 1) % QUOTES.length);
    }, 6000);

    // listen for profile updates from other pages (Profile saved)
    const onUpdated = () => loadUser();
    try { window.addEventListener('user-updated', onUpdated); } catch (e) { }

    return () => {
      try { unsub(); } catch (e) { }
      try { window.removeEventListener('user-updated', onUpdated); } catch (e) { }
      clearInterval(quoteInterval);
    };
  }, []);

  // Helper functions
  const initials = (name) => (name ? name.charAt(0).toUpperCase() : "U");
  const handleLogout = () => (window.location.href = "/login");

  if (loadingUser) {
    return (
      <Box sx={{ minHeight: "100vh", background: "#0b0b0b", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <CircularProgress color="error" />
      </Box>
    );
  }

  return (
    <Box
      sx={{
        minHeight: "100vh",
        background: "linear-gradient(180deg, #0b0b0b 0%, #151515 100%)",
        color: "#fff",
        overflowX: "hidden",
        maxWidth: "100vw",
      }}
    >
      {/* TOP NAV */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          px: { xs: 2, md: 6 },
          py: 2,
        }}
      >
        {/* LEFT */}
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

        {/* RIGHT */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
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

            <MenuItem onClick={handleLogout}>
              <LogoutIcon fontSize="small" sx={{ mr: 1 }} />
              Logout
            </MenuItem>
          </Menu>
        </Box>
      </Box>

      {/* New user modal shown if profile is incomplete */}
      <Dialog open={showNewUserModal} onClose={() => setShowNewUserModal(false)}>
        <DialogTitle>{`Hello ${user?.name || 'User'}`}</DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 1 }}>
            To continue with donations, please fill out your profile details (Phone & Blood Group) — it helps us match you with requests. Thank you!
          </Typography>
        </DialogContent>
        <DialogActions sx={{ flexDirection: { xs: 'column', sm: 'row' }, gap: 1, p: 2 }}>
          <Button
            onClick={() => setShowNewUserModal(false)}
            sx={{ minHeight: 48, width: { xs: '100%', sm: 'auto' } }}
          >
            Later
          </Button>
          <Button
            onClick={() => { setShowNewUserModal(false); navigate('/profile'); }}
            sx={{
              background: 'linear-gradient(135deg,#ff2b2b,#b60000)',
              color: '#fff',
              minHeight: 48,
              width: { xs: '100%', sm: 'auto' }
            }}
          >
            Profile
          </Button>
        </DialogActions>
      </Dialog>

      {/* Returning user splash — show once per session for a returning user */}
      {showWelcomeSplash && (
        <Box sx={{ position: 'fixed', inset: 0, zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.95)' }}>
          <Box sx={{ textAlign: 'center', color: '#fff', px: 3 }}>
            <Typography variant="h6" sx={{ mb: 2, color: '#bbb' }}>Welcome back,</Typography>
            <Box sx={{ width: 140, height: 140, borderRadius: '50%', mx: 'auto', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: '#111', mb: 2 }}>
              {user?.profilePhoto ? (
                <img src={user.profilePhoto} alt="pf" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <Avatar src={user?.profilePhoto} sx={{ width: 120, height: 120, bgcolor: '#ff2b2b', fontSize: '2.2rem' }}>{!user?.profilePhoto && initials(user?.name)}</Avatar>
              )}
            </Box>
            <Typography variant="h4" sx={{ fontWeight: 800, mb: 1 }}>{user?.name || 'Friend'}</Typography>
            <Typography sx={{ color: '#ddd', fontSize: 16 }}>{"Real heroes don't wear capes — they donate blood"}</Typography>
          </Box>
        </Box>
      )}

      {/* Reward popup shown on login when user has a recent reward notification */}
      <Dialog open={rewardDialogOpen} onClose={() => setRewardDialogOpen(false)}>
        <DialogTitle>Congratulations</DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 1 }}>
            {rewardNotification?.title || 'You received a reward'}
          </Typography>
          <Typography variant="body2">{rewardNotification?.body}</Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button
            onClick={() => setRewardDialogOpen(false)}
            sx={{ minHeight: 48, width: { xs: '100%', sm: 'auto' } }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* BODY */}
      <Box sx={{ display: "flex", gap: 4, px: { xs: 2, md: 6 }, pb: 6 }}>

        {/* SIDEBAR */}
        {!isMobile && (
          <Box sx={{ width: 260, mt: 2 }}>
            <Box sx={{ position: "sticky", top: 24 }}><Sidebar /></Box>
          </Box>
        )}

        {/* MOBILE DRAWER */}
        {isMobile && (
          <Drawer open={openSidebar} onClose={() => setOpenSidebar(false)}>
            <Sidebar onClose={() => setOpenSidebar(false)} />
          </Drawer>
        )}

        {/* MAIN CONTENT */}
        <Box sx={{ flex: 1, pt: 3 }}>

          {/* QUOTES SECTION */}
          <Box
            sx={{
              borderRadius: 3,
              p: { xs: 3, md: 5 },
              background: "rgba(255,255,255,0.02)",
              boxShadow: "0 30px 80px rgba(0,0,0,0.5)",
              minHeight: 330,
            }}
          >
            <Typography variant="h4" sx={{ color: "#ff2b2b", fontWeight: 800, mb: 3, fontSize: { xs: '1.5rem', md: '2.125rem' } }}>
              Inspiring Donation Stories
            </Typography>

            <Box
              sx={{
                position: "relative",
                height: 200,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                px: 3,
                textAlign: "center",
              }}
            >
              <AnimatePresence mode="wait">
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.5 }}
                  style={{ width: "100%" }}
                >
                  <Typography
                    variant="h5"
                    sx={{
                      color: "#f7f7f7",
                      fontWeight: 500,
                      lineHeight: 1.4,
                    }}
                  >
                    “{QUOTES[index]}”
                  </Typography>
                </motion.div>
              </AnimatePresence>
            </Box>
          </Box>

          {/* LIVE EMERGENCY REQUESTS */}
          <Card
            sx={{
              background: "rgba(255,255,255,0.02)",
              mt: 4,
              p: 3,
              borderRadius: 3,
              boxShadow: "0 25px 60px rgba(0,0,0,0.45)",
            }}
          >
            <Box sx={{ display: "flex", justifyContent: "space-between", mb: 2 }}>
              <Typography sx={{ fontWeight: 700, color: "#ff2b2b" }}>Emergency Requests (Live)</Typography>

              <IconButton sx={{ color: "#fff" }} onClick={loadRequests}>
                <RefreshIcon />
              </IconButton>
            </Box>

            {loadingReq ? (
              <Box sx={{ textAlign: "center", py: 2 }}>
                <CircularProgress color="error" />
              </Box>
            ) : recentRequests.length === 0 ? (
              <Typography sx={{ color: "#bbb" }}>No active emergency requests.</Typography>
            ) : (
              recentRequests.map((r) => (
                <Box
                  key={r._id}
                  sx={{
                    background: "rgba(255,255,255,0.03)",
                    p: 2,
                    mb: 1.5,
                    borderRadius: 2,
                  }}
                >
                  <Box sx={{ display: "flex", gap: 2, alignItems: "center" }}>
                    <Avatar sx={{ bgcolor: "#b71c1c" }}>
                      <LocalHospitalIcon />
                    </Avatar>

                    <Box>
                      <Typography sx={{ fontWeight: 700 }}>
                        {r.name} • {r.bloodGroup || "Any"}
                      </Typography>

                      <Typography variant="caption" sx={{ color: "#aaa" }}>
                        {new Date(r.createdAt).toLocaleString()}
                        {r.distanceKm && ` • ${r.distanceKm} km`}
                      </Typography>

                      <Typography sx={{ fontSize: 13 }}>{r.description}</Typography>
                    </Box>
                  </Box>
                </Box>
              ))
            )}
          </Card>

        </Box>

        {/* HERO IMAGE */}
        <Box
          sx={{
            width: isMobile ? 160 : 330,
            display: { xs: "none", md: "flex" },
            alignItems: "center",
            justifyContent: "center",
            mt: 8,
          }}
        >
          <motion.img
            src={HERO_URL}
            alt="hero"
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
            style={{
              width: isMobile ? 150 : 320,
              maxWidth: "100%",
              filter: "drop-shadow(0 20px 50px rgba(196,20,20,0.35))",
            }}
          />
        </Box>
      </Box>
    </Box>
  );
}
