// Main Express server for Where's the Game
import express from "express";

// Import routes
import eventsRoute from "./routes/events.js";
import channelsRoute from "./routes/channels.js";
import streamingRoute from "./routes/streaming.js";
import blackoutRoute from "./routes/blackout.js";
import resolveRoute from "./routes/resolve.js";

const app = express();
const PORT = 3000;

// Middleware
app.use(express.json());

// Route mounting
app.use("/events", eventsRoute);
app.use("/channels", channelsRoute);
app.use("/streaming", streamingRoute);
app.use("/blackout", blackoutRoute);
app.use("/resolve", resolveRoute);

// Root endpoint
app.get("/", (req, res) => {
    res.json({
        status: "ok",
        message: "Where's the Game backend is running"
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
