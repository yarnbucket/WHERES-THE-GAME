// Main Express server for Where's the Game
import express from "express";
import path from "path";
import { fileURLToPath } from "url";

// Import routes
import eventsRoute from "./routes/events.js";
import channelsRoute from "./routes/channels.js";
import streamingRoute from "./routes/streaming.js";
import blackoutRoute from "./routes/blackout.js";
import otherFootballRoute from "./routes/otherFootball.js";
import tennisRoute from "./routes/tennis.js";
import soccerRoute from "./routes/soccer.js";
import collegeSoccerRoute from "./routes/collegeSoccer.js";
import mmaRoute from "./routes/mma.js";
import boxingRoute from "./routes/boxing.js";
import resolveRoute from "./routes/resolve.js";

const app = express();

const PORT = process.env.PORT || 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const frontendPath = path.resolve(
  __dirname,
  "../../frontend"
);

// --------------------------------------------------
// CORS
// --------------------------------------------------

app.use((req, res, next) => {
  res.header(
    "Access-Control-Allow-Origin",
    "https://yarnbucket.github.io"
  );

  res.header(
    "Access-Control-Allow-Methods",
    "GET,OPTIONS"
  );

  res.header(
    "Access-Control-Allow-Headers",
    "Content-Type"
  );

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  next();
});

// Middleware
app.use(express.json());
app.use(express.static(frontendPath));

// Routes
app.use("/events", eventsRoute);
app.use("/channels", channelsRoute);
app.use("/streaming", streamingRoute);
app.use("/blackout", blackoutRoute);

// Specialized resolvers intercept their sport and pass unrelated requests through.
app.use("/resolve", otherFootballRoute);
app.use("/resolve", tennisRoute);
app.use("/resolve", soccerRoute);
app.use("/resolve", collegeSoccerRoute);
app.use("/resolve", mmaRoute);
app.use("/resolve", boxingRoute);
app.use("/resolve", resolveRoute);

// Root endpoint
app.get("/", (req, res) => {
  res.sendFile(
    path.join(frontendPath, "index.html")
  );
});

app.get("*", (req, res) => {
  res.sendFile(
    path.join(frontendPath, "index.html")
  );
});

// Start server
app.listen(PORT, () => {
  console.log(
    `Server running on port ${PORT}`
  );
});
