import express from "express";
import { resolveGame } from "../logic/resolver.js";

const router = express.Router();

// Active pro football leagues outside the NFL that ESPN exposes.
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

  // WTG displays and filters schedules in Eastern Time. Using UTC here
  // moves late CFL games (for example 10 PM ET) onto the following date.
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  return year && month && day
    ? `${year}${month}${day}`
    : null;
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

function targetDateUtc(dateKey) {
  const text = String(dateKey || "");
  if (!/^\d{8}$/.test(text)) return null;

  const year = Number(text.slice(0, 4));
  const month = Number(text.slice(4, 6));
  const day = Number(text.slice(6, 8));
  const value = Date.UTC(year, month - 1, day, 12, 0, 0);

  return Number.isFinite(value) ? value : null;
}

function calendarWeekForDate(scoreboardData, date) {
  const target = targetDateUtc(date);
  if (target == null) return null;

  const calendar = scoreboardData?.leagues?.[0]?.calendar;
  if (!Array.isArray(calendar)) return null;

  for (const seasonType of calendar) {
    const entries = Array.isArray(seasonType?.entries)
      ? seasonType.entries
      : [];

    for (const entry of entries) {
      const start = new Date(entry?.startDate || 0).getTime();
      const end = new Date(entry?.endDate || 0).getTime();

      if (
        Number.isFinite(start) &&
        Number.isFinite(end) &&
        target >= start &&
        target <= end
      ) {
        const week =
          entry?.value ??
          entry?.week ??
          entry?.number ??
          null;

        const seasonTypeValue =
          seasonType?.value ??
          seasonType?.type ??
          2;

        if (week != null) {
          return {
            week: String(week),
            seasonType: String(seasonTypeValue || 2)
          };
        }
      }
    }
  }

  return null;
}

async function fetchScoreboardData(config, query) {
  const url =
    `https://site.api.espn.com/apis/site/v2/sports/` +
    `${config.sport}/${config.league}/scoreboard?${query}`;

  return fetchJson(
    url,
    `${config.label} ESPN scoreboard`
  );
}

function eventsForDate(data, config, date, source) {
  return (data?.events ?? [])
    .filter((event) => dateKeyFromEvent(event) === date)
    .map((event) => normalizeEvent(
      event,
      config,
      { source }
    ));
}

async function fetchScoreboardGames(config, date) {
  const data = await fetchScoreboardData(
    config,
    `dates=${encodeURIComponent(date)}&limit=100`
  );

  const directGames = eventsForDate(
    data,
    config,
    date,
    "espn-scoreboard-date"
  );

  if (directGames.length) {
    return {
      games: directGames,
      data,
      source: "espn-scoreboard-date"
    };
  }

  // ESPN's CFL date query can return an empty events array for future
  // dates even though that week's games are already published. The
  // scoreboard response still carries its season calendar, so identify
  // the requested week and ask ESPN for that week instead.
  const weekInfo = calendarWeekForDate(data, date);

  if (weekInfo) {
    const weekData = await fetchScoreboardData(
      config,
      `week=${encodeURIComponent(weekInfo.week)}` +
      `&seasontype=${encodeURIComponent(weekInfo.seasonType)}` +
      `&limit=100`
    );

    const weekGames = eventsForDate(
      weekData,
      config,
      date,
      "espn-scoreboard-week"
    );

    if (weekGames.length) {
      return {
        games: weekGames,
        data,
        source: "espn-scoreboard-week"
      };
    }
  }

  return {
    games: [],
    data,
    source: "espn-scoreboard-date"
  };
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
  const scoreboardResult = await fetchScoreboardGames(
    config,
    date
  );

  if (scoreboardResult.games.length) {
    return {
      games: scoreboardResult.games,
      source: scoreboardResult.source,
      fallbackUsed:
        scoreboardResult.source !== "espn-scoreboard-date"
    };
  }

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
    source: scoreboardResult.source,
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

// Mounted at /resolve before the main resolver. Handles only
// sport=otherfootball and passes all other requests through.
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
