// Channels route placeholder for Where's the Game
import express from "express";
const router = express.Router();

// GET /channels
router.get("/", (req, res) => {
    res.json({
        status: "ok",
        message: "Channels route ready"
    });
});

export default router;
