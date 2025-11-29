import React, { useEffect, useState } from "react";
import {
    Box,
    Typography,
    Card,
    Button,
    CircularProgress,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Drawer,
    IconButton,
    useMediaQuery,
    Avatar,
    Tooltip,
    Menu,
    MenuItem,

    Divider,
    Grid
} from "@mui/material";
import Sidebar from "../components/Sidebar";
import { useNavigate } from 'react-router-dom';
import MenuIcon from "@mui/icons-material/Menu";
// removed other topbar icons — keep only profile/avatar
import LogoutIcon from "@mui/icons-material/Logout";
import AccountCircleIcon from "@mui/icons-material/AccountCircle";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";

import { auth as firebaseAuth } from "../firebase/firebaseConfig";

let API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:5000";

export default function Donations() {
    const [openSidebar, setOpenSidebar] = useState(false);
    const isMobile = useMediaQuery("(max-width:900px)");
    const [liveDonation, setLiveDonation] = useState(null);
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);

    // Dialogs
    const [completeDialogOpen, setCompleteDialogOpen] = useState(false);
    const [cancelDialogOpen, setCancelDialogOpen] = useState(false);

    // Profile menu
    const [anchorEl, setAnchorEl] = useState(null);
    const profileOpen = Boolean(anchorEl);

    const [user, setUser] = useState(() => {
        try {
            const cached = localStorage.getItem("userProfile");
            return cached ? JSON.parse(cached) : null;
        } catch (e) {
            return null;
        }
    });

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
                localStorage.setItem("userProfile", JSON.stringify(u));
                loadDonations(u);
                return;
            }
        } catch (e) {
            console.warn("User fetch failed", e);
        }
        setLoading(false);
    }

    useEffect(() => {
        loadUser();
        const onAuth = () => loadUser();
        const onUpdated = () => loadUser();
        try { window.addEventListener('auth-changed', onAuth); window.addEventListener('user-updated', onUpdated); } catch (e) { }
        return () => { try { window.removeEventListener('auth-changed', onAuth); window.removeEventListener('user-updated', onUpdated); } catch (e) { } };
    }, []);

    const loadDonations = async (currentUser) => {
        if (!currentUser) return;
        setLoading(true);
        try {
            const uid = currentUser.uid || currentUser._id;
            const res = await fetch(`${API_BASE}/api/requests/my-donations?uid=${uid}`);
            if (res.ok) {
                const data = await res.json();
                console.log('My donations data:', data);
                // Separate live vs history
                // Live = active or promoted (but NOT completed)
                // History = completed, fulfilled, cancelled, failed
                const active = data.find(d => ['active', 'promoted'].includes(d.status) && d.requestId && ['primary_assigned', 'backup_assigned', 'open'].includes(d.requestId.status));
                console.log('Active donation:', active);

                if (active) {
                    setLiveDonation({
                        ...active,
                        hospital: active.requestId.hospital,
                        patientName: active.requestId.name,
                        bloodGroup: active.requestId.bloodGroup,
                        role: active.role === 'primary' ? 'Primary Donor' : 'Backup Donor'
                    });
                } else {
                    setLiveDonation(null);
                }

                const hist = data.filter(d => !active || d._id !== active._id).map(d => ({
                    ...d,
                    hospital: d.requestId?.hospital || d.hospital || 'Unknown',
                    date: new Date(d.updatedAt).toLocaleDateString(),
                    points: d.rewardPoints || 0,
                    status: d.status
                }));
                console.log('History donations:', hist);
                setHistory(hist);
            }
        } catch (e) {
            console.error(e);
        }
        setLoading(false);
    };

    const handleComplete = () => {
        setCompleteDialogOpen(true);
    };

    const confirmComplete = async () => {
        if (!liveDonation) return;
        console.log('Completing donation for request:', liveDonation.requestId._id);
        console.log('User UID:', user?.uid);
        try {
            const res = await fetch(`${API_BASE}/api/requests/complete/${liveDonation.requestId._id}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ uid: user?.uid })
            });
            const data = await res.json();
            console.log('Complete donation response:', data);
            if (res.ok) {
                alert("Great job! We have sent a verification email to the requester. Your rewards will be credited once they confirm.");
                console.log('Reloading donations...');
                await loadDonations(user);
                console.log('Donations reloaded');
            } else {
                console.error('Error completing donation:', data);
                alert("Error: " + (data.error || "Failed"));
            }
        } catch (e) {
            console.error('Network error:', e);
            alert("Network error");
        }
        setCompleteDialogOpen(false);
    };

    const handleCancel = () => {
        setCancelDialogOpen(true);
    };

    const confirmCancel = async () => {
        if (!liveDonation) return;
        try {
            const res = await fetch(`${API_BASE}/api/requests/cancel/${liveDonation.requestId._id}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ uid: user?.uid })
            });
            if (res.ok) {
                alert("Don't worry! Your cancellation has been processed.");
                loadDonations(user);
            } else {
                const err = await res.json();
                alert("Error: " + (err.error || "Failed"));
            }
        } catch (e) {
            alert("Network error");
        }
        setCancelDialogOpen(false);
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
                        Real-Hero
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
            </Box >

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
                    <Typography variant="h4" sx={{ color: "#ff2b2b", fontWeight: 800, mb: 3 }}>My Donations</Typography>

                    <Grid container spacing={3} alignItems="stretch">
                        {/* Live Donations */}
                        <Grid size={{ xs: 12, md: 6 }} sx={{ mb: 3 }}>
                            <Card sx={{ background: "rgba(255,255,255,0.03)", p: 3, borderRadius: 3, height: '100%' }}>
                                <Typography variant="h6" sx={{ color: "#ff4a4a", mb: 2, fontWeight: 700 }}>Live Donation</Typography>
                                {loading ? <CircularProgress color="error" /> : liveDonation ? (
                                    <Box>
                                        <Typography variant="h5" sx={{ mb: 1 }}>{liveDonation.hospital}</Typography>
                                        <Typography sx={{ color: "#aaa" }}>Patient: {liveDonation.patientName}</Typography>
                                        <Typography sx={{ color: "#aaa" }}>Role: {liveDonation.role}</Typography>
                                        <Box sx={{ mt: 3, display: 'flex', gap: 2 }}>
                                            <Button variant="contained" color="success" startIcon={<CheckCircleIcon />} onClick={handleComplete}>
                                                Donation Completed
                                            </Button>
                                            <Button variant="outlined" color="error" startIcon={<CancelIcon />} onClick={handleCancel}>
                                                Cancel
                                            </Button>
                                        </Box>
                                    </Box>
                                ) : (
                                    <Typography sx={{ color: "#777" }}>No active donations at the moment.</Typography>
                                )}
                            </Card>
                        </Grid>

                        {/* Donation History */}
                        <Grid size={{ xs: 12, md: 6 }} sx={{ mb: 3 }}>
                            <Card sx={{ background: "rgba(255,255,255,0.03)", p: 3, borderRadius: 3, height: '100%' }}>
                                <Typography variant="h6" sx={{ color: "#aaa", mb: 2, fontWeight: 700 }}>History</Typography>
                                {loading ? <CircularProgress color="error" /> : history.length > 0 ? (
                                    history.map((h) => (
                                        <Box key={h._id} sx={{ mb: 2, p: 2, background: "rgba(0,0,0,0.2)", borderRadius: 2 }}>
                                            <Typography sx={{ fontWeight: 600 }}>{h.hospital}</Typography>
                                            <Typography variant="caption" sx={{ color: "#777" }}>{h.date} • {h.status}</Typography>
                                            <Typography variant="body2" sx={{ color: "#4caf50" }}>+{h.points} Points</Typography>
                                        </Box>
                                    ))
                                ) : (
                                    <Typography sx={{ color: "#777" }}>No donation history yet.</Typography>
                                )}
                            </Card>
                        </Grid>
                    </Grid>
                </Box>
            </Box>

            {/* Complete Dialog */}
            <Dialog open={completeDialogOpen} onClose={() => setCompleteDialogOpen(false)}>
                <DialogTitle>Confirm Completion</DialogTitle>
                <DialogContent>
                    <Typography>
                        You have done a great job! Your rewards will be added in a couple of days after we verify with the requester.
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setCompleteDialogOpen(false)}>Cancel</Button>
                    <Button onClick={confirmComplete} variant="contained" color="success">
                        Confirm
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Cancel Dialog */}
            <Dialog open={cancelDialogOpen} onClose={() => setCancelDialogOpen(false)}>
                <DialogTitle>Cancel Donation?</DialogTitle>
                <DialogContent>
                    <Typography>
                        You may have work, don't worry! Make a donation next time.
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setCancelDialogOpen(false)}>Back</Button>
                    <Button onClick={confirmCancel} variant="contained" color="error">
                        Cancel Donation
                    </Button>
                </DialogActions>
            </Dialog>

        </Box >
    );
}
