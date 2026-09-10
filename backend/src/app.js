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
import volleyballRoute from "./routes/volleyball.js";
import collegeSoftballRoute from "./routes/collegeSoftball.js";
import collegeVolleyballRoute from "./routes/collegeVolleyball.js";
import rugbyRoute from "./routes/rugby.js";
import resolveRoute from "./routes/resolve.js";

const app = express();

const PORT = process.env.PORT || 3000;
const LIVE_FRONTEND = "https://yarnbucket.github.io/WHERES-THE-GAME/";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Keep the old bundled frontend available only for debugging. The public app
// has one source of truth: GitHub Pages at LIVE_FRONTEND. This prevents Render
// from silently serving an older UI than the one we are actually building.
const legacyFrontendPath = path.resolve(__dirname, "../../frontend");

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
app.use("/legacy-ui", express.static(legacyFrontendPath));

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
app.use("/resolve", volleyballRoute);
app.use("/resolve", collegeSoftballRoute);
app.use("/resolve", collegeVolleyballRoute);
app.use("/resolve", rugbyRoute);
app.use("/resolve", resolveRoute);

// Render is the API host, not a second production frontend. Always send anyone
// opening the Render URL to the same GitHub Pages UI used for normal testing.
app.get("/", (req, res) => {
  res.redirect(302, LIVE_FRONTEND);
});

app.get("*", (req, res) => {
  if (req.path.startsWith("/resolve") || req.path.startsWith("/events") || req.path.startsWith("/channels") || req.path.startsWith("/streaming") || req.path.startsWith("/blackout")) {
    return res.status(404).json({ status: "error", message: "API route not found" });
  }
  return res.redirect(302, LIVE_FRONTEND);
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);

  // Deployment gate: exercise the real HTTP route inside the live Render
  // process before asking the user to inspect Rugby in the frontend.
  setTimeout(async () => {
    try {
      const url = `http://127.0.0.1:${PORT}/resolve?sport=rugby&date=20260912&provider=directv`;
      const response = await fetch(url, { headers: { "user-agent": "WTG-live-smoke/1.0" } });
      const data = await response.json();
      const japanUsa = (data?.games ?? []).find((game) => game?.id === "wtg-rugby-pnc-japan-usa-20260912");
      const paramount = (japanUsa?.streaming ?? []).some((source) => source?.service === "Paramount+");
      console.info(`RUGBY_LIVE_SMOKE http=${response.status} count=${data?.count ?? -1} japanUSA=${Boolean(japanUsa)} paramount=${paramount}`);
    } catch (error) {
      console.error("RUGBY_LIVE_SMOKE failed:", error);
    }
  }, 1200);
});
