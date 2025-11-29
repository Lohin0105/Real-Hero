// frontend/src/pages/Profile.js
import React, { useState, useEffect, useRef } from "react";
import { auth as firebaseAuth } from "../firebase/firebaseConfig";
import { sendPasswordResetEmail } from "firebase/auth";
import Swal from "sweetalert2";
import { useNavigate } from "react-router-dom";

import {
    Box,
    Drawer,
    IconButton,
    Typography,
    Avatar,
    Divider,
    useMediaQuery,
    Menu,
    MenuItem,
    Card,
    CardContent,
    TextField,
    Button,
    CircularProgress,
    InputAdornment,
} from "@mui/material";

import MenuIcon from "@mui/icons-material/Menu";
import AccountCircleIcon from "@mui/icons-material/AccountCircle";
import LogoutIcon from "@mui/icons-material/Logout";
import EditIcon from "@mui/icons-material/Edit";
import SaveIcon from "@mui/icons-material/Save";
import LockResetIcon from "@mui/icons-material/LockReset";
import PersonIcon from "@mui/icons-material/Person";
import EmailIcon from "@mui/icons-material/Email";
import PhoneIcon from "@mui/icons-material/Phone";
import CakeIcon from "@mui/icons-material/Cake";
import WcIcon from "@mui/icons-material/Wc";
import FavoriteIcon from "@mui/icons-material/Favorite";
import FitnessCenterIcon from "@mui/icons-material/FitnessCenter";
import CameraAltIcon from "@mui/icons-material/CameraAlt";
import PhotoLibraryIcon from "@mui/icons-material/PhotoLibrary";

import Sidebar from "../components/Sidebar";

const HERO_URL = "https://ik.imagekit.io/Lohin/hero.png";

let API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:5000";
try {
    if (typeof window !== "undefined") {
        const host = window.location.hostname;
        if (!/(localhost|127\.0\.0\.1)/.test(host)) {
            API_BASE = API_BASE.replace(/localhost|127\.0\.0\.1/, host);
        }
    }
} catch { }

