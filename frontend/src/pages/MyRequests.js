import React from "react";
import { Box, Typography } from "@mui/material";

export default function MyRequests() {
  return (
    <Box sx={{ minHeight: "100vh", background: "linear-gradient(180deg,#0b0b0b 0%,#151515 100%)", color: "#fff", p: 4 }}>
      <Typography variant="h4" sx={{ color: "#ff2b2b", fontWeight: 800, mb: 2 }}>
        My Requests
      </Typography>
      <Typography sx={{ color: "#bbb" }}>This page will show requests you created and their status. (Placeholder)</Typography>
    </Box>
  );
}
