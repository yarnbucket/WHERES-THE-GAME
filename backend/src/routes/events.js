// Events route placeholder for Where's the Game
import express from "express";
const router = express.Router();

// GET /events
router.get("/", (req, res) => {
    res.json({
        status: "ok",
        message: "Events route ready"
    });
});

export default router;