export default function Profile() {
    const navigate = useNavigate();
    const isMobile = useMediaQuery("(max-width:900px)");
    const [openSidebar, setOpenSidebar] = useState(false);

    const [anchorEl, setAnchorEl] = useState(null);
    const profileOpen = Boolean(anchorEl);

    const [isEditing, setIsEditing] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const cameraInputRef = useRef(null);
    const fileInputRef = useRef(null);

    const [formData, setFormData] = useState({
        name: "",
        email: "",
        phone: "",
        gender: "",
        dateOfBirth: "",
        bloodGroup: "",
        weight: "",
        profilePhoto: "",
    });

    const [calculatedAge, setCalculatedAge] = useState("");

    const getIdToken = async () => {
        try {
            if (firebaseAuth.currentUser) {
                return await firebaseAuth.currentUser.getIdToken();
            }
        } catch { }
        return null;
    };

    useEffect(() => {
        // wait for Firebase auth to initialize; when auth state ready, load profile
        let unsub = () => { };
        try {
            unsub = firebaseAuth.onAuthStateChanged((u) => {
                // ensure we always attempt to load profile once we know auth status
                loadProfile();
            });
        } catch (e) {
            // fallback - attempt a single load
            loadProfile();
        }

        return () => {
            try { unsub(); } catch (e) { }
        };
    }, []);

    const loadProfile = async () => {
        setLoading(true);
        try {
            const token = await getIdToken();
            const headers = token ? { Authorization: `Bearer ${token}` } : {};

            const res = await fetch(`${API_BASE}/api/user/me`, { credentials: "include", headers });
            if (!res.ok) throw new Error();

            const data = await res.json();

            setFormData({
                name: data.name || firebaseAuth.currentUser?.displayName || "",
                email: data.email || firebaseAuth.currentUser?.email || "",
                phone: data.phone || "",
                gender: data.gender || "",
                dateOfBirth: data.dateOfBirth?.split("T")[0] || "",
                bloodGroup: data.bloodGroup || "",
                weight: data.weight || "",
                profilePhoto: data.profilePhoto || "",
            });
        } catch {
            // fall back to Firebase user info to keep UI populated if backend fails
            const fallName = firebaseAuth.currentUser?.displayName || "";
            const fallEmail = firebaseAuth.currentUser?.email || "";
            setFormData((p) => ({
                ...p,
                name: fallName,
                email: fallEmail,
                profilePhoto: firebaseAuth.currentUser?.photoURL || p.profilePhoto || "",
            }));
            // notify the user but allow them to continue editing
            Swal.fire("Error", "Unable to load profile from server — using fallback info. You can still edit and save.", "warning");
        }
        setLoading(false);
    };

    useEffect(() => {
        if (formData.dateOfBirth) {
            const dob = new Date(formData.dateOfBirth);
            const now = new Date();
            let age = now.getFullYear() - dob.getFullYear();
            const m = now.getMonth() - dob.getMonth();
            if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age--;
            setCalculatedAge(age);
        } else {
            setCalculatedAge("");
        }
    }, [formData.dateOfBirth]);

    const handleInput = (e) => {
        setFormData((p) => ({ ...p, [e.target.name]: e.target.value }));
    };

    const handlePhotoUpload = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 2 * 1024 * 1024) {
            return Swal.fire("Error", "Max 2MB file allowed", "error");
        }

        const reader = new FileReader();
        reader.onloadend = () => setFormData((p) => ({ ...p, profilePhoto: reader.result }));
        reader.readAsDataURL(file);
    };

    const handleSave = async () => {
        if (calculatedAge < 18 || calculatedAge > 65)
            return Swal.fire("Invalid", "Age must be 18–65", "error");
        if (formData.weight < 50)
            return Swal.fire("Invalid", "Weight must be 50kg minimum", "error");

        setSaving(true);

        try {
            const token = await getIdToken();
            const res = await fetch(`${API_BASE}/api/user`, {
                method: "POST",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: token ? `Bearer ${token}` : "",
                },
                body: JSON.stringify(formData),
            });

            if (!res.ok) {
                // attempt to surface a helpful message to the user
                const txt = await res.text().catch(() => '');
                if (res.status === 413) {
                    throw new Error('Image too large. Please upload an image smaller than 2MB (profiles are base64 encoded).');
                }
                throw new Error(txt || `Server returned ${res.status}`);
            }

            // update UI from returned JSON so the user's changes appear immediately
            const saved = await res.json().catch(() => null);
            if (saved) {
                setFormData((prev) => ({
                    ...prev,
                    name: saved.name || prev.name,
                    email: saved.email || prev.email,
                    phone: saved.phone || prev.phone,
                    gender: saved.gender || prev.gender,
                    dateOfBirth: saved.dateOfBirth ? saved.dateOfBirth.split('T')[0] : prev.dateOfBirth,
                    bloodGroup: saved.bloodGroup || saved.blood || prev.bloodGroup,
                    weight: saved.weight || prev.weight,
                    profilePhoto: saved.profilePhoto || prev.profilePhoto,
                }));
            }

            Swal.fire("Success", "Profile updated", "success");
            setIsEditing(false);
            try { localStorage.removeItem('newUserProfile'); } catch (e) { }
            // notify other pages that profile changed so they can refresh
            try { window.dispatchEvent(new CustomEvent('user-updated', { detail: saved })); } catch (e) { }
        } catch (e) {
            Swal.fire("Error", e?.message || "Unable to save profile", "error");
            // keep isEditing true so user's inputs aren't discarded — do not reload profile
            setSaving(false);
            return;
        }

        setSaving(false);
    };

    const handleResetPassword = async () => {
        try {
            await sendPasswordResetEmail(firebaseAuth, formData.email);
            Swal.fire("Email Sent", "Check your inbox", "success");
        } catch {
            Swal.fire("Error", "Failed to send reset email", "error");
        }
    };

    const initials = (t) => (t ? t.charAt(0).toUpperCase() : "U");

    if (loading)
        return (
            <Box
                sx={{
                    height: "100vh",
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    background: "black",
                }}
            >
                <CircularProgress sx={{ color: "#ff2b2b" }} />
            </Box>
        );

    const inputStyle = {
        InputProps: {
            sx: {
                color: "#fff !important",
                "& input::placeholder": { color: "#fff !important", opacity: 0.7 },
                // ensure disabled inputs remain readable
                '& input.Mui-disabled': { color: '#fff !important', WebkitTextFillColor: '#fff !important' },
            },
        },
        InputLabelProps: { sx: { color: "#fff", '&.Mui-disabled': { color: '#ddd' } } },
        sx: {
            '& .MuiOutlinedInput-root': {
                background: "rgba(255,255,255,0.04)",
                borderRadius: "10px",
                '& input.Mui-disabled': { color: '#fff !important', WebkitTextFillColor: '#fff !important' },
                '& .Mui-disabled': { color: '#fff !important' },
                '& fieldset': { borderColor: "rgba(255,255,255,0.3)" },
                '&:hover fieldset': { borderColor: "#ff2b2b" },
                '& .MuiSelect-select': { color: '#fff' },
                '& .MuiSelect-icon': { color: '#fff' },
            },
        },
    };

    return (
        <Box
            sx={{
                minHeight: "100vh",
                background: "linear-gradient(180deg,#0b0b0b,#151515)",
                color: "#fff",
                overflowX: "hidden",
                maxWidth: "100vw",
            }}
        >
            {/* NAVBAR */}
            <Box
                sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    px: { xs: 2, md: 6 },
                    py: 2,
                }}
            >
                <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                    <IconButton
                        sx={{ color: "#fff", display: { xs: "flex", md: "none" } }}
                        onClick={() => setOpenSidebar(true)}
                    >
                        <MenuIcon />
                    </IconButton>

                    <Typography
                        variant="h4"
                        sx={{
                            color: "#ff2b2b",
                            fontWeight: 800,
                            textShadow: "0 0 20px rgba(255,0,0,0.7)",
                        }}
                    >
                        Real-Hero
                    </Typography>
                </Box>

                <IconButton onClick={(e) => setAnchorEl(e.currentTarget)}>
                    <Avatar src={formData.profilePhoto}>
                        {!formData.profilePhoto && initials(formData.name)}
                    </Avatar>
                </IconButton>

                <Menu anchorEl={anchorEl} open={profileOpen} onClose={() => setAnchorEl(null)}>
                    <MenuItem onClick={() => navigate("/profile")}>
                        <AccountCircleIcon fontSize="small" sx={{ mr: 1 }} /> Profile
                    </MenuItem>
                    <MenuItem onClick={() => (window.location.href = "/login")}>
                        <LogoutIcon fontSize="small" sx={{ mr: 1 }} /> Logout
                    </MenuItem>
                </Menu>
            </Box>

            <Box sx={{ display: "flex", gap: 4, px: { xs: 2, md: 6 } }}>
                {!isMobile && (
                    <Box sx={{ width: 260 }}>
                        <Sidebar />
                    </Box>
                )}

                {isMobile && (
                    <Drawer open={openSidebar} onClose={() => setOpenSidebar(false)}>
                        <Sidebar />
                    </Drawer>
                )}

                <Box sx={{ flex: 1, pt: 3 }}>
                    <Typography variant="h4" sx={{ fontWeight: 800, color: "#ff2b2b", mb: 3 }}>
                        My Profile
                    </Typography>

                    <Box sx={{ display: "flex", gap: 4 }}>
                        {/* CARD */}
                        <Card
                            sx={{
                                flex: 1,
                                background: "rgba(255,255,255,0.05)",
                                borderRadius: 3,
                                backdropFilter: "blur(10px)",
                            }}
                        >
                            <CardContent sx={{ p: 4 }}>
                                {/* PHOTO */}
                                <Box sx={{ textAlign: "center", mb: 3 }}>
                                    <Avatar
                                        src={formData.profilePhoto}
                                        sx={{
                                            width: 120,
                                            height: 120,
                                            margin: "0 auto",
                                            bgcolor: "#ff2b2b",
                                            fontSize: "2.5rem",
                                        }}
                                    >
                                        {!formData.profilePhoto && initials(formData.name)}
                                    </Avatar>

                                    {isEditing && (
                                        <Box
                                            sx={{
                                                mt: 2,
                                                display: "flex",
                                                justifyContent: "center",
                                                gap: 2,
                                            }}
                                        >
                                            {/* CAMERA - real camera */}
                                            <input
                                                ref={cameraInputRef}
                                                type="file"
                                                accept="image/*"
                                                capture="environment"
                                                style={{ display: "none" }}
                                                onChange={handlePhotoUpload}
                                            />

                                            <Button
                                                variant="outlined"
                                                startIcon={<CameraAltIcon />}
                                                onClick={() => cameraInputRef.current.click()}
                                                sx={{
                                                    color: "#ff4c4c",
                                                    borderColor: "#ff4c4c",
                                                    minHeight: { xs: 48, md: 36 },
                                                    flex: { xs: 1, sm: 'initial' }
                                                }}
                                            >
                                                Camera
                                            </Button>

                                            {/* GALLERY */}
                                            <input
                                                ref={fileInputRef}
                                                type="file"
                                                accept="image/*"
                                                style={{ display: "none" }}
                                                onChange={handlePhotoUpload}
                                            />

                                            <Button
                                                variant="outlined"
                                                startIcon={<PhotoLibraryIcon />}
                                                onClick={() => fileInputRef.current.click()}
                                                sx={{
                                                    color: "#ff4c4c",
                                                    borderColor: "#ff4c4c",
                                                    minHeight: { xs: 48, md: 36 },
                                                    flex: { xs: 1, sm: 'initial' }
                                                }}
                                            >
                                                Gallery
                                            </Button>
                                        </Box>
                                    )}
                                    {/* help text for uploads */}
                                    <Typography variant="caption" sx={{ color: '#bbb', mt: 1 }}>
                                        Supported: jpg/png/webp — Max 2 MB. If your image is larger, reduce dimensions or select a compressed format.
                                    </Typography>
                                </Box>

                                <Divider sx={{ mb: 3 }} />

                                {/* INPUT FIELDS */}
                                <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>

                                    <TextField
                                        label="Full Name"
                                        name="name"
                                        value={formData.name}
                                        onChange={handleInput}
                                        disabled={!isEditing}
                                        InputProps={{
                                            startAdornment: (
                                                <InputAdornment position="start">
                                                    <PersonIcon sx={{ color: "#ff4c4c" }} />
                                                </InputAdornment>
                                            ),
                                            sx: inputStyle.InputProps.sx,
                                        }}
                                        InputLabelProps={inputStyle.InputLabelProps}
                                        sx={inputStyle.sx}
                                    />

                                    <TextField
                                        label="Email Address"
                                        name="email"
                                        value={formData.email}
                                        disabled
                                        InputProps={{
                                            startAdornment: (
                                                <InputAdornment position="start">
                                                    <EmailIcon sx={{ color: "#ff4c4c" }} />
                                                </InputAdornment>
                                            ),
                                            sx: inputStyle.InputProps.sx,
                                        }}
                                        InputLabelProps={inputStyle.InputLabelProps}
                                        sx={inputStyle.sx}
                                    />

                                    <TextField
                                        label="Phone Number"
                                        name="phone"
                                        value={formData.phone}
                                        onChange={handleInput}
                                        disabled={!isEditing}
                                        placeholder="+91 XXXXX XXXXX"
                                        InputProps={{
                                            startAdornment: (
                                                <InputAdornment position="start">
                                                    <PhoneIcon sx={{ color: "#ff4c4c" }} />
                                                </InputAdornment>
                                            ),
                                            sx: inputStyle.InputProps.sx,
                                        }}
                                        InputLabelProps={inputStyle.InputLabelProps}
                                        sx={inputStyle.sx}
                                    />

                                    <TextField
                                        select
                                        label="Gender"
                                        name="gender"
                                        value={formData.gender}
                                        onChange={handleInput}
                                        disabled={!isEditing}
                                        SelectProps={{ native: false, MenuProps: { PaperProps: { sx: { background: 'rgba(0,0,0,0.9)', color: '#fff' } } } }}
                                        InputProps={{
                                            startAdornment: (
                                                <InputAdornment position="start">
                                                    <WcIcon sx={{ color: "#ff4c4c" }} />
                                                </InputAdornment>
                                            ),
                                            sx: inputStyle.InputProps.sx,
                                        }}
                                        InputLabelProps={inputStyle.InputLabelProps}
                                        sx={inputStyle.sx}
                                    >
                                        <MenuItem value="" sx={{ color: '#fff' }}>Select Gender</MenuItem>
                                        <MenuItem value="Male" sx={{ color: '#fff' }}>Male</MenuItem>
                                        <MenuItem value="Female" sx={{ color: '#fff' }}>Female</MenuItem>
                                        <MenuItem value="Others" sx={{ color: '#fff' }}>Others</MenuItem>
                                    </TextField>

                                    <TextField
                                        label="Date of Birth"
                                        type="date"
                                        name="dateOfBirth"
                                        value={formData.dateOfBirth}
                                        onChange={handleInput}
                                        disabled={!isEditing}
                                        InputLabelProps={{
                                            shrink: true,
                                            sx: { color: "#bbb" },
                                        }}
                                        InputProps={{
                                            startAdornment: (
                                                <InputAdornment position="start">
                                                    <CakeIcon sx={{ color: "#ff4c4c" }} />
                                                </InputAdornment>
                                            ),
                                            sx: inputStyle.InputProps.sx,
                                        }}
                                        sx={inputStyle.sx}
                                    />

                                    <TextField
                                        label="Age"
                                        value={calculatedAge}
                                        disabled
                                        InputProps={{
                                            startAdornment: (
                                                <InputAdornment position="start">
                                                    <PersonIcon sx={{ color: "#ff4c4c" }} />
                                                </InputAdornment>
                                            ),
                                            sx: inputStyle.InputProps.sx,
                                        }}
                                        InputLabelProps={inputStyle.InputLabelProps}
                                        sx={inputStyle.sx}
                                    />

                                    <TextField
                                        select
                                        label="Blood Group"
                                        name="bloodGroup"
                                        value={formData.bloodGroup}
                                        onChange={handleInput}
                                        disabled={!isEditing}
                                        SelectProps={{ native: false, MenuProps: { PaperProps: { sx: { background: 'rgba(0,0,0,0.9)', color: '#fff' } } } }}
                                        InputProps={{
                                            startAdornment: (
                                                <InputAdornment position="start">
                                                    <FavoriteIcon sx={{ color: "#ff4c4c" }} />
                                                </InputAdornment>
                                            ),
                                            sx: inputStyle.InputProps.sx,
                                        }}
                                        InputLabelProps={inputStyle.InputLabelProps}
                                        sx={inputStyle.sx}
                                    >
                                        <MenuItem value="" sx={{ color: '#fff' }}>Select Blood Group</MenuItem>
                                        <MenuItem value="A+" sx={{ color: '#fff' }}>A+</MenuItem>
                                        <MenuItem value="A-" sx={{ color: '#fff' }}>A-</MenuItem>
                                        <MenuItem value="B+" sx={{ color: '#fff' }}>B+</MenuItem>
                                        <MenuItem value="B-" sx={{ color: '#fff' }}>B-</MenuItem>
                                        <MenuItem value="O+" sx={{ color: '#fff' }}>O+</MenuItem>
                                        <MenuItem value="O-" sx={{ color: '#fff' }}>O-</MenuItem>
                                        <MenuItem value="AB+" sx={{ color: '#fff' }}>AB+</MenuItem>
                                        <MenuItem value="AB-" sx={{ color: '#fff' }}>AB-</MenuItem>
                                    </TextField>

                                    <TextField
                                        label="Weight (kg)"
                                        type="number"
                                        name="weight"
                                        value={formData.weight}
                                        onChange={handleInput}
                                        disabled={!isEditing}
                                        placeholder="Minimum 50 kg"
                                        InputProps={{
                                            startAdornment: (
                                                <InputAdornment position="start">
                                                    <FitnessCenterIcon sx={{ color: "#ff4c4c" }} />
                                                </InputAdornment>
                                            ),
                                            sx: inputStyle.InputProps.sx,
                                        }}
                                        InputLabelProps={inputStyle.InputLabelProps}
                                        sx={inputStyle.sx}
                                    />
                                </Box>

                                <Divider sx={{ my: 3 }} />

                                {/* ACTION BTNS */}
                                <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
                                    {!isEditing ? (
                                        <Button
                                            variant="contained"
                                            startIcon={<EditIcon />}
                                            onClick={() => setIsEditing(true)}
                                            sx={{
                                                background: "linear-gradient(135deg,#ff2b2b,#b60000)",
                                                minHeight: 48,
                                                width: { xs: '100%', sm: 'auto' }
                                            }}
                                        >
                                            Edit Profile
                                        </Button>
                                    ) : (
                                        <>
                                            <Button
                                                variant="contained"
                                                startIcon={
                                                    saving ? (
                                                        <CircularProgress size={20} />
                                                    ) : (
                                                        <SaveIcon />
                                                    )
                                                }
                                                onClick={handleSave}
                                                disabled={saving}
                                                sx={{
                                                    background: "linear-gradient(135deg,#4caf50,#2e7d32)",
                                                    minHeight: 48,
                                                    width: { xs: '100%', sm: 'auto' }
                                                }}
                                            >
                                                {saving ? "Saving..." : "Save"}
                                            </Button>

                                            <Button
                                                variant="outlined"
                                                onClick={() => {
                                                    setIsEditing(false);
                                                    loadProfile();
                                                }}
                                                sx={{
                                                    minHeight: 48,
                                                    width: { xs: '100%', sm: 'auto' }
                                                }}
                                            >
                                                Cancel
                                            </Button>
                                        </>
                                    )}

                                    <Button
                                        variant="outlined"
                                        startIcon={<LockResetIcon />}
                                        onClick={handleResetPassword}
                                        sx={{
                                            color: "#ff4c4c",
                                            borderColor: "#ff4c4c",
                                            minHeight: 48,
                                            width: { xs: '100%', sm: 'auto' }
                                        }}
                                    >
                                        Reset Password
                                    </Button>
                                </Box>
                            </CardContent>
                        </Card>

                        {/* HERO IMAGE */}
                        {!isMobile && (
                            <Box
                                sx={{
                                    width: 420,
                                    display: "flex",
                                    justifyContent: "center",
                                }}
                            >
                                <img
                                    src={HERO_URL}
                                    alt="Hero"
                                    style={{ width: "100%", height: "auto" }}
                                />
                            </Box>
                        )}
                    </Box>
                </Box>
            </Box>
        </Box>
    );
}
