import React from "react";
import {
    Box,
    List,
    ListItemButton,
    ListItemIcon,
    ListItemText,
    Typography,
    Divider,
} from "@mui/material";
import DashboardIcon from "@mui/icons-material/Dashboard";
import LocalShippingIcon from "@mui/icons-material/LocalShipping";
import MedicalServicesIcon from "@mui/icons-material/MedicalServices";
import AccountCircleIcon from "@mui/icons-material/AccountCircle";
import MapIcon from "@mui/icons-material/Map";
import BloodtypeIcon from "@mui/icons-material/Bloodtype";
import VolunteerActivismIcon from "@mui/icons-material/VolunteerActivism";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import LeaderboardIcon from "@mui/icons-material/Leaderboard";
import { useNavigate, useLocation } from "react-router-dom";

export default function Sidebar({ onClose }) {
    const navigate = useNavigate();
    const location = useLocation();
    const active = location.pathname;

    const handleAction = (path) => {
        navigate(path);
        if (onClose) onClose();
    };

    return (
        <Box sx={{ width: 240, px: 1, py: 2 }}>
            <Typography
                variant="h5"
                sx={{
                    color: "#ff2b2b",
                    fontWeight: 800,
                    textAlign: "center",
                    mb: 2,
                    textShadow: "0 0 12px rgba(255,40,40,0.8)",
                }}
            >
                Real-Hero
            </Typography>

            <Divider sx={{ mb: 2, background: "#222" }} />

            <List>
                <ListItemButton selected={active === "/dashboard"} onClick={() => handleAction("/dashboard")}>
                    <ListItemIcon><DashboardIcon sx={{ color: "#ff4a4a" }} /></ListItemIcon>
                    <ListItemText primary="Dashboard" />
                </ListItemButton>

                <ListItemButton selected={active === "/donate"} onClick={() => handleAction("/donate")}>
                    <ListItemIcon><LocalShippingIcon sx={{ color: "#ff4a4a" }} /></ListItemIcon>
                    <ListItemText primary="Donate Blood" />
                </ListItemButton>

                <ListItemButton selected={active === "/request"} onClick={() => handleAction("/request")}>
                    <ListItemIcon><MedicalServicesIcon sx={{ color: "#ff4a4a" }} /></ListItemIcon>
                    <ListItemText primary="Request Blood" />
                </ListItemButton>

                {/* MediBot removed */}

                {/* New Pages */}
                <ListItemButton selected={active === "/requested-donations"} onClick={() => handleAction("/requested-donations")}>
                    <ListItemIcon><BloodtypeIcon sx={{ color: "#ff4a4a" }} /></ListItemIcon>
                    <ListItemText primary="Requested Donations" />
                </ListItemButton>

                <ListItemButton selected={active === "/donations"} onClick={() => handleAction("/donations")}>
                    <ListItemIcon><VolunteerActivismIcon sx={{ color: "#ff4a4a" }} /></ListItemIcon>
                    <ListItemText primary="My Donations" />
                </ListItemButton>

                <ListItemButton selected={active === "/rewards"} onClick={() => handleAction("/rewards")}>
                    <ListItemIcon><EmojiEventsIcon sx={{ color: "#ff4a4a" }} /></ListItemIcon>
                    <ListItemText primary="Rewards" />
                </ListItemButton>

                <ListItemButton selected={active === "/leaderboard"} onClick={() => handleAction("/leaderboard")}>
                    <ListItemIcon><LeaderboardIcon sx={{ color: "#ff4a4a" }} /></ListItemIcon>
                    <ListItemText primary="Leaderboard" />
                </ListItemButton>

                {/* Map Button Removed as per request */}
                {/* <ListItemButton selected={active === "/map"} onClick={() => handleAction("/map")}>
          <ListItemIcon><MapIcon sx={{ color: "#ff4a4a" }} /></ListItemIcon>
          <ListItemText primary="Map" />
        </ListItemButton> */}
            </List>
        </Box>
    );
}
