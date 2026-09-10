import express from "express";
import { resolveGame } from "../logic/resolver.js";

const router = express.Router();

function normalizeDate(value) {
  const text = String(value || "").replace(/[^0-9]/g, "");
  if (/^\d{8}$/.test(text)) return text;
  const now = new Date();
  return `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, "0")}${String(now.getUTCDate()).padStart(2, "0")}`;
}

function unique(values) {
  return [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))];
}

function broadcastNames(competition, event) {
  return unique([
    ...(competition?.broadcasts ?? []).flatMap((item) => [
      ...(item?.names ?? []), item?.name, item?.shortName, item?.displayName,
      item?.media?.name, item?.media?.shortName, item?.media?.displayName,
      item?.network?.name, item?.network?.shortName, item?.network?.displayName
    ]),
    ...(competition?.geoBroadcasts ?? []).flatMap((item) => [
      item?.media?.name, item?.media?.shortName, item?.media?.displayName,
      item?.network?.name, item?.network?.shortName, item?.network?.displayName
    ]),
    event?.network,
    competition?.network
  ]).join(", ");
}

function normalizeEvent(event) {
  const competition = event?.competitions?.[0];
  const competitors = competition?.competitors ?? [];
  const names = competitors.map((item) => item?.athlete?.displayName ?? item?.team?.displayName).filter(Boolean);
  const away = names[0] ?? "Boxer 1";
  const home = names[1] ?? event?.name ?? competition?.name ?? "Boxing Event";

  return {
    id: event?.id ?? competition?.id ?? null,
    sport: "Boxing",
    league: "Boxing",
    name: event?.name ?? competition?.name ?? `${away} vs ${home}`,
    away,
    home,
    awayTeamId: null,
    homeTeamId: null,
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

async function fetchEspn(date) {
  const candidates = [
    `https://site.api.espn.com/apis/site/v2/sports/boxing/boxing/scoreboard?dates=${date}&limit=100`,
    `https://site.api.espn.com/apis/site/v2/sports/boxing/scoreboard?dates=${date}&limit=100`
  ];

  for (const url of candidates) {
    try {
      const response = await fetch(url, { headers: { accept: "application/json", "user-agent": "WTG/0.1H8p" } });
      if (!response.ok) continue;
      const data = await response.json();
      if (Array.isArray(data?.events)) return data.events;
    } catch (error) {
      console.error("Boxing ESPN lookup error:", error);
    }
  }
  return [];
}

function verifiedFallbacks(date) {
  const events = [];

  if (date === "20260912") {
    events.push({
      id: "wtg-boxing-garcia-benn-20260912",
      sport: "Boxing",
      league: "Zuffa Boxing",
      name: "Ryan Garcia vs Conor Benn",
      away: "Ryan Garcia",
      home: "Conor Benn",
      awayTeamId: null,
      homeTeamId: null,
      startTime: "2026-09-13T00:00:00Z",
      status: "Scheduled",
      network: "Paramount+",
      venue: "T-Mobile Arena",
      division: "Welterweight",
      conferences: { away: { id: null, name: null }, home: { id: null, name: null } },
      conferenceIds: [],
      awayRank: null,
      homeRank: null,
      verifiedFallback: true
    });
  }

  return events;
}

function dedupe(games) {
  const seen = new Set();
  return games.filter((game) => {
    const names = [game.away, game.home].map((value) => String(value || "").toLowerCase()).sort().join("|");
    const key = game.id || `${names}|${game.startTime || ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).sort((a, b) => new Date(a.startTime || 0) - new Date(b.startTime || 0));
}

router.get("/", async (req, res, next) => {
  const sportKey = String(req.query.sport || "").toLowerCase().trim();
  if (sportKey !== "boxing") return next();

  const date = normalizeDate(req.query.date);
  const providerKey = String(req.query.provider || "directv").toLowerCase().trim();

  try {
    const espnEvents = await fetchEspn(date);
    const normalized = espnEvents.map(normalizeEvent).filter((event) => event.name || event.startTime);
    const fallback = verifiedFallbacks(date);
    const baseGames = dedupe([...normalized, ...fallback]);
    const games = baseGames.map((game) => resolveGame(game, providerKey));

    return res.json({
      status: "ok",
      sport: "boxing",
      date,
      provider: providerKey,
      count: games.length,
      source: espnEvents.length ? "ESPN + verified fallbacks" : "verified fallbacks",
      games
    });
  } catch (error) {
    console.error("Boxing resolve error:", error);
    return res.status(500).json({ status: "error", sport: "boxing", date, count: 0, games: [] });
  }
});

export default router;
