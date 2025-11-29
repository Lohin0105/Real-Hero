import React, { useEffect, useState } from "react";
import {
    Box,
    Typography,
    Card,
    CardContent,
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
    Divider,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button
} from "@mui/material";
import Sidebar from "../components/Sidebar";
import { useNavigate } from 'react-router-dom';
import MenuIcon from "@mui/icons-material/Menu";
// removed extra navbar icons - only profile/avatar remains
import LogoutIcon from "@mui/icons-material/Logout";
import AccountCircleIcon from "@mui/icons-material/AccountCircle";
import { auth as firebaseAuth } from "../firebase/firebaseConfig";

let API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:5000";

export default function Rewards() {
    const [openSidebar, setOpenSidebar] = useState(false);
    const isMobile = useMediaQuery("(max-width:900px)");
    const [user, setUser] = useState(null);
    const [rewards, setRewards] = useState([]);
    const [loading, setLoading] = useState(true);
    const [anchorEl, setAnchorEl] = useState(null);
    const profileOpen = Boolean(anchorEl);

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
                loadRewards(u);
                return;
            }
        } catch (e) {
            console.warn("User fetch failed", e);
        }
        setLoading(false);
    }

    const navigate = useNavigate();

    useEffect(() => {
        (async () => { await loadUser(); })();

        const onAuth = () => { loadUser(); };
        const onUpdated = () => { loadUser(); };
        try { window.addEventListener('auth-changed', onAuth); window.addEventListener('user-updated', onUpdated); } catch(e) {}
        return () => { try { window.removeEventListener('auth-changed', onAuth); window.removeEventListener('user-updated', onUpdated); } catch(e) {} };
    }, []);

    const loadRewards = async (currentUser) => {
        if (!currentUser) return;
        setLoading(true);
        try {
            const uid = currentUser.uid || currentUser._id;
            const res = await fetch(`${API_BASE}/api/rewards/my-rewards?uid=${uid}`);
            if (res.ok) {
                const data = await res.json();
                setRewards(data);
            }
        } catch (e) {
            console.error("Failed to load rewards", e);
        }
        setLoading(false);
    };

    const [infoDialogOpen, setInfoDialogOpen] = useState(false);
    const [selectedReward, setSelectedReward] = useState(null);

    const handleInfoClick = (reward) => {
        setSelectedReward(reward);
        setInfoDialogOpen(true);
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
                        Rewards
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
                    <Typography variant="h4" sx={{ color: "#ff2b2b", fontWeight: 800, mb: 3 }}>My Rewards</Typography>

                    {/* Coins and Points Summary */}
                    <Box sx={{ display: "flex", gap: 3, mb: 4, flexWrap: "wrap" }}>
                        <Card sx={{ flex: 1, minWidth: 200, background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)", boxShadow: "0 20px 60px rgba(0,0,0,0.5)" }}>
                            <CardContent>
                                <Typography variant="h6" sx={{ color: "#fff", opacity: 0.9 }}>Total Coins</Typography>
                                <Typography variant="h2" sx={{ color: "#fff", fontWeight: 800 }}>{user?.coins || 0}</Typography>
                            </CardContent>
                        </Card>
                        <Card sx={{ flex: 1, minWidth: 200, background: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)", boxShadow: "0 20px 60px rgba(0,0,0,0.5)" }}>
                            <CardContent>
                                <Typography variant="h6" sx={{ color: "#fff", opacity: 0.9 }}>Leaderboard Points</Typography>
                                <Typography variant="h2" sx={{ color: "#fff", fontWeight: 800 }}>{user?.leaderboardPoints || 0}</Typography>
                            </CardContent>
                        </Card>
                    </Box>

                    {/* Reward History */}
                    <Typography variant="h5" sx={{ color: "#ff2b2b", fontWeight: 700, mb: 2 }}>Reward History</Typography>

                    {loading ? (
                        <CircularProgress color="error" />
                    ) : rewards.length === 0 ? (
                        <Typography sx={{ color: "#777" }}>No rewards yet. Start donating to earn rewards!</Typography>
                    ) : (
                        <TableContainer component={Paper} sx={{ background: "rgba(255,255,255,0.03)" }}>
                            <Table>
                                <TableHead>
                                    <TableRow>
                                        <TableCell sx={{ color: "#fff", fontWeight: 700 }}>Date</TableCell>
                                        <TableCell sx={{ color: "#fff", fontWeight: 700 }}>Type</TableCell>
                                        <TableCell sx={{ color: "#fff", fontWeight: 700 }}>Points</TableCell>
                                        <TableCell sx={{ color: "#fff", fontWeight: 700 }}>Coins</TableCell>
                                        <TableCell sx={{ color: "#fff", fontWeight: 700 }}>Info</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {rewards.map((reward) => (
                                        <TableRow key={reward._id}>
                                            <TableCell sx={{ color: "#ddd" }}>{new Date(reward.createdAt).toLocaleDateString()}</TableCell>
                                            <TableCell sx={{ color: "#ddd" }}>{reward.type}</TableCell>
                                            <TableCell sx={{ color: "#4caf50", fontWeight: 700 }}>+{reward.leaderboardPoints || reward.points || 0}</TableCell>
                                            <TableCell sx={{ color: "#ffd700", fontWeight: 700 }}>+{reward.coins || 0}</TableCell>
                                            <TableCell>
                                                <IconButton size="small" onClick={() => handleInfoClick(reward)} sx={{ color: "#2196f3" }}>
                                                    <Typography variant="caption" sx={{ textDecoration: 'underline', cursor: 'pointer' }}>View Info</Typography>
                                                </IconButton>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    )}
                </Box>
            </Box>

            {/* Donation Info Dialog */}
            <Dialog open={infoDialogOpen} onClose={() => setInfoDialogOpen(false)}>
                <DialogTitle>Donation Information</DialogTitle>
                <DialogContent>
                    {selectedReward ? (
                        <Box sx={{ minWidth: 300, mt: 1 }}>
                            <Typography variant="subtitle2" color="textSecondary">Patient Name</Typography>
                            <Typography variant="body1" sx={{ mb: 2, fontWeight: 600 }}>{selectedReward.patientName || "N/A"}</Typography>

                            <Typography variant="subtitle2" color="textSecondary">Hospital</Typography>
                            <Typography variant="body1" sx={{ mb: 2, fontWeight: 600 }}>{selectedReward.hospital || "N/A"}</Typography>

                            <Typography variant="subtitle2" color="textSecondary">Date</Typography>
                            <Typography variant="body1">{new Date(selectedReward.createdAt).toLocaleString()}</Typography>
                        </Box>
                    ) : (
                        <Typography>No details available.</Typography>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setInfoDialogOpen(false)}>Close</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
