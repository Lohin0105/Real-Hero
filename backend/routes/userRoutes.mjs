// backend/routes/userRoutes.mjs
import express from "express";
import {
  saveUser,
  getUserByQuery,
  getCurrentUser,
  updateAvailability,
  updateLocation,
} from "../controllers/userController.mjs";
import { getLeaderboard } from "../controllers/userController.mjs";

const router = express.Router();

router.post("/", saveUser);
router.get("/", getUserByQuery);
router.get("/me", getCurrentUser);
router.post("/availability", updateAvailability);
router.post("/location", updateLocation);
router.get("/leaderboard", getLeaderboard);

export default router;
