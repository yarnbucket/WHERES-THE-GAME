import express from "express";

import { resolveGame } from "../logic/resolver.js";
import { lookupDirectvGame } from "../logic/directvGuide.js";

const router = express.Router();

const SPORTS = {
  nfl: {
    sport: "football",
    league: "nfl",
    label: "NFL"
  },

  ncaaf: {
    sport: "football",
    league: "college-football",
    label: "NCAA Football"
  },

  mlb: {
    sport: "baseball",
    league: "mlb",
    label: "MLB"
  },

  nhl: {
    sport: "hockey",
    league: "nhl",
    label: "NHL"
  },

  nba: {
    sport: "basketball",
    league: "nba",
    label: "NBA"
  },

  ncaab: {
    sport: "basketball",
    league: "mens-college-basketball",
    label: "NCAA Basketball"
  }
};

function normalizeDate(value) {
  if (!value) {
    return new Date()
      .toISOString()
      .slice(0, 10)
      .replaceAll("-", "");
  }

  return String(value)
    .replaceAll("-", "")
    .trim();
}

function getBroadcast(competition) {
  const broadcasts = competition?.broadcasts ?? [];

  const names = broadcasts
    .flatMap((broadcast) => broadcast?.names ?? [])
    .filter(Boolean);

  return [...new Set(names)].join(", ");
}

function normalizeEvent(event, sportLabel) {
  const competition = event?.competitions?.[0];

  const competitors = competition?.competitors ?? [];

  const homeTeam = competitors.find(
    (team) => team.homeAway === "home"
  );

  const awayTeam = competitors.find(
    (team) => team.homeAway === "away"
  );

  return {
    id: event?.id ?? null,

    sport: sportLabel,

    name: event?.name ?? null,

    away:
      awayTeam?.team?.displayName ??
      "Away",

    home:
      homeTeam?.team?.displayName ??
      "Home",

    startTime:
      event?.date ?? null,

    status:
      event?.status?.type?.description ??
      null,

    network:
      getBroadcast(competition),

    venue:
      competition?.venue?.fullName ??
      null
  };
}

async function addDirectvGuideData(game, sportKey) {
  if (sportKey !== "mlb") {
    return game;
  }

  try {
    const directvGuide = await lookupDirectvGame({
      sport: "mlb",
      away: game.away,
      home: game.home,
      zip: "15220"
    });

    return {
      ...game,
      directvGuide
    };
  } catch (error) {
    console.error(
      "DIRECTV game lookup error:",
      error
    );

    return {
      ...game,
      directvGuide: null
    };
  }
}

router.get("/", async (req, res) => {
  const sportKey = String(
    req.query.sport ?? "mlb"
  )
    .toLowerCase()
    .trim();

  const config = SPORTS[sportKey];

  if (!config) {
    return res.status(400).json({
      status: "error",
      message: "Unsupported sport"
    });
  }

  const date = normalizeDate(
    req.query.date
  );

  const providerKey = String(
    req.query.provider ?? "directv"
  )
    .toLowerCase()
    .trim();

  const url =
    `https://site.api.espn.com/apis/site/v2/sports/` +
    `${config.sport}/` +
    `${config.league}/scoreboard` +
    `?dates=${date}`;

  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(
        `ESPN request failed: ${response.status}`
      );
    }

    const data = await response.json();

    const baseGames = (data.events ?? []).map(
      (event) =>
        normalizeEvent(
          event,
          config.label
        )
    );

    const resolvedGames = baseGames.map(
      (game) =>
        resolveGame(
          game,
          providerKey
        )
    );

    const games = await Promise.all(
      resolvedGames.map(
        (game) =>
          addDirectvGuideData(
            game,
            sportKey
          )
      )
    );

    return res.json({
      status: "ok",
      sport: sportKey,
      date,
      provider: providerKey,
      count: games.length,
      games
    });

  } catch (error) {
    console.error(
      "Resolve route error:",
      error
    );

    return res.status(500).json({
      status: "error",
      message: "Could not resolve games"
    });
  }
});

export default router;
