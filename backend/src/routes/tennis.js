import express from "express";
import { resolveGame } from "../logic/resolver.js";

const router = express.Router();

const LEAGUES = [
  { league: "atp", label: "ATP" },
  { league: "wta", label: "WTA" }
];

function normalizeDate(value) {
  const text = String(value || "").replace(/[^0-9]/g, "");
  if (/^\d{8}$/.test(text)) return text;
  const now = new Date();
  return `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, "0")}${String(now.getUTCDate()).padStart(2, "0")}`;
}

function easternDateKey(value) {
  const date = new Date(value || 0);
  if (!Number.isFinite(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const get = (type) => parts.find((part) => part.type === type)?.value || "";
  return `${get("year")}${get("month")}${get("day")}`;
}

function unique(values) {
  return [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))];
}

function broadcastNames(competition) {
  return unique([
    ...(competition?.broadcasts ?? []).flatMap((item) => [
      ...(item?.names ?? []),
      item?.name,
      item?.shortName,
      item?.displayName,
      item?.media?.name,
      item?.media?.shortName,
      item?.media?.displayName
    ]),
    ...(competition?.geoBroadcasts ?? []).flatMap((item) => [
      item?.media?.shortName,
      item?.media?.name,
      item?.media?.displayName
    ]),
    competition?.broadcast
  ]);
}

function competitorName(competitor) {
  return competitor?.athlete?.displayName ||
    competitor?.athlete?.fullName ||
    competitor?.team?.displayName ||
    competitor?.displayName ||
    "TBD";
}

function normalizeMatch(event, grouping, competition, leagueLabel) {
  const competitors = competition?.competitors ?? [];
  const home = competitors.find((item) => item.homeAway === "home") || competitors[0];
  const away = competitors.find((item) => item.homeAway === "away") || competitors[1];
  const round = competition?.round?.displayName || grouping?.grouping?.displayName || "Match";
  const tournament = event?.name || event?.shortName || "Tennis";
  const names = broadcastNames(competition);

  return {
    id: competition?.id || `${event?.id || tournament}-${round}-${competition?.date || ""}`,
    sport: "Tennis",
    league: leagueLabel,
    name: `${tournament} — ${round}`,
    away: competitorName(away),
    home: competitorName(home),
    awayTeamId: away?.id != null ? String(away.id) : away?.athlete?.id != null ? String(away.athlete.id) : null,
    homeTeamId: home?.id != null ? String(home.id) : home?.athlete?.id != null ? String(home.athlete.id) : null,
    startTime: competition?.date || competition?.startDate || event?.date || null,
    status: competition?.status?.type?.description || competition?.status?.type?.detail || null,
    network: names.join(", "),
    venue: competition?.venue?.fullName || event?.venue?.fullName || null,
    division: null,
    conferences: { away: { id: null, name: null }, home: { id: null, name: null } },
    conferenceIds: [],
    awayRank: null,
    homeRank: null,
    tournament,
    round,
    matchType: grouping?.grouping?.displayName || competition?.type?.text || null
  };
}

async function fetchLeague(league, date) {
  // ESPN Tennis is tournament-centric: the date selects active tournaments,
  // while the actual day's matches live inside event.groupings[].competitions[].
  const url = `https://site.api.espn.com/apis/site/v2/sports/tennis/${league}/scoreboard?dates=${date}`;
  const response = await fetch(url, {
    headers: { accept: "application/json", "user-agent": "WTG/0.1H8m" }
  });
  if (!response.ok) throw new Error(`ESPN Tennis ${league} request failed: ${response.status}`);
  return response.json();
}

function matchesForDate(data, date, leagueLabel) {
  const games = [];
  for (const event of data?.events ?? []) {
    for (const grouping of event?.groupings ?? []) {
      for (const competition of grouping?.competitions ?? []) {
        if (easternDateKey(competition?.date || competition?.startDate) !== date) continue;
        games.push(normalizeMatch(event, grouping, competition, leagueLabel));
      }
    }
  }
  return games;
}

function dedupe(games) {
  const seen = new Set();
  return games.filter((game) => {
    const key = String(game.id || `${game.away}|${game.home}|${game.startTime}`);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).sort((a, b) => new Date(a.startTime || 0) - new Date(b.startTime || 0));
}

router.get("/", async (req, res, next) => {
  const sportKey = String(req.query.sport || "").toLowerCase().trim();
  if (sportKey !== "tennis") return next();

  const date = normalizeDate(req.query.date);
  const providerKey = String(req.query.provider || "directv").toLowerCase().trim();

  try {
    const results = await Promise.allSettled(
      LEAGUES.map(async ({ league, label }) => {
        const data = await fetchLeague(league, date);
        return matchesForDate(data, date, label);
      })
    );

    const baseGames = dedupe(
      results.filter((result) => result.status === "fulfilled").flatMap((result) => result.value)
    );
    const games = baseGames.map((game) => resolveGame(game, providerKey));

    return res.json({
      status: "ok",
      sport: "tennis",
      date,
      provider: providerKey,
      count: games.length,
      leagues: LEAGUES.map((item) => item.label),
      games
    });
  } catch (error) {
    console.error("Tennis resolve error:", error);
    return res.status(500).json({ status: "error", sport: "tennis", date, count: 0, games: [] });
  }
});

export default router;
