// backend/routes/notifyRoutes.mjs
import express from "express";
import { shareAvailability, createOffer, respondOffer, getNotifications, markNotificationsRead, followUpRespond } from "../controllers/notifyController.mjs";

const router = express.Router();

router.post("/share-availability", shareAvailability);
router.post("/offer", createOffer);
router.get("/offer/respond", respondOffer);
router.get("/offer/followup/respond", followUpRespond); // NEW follow-up respond route
router.get("/notifications", getNotifications);
router.post("/notifications/mark-read", markNotificationsRead);

export default router;
