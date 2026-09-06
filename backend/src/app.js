// Main Express server for Where's the Game
import express from "express";
import path from "path";
import { fileURLToPath } from "url";

// Import routes
import eventsRoute from "./routes/events.js";
import channelsRoute from "./routes/channels.js";
import streamingRoute from "./routes/streaming.js";
import blackoutRoute from "./routes/blackout.js";
import resolveRoute from "./routes/resolve.js";

const app = express();
const PORT = 3000;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendPath = path.resolve(__dirname, "../../frontend");
// Middleware
app.use(express.json());
app.use(express.static(frontendPath));
// Route mounting
app.use("/events", eventsRoute);
app.use("/channels", channelsRoute);
app.use("/streaming", streamingRoute);
app.use("/blackout", blackoutRoute);
app.use("/resolve", resolveRoute);

// Root endpoint
app.get("/", (req, res) => {
    res.sendFile(path.join(frontendPath, "index.html"));
});
app.get("*", (req, res) => {
  res.sendFile(path.join(frontendPath, "index.html"));
});
// Start server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
