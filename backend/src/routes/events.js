// Live events route for Where's the Game
import express from "express";

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

function normalizeEvent(event, leagueLabel) {
  const competition = event.competitions?.[0] ?? {};
  const competitors = competition.competitors ?? [];

  const home = competitors.find((team) => team.homeAway === "home");
  const away = competitors.find((team) => team.homeAway === "away");

  const networks = (competition.broadcasts ?? []).flatMap(
    (broadcast) => broadcast.names ?? []
  );

  return {
    id: event.id,
    sport: leagueLabel,
    name: event.name,
    away: away?.team?.displayName ?? null,
    home: home?.team?.displayName ?? null,
    startTime: event.date ?? null,
    status: event.status?.type?.description ?? null,
    network: [...new Set(networks)].join(", ") || null,
    venue: competition.venue?.fullName ?? null
  };
}

async function fetchLeagueEvents(key, date) {
  const config = SPORTS[key];

  const url =
    `https://site.api.espn.com/apis/site/v2/sports/` +
    `${config.sport}/${config.league}/scoreboard?dates=${date}`;

  const response = await fetch(url, {
    headers: {
      Accept: "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(
      `${config.label} schedule request failed with ${response.status}`
    );
  }

  const data = await response.json();

  return (data.events ?? []).map((event) =>
    normalizeEvent(event, config.label)
  );
}

// GET /events
// Examples:
// /events
// /events?sport=nfl
// /events?date=20260906
// /events?sport=mlb&date=20260906
router.get("/", async (req, res) => {
  try {
    const date = /^\d{8}$/.test(req.query.date ?? "")
      ? req.query.date
      : yyyymmdd();

    const sport = String(req.query.sport ?? "").toLowerCase();

    if (sport && !SPORTS[sport]) {
      return res.status(400).json({
        status: "error",
        message: `Unknown sport '${sport}'`,
        supportedSports: Object.keys(SPORTS)
      });
    }

    const keys = sport ? [sport] : Object.keys(SPORTS);

    const results = await Promise.allSettled(
      keys.map((key) => fetchLeagueEvents(key, date))
    );

    const events = [];
    const errors = [];

    results.forEach((result, index) => {
      if (result.status === "fulfilled") {
        events.push(...result.value);
      } else {
        errors.push({
          sport: SPORTS[keys[index]].label,
          message:
            result.reason?.message ?? "Schedule request failed"
        });
      }
    });

    events.sort(
      (a, b) => new Date(a.startTime) - new Date(b.startTime)
    );

    res.json({
      status: errors.length === keys.length ? "error" : "ok",
      date,
      count: events.length,
      events,
      errors
    });
  } catch (error) {
    console.error("/events error:", error);

    res.status(500).json({
      status: "error",
      message: "Failed to load sports events"
    });
  }
});

export default router;
