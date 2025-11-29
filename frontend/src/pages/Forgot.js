import { useState } from "react";
import { auth } from "../firebase/firebaseConfig";
import { sendPasswordResetEmail } from "firebase/auth";
import Swal from "sweetalert2";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

import {
  Box,
  Button,
  Card,
  CardContent,
  TextField,
  Typography,
  InputAdornment,
} from "@mui/material";

import EmailIcon from "@mui/icons-material/Email";

export default function Forgot() {
  const [email, setEmail] = useState("");
  const navigate = useNavigate();

  const handleReset = async (e) => {
    e.preventDefault();

    try {
      await sendPasswordResetEmail(auth, email);

      Swal.fire({
        title: "Password Reset Email Sent",
        text: "Password reset link has been sent to your mail ID.",
        icon: "success",
        confirmButtonColor: "#ff2b2b",
        background: "#1a1a1a",
        color: "#fff",
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

      {/* FORGOT PASSWORD CARD - CENTERED */}
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
            background: "rgba(255,255,255,0.08)",
            backdropFilter: "blur(16px)",
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
              Forgot Password
            </Typography>

            <form onSubmit={handleReset}>
              {/* EMAIL */}
              <TextField
                fullWidth
                label="Enter Your Email"
                required
                onChange={(e) => setEmail(e.target.value)}
                sx={{
                  mb: 3,
                  "& label": { color: "#ddd" },          // WHITE LABEL
                  "& .MuiOutlinedInput-root": {
                    borderRadius: "10px",
                    background: "#ffffff15",
                    input: { color: "#fff" },            // WHITE TEXT
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
                }}
              >
                Send Password Reset Link
              </Button>
            </form>

            {/* LINK */}
            <Box sx={{ textAlign: "center", mt: 2 }}>
              <Link to="/login" style={{ color: "#ff5656" }}>
                Back to Login
              </Link>
            </Box>
          </CardContent>
        </Card>
      </motion.div>
    </Box>
  );
}
