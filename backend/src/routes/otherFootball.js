import express from "express";
import { resolveGame } from "../logic/resolver.js";

const router = express.Router();

// Active pro football leagues outside the NFL that ESPN exposes
// through the same public API family used by the rest of WTG.
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

function dateKeyFromEvent(event) {
  const raw = event?.date;
  if (!raw) return null;

  const date = new Date(raw);
  if (!Number.isFinite(date.getTime())) return null;

  return date
    .toISOString()
    .slice(0, 10)
    .replaceAll("-", "");
}

function getBroadcast(competition) {
  const names = (competition?.broadcasts ?? [])
    .flatMap((broadcast) => broadcast?.names ?? [])
    .filter(Boolean);

  return [...new Set(names)].join(", ");
}

function normalizeEvent(event, config, metadata = {}) {
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
    source: metadata.source ?? "espn-scoreboard",
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

async function fetchJson(url, label) {
  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      "user-agent": "WTG/other-football"
    }
  });

  if (!response.ok) {
    throw new Error(`${label} request failed: ${response.status}`);
  }

  return response.json();
}

async function fetchScoreboardGames(config, date) {
  const url =
    `https://site.api.espn.com/apis/site/v2/sports/` +
    `${config.sport}/${config.league}/scoreboard` +
    `?dates=${date}&limit=100`;

  const data = await fetchJson(
    url,
    `${config.label} ESPN scoreboard`
  );

  return (data?.events ?? []).map(
    (event) => normalizeEvent(
      event,
      config,
      { source: "espn-scoreboard" }
    )
  );
}

function extractTeams(data) {
  const output = [];
  const seen = new Set();

  const walk = (value) => {
    if (!value || typeof value !== "object") return;

    if (Array.isArray(value)) {
      value.forEach(walk);
      return;
    }

    const team = value?.team;
    if (
      team &&
      team.id != null &&
      (team.displayName || team.name)
    ) {
      const id = String(team.id);
      if (!seen.has(id)) {
        seen.add(id);
        output.push(team);
      }
    }

    for (const child of Object.values(value)) {
      if (child && typeof child === "object") {
        walk(child);
      }
    }
  };

  walk(data);
  return output;
}

function scheduleEvents(data) {
  if (Array.isArray(data?.events)) return data.events;
  if (Array.isArray(data?.schedule)) return data.schedule;
  return [];
}

async function fetchTeamScheduleGames(config, date) {
  const season = String(date).slice(0, 4);

  const teamsUrl =
    `https://site.api.espn.com/apis/site/v2/sports/` +
    `${config.sport}/${config.league}/teams?limit=100`;

  const teamsData = await fetchJson(
    teamsUrl,
    `${config.label} ESPN teams`
  );

  const teams = extractTeams(teamsData);

  if (!teams.length) {
    throw new Error(`${config.label} ESPN teams returned no teams`);
  }

  const schedules = await Promise.allSettled(
    teams.map(async (team) => {
      const scheduleUrl =
        `https://site.api.espn.com/apis/site/v2/sports/` +
        `${config.sport}/${config.league}/teams/` +
        `${encodeURIComponent(team.id)}/schedule` +
        `?season=${encodeURIComponent(season)}`;

      return fetchJson(
        scheduleUrl,
        `${config.label} ESPN team schedule`
      );
    })
  );

  const events = schedules
    .filter((result) => result.status === "fulfilled")
    .flatMap((result) => scheduleEvents(result.value))
    .filter((event) => dateKeyFromEvent(event) === date)
    .map((event) => normalizeEvent(
      event,
      config,
      { source: "espn-team-schedule" }
    ));

  return dedupeGames(events);
}

async function fetchLeagueGames(config, date) {
  const scoreboardGames = await fetchScoreboardGames(
    config,
    date
  );

  if (scoreboardGames.length) {
    return {
      games: scoreboardGames,
      source: "espn-scoreboard",
      fallbackUsed: false
    };
  }

  // ESPN's CFL date scoreboard can return zero future events even when
  // the season schedule is already published. The team schedule endpoint
  // is a better source for those future dates, so use it as a fallback.
  if (config.key === "cfl") {
    const scheduleGames = await fetchTeamScheduleGames(
      config,
      date
    );

    return {
      games: scheduleGames,
      source: "espn-team-schedule",
      fallbackUsed: true
    };
  }

  return {
    games: [],
    source: "espn-scoreboard",
    fallbackUsed: false
  };
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
            ? result.value.games.length
            : 0,
        source:
          result?.status === "fulfilled"
            ? result.value.source
            : null,
        fallbackUsed:
          result?.status === "fulfilled"
            ? Boolean(result.value.fallbackUsed)
            : false,
        error:
          result?.status === "rejected"
            ? String(result.reason?.message || result.reason || "Unknown error")
            : null
      };
    }
  );

  const successfulGames = results
    .filter((result) => result.status === "fulfilled")
    .flatMap((result) => result.value.games);

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
