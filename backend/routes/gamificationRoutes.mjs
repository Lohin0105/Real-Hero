import express from "express";
import { getGamificationStatus } from "../controllers/gamificationController.mjs";
const router = express.Router();
router.get("/status", getGamificationStatus);
export default router;
