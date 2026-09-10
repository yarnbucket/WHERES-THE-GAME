import express from "express";
import { resolveGame } from "../logic/resolver.js";

const router = express.Router();

const LEAGUE_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
let leagueCache = { expires: 0, ids: [] };

function normalizeDate(value) {
  const text = String(value || "").replace(/[^0-9]/g, "");
  if (/^\d{8}$/.test(text)) return text;
  const now = new Date();
  return `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, "0")}${String(now.getUTCDate()).padStart(2, "0")}`;
}

function unique(values) {
  return [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))];
}

function sourceNames(items = []) {
  return items.flatMap((item) => [
    ...(item?.names ?? []),
    item?.name,
    item?.shortName,
    item?.displayName,
    item?.callLetters,
    item?.media?.name,
    item?.media?.shortName,
    item?.media?.displayName,
    item?.media?.callLetters,
    item?.network?.name,
    item?.network?.shortName,
    item?.network?.displayName,
    item?.network?.callLetters
  ]);
}

function broadcastNames(competition, event) {
  return unique([
    ...sourceNames(competition?.broadcasts),
    ...sourceNames(competition?.geoBroadcasts),
    ...sourceNames(event?.broadcasts),
    ...sourceNames(event?.geoBroadcasts),
    event?.network,
    competition?.network
  ]).join(", ");
}

function leagueLabel(data, leagueId) {
  const league = data?.leagues?.[0] ?? null;
  return league?.name ?? league?.shortName ?? league?.abbreviation ?? `Rugby Union ${leagueId}`;
}

function competitorName(item, fallback) {
  return item?.team?.displayName ??
    item?.team?.shortDisplayName ??
    item?.team?.name ??
    item?.displayName ??
    item?.name ??
    fallback;
}

function normalizeEvent(event, leagueId, label) {
  const competition = event?.competitions?.[0] ?? null;
  const competitors = competition?.competitors ?? [];
  const home = competitors.find((item) => item?.homeAway === "home") ?? competitors[1] ?? competitors[0] ?? null;
  const away = competitors.find((item) => item?.homeAway === "away") ?? competitors[0] ?? competitors[1] ?? null;

  return {
    id: event?.id ?? competition?.id ?? null,
    sport: "Rugby",
    league: label,
    rugbyLeagueId: String(leagueId),
    name: event?.name ?? event?.shortName ?? competition?.name ?? null,
    away: competitorName(away, "Away"),
    home: competitorName(home, "Home"),
    awayTeamId: away?.team?.id != null ? String(away.team.id) : null,
    homeTeamId: home?.team?.id != null ? String(home.team.id) : null,
    startTime: event?.date ?? competition?.date ?? null,
    status: event?.status?.type?.description ?? competition?.status?.type?.description ?? null,
    network: broadcastNames(competition, event),
    venue: competition?.venue?.fullName ?? event?.venue?.fullName ?? null,
    division: null,
    conferences: { away: { id: null, name: null }, home: { id: null, name: null } },
    conferenceIds: [],
    awayRank: null,
    homeRank: null
  };
}

function leagueIdFromRef(value) {
  const match = String(value || "").match(/\/leagues\/([^/?#]+)/i);
  return match ? decodeURIComponent(match[1]) : null;
}

async function getLeagueIds() {
  if (Date.now() < leagueCache.expires && leagueCache.ids.length) {
    return leagueCache.ids;
  }

  const url = "https://sports.core.api.espn.com/v2/sports/rugby/leagues?lang=en&region=us&limit=100";
  const response = await fetch(url, {
    headers: { accept: "application/json", "user-agent": "WTG/0.1H8v" }
  });
  if (!response.ok) throw new Error(`ESPN Rugby league discovery failed: ${response.status}`);

  const data = await response.json();
  const ids = unique((data?.items ?? []).map((item) => item?.id ?? leagueIdFromRef(item?.$ref)));
  if (!ids.length) throw new Error("No ESPN Rugby Union leagues discovered");

  leagueCache = { expires: Date.now() + LEAGUE_CACHE_TTL_MS, ids };
  return ids;
}

async function fetchLeague(leagueId, date) {
  const url = `https://site.api.espn.com/apis/site/v2/sports/rugby/${encodeURIComponent(leagueId)}/scoreboard?dates=${date}&limit=500`;
  const response = await fetch(url, {
    headers: { accept: "application/json", "user-agent": "WTG/0.1H8v" }
  });
  if (!response.ok) throw new Error(`ESPN Rugby ${leagueId} request failed: ${response.status}`);
  return response.json();
}

function dedupe(games) {
  const seen = new Set();
  return games.filter((game) => {
    const teams = [game.away, game.home]
      .map((value) => String(value || "").toLowerCase())
      .sort()
      .join("|");
    const key = String(game.id || `${teams}|${game.startTime || ""}`);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).sort((a, b) => new Date(a.startTime || 0) - new Date(b.startTime || 0));
}

router.get("/", async (req, res, next) => {
  const sportKey = String(req.query.sport || "").toLowerCase().trim();
  if (sportKey !== "rugby") return next();

  const date = normalizeDate(req.query.date);
  const providerKey = String(req.query.provider || "directv").toLowerCase().trim();

  try {
    const ids = await getLeagueIds();
    const results = await Promise.allSettled(
      ids.map(async (leagueId) => {
        const data = await fetchLeague(leagueId, date);
        const label = leagueLabel(data, leagueId);
        return {
          leagueId,
          label,
          games: (data?.events ?? []).map((event) => normalizeEvent(event, leagueId, label))
        };
      })
    );

    const successful = results
      .filter((result) => result.status === "fulfilled")
      .map((result) => result.value);

    const failedLeagues = results
      .map((result, index) => result.status === "rejected" ? ids[index] : null)
      .filter(Boolean);

    const games = dedupe(successful.flatMap((item) => item.games))
      .map((game) => resolveGame(game, providerKey));

    return res.json({
      status: "ok",
      sport: "rugby",
      code: "rugby-union",
      date,
      provider: providerKey,
      count: games.length,
      leagues: successful.map((item) => ({ id: item.leagueId, label: item.label })),
      failedLeagues,
      games
    });
  } catch (error) {
    console.error("Rugby resolve error:", error);
    return res.status(500).json({
      status: "error",
      sport: "rugby",
      code: "rugby-union",
      date,
      count: 0,
      games: []
    });
  }
});

export default router;
