import express from "express";
import { resolveGame } from "../logic/resolver.js";

const router = express.Router();

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

const CFL_TEAMS = [
  { abbr: "BC", name: "BC Lions" },
  { abbr: "CGY", name: "Calgary Stampeders" },
  { abbr: "EDM", name: "Edmonton Elks" },
  { abbr: "HAM", name: "Hamilton Tiger-Cats" },
  { abbr: "MTL", name: "Montreal Alouettes" },
  { abbr: "OTT", name: "Ottawa Redblacks" },
  { abbr: "SSK", name: "Saskatchewan Roughriders" },
  { abbr: "TOR", name: "Toronto Argonauts" },
  { abbr: "WPG", name: "Winnipeg Blue Bombers" }
];

function normalizeDate(value) {
  if (!value) {
    return new Date().toISOString().slice(0, 10).replaceAll("-", "");
  }
  return String(value).replaceAll("-", "").trim();
}

function dateKeyFromEvent(event) {
  const raw = event?.date;
  if (!raw) return null;
  const date = new Date(raw);
  if (!Number.isFinite(date.getTime())) return null;

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  return year && month && day ? `${year}${month}${day}` : null;
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
  const homeTeam = competitors.find((team) => team.homeAway === "home");
  const awayTeam = competitors.find((team) => team.homeAway === "away");

  return {
    id: event?.id ?? null,
    sport: config.label,
    league: config.key,
    leagueLabel: config.label,
    source: metadata.source ?? "espn-scoreboard",
    name: event?.name ?? null,
    away: awayTeam?.team?.displayName ?? awayTeam?.team?.shortDisplayName ?? "Away",
    home: homeTeam?.team?.displayName ?? homeTeam?.team?.shortDisplayName ?? "Home",
    awayTeamId: awayTeam?.team?.id != null ? String(awayTeam.team.id) : null,
    homeTeamId: homeTeam?.team?.id != null ? String(homeTeam.team.id) : null,
    startTime: event?.date ?? null,
    status: event?.status?.type?.description ?? null,
    network: getBroadcast(competition),
    venue: competition?.venue?.fullName ?? null
  };
}

async function fetchJson(url, label) {
  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      "user-agent": "WTG/other-football"
    }
  });
  if (!response.ok) throw new Error(`${label} request failed: ${response.status}`);
  return response.json();
}

async function fetchText(url, label) {
  const response = await fetch(url, {
    headers: {
      accept: "text/html,application/xhtml+xml",
      "user-agent": "Mozilla/5.0 WTG/other-football"
    }
  });
  if (!response.ok) throw new Error(`${label} request failed: ${response.status}`);
  return response.text();
}

function decodeHtml(value) {
  return String(value || "")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&ndash;|&#8211;/gi, "-")
    .replace(/&mdash;|&#8212;/gi, "-");
}

function htmlToScheduleText(html) {
  return decodeHtml(
    String(html || "")
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<img\b[^>]*\balt=["']([^"']*)["'][^>]*>/gi, " $1 ")
      .replace(/<(?:br|\/p|\/div|\/li|\/section|\/article|\/h\d)\b[^>]*>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
  )
    .replace(/[\t\r]+/g, " ")
    .replace(/ +/g, " ")
    .replace(/\n\s+/g, "\n")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

function monthIndex(shortMonth) {
  return ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    .indexOf(shortMonth);
}

function easternLocalToIso(year, month, day, hour, minute) {
  const probe = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  const zoneName = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    timeZoneName: "shortOffset",
    hour: "2-digit"
  }).formatToParts(probe).find((part) => part.type === "timeZoneName")?.value || "GMT-5";

  const match = zoneName.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/i);
  let offsetMinutes = -300;
  if (match) {
    const sign = match[1] === "+" ? 1 : -1;
    offsetMinutes = sign * (Number(match[2]) * 60 + Number(match[3] || 0));
  }

  return new Date(Date.UTC(year, month - 1, day, hour, minute) - offsetMinutes * 60000).toISOString();
}

function findCflTeams(block) {
  const lower = block.toLowerCase();
  const hits = [];

  for (const team of CFL_TEAMS) {
    const candidates = [team.name, `${team.name} logo`, team.abbr];
    let best = -1;
    for (const candidate of candidates) {
      const index = lower.indexOf(candidate.toLowerCase());
      if (index >= 0 && (best < 0 || index < best)) best = index;
    }
    if (best >= 0) hits.push({ ...team, index: best });
  }

  return hits.sort((a, b) => a.index - b.index);
}

function networksFromOfficialBlock(block) {
  const known = ["CBS Sports Network", "CFL+", "CTV", "TSN", "RDS"];
  return known.filter((name) => new RegExp(name.replace("+", "\\+"), "i").test(block)).join(", ");
}

