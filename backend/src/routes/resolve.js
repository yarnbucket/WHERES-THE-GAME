// Game resolver route for Where's the Game
import express from "express";
import { resolveGame } from "../logic/resolver.js";

const router = express.Router();

const SPORTS = {
  nfl: { sport: "football", league: "nfl", label: "NFL" },
  ncaaf: { sport: "football", league: "college-football", label: "NCAA Football" },
  mlb: { sport: "baseball", league: "mlb", label: "MLB" },
  nhl: { sport: "hockey", league: "nhl", label: "NHL" },
  nba: { sport: "basketball", league: "nba", label: "NBA" },
  ncaab: {
    sport: "basketball",
    league: "mens-college-basketball",
    label: "NCAA Basketball"
  }
};

function yyyymmdd(date = new Date()) {
  return date.toISOString().slice(0, 10).replaceAll("-", "");
}

async function fetchGames(sportKey, date) {
  const config = SPORTS[sportKey];

  const url =
    `https://site.api.espn.com/apis/site/v2/sports/` +
    `${config.sport}/${config.league}/scoreboard?dates=${date}`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Sports request failed: ${response.status}`);
  }

  const data = await response.json();

  return (data.events ?? []).map((event) => {
    const competition = event.competitions?.[0] ?? {};
    const competitors = competition.competitors ?? [];

    const home = competitors.find((team) => team.homeAway === "home");
    const away = competitors.find((team) => team.homeAway === "away");

    const networks = (competition.broadcasts ?? [])
      .flatMap((broadcast) => broadcast.names ?? []);

    return {
      id: event.id,
      sport: config.label,
      name: event.name,
      away: away?.team?.displayName ?? null,
      home: home?.team?.displayName ?? null,
      startTime: event.date ?? null,
      status: event.status?.type?.description ?? null,
      network: [...new Set(networks)].join(", ") || null,
      venue: competition.venue?.fullName ?? null
    };
  });
}

// GET /resolve?sport=mlb
router.get("/", async (req, res) => {
  try {
    const sport = String(req.query.sport ?? "mlb").toLowerCase();
    const date = /^\d{8}$/.test(req.query.date ?? "")
      ? req.query.date
      : yyyymmdd();

    if (!SPORTS[sport]) {
      return res.status(400).json({
        status: "error",
        message: `Unknown sport '${sport}'`,
        supportedSports: Object.keys(SPORTS)
      });
    }

    const games = await fetchGames(sport, date);
    const resolvedGames = games.map(resolveGame);

    res.json({
      status: "ok",
      date,
      sport: SPORTS[sport].label,
      count: resolvedGames.length,
      games: resolvedGames
    });
  } catch (error) {
    console.error("/resolve error:", error);

    res.status(500).json({
      status: "error",
      message: "Failed to resolve games"
    });
  }
});

export default router;
