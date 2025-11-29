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
    Divider
} from "@mui/material";
import Sidebar from "../components/Sidebar";
import { useNavigate } from 'react-router-dom';
import MenuIcon from "@mui/icons-material/Menu";
// removed extra topbar icons: keep only profile/avatar
import LogoutIcon from "@mui/icons-material/Logout";
import AccountCircleIcon from "@mui/icons-material/AccountCircle";
import InfoIcon from "@mui/icons-material/Info";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import DeleteIcon from "@mui/icons-material/Delete";
import { auth as firebaseAuth } from "../firebase/firebaseConfig";

let API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:5000";

export default function RequestedDonations() {
    const [openSidebar, setOpenSidebar] = useState(false);
    const isMobile = useMediaQuery("(max-width:900px)");
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedRequest, setSelectedRequest] = useState(null);
    const [infoOpen, setInfoOpen] = useState(false);
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [requestToDelete, setRequestToDelete] = useState(null);

    // Profile menu
    const [anchorEl, setAnchorEl] = useState(null);
    const profileOpen = Boolean(anchorEl);

    const [user, setUser] = useState(null);

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
                loadMyRequests(u);
                return;
            }
        } catch (e) {
            console.warn("User fetch failed", e);
        }
        setLoading(false);
    }

    const navigate = useNavigate();

    useEffect(() => {
        loadUser();
        const onAuth = () => loadUser();
        const onUpdated = () => loadUser();
        try { window.addEventListener('auth-changed', onAuth); window.addEventListener('user-updated', onUpdated); } catch(e) {}
        return () => { try { window.removeEventListener('auth-changed', onAuth); window.removeEventListener('user-updated', onUpdated); } catch(e) {} };
    }, []);

    const loadMyRequests = async (currentUser) => {
        if (!currentUser) return;
        setLoading(true);
        try {
            const uid = currentUser.uid || currentUser._id; // fallback
            const res = await fetch(`${API_BASE}/api/requests/my-requests?uid=${uid}`);
            if (res.ok) {
                const data = await res.json();
                setRequests(data);
            }
        } catch (e) {
            console.error("Failed to load requests", e);
        }
        setLoading(false);
    };

    const handleInfo = (req) => {
        setSelectedRequest(req);
        setInfoOpen(true);
    };

    const handleDeleteClick = (req) => {
        setRequestToDelete(req);
        setDeleteOpen(true);
    };

    const [successOpen, setSuccessOpen] = useState(false);

    const confirmDelete = async () => {
        if (!requestToDelete) return;
        try {
            const res = await fetch(`${API_BASE}/api/requests/close/${requestToDelete._id}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ uid: user?.uid })
            });
            if (res.ok) {
                setSuccessOpen(true);
                loadMyRequests(user);
            } else {
                const err = await res.json();
                alert("Failed to close request: " + (err.error || "Unknown error"));
            }
        } catch (e) {
            console.error(e);
            alert("Network error");
        }
        setDeleteOpen(false);
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
                    <Typography variant="h4" sx={{ color: "#ff2b2b", fontWeight: 800, mb: 3 }}>Requested Donations</Typography>

                    {loading ? (
                        <CircularProgress color="error" />
                    ) : requests.length === 0 ? (
                        <Typography sx={{ color: "#777" }}>No active requests found.</Typography>
                    ) : (
                        requests.map((req) => (
                            <Card key={req._id} sx={{ background: "rgba(255,255,255,0.03)", p: 3, mb: 2, borderRadius: 3 }}>
                                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 2 }}>
                                    <Box>
                                        <Typography variant="h6" sx={{ fontWeight: 700 }}>{req.bloodGroup} Request at {req.hospital}</Typography>
                                        <Typography variant="body2" sx={{ color: "#aaa" }}>Status: {req.status}</Typography>
                                        <Typography variant="caption" sx={{ color: "#777" }}>Created: {new Date(req.createdAt).toLocaleDateString()}</Typography>
                                    </Box>
                                    <Box sx={{ display: "flex", gap: 2 }}>
                                        <Button variant="outlined" startIcon={<InfoIcon />} onClick={() => handleInfo(req)} sx={{ color: "#fff", borderColor: "#444" }}>
                                            Info
                                        </Button>
                                        <Button variant="contained" color="success" startIcon={<CheckCircleIcon />} onClick={() => handleDeleteClick(req)}>
                                            Received Blood
                                        </Button>
                                    </Box>
                                </Box>
                            </Card>
                        ))
                    )}
                </Box>
            </Box>

            {/* Info Dialog */}
            <Dialog open={infoOpen} onClose={() => setInfoOpen(false)}>
                <DialogTitle>Request Details</DialogTitle>
                <DialogContent>
                    {selectedRequest && (
                        <Box>
                            <Typography><strong>Patient Name:</strong> {selectedRequest.name}</Typography>
                            <Typography><strong>Hospital:</strong> {selectedRequest.hospital}</Typography>
                            <Typography><strong>Blood Group:</strong> {selectedRequest.bloodGroup}</Typography>
                            <Typography><strong>Status:</strong> {selectedRequest.status}</Typography>
                            <Typography sx={{ mt: 2, fontStyle: 'italic', color: '#777' }}>
                                Note: Requests are automatically removed after 7 days.
                            </Typography>
                        </Box>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setInfoOpen(false)}>Close</Button>
                </DialogActions>
            </Dialog>

            {/* Delete/Received Dialog */}
            <Dialog open={deleteOpen} onClose={() => setDeleteOpen(false)}>
                <DialogTitle>Received Blood?</DialogTitle>
                <DialogContent>
                    <Typography>
                        We are so happy you received the blood! Would you like to close this request now?
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDeleteOpen(false)}>Cancel</Button>
                    <Button onClick={confirmDelete} variant="contained" color="error" startIcon={<DeleteIcon />}>
                        Yes, Close Request
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Success Dialog */}
            <Dialog open={successOpen} onClose={() => setSuccessOpen(false)}>
                <DialogTitle>Success</DialogTitle>
                <DialogContent>
                    <Typography>
                        Request deleted successfully.
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setSuccessOpen(false)} variant="contained" color="primary">
                        Close
                    </Button>
                </DialogActions>
            </Dialog>

        </Box>
    );
}
