// backend/routes/requestRoutes.mjs
import express from "express";
import {
    createRequest,
    getRecentRequests,
    geocodeMissingRequests,
    claimRequest,
    registerInterest,
    confirmInterest,
    verifyArrival,
    completeDonation,
    cancelDonation,
    getMyRequests,
    getMyDonations,
    closeRequest,
    verifyDonation
} from "../controllers/requestController.mjs";

const router = express.Router();

router.post("/create", createRequest);
router.get("/recent", getRecentRequests);
router.post("/geocode-missing", geocodeMissingRequests);

// Claim System Routes
router.post("/claim/:id", claimRequest);
router.post("/interest/:id", registerInterest);
router.get("/confirm-interest/:id", confirmInterest);
router.post("/verify-arrival/:id", verifyArrival);
router.post("/complete/:id", completeDonation);
router.post("/cancel/:id", cancelDonation);
router.post("/close/:id", closeRequest);
router.get("/verify-donation/:id", verifyDonation);
router.get("/my-requests", getMyRequests);
router.get("/my-donations", getMyDonations);

export default router;
