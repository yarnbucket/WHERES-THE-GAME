import express from "express";
import { resolveGame } from "../logic/resolver.js";

const router = express.Router();

const CFL_TEAMS = {
  BC: "BC Lions",
  CGY: "Calgary Stampeders",
  EDM: "Edmonton Elks",
  HAM: "Hamilton Tiger-Cats",
  MTL: "Montreal Alouettes",
  OTT: "Ottawa Redblacks",
  SSK: "Saskatchewan Roughriders",
  TOR: "Toronto Argonauts",
  WPG: "Winnipeg Blue Bombers"
};

// Verified against the official CFL 2026 schedule PDF (Eastern Time).
// This avoids the CFL website's client-rendered HTML, which Render can fetch
// but cannot reliably parse into schedule rows.
const CFL_2026 = [
  ["20260604","19:30","MTL","HAM"],["20260605","21:00","WPG","CGY"],["20260606","19:00","EDM","OTT"],
  ["20260611","20:30","HAM","WPG"],["20260612","19:00","TOR","MTL"],["20260613","19:00","BC","SSK"],
  ["20260619","19:30","BC","HAM"],["20260620","13:00","TOR","OTT"],["20260620","16:00","MTL","EDM"],["20260620","19:00","SSK","CGY"],
  ["20260625","20:30","EDM","WPG"],["20260626","21:00","TOR","SSK"],["20260627","19:00","CGY","BC"],["20260628","19:00","OTT","MTL"],
  ["20260702","21:00","TOR","CGY"],["20260703","19:30","SSK","OTT"],["20260704","19:00","EDM","BC"],["20260705","19:00","WPG","HAM"],
  ["20260709","21:00","OTT","EDM"],["20260710","20:30","TOR","WPG"],["20260711","19:00","CGY","MTL"],["20260712","19:00","HAM","SSK"],
  ["20260717","21:00","BC","EDM"],["20260718","16:00","MTL","CGY"],["20260718","19:00","TOR","HAM"],["20260719","19:00","WPG","OTT"],
  ["20260723","21:00","EDM","SSK"],["20260724","20:30","CGY","WPG"],["20260725","19:00","TOR","BC"],["20260726","19:00","HAM","MTL"],
  ["20260730","20:30","BC","WPG"],["20260731","19:30","MTL","OTT"],["20260801","15:00","CGY","HAM"],["20260801","19:00","SSK","EDM"],
  ["20260806","19:30","CGY","TOR"],["20260807","21:00","OTT","SSK"],["20260808","15:00","EDM","MTL"],["20260808","19:00","HAM","BC"],
  ["20260813","21:00","BC","CGY"],["20260814","20:30","OTT","WPG"],["20260815","15:00","TOR","EDM"],["20260815","19:00","SSK","HAM"],
  ["20260820","19:30","OTT","MTL"],["20260821","21:30","WPG","EDM"],["20260822","19:00","HAM","TOR"],["20260823","19:00","SSK","BC"],
  ["20260828","20:30","MTL","WPG"],["20260829","15:00","HAM","CGY"],["20260829","19:00","TOR","SSK"],["20260830","19:00","BC","OTT"],
  ["20260904","19:30","BC","MTL"],["20260906","19:00","WPG","SSK"],["20260907","14:30","TOR","HAM"],["20260907","18:00","EDM","CGY"],
  ["20260912","13:00","OTT","TOR"],["20260912","16:00","SSK","WPG"],["20260912","19:00","CGY","EDM"],["20260912","22:00","MTL","BC"],
  ["20260918","19:30","MTL","HAM"],["20260919","15:00","EDM","TOR"],["20260919","19:00","OTT","CGY"],
  ["20260925","20:00","TOR","WPG"],["20260925","22:30","SSK","BC"],["20260926","15:00","CGY","OTT"],["20260926","19:00","HAM","EDM"],
  ["20261002","19:00","HAM","OTT"],["20261002","21:30","CGY","SSK"],["20261003","15:00","BC","TOR"],["20261003","19:00","WPG","MTL"],
  ["20261009","19:00","EDM","HAM"],["20261009","22:00","OTT","BC"],["20261010","20:00","CGY","WPG"],["20261012","13:00","SSK","MTL"],
  ["20261016","19:00","TOR","OTT"],["20261016","21:30","WPG","EDM"],["20261017","15:00","MTL","SSK"],["20261017","19:00","BC","CGY"],
  ["20261023","19:00","MTL","TOR"],["20261023","22:00","WPG","BC"],["20261024","15:00","OTT","HAM"],["20261024","15:00","EDM","SSK"]
];

function normalizeDate(value) {
  if (!value) return new Date().toISOString().slice(0, 10).replaceAll("-", "");
  return String(value).replaceAll("-", "").trim();
}

