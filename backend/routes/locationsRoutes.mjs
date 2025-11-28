import express from "express";
import { getHeatmapPoints } from "../controllers/locationsController.mjs";
const router = express.Router();
router.get("/heatmap", getHeatmapPoints);
export default router;
