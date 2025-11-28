import React, { useState } from "react";
import {
  Box,
  IconButton,
  Typography,
  Drawer,
  useMediaQuery,
  Avatar,
  Menu,
  MenuItem,
  Divider,
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import LogoutIcon from "@mui/icons-material/Logout";
import AccountCircleIcon from "@mui/icons-material/AccountCircle";
import Sidebar from "../components/Sidebar";
import { auth as firebaseAuth } from '../firebase/firebaseConfig';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function MapPage() {
  const [openSidebar, setOpenSidebar] = useState(false);
  const [user, setUser] = useState(null);
  const isMobile = useMediaQuery("(max-width:900px)");

  // Profile menu
  const [anchorEl, setAnchorEl] = useState(null);
  const profileOpen = Boolean(anchorEl);

  // Simple initials helper
  const initials = (name) => (name ? name.charAt(0).toUpperCase() : "U");

  const navigate = useNavigate();

  useEffect(() => {
    async function loadUser() {
      try {
        let headers = {};
        if (firebaseAuth?.currentUser) {
          const t = await firebaseAuth.currentUser.getIdToken(false);
          if (t) headers.Authorization = `Bearer ${t}`;
        }
        const res = await fetch(`${process.env.REACT_APP_API_BASE || 'http://localhost:5000'}/api/user/me`, { credentials: 'include', headers });
        if (res.ok) {
          const u = await res.json();
          setUser(u);
          // update UI — replace placeholder with real values
          // we can't call setUser here (no user state) — instead update DOM via globals is not ideal
          // But map is a low priority — just ensure authenticated session triggers no crash
        }
      } catch (e) {
        // ignore
      }
    }

    loadUser();
    const onAuth = () => loadUser();
    try { window.addEventListener('auth-changed', onAuth); window.addEventListener('user-updated', onAuth); } catch(e) {}
    return () => { try { window.removeEventListener('auth-changed', onAuth); window.removeEventListener('user-updated', onAuth); } catch(e) {} };
  }, []);

  const handleLogout = () => (window.location.href = "/login");

  return (
    <Box sx={{ minHeight: "100vh", background: "linear-gradient(180deg,#0b0b0b 0%,#151515 100%)", color: "#fff" }}>
      {/* Top nav */}
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", px: { xs: 2, md: 6 }, py: 2 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <IconButton sx={{ color: "#fff", display: { xs: "inline-flex", md: "none" } }} onClick={() => setOpenSidebar(true)}>
            <MenuIcon />
          </IconButton>

          <Typography variant="h4" sx={{ color: "#ff2b2b", fontWeight: 800, display: { xs: "none", md: "block" } }}>
            Map
          </Typography>
        </Box>

        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <IconButton onClick={(e) => setAnchorEl(e.currentTarget)}>
            <Avatar src={user?.profilePhoto} sx={{ bgcolor: "#222" }}>{!user?.profilePhoto && initials(user?.name || 'U')}</Avatar>
          </IconButton>
          <Menu anchorEl={anchorEl} open={profileOpen} onClose={() => setAnchorEl(null)}>
            <Box sx={{ px: 2, py: 1 }}>
              <Typography sx={{ fontWeight: 700 }}>{user?.name || 'Guest'}</Typography>
              <Typography variant="caption" sx={{ color: "#777" }}>{user?.email || 'guest@example.com'}</Typography>
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

      {/* Sidebar (mobile) */}
      {isMobile && <Drawer open={openSidebar} onClose={() => setOpenSidebar(false)}><Sidebar onClose={() => setOpenSidebar(false)} /></Drawer>}

      {/* Content - simple map placeholder */}
      <Box sx={{ display: "flex", gap: 4, px: { xs: 2, md: 6 }, pb: 6 }}>
        {!isMobile && (
          <Box sx={{ width: 260, mt: 2 }}>
            <Box sx={{ position: "sticky", top: 24 }}><Sidebar /></Box>
          </Box>
        )}

        <Box sx={{ flex: 1, pt: 3 }}>
          <Typography variant="h5" sx={{ color: "#ff2b2b", fontWeight: 800, mb: 2 }}>Nearby Requests Map</Typography>

          <Box sx={{ height: 600, borderRadius: 2, overflow: "hidden", boxShadow: "0 25px 60px rgba(0,0,0,0.45)" }}>
            {/* Using OpenStreetMap embed as a simple placeholder */}
            <iframe
              title="map"
              src="https://www.openstreetmap.org/export/embed.html"
              style={{ width: "100%", height: "100%", border: 0 }}
            />
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
