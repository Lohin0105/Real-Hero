// backend/routes/notificationsRoutes.mjs
import express from "express";
import { getNotificationsForUser } from "../controllers/notificationsController.mjs";

const router = express.Router();

router.get("/user", getNotificationsForUser);

export default router;
