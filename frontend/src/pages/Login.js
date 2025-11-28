import { useState } from "react";
import { auth } from "../firebase/firebaseConfig";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import Swal from "sweetalert2";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";

import {
  Box,
  Button,
  Card,
  CardContent,
  TextField,
  Typography,
  InputAdornment,
  useMediaQuery,
} from "@mui/material";

import EmailIcon from "@mui/icons-material/Email";
import LockIcon from "@mui/icons-material/Lock";

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Detect mobile screens
  const isMobile = useMediaQuery("(max-width: 768px)");

  const handleLogin = async (e) => {
    e.preventDefault();

    try {
      const userCred = await signInWithEmailAndPassword(auth, email, password);

      if (!userCred.user.emailVerified) {
        Swal.fire("Email Not Verified", "Please verify your email first.", "warning");
        await signOut(auth);
        return;
      }

      navigate("/dashboard");
    } catch (err) {
      Swal.fire("Login Failed", err.message, "error");
    }
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        width: "100%",
        background: "radial-gradient(circle, #0c0c0c, #1a1a1a, #0e0e0e)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        paddingTop: isMobile ? "20px" : "60px",
        paddingBottom: "40px",
      }}
    >
      {/* CENTERED REAL-HERO ABOVE LOGIN BOX */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        style={{
          textAlign: "center",
          marginBottom: isMobile ? "10px" : "30px",
        }}
      >
        <Typography
          variant={isMobile ? "h4" : "h3"}
          sx={{
            color: "#ff2b2b",
            fontWeight: "700",
            fontFamily: "Poppins, sans-serif",
            textShadow: "0px 0px 15px rgba(255,40,40,0.7)",
          }}
        >
          Real-Hero
        </Typography>
      </motion.div>

      {/* LOGIN CARD - CENTERED */}
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
            width: isMobile ? "90%" : 420,
            borderRadius: "18px",
            background: "rgba(255,255,255,0.06)",
            backdropFilter: "blur(16px)",
            boxShadow: "0 10px 40px rgba(0,0,0,0.6)",
          }}
        >
          <CardContent>
            <Typography
              variant="h4"
              sx={{ textAlign: "center", color: "#ff4c4c", fontWeight: 600, mb: 3 }}
            >
              Login
            </Typography>

            <form onSubmit={handleLogin}>
              {/* Email */}
              <TextField
                fullWidth
                label="Email"
                variant="outlined"
                sx={{
                  mb: 2,
                  "& .MuiOutlinedInput-root": {
                    borderRadius: "10px",
                    background: "#ffffff15",
                    input: { color: "#fff" },
                  },
                  "& label": { color: "#bbb" },
                }}
                onChange={(e) => setEmail(e.target.value)}
                required
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <EmailIcon sx={{ color: "#ff4c4c" }} />
                    </InputAdornment>
                  ),
                }}
              />

              {/* Password */}
              <TextField
                fullWidth
                label="Password"
                type="password"
                variant="outlined"
                sx={{
                  mb: 3,
                  "& .MuiOutlinedInput-root": {
                    borderRadius: "10px",
                    background: "#ffffff15",
                    input: { color: "#fff" },
                  },
                  "& label": { color: "#bbb" },
                }}
                onChange={(e) => setPassword(e.target.value)}
                required
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <LockIcon sx={{ color: "#ff4c4c" }} />
                    </InputAdornment>
                  ),
                }}
              />

              {/* LOGIN BUTTON */}
              <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}>
                <Button
                  fullWidth
                  type="submit"
                  sx={{
                    py: 1.5,
                    borderRadius: "10px",
                    background: "linear-gradient(135deg, #ff2b2b, #b60000)",
                    color: "white",
                    fontWeight: "700",
                    letterSpacing: "1px",
                    boxShadow: "0 4px 15px rgba(255,0,0,0.45)",
                    "&:hover": {
                      background: "linear-gradient(135deg, #ff4040, #8b0000)",
                    },
                  }}
                >
                  LOGIN
                </Button>
              </motion.div>
            </form>

            {/* LINKS */}
            <Box
              sx={{
                display: "flex",
                justifyContent: "space-between",
                mt: 2,
                fontSize: "14px",
              }}
            >
              <Link to="/register" style={{ color: "#ff5656" }}>
                Create Account
              </Link>
              <Link to="/forgot" style={{ color: "#ff5656" }}>Forgot Password?</Link>
            </Box>
          </CardContent>
        </Card>
      </motion.div>
    </Box>
  );
}
