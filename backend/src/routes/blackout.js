// Blackout rules route placeholder for Where's the Game
import express from "express";
const router = express.Router();

// GET /blackout
router.get("/", (req, res) => {
    res.json({
        status: "ok",
        message: "Blackout route ready"
    });
});

export default router;
