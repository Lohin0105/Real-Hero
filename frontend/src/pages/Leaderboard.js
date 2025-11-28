import React, { useEffect, useState } from "react";
import {
    Box,
    Typography,
    Card,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    CircularProgress,
    Drawer,
    IconButton,
    useMediaQuery,
    Avatar,
    Tooltip,
    Menu,
    MenuItem,
    Divider
} from "@mui/material";
import Sidebar from "../components/Sidebar";
import { useNavigate } from 'react-router-dom';
import MenuIcon from "@mui/icons-material/Menu";
// removed extra topbar icons - only profile/avatar is shown
import LogoutIcon from "@mui/icons-material/Logout";
import AccountCircleIcon from "@mui/icons-material/AccountCircle";
import { auth as firebaseAuth } from "../firebase/firebaseConfig";

let API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:5000";

export default function Leaderboard() {
    const [openSidebar, setOpenSidebar] = useState(false);
    const isMobile = useMediaQuery("(max-width:900px)");
    const [user, setUser] = useState(null);
    const [leaderboard, setLeaderboard] = useState([]);
    const [loading, setLoading] = useState(true);
    const [anchorEl, setAnchorEl] = useState(null);
    const profileOpen = Boolean(anchorEl);

    const navigate = useNavigate();

    async function loadUser() {
        try {
            let headers = {};
            if (firebaseAuth?.currentUser) {
                const t = await firebaseAuth.currentUser.getIdToken(false);
                if (t) headers.Authorization = `Bearer ${t}`;
            }
            const res = await fetch(`${API_BASE}/api/user/me`, { credentials: "include", headers });
            if (res.ok) {
                const u = await res.json();
                setUser(u);
            }
        } catch (e) {
            console.warn("User fetch failed", e);
        }
    }

    useEffect(() => {
        (async () => { await loadUser(); await loadLeaderboard(); })();
        const onAuth = () => loadUser();
        const onUpdated = () => loadUser();
        try { window.addEventListener('auth-changed', onAuth); window.addEventListener('user-updated', onUpdated); } catch(e) {}
        return () => { try { window.removeEventListener('auth-changed', onAuth); window.removeEventListener('user-updated', onUpdated); } catch(e) {} };
    }, []);

    const loadLeaderboard = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE}/api/rewards/leaderboard`);
            if (res.ok) {
                const data = await res.json();
                setLeaderboard(data);
            }
        } catch (e) {
            console.error("Failed to load leaderboard", e);
        }
        setLoading(false);
    };

    return (
        <Box sx={{ minHeight: "100vh", background: "linear-gradient(180deg, #0b0b0b 0%, #151515 100%)", color: "#fff" }}>
            {/* TOP NAV */}
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", px: { xs: 2, md: 6 }, py: 2 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                    <IconButton sx={{ color: "#fff", display: { xs: "inline-flex", md: "none" } }} onClick={() => setOpenSidebar(true)}>
                        <MenuIcon />
                    </IconButton>
                    <Typography variant="h4" sx={{ color: "#ff2b2b", fontWeight: 800, textShadow: "0 0 18px rgba(255,20,20,0.85)", display: { xs: "none", md: "block" } }}>
                        Leaderboard
                    </Typography>
                </Box>
                <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                    {/* only profile avatar shown in navbar */}
                    <IconButton onClick={(e) => setAnchorEl(e.currentTarget)}>
                        <Avatar src={user?.profilePhoto} sx={{ bgcolor: "#222" }}>{!user?.profilePhoto && (user?.name ? user.name.charAt(0).toUpperCase() : "U")}</Avatar>
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
                        <MenuItem onClick={() => window.location.href = "/login"}>
                            <LogoutIcon fontSize="small" sx={{ mr: 1 }} />
                            Logout
                        </MenuItem>
                    </Menu>
                </Box>
            </Box>

            <Box sx={{ display: "flex", gap: 4, px: { xs: 2, md: 6 }, pb: 6 }}>
                {!isMobile && (
                    <Box sx={{ width: 260, mt: 2 }}>
                        <Box sx={{ position: "sticky", top: 24 }}><Sidebar /></Box>
                    </Box>
                )}
                {isMobile && (
                    <Drawer open={openSidebar} onClose={() => setOpenSidebar(false)}>
                        <Sidebar onClose={() => setOpenSidebar(false)} />
                    </Drawer>
                )}

                <Box sx={{ flex: 1, pt: 3 }}>
                    <Typography variant="h4" sx={{ color: "#ff2b2b", fontWeight: 800, mb: 3 }}>Top Heroes</Typography>

                    {loading ? (
                        <CircularProgress color="error" />
                    ) : leaderboard.length === 0 ? (
                        <Typography sx={{ color: "#777" }}>No leaderboard data yet.</Typography>
                    ) : (
                        <TableContainer component={Paper} sx={{ background: "rgba(255,255,255,0.03)" }}>
                            <Table>
                                <TableHead>
                                    <TableRow>
                                        <TableCell sx={{ color: "#fff", fontWeight: 700 }}>Rank</TableCell>
                                        <TableCell sx={{ color: "#fff", fontWeight: 700 }}>Name</TableCell>
                                        <TableCell sx={{ color: "#fff", fontWeight: 700 }}>Points</TableCell>
                                        <TableCell sx={{ color: "#fff", fontWeight: 700 }}>Coins</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {leaderboard.map((entry, index) => {
                                        const isCurrentUser = user && entry._id === user._id;
                                        return (
                                            <TableRow
                                                key={entry._id}
                                                sx={{
                                                    background: isCurrentUser ? "rgba(255,43,43,0.1)" : "transparent",
                                                    borderLeft: isCurrentUser ? "4px solid #ff2b2b" : "none"
                                                }}
                                            >
                                                <TableCell sx={{ color: "#ddd", fontWeight: isCurrentUser ? 700 : 400 }}>
                                                    {index === 0 && "🥇"}
                                                    {index === 1 && "🥈"}
                                                    {index === 2 && "🥉"}
                                                    {index > 2 && `#${index + 1}`}
                                                </TableCell>
                                                <TableCell sx={{ color: isCurrentUser ? "#ff2b2b" : "#ddd", fontWeight: isCurrentUser ? 700 : 400 }}>
                                                    {entry.name} {isCurrentUser && "(You)"}
                                                </TableCell>
                                                <TableCell sx={{ color: "#4caf50", fontWeight: 700 }}>{entry.leaderboardPoints || 0}</TableCell>
                                                <TableCell sx={{ color: "#ffa726", fontWeight: 700 }}>{entry.coins || 0}</TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    )}
                </Box>
            </Box>
        </Box>
    );
}
