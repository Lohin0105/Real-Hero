// backend/routes/donorsRoutes.mjs
import express from "express";
import { updateAvailability, getNearbyDonors } from "../controllers/donorsController.mjs";

const router = express.Router();

router.post("/availability", updateAvailability);
router.get("/nearby", getNearbyDonors);

export default router;
