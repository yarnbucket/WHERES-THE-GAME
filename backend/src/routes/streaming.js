// Streaming route placeholder for Where's the Game
import express from "express";
const router = express.Router();

// GET /streaming
router.get("/", (req, res) => {
    res.json({
        status: "ok",
        message: "Streaming route ready"
    });
});

export default router;