function easternLocalToIso(dateKey, timeText) {
  const year = Number(dateKey.slice(0, 4));
  const month = Number(dateKey.slice(4, 6));
  const day = Number(dateKey.slice(6, 8));
  const [hour, minute] = timeText.split(":").map(Number);
  const probe = new Date(Date.UTC(year, month - 1, day, 12));
  const zone = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    timeZoneName: "shortOffset",
    hour: "2-digit"
  }).formatToParts(probe).find((p) => p.type === "timeZoneName")?.value || "GMT-5";
  const m = zone.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/i);
  let offset = -300;
  if (m) offset = (m[1] === "+" ? 1 : -1) * (Number(m[2]) * 60 + Number(m[3] || 0));
  return new Date(Date.UTC(year, month - 1, day, hour, minute) - offset * 60000).toISOString();
}

function cflGamesForDate(date) {
  return CFL_2026.filter((row) => row[0] === date).map(([d, time, away, home]) => ({
    id: `cfl-${d}-${away}-${home}`,
    sport: "CFL",
    league: "cfl",
    leagueLabel: "CFL",
    source: "official-cfl-2026-schedule",
    sourceUrl: "https://static.cfl.ca/wp-content/uploads/CFL-2026-Schedule-ET-.pdf",
    name: `${CFL_TEAMS[away]} at ${CFL_TEAMS[home]}`,
    away: CFL_TEAMS[away],
    home: CFL_TEAMS[home],
    awayTeamId: away,
    homeTeamId: home,
    startTime: easternLocalToIso(d, time),
    status: "Scheduled",
    network: "",
    venue: null
  }));
}

function dateKeyFromEvent(event) {
  if (!event?.date) return null;
  const date = new Date(event.date);
  if (!Number.isFinite(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(date);
  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const d = parts.find((p) => p.type === "day")?.value;
  return y && m && d ? `${y}${m}${d}` : null;
}

function getBroadcast(competition) {
  return [...new Set((competition?.broadcasts ?? []).flatMap((b) => b?.names ?? []).filter(Boolean))].join(", ");
}

async function fetchUflGames(date) {
  const url = `https://site.api.espn.com/apis/site/v2/sports/football/ufl/scoreboard?dates=${encodeURIComponent(date)}&limit=100`;
  const response = await fetch(url, { headers: { accept: "application/json", "user-agent": "WTG/other-football" } });
  if (!response.ok) throw new Error(`UFL ESPN request failed: ${response.status}`);
  const data = await response.json();
  return (data?.events ?? []).filter((e) => dateKeyFromEvent(e) === date).map((event) => {
    const c = event?.competitions?.[0];
    const teams = c?.competitors ?? [];
    const home = teams.find((t) => t.homeAway === "home");
    const away = teams.find((t) => t.homeAway === "away");
    return {
      id: event?.id ?? null,
      sport: "UFL",
      league: "ufl",
      leagueLabel: "UFL",
      source: "espn-scoreboard",
      name: event?.name ?? null,
      away: away?.team?.displayName ?? "Away",
      home: home?.team?.displayName ?? "Home",
      awayTeamId: away?.team?.id != null ? String(away.team.id) : null,
      homeTeamId: home?.team?.id != null ? String(home.team.id) : null,
      startTime: event?.date ?? null,
      status: event?.status?.type?.description ?? null,
      network: getBroadcast(c),
      venue: c?.venue?.fullName ?? null
    };
  });
}

function dedupe(games) {
  const seen = new Set();
  return games.filter((g) => {
    const key = g.id ?? `${g.league}|${g.away}|${g.home}|${g.startTime}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).sort((a, b) => new Date(a.startTime ?? 0) - new Date(b.startTime ?? 0));
}

router.get("/", async (req, res, next) => {
  const sportKey = String(req.query.sport ?? "").toLowerCase().trim();
  if (sportKey !== "otherfootball") return next();

  const date = normalizeDate(req.query.date);
  const providerKey = String(req.query.provider ?? "directv").toLowerCase().trim();

  const cflGames = cflGamesForDate(date);
  let uflGames = [];
  let uflError = null;
  try { uflGames = await fetchUflGames(date); }
  catch (error) { uflError = String(error?.message || error); }

  const games = dedupe([...cflGames, ...uflGames]).map((game) => resolveGame(game, providerKey));

  return res.json({
    status: "ok",
    sport: sportKey,
    date,
    provider: providerKey,
    count: games.length,
    leagues: ["cfl", "ufl"],
    sources: [
      { league: "cfl", label: "CFL", healthy: true, count: cflGames.length, source: "official-cfl-2026-schedule", fallbackUsed: false },
      { league: "ufl", label: "UFL", healthy: !uflError, count: uflGames.length, source: "espn-scoreboard", fallbackUsed: false, error: uflError }
    ],
    games
  });
});

export default router;
