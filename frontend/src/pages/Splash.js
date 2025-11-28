import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Box, Typography } from "@mui/material";

export default function Splash() {
    const navigate = useNavigate();

    useEffect(() => {
        // Auto redirect to login after 3 seconds
        const timer = setTimeout(() => {
            navigate("/login");
        }, 3000);

        return () => clearTimeout(timer);
    }, [navigate]);

    return (
        <Box
            sx={{
                minHeight: "100vh",
                width: "100%",
                background: "#000000",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
            }}
        >
            {/* APP NAME - Above Image */}
            <motion.div
                initial={{ opacity: 0, y: -50 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 1, delay: 0.2 }}
            >
                <Typography
                    variant="h1"
                    sx={{
                        color: "#ff2b2b",
                        fontWeight: "800",
                        fontFamily: "'Poppins', sans-serif",
                        fontSize: { xs: "3rem", sm: "4rem", md: "5rem" },
                        textAlign: "center",
                        letterSpacing: "2px",
                        textShadow: "0px 0px 30px rgba(255, 43, 43, 0.9), 0px 0px 60px rgba(255, 43, 43, 0.6)",
                        marginBottom: "40px",
                    }}
                >
                    Real-Hero
                </Typography>
            </motion.div>

            {/* HERO IMAGE - Center */}
            <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 1.2, delay: 0.5 }}
            >
                <motion.img
                    src="https://ik.imagekit.io/Lohin/hero.png"
                    alt="Real-Hero"
                    style={{
                        width: "300px",
                        maxWidth: "90vw",
                        filter: "drop-shadow(0px 0px 40px rgba(255, 43, 43, 0.8))",
                    }}
                    animate={{
                        y: [0, -10, 0],
                    }}
                    transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: "easeInOut",
                    }}
                />
            </motion.div>

            {/* QUOTE - Below Image */}
            <motion.div
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 1, delay: 0.8 }}
            >
                <Typography
                    variant="h4"
                    sx={{
                        color: "#ffffff",
                        fontWeight: "600",
                        fontFamily: "'Poppins', sans-serif",
                        fontSize: { xs: "1.5rem", sm: "2rem", md: "2.5rem" },
                        textAlign: "center",
                        marginTop: "50px",
                        letterSpacing: "3px",
                        textShadow: "0px 0px 20px rgba(255, 255, 255, 0.5)",
                    }}
                >
                    💉 Donate. Save. Repeat. ❤️
                </Typography>

                {/* Subtitle with pulsing animation */}
                <motion.div
                    animate={{
                        opacity: [0.6, 1, 0.6],
                    }}
                    transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: "easeInOut",
                    }}
                >
                    <Typography
                        variant="subtitle1"
                        sx={{
                            color: "#ff6b6b",
                            fontWeight: "500",
                            fontFamily: "'Poppins', sans-serif",
                            fontSize: { xs: "0.9rem", sm: "1.1rem" },
                            textAlign: "center",
                            marginTop: "15px",
                            letterSpacing: "2px",
                        }}
                    >
                        Be a Hero. Save Lives. 🩸
                    </Typography>
                </motion.div>
            </motion.div>

            {/* Loading indicator dots */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.5 }}
                style={{
                    position: "absolute",
                    bottom: "50px",
                    display: "flex",
                    gap: "10px",
                }}
            >
                {[0, 1, 2].map((i) => (
                    <motion.div
                        key={i}
                        animate={{
                            scale: [1, 1.5, 1],
                            opacity: [0.5, 1, 0.5],
                        }}
                        transition={{
                            duration: 1.5,
                            repeat: Infinity,
                            delay: i * 0.2,
                        }}
                        style={{
                            width: "12px",
                            height: "12px",
                            borderRadius: "50%",
                            backgroundColor: "#ff2b2b",
                            boxShadow: "0px 0px 10px rgba(255, 43, 43, 0.8)",
                        }}
                    />
                ))}
            </motion.div>
        </Box>
    );
}
