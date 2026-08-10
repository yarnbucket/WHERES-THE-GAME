// Resolve route placeholder for Where's the Game
import express from "express";
import { resolveGamePlaceholder } from "../logic/resolver.js";

const router = express.Router();

// GET /resolve
router.get("/", (req, res) => {
    const result = resolveGamePlaceholder();
    res.json({
        status: "ok",
        message: "Resolve route ready",
        resolver: result
    });
});

export default router;