function parseOfficialCflSchedule(html, dateKey) {
  const text = htmlToScheduleText(html);
  const year = Number(String(dateKey).slice(0, 4));
  const month = Number(String(dateKey).slice(4, 6));
  const day = Number(String(dateKey).slice(6, 8));
  if (!year || !month || !day) return [];

  const datePattern = /(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})\s+(\d{1,2}:\d{2})\s*([ap])\.?m\.?\s*ET/gi;
  const matches = [...text.matchAll(datePattern)];
  const games = [];

  for (let i = 0; i < matches.length; i += 1) {
    const match = matches[i];
    const matchMonth = monthIndex(match[2]) + 1;
    const matchDay = Number(match[3]);
    if (matchMonth !== month || matchDay !== day) continue;

    const start = match.index + match[0].length;
    const end = i + 1 < matches.length ? matches[i + 1].index : Math.min(text.length, start + 2500);
    const block = text.slice(start, end);
    const teams = findCflTeams(block);
    if (teams.length < 2) continue;

    const [awayTeam, homeTeam] = teams;
    const [clock, minuteText] = match[4].split(":");
    let hour = Number(clock);
    const minute = Number(minuteText);
    const meridiem = match[5].toLowerCase();
    if (meridiem === "p" && hour !== 12) hour += 12;
    if (meridiem === "a" && hour === 12) hour = 0;

    games.push({
      id: `cfl-${dateKey}-${awayTeam.abbr}-${homeTeam.abbr}`,
      sport: "CFL",
      league: "cfl",
      leagueLabel: "CFL",
      source: "cfl.ca-schedule",
      sourceUrl: `https://www.cfl.ca/schedule/${year}/`,
      name: `${awayTeam.name} at ${homeTeam.name}`,
      away: awayTeam.name,
      home: homeTeam.name,
      awayTeamId: awayTeam.abbr,
      homeTeamId: homeTeam.abbr,
      startTime: easternLocalToIso(year, month, day, hour, minute),
      status: "Scheduled",
      network: networksFromOfficialBlock(block),
      venue: null
    });
  }

  return dedupeGames(games);
}

async function fetchOfficialCflGames(date) {
  const season = String(date).slice(0, 4);
  const urls = [
    `https://www.cfl.ca/schedule/${season}/`,
    `https://cfl.prod.s.cfl.ca/schedule/${season}/`,
    `https://cfl.prod.s.cfl.ca/schedule`
  ];

  let lastError = null;
  for (const url of urls) {
    try {
      const html = await fetchText(url, "Official CFL schedule");
      const games = parseOfficialCflSchedule(html, date);
      if (games.length) {
        return { games, source: "cfl.ca-schedule", fallbackUsed: false, sourceUrl: url };
      }
      lastError = new Error(`Official CFL schedule returned no parseable games for ${date}`);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error("Official CFL schedule lookup failed");
}

async function fetchEspnScoreboardGames(config, date) {
  const url = `https://site.api.espn.com/apis/site/v2/sports/${config.sport}/${config.league}/scoreboard?dates=${encodeURIComponent(date)}&limit=100`;
  const data = await fetchJson(url, `${config.label} ESPN scoreboard`);
  return (data?.events ?? [])
    .filter((event) => dateKeyFromEvent(event) === date)
    .map((event) => normalizeEvent(event, config, { source: "espn-scoreboard" }));
}

async function fetchLeagueGames(config, date) {
  if (config.key === "cfl") {
    try {
      return await fetchOfficialCflGames(date);
    } catch (officialError) {
      console.error("Official CFL schedule lookup error:", officialError);
      const espnGames = await fetchEspnScoreboardGames(config, date);
      return {
        games: espnGames,
        source: "espn-scoreboard-fallback",
        fallbackUsed: true,
        error: String(officialError?.message || officialError)
      };
    }
  }

  const games = await fetchEspnScoreboardGames(config, date);
  return { games, source: "espn-scoreboard", fallbackUsed: false };
}

function dedupeGames(games) {
  const seen = new Set();
  return games
    .filter((game) => {
      const key = game?.id ?? `${game?.league}|${game?.away}|${game?.home}|${game?.startTime}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => new Date(a?.startTime ?? 0).getTime() - new Date(b?.startTime ?? 0).getTime());
}

router.get("/", async (req, res, next) => {
  const sportKey = String(req.query.sport ?? "").toLowerCase().trim();
  if (sportKey !== "otherfootball") return next();

  const date = normalizeDate(req.query.date);
  const providerKey = String(req.query.provider ?? "directv").toLowerCase().trim();

  const results = await Promise.allSettled(
    OTHER_FOOTBALL_LEAGUES.map((config) => fetchLeagueGames(config, date))
  );

  const sourceStatus = OTHER_FOOTBALL_LEAGUES.map((config, index) => {
    const result = results[index];
    return {
      league: config.key,
      label: config.label,
      healthy: result?.status === "fulfilled",
      count: result?.status === "fulfilled" ? result.value.games.length : 0,
      source: result?.status === "fulfilled" ? result.value.source : null,
      sourceUrl: result?.status === "fulfilled" ? result.value.sourceUrl ?? null : null,
      fallbackUsed: result?.status === "fulfilled" ? Boolean(result.value.fallbackUsed) : false,
      error: result?.status === "rejected"
        ? String(result.reason?.message || result.reason || "Unknown error")
        : result.value?.error ?? null
    };
  });

  const successfulGames = results
    .filter((result) => result.status === "fulfilled")
    .flatMap((result) => result.value.games);

  if (!successfulGames.length && results.every((result) => result.status === "rejected")) {
    console.error("Other Football sources failed:", sourceStatus);
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

  const games = dedupeGames(successfulGames).map((game) => resolveGame(game, providerKey));

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
