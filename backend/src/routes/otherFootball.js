import express from "express";
import { resolveGame } from "../logic/resolver.js";

const router = express.Router();

// Active pro football leagues outside the NFL that ESPN exposes
// through the same scoreboard API used by the rest of WTG.
const OTHER_FOOTBALL_LEAGUES = [
  {
    key: "cfl",
    sport: "football",
    league: "cfl",
    label: "CFL"
  },
  {
    key: "ufl",
    sport: "football",
    league: "ufl",
    label: "UFL"
  }
];

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
  const names = (competition?.broadcasts ?? [])
    .flatMap((broadcast) => broadcast?.names ?? [])
    .filter(Boolean);

  return [...new Set(names)].join(", ");
}

function normalizeEvent(event, config) {
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
    sport: config.label,
    league: config.key,
    leagueLabel: config.label,
    name: event?.name ?? null,
    away:
      awayTeam?.team?.displayName ??
      awayTeam?.team?.shortDisplayName ??
      "Away",
    home:
      homeTeam?.team?.displayName ??
      homeTeam?.team?.shortDisplayName ??
      "Home",
    awayTeamId:
      awayTeam?.team?.id != null
        ? String(awayTeam.team.id)
        : null,
    homeTeamId:
      homeTeam?.team?.id != null
        ? String(homeTeam.team.id)
        : null,
    startTime: event?.date ?? null,
    status:
      event?.status?.type?.description ??
      null,
    network: getBroadcast(competition),
    venue:
      competition?.venue?.fullName ??
      null
  };
}

async function fetchLeagueGames(config, date) {
  const url =
    `https://site.api.espn.com/apis/site/v2/sports/` +
    `${config.sport}/${config.league}/scoreboard` +
    `?dates=${date}&limit=100`;

  const response = await fetch(url, {
    headers: {
      "accept": "application/json",
      "user-agent": "WTG/other-football"
    }
  });

  if (!response.ok) {
    throw new Error(
      `${config.label} ESPN request failed: ${response.status}`
    );
  }

  const data = await response.json();

  return (data?.events ?? []).map(
    (event) => normalizeEvent(event, config)
  );
}

function dedupeGames(games) {
  const seen = new Set();

  return games
    .filter((game) => {
      const key =
        game?.id ??
        `${game?.league}|${game?.away}|${game?.home}|${game?.startTime}`;

      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) =>
      new Date(a?.startTime ?? 0).getTime() -
      new Date(b?.startTime ?? 0).getTime()
    );
}

// This route is mounted at /resolve before the main resolve router.
// It handles only sport=otherfootball and passes every other request on.
router.get("/", async (req, res, next) => {
  const sportKey = String(req.query.sport ?? "")
    .toLowerCase()
    .trim();

  if (sportKey !== "otherfootball") {
    return next();
  }

  const date = normalizeDate(req.query.date);
  const providerKey = String(
    req.query.provider ?? "directv"
  )
    .toLowerCase()
    .trim();

  const results = await Promise.allSettled(
    OTHER_FOOTBALL_LEAGUES.map((config) =>
      fetchLeagueGames(config, date)
    )
  );

  const sourceStatus = OTHER_FOOTBALL_LEAGUES.map(
    (config, index) => {
      const result = results[index];

      return {
        league: config.key,
        label: config.label,
        healthy: result?.status === "fulfilled",
        count:
          result?.status === "fulfilled"
            ? result.value.length
            : 0,
        error:
          result?.status === "rejected"
            ? String(result.reason?.message || result.reason || "Unknown error")
            : null
      };
    }
  );

  const successfulGames = results
    .filter((result) => result.status === "fulfilled")
    .flatMap((result) => result.value);

  // A failure in one league should not hide games from the other league.
  // Only return an error when every configured source failed.
  if (!successfulGames.length && results.every(
    (result) => result.status === "rejected"
  )) {
    console.error(
      "Other Football sources failed:",
      sourceStatus
    );

    return res.status(502).json({
      status: "error",
      sport: sportKey,
      date,
      provider: providerKey,
      count: 0,
      leagues: OTHER_FOOTBALL_LEAGUES.map((item) => item.key),
      sources: sourceStatus,
      games: []
    });
  }

  const games = dedupeGames(successfulGames).map(
    (game) => resolveGame(game, providerKey)
  );

  return res.json({
    status: "ok",
    sport: sportKey,
    date,
    provider: providerKey,
    count: games.length,
    leagues: OTHER_FOOTBALL_LEAGUES.map((item) => item.key),
    sources: sourceStatus,
    games
  });
});

export default router;
