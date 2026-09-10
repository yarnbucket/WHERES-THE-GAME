import express from "express";
import { resolveGame } from "../logic/resolver.js";

const router = express.Router();

const LEAGUES = [
  { league: "fivb.w", label: "FIVB Women" },
  { league: "fivb.m", label: "FIVB Men" }
];

function normalizeDate(value) {
  if (!value) return new Date().toISOString().slice(0, 10).replaceAll("-", "");
  return String(value).replaceAll("-", "").trim();
}

function unique(values) {
  return [...new Set(values.map((v) => String(v || "").trim()).filter(Boolean))];
}

function broadcastNames(competition, event) {
  const broadcasts = [
    ...(competition?.broadcasts ?? []),
    ...(event?.broadcasts ?? [])
  ];
  return unique(broadcasts.flatMap((b) => [
    ...(b?.names ?? []), b?.name, b?.shortName, b?.displayName,
    b?.media?.name, b?.media?.shortName, b?.media?.displayName,
    b?.network?.name, b?.network?.shortName, b?.network?.displayName
  ])).join(", ");
}

function normalizeEvent(event, leagueLabel) {
  const competition = event?.competitions?.[0];
  const competitors = competition?.competitors ?? [];
  const home = competitors.find((c) => c?.homeAway === "home") ?? competitors[1];
  const away = competitors.find((c) => c?.homeAway === "away") ?? competitors[0];
  return {
    id: event?.id ?? null,
    sport: "Volleyball",
    league: leagueLabel,
    name: event?.name ?? competition?.name ?? null,
    away: away?.team?.displayName ?? away?.team?.shortDisplayName ?? "Away",
    home: home?.team?.displayName ?? home?.team?.shortDisplayName ?? "Home",
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

async function fetchLeague(league, date) {
  const url = `https://site.api.espn.com/apis/site/v2/sports/volleyball/${league}/scoreboard?dates=${date}&limit=500`;
  const response = await fetch(url, {
    headers: { accept: "application/json", "user-agent": "WTG/0.1H8v" }
  });
  if (!response.ok) throw new Error(`ESPN volleyball ${league} request failed: ${response.status}`);
  return response.json();
}

router.get("/", async (req, res, next) => {
  const sportKey = String(req.query.sport ?? "").toLowerCase().trim();
  if (sportKey !== "volleyball") return next();

  const date = normalizeDate(req.query.date);
  const providerKey = String(req.query.provider ?? "directv").toLowerCase().trim();

  try {
    const results = await Promise.allSettled(LEAGUES.map(async ({ league, label }) => {
      const data = await fetchLeague(league, date);
      return (data?.events ?? []).map((event) => normalizeEvent(event, label));
    }));

    const games = [];
    const failedLeagues = [];
    for (let i = 0; i < results.length; i += 1) {
      const result = results[i];
      if (result.status === "fulfilled") games.push(...result.value);
      else failedLeagues.push(LEAGUES[i].label);
    }

    const deduped = new Map();
    for (const game of games) {
      const key = game.id ?? `${game.away}|${game.home}|${game.startTime}`;
      if (!deduped.has(key)) deduped.set(key, game);
    }

    const resolved = [...deduped.values()]
      .sort((a, b) => new Date(a.startTime ?? 0) - new Date(b.startTime ?? 0))
      .map((game) => resolveGame(game, providerKey));

    return res.json({
      status: "ok",
      sport: "volleyball",
      date,
      provider: providerKey,
      leagues: LEAGUES.map((l) => l.label),
      failedLeagues,
      count: resolved.length,
      games: resolved
    });
  } catch (error) {
    console.error("Volleyball resolver error:", error);
    return res.status(500).json({ status: "error", message: "Could not resolve volleyball events" });
  }
});

export default router;
