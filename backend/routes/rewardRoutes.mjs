// backend/routes/rewardRoutes.mjs
import express from "express";
import { getLeaderboard, getMyRewards } from "../controllers/rewardController.mjs";

const router = express.Router();

router.get("/leaderboard", getLeaderboard);
router.get("/my-rewards", getMyRewards);

export default router;
