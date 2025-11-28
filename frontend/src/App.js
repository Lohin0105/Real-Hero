import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useEffect, useState } from 'react';
import { auth as firebaseAuth } from './firebase/firebaseConfig';
import { CircularProgress, Box } from '@mui/material';
import Splash from "./pages/Splash";
import Register from "./pages/Register";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Forgot from "./pages/Forgot";
import Donate from "./pages/Donate";
import Request from "./pages/Request";
import MapPage from "./pages/MapPage";
import MyRequests from "./pages/MyRequests";
import RequestedDonations from "./pages/RequestedDonations";
import Donations from "./pages/Donations";
import Gamification from "./pages/Gamification";
import Rewards from "./pages/Rewards";
import Leaderboard from "./pages/Leaderboard";
import Profile from "./pages/Profile";

function App() {
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    // Firebase sets auth state asynchronously; wait for first event so pages relying on firebaseAuth.currentUser won't race
    let unsub = () => { };
    if (firebaseAuth) {
      unsub = firebaseAuth.onAuthStateChanged((u) => {
        setAuthReady(true);
        // broadcast auth changes so pages can refresh their user state
        try { window.dispatchEvent(new CustomEvent('auth-changed', { detail: u })); } catch (e) { }
      });
    } else {
      // if firebase not initialized, just render
      setAuthReady(true);
    }
    return () => {
      try { unsub(); } catch (e) { }
    };
  }, []);
  if (!authReady) {
    return (
      <Box sx={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000' }}>
        <CircularProgress sx={{ color: '#ff2b2b' }} />
      </Box>
    );
  }

  return (
    <BrowserRouter>
      <Routes>

        {/* Default route → Splash screen, then auto-redirects to login */}
        <Route path="/" element={<Splash />} />

        {/* Auth pages */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot" element={<Forgot />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/donate" element={<Donate />} />
        <Route path="/request" element={<Request />} />
        <Route path="/map" element={<MapPage />} />
        {/* MediBot removed - page deleted */}
        <Route path="/my-requests" element={<MyRequests />} />
        <Route path="/requested-donations" element={<RequestedDonations />} />
        <Route path="/donations" element={<Donations />} />
        <Route path="/gamification" element={<Gamification />} />
        <Route path="/rewards" element={<Rewards />} />
        <Route path="/leaderboard" element={<Leaderboard />} />
        <Route path="/profile" element={<Profile />} />

      </Routes>
    </BrowserRouter>
  );
}

export default App;
