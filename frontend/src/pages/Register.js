import { useState } from "react";
import { auth } from "../firebase/firebaseConfig";
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  updateProfile,
} from "firebase/auth";
import Swal from "sweetalert2";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

import {
  Box,
  Card,
  CardContent,
  TextField,
  Typography,
  Button,
  InputAdornment,
} from "@mui/material";

import PersonIcon from "@mui/icons-material/Person";
import EmailIcon from "@mui/icons-material/Email";
import LockIcon from "@mui/icons-material/Lock";

export default function Register() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
  });

  const update = (e) =>
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });

  const handleRegister = async (e) => {
    e.preventDefault();

    try {
      const userCred = await createUserWithEmailAndPassword(
        auth,
        form.email,
        form.password
      );

      await sendEmailVerification(userCred.user);

      // Ensure Firebase user has a displayName so fallback UI shows the registered name
      try {
        if (userCred.user && userCred.user.displayName !== form.name) {
          await updateProfile(userCred.user, { displayName: form.name }).catch(() => null);
        }
      } catch (e) {
        console.warn("Failed to update Firebase displayName:", e?.message || e);
      }

      // Create a corresponding user record in backend (MongoDB) so the app can store profile details
      try {
        // compute apiBase similar to other pages so LAN devices call the correct backend
        let apiBase = process.env.REACT_APP_API_BASE || "http://localhost:5000";
        try {
          if (typeof window !== "undefined") {
            const host = window.location.hostname;
            if (host && !/(^localhost$|^127\.0\.0\.1$)/.test(host) && /localhost|127\.0\.0\.1/.test(apiBase)) {
              apiBase = apiBase.replace(/localhost|127\.0\.0\.1/, host);
            }
          }
        } catch (e) {
          // ignore
        }
        const payload = {
          name: form.name,
          email: form.email,
        };

        // Send ID token in Authorization header so server can verify token and create/associate user
        // Get ID token reliably; sometimes Firebase needs a moment to initialize the currentUser
        let idToken = null;
        const getTokenWithRetry = async (userObj, attempts = 5, delayMs = 300) => {
          for (let i = 0; i < attempts; i++) {
            try {
              if (userObj) {
                const t = await userObj.getIdToken(false);
                if (t) return t;
              }
            } catch (e) {
              // try again after a short wait
            }
            await new Promise((r) => setTimeout(r, delayMs));
            // refresh userObj from auth if available
            try {
              // eslint-disable-next-line no-undef
              if (auth && auth.currentUser) userObj = auth.currentUser;
            } catch (e) {
              // ignore
            }
          }
          return null;
        };

        try {
          idToken = await getTokenWithRetry(userCred.user);
          // if still null, try to use exported auth currentUser
          if (!idToken && auth && auth.currentUser) {
            idToken = await getTokenWithRetry(auth.currentUser);
          }
        } catch (e) {
          console.warn("Failed to get ID token after signup:", e);
        }

        const headers = { "Content-Type": "application/json" };
        if (idToken) headers.Authorization = `Bearer ${idToken}`;

        // Call backend to create or update the user record using verified token
        const r = await fetch(`${apiBase}/api/user`, {
          method: "POST",
          headers,
          credentials: "include",
          body: JSON.stringify(payload),
        });
        if (!r.ok) {
          const txt = await r.text().catch(() => "");
          console.warn("Failed to create backend user record:", r.status, txt);
          // show user-visible error so they know backend record wasn't created
          Swal.fire({ title: "Profile not saved", text: `Failed to create backend profile (${r.status}): ${txt}`, icon: "warning", confirmButtonColor: "#ff2b2b" });
        } else {
          // success - optionally you can read created user
          const created = await r.json().catch(() => null);
          console.debug("Backend user created:", created);
          try {
            // persist a short-lived copy so the next page can pick up profile fields (e.g. blood)
            if (created) {
              localStorage.setItem("newUserProfile", JSON.stringify(created));
            } else {
              // fallback to storing submitted payload
              localStorage.setItem("newUserProfile", JSON.stringify(payload));
            }
          } catch (e) {
            // ignore storage errors
          }
        }
      } catch (err) {
        console.warn("Error creating backend user record:", err);
      }

      Swal.fire({
        title: "Verification Link Sent!",
        text: "Please check your inbox to verify your account.",
        icon: "success",
        confirmButtonColor: "#ff2b2b",
      }).then(() => navigate("/login"));
    } catch (err) {
      Swal.fire("Error", err.message, "error");
    }
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        background: "radial-gradient(circle, #0c0c0c, #1a1a1a)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        paddingTop: "40px",
      }}
    >
      {/* TITLE */}
      <Typography
        variant="h3"
        sx={{
          color: "#ff2b2b",
          fontWeight: 700,
          textShadow: "0px 0px 18px rgba(255,40,40,0.9)",
          marginBottom: "20px",
        }}
      >
        Real-Hero
      </Typography>

      {/* REGISTRATION CARD - CENTERED */}
      <motion.div
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6 }}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
        }}
      >
        <Card
          sx={{
            width: 420,
            borderRadius: "18px",
            background: "rgba(255,255,255,0.07)",
            backdropFilter: "blur(15px)",
            padding: "10px",
            boxShadow: "0 10px 40px rgba(0,0,0,0.6)",
          }}
        >
          <CardContent>
            <Typography
              variant="h4"
              sx={{
                textAlign: "center",
                color: "#ff4c4c",
                fontWeight: 600,
                mb: 3,
              }}
            >
              Register
            </Typography>

            <form onSubmit={handleRegister}>
              {/* FULL NAME */}
              <TextField
                fullWidth
                name="name"
                label="Full Name"
                required
                onChange={update}
                sx={{
                  mb: 2,
                  "& label": { color: "#ddd" },
                  "& .MuiOutlinedInput-root": {
                    borderRadius: "10px",
                    background: "#ffffff15",
                    input: { color: "#fff" },
                  },
                }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <PersonIcon sx={{ color: "#ff4c4c" }} />
                    </InputAdornment>
                  ),
                }}
              />

              {/* EMAIL */}
              <TextField
                fullWidth
                name="email"
                label="Email"
                required
                onChange={update}
                sx={{
                  mb: 2,
                  "& label": { color: "#ddd" },
                  "& .MuiOutlinedInput-root": {
                    borderRadius: "10px",
                    background: "#ffffff15",
                    input: { color: "#fff" },
                  },
                }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <EmailIcon sx={{ color: "#ff4c4c" }} />
                    </InputAdornment>
                  ),
                }}
              />



              {/* PASSWORD */}
              <TextField
                fullWidth
                name="password"
                label="Password"
                type="password"
                required
                onChange={update}
                sx={{
                  mb: 3,
                  "& label": { color: "#ddd" },
                  "& .MuiOutlinedInput-root": {
                    borderRadius: "10px",
                    background: "#ffffff15",
                    input: { color: "#fff" },
                  },
                }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <LockIcon sx={{ color: "#ff4c4c" }} />
                    </InputAdornment>
                  ),
                }}
              />

              {/* BUTTON */}
              <Button
                fullWidth
                type="submit"
                sx={{
                  py: 1.4,
                  borderRadius: "10px",
                  background: "linear-gradient(135deg, #ff2b2b, #b60000)",
                  color: "white",
                  fontWeight: "700",
                  "&:hover": {
                    background: "linear-gradient(135deg, #ff4040, #8b0000)",
                  },
                }}
              >
                Create Account
              </Button>
            </form>

            <Box sx={{ textAlign: "center", mt: 2 }}>
              <Link to="/login" style={{ color: "#ff5656" }}>
                Already have an account? Login
              </Link>
            </Box>
          </CardContent>
        </Card>
      </motion.div>
    </Box>
  );
}
