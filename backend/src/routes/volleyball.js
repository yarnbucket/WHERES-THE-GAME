import express from "express";
import { resolveGame } from "../logic/resolver.js";

const router = express.Router();

const LEAGUES = [
  { league: "fivb.w", label: "FIVB Women" },
  { league: "fivb.m", label: "FIVB Men" }
];

// ESPN currently exposes the broad FIVB men's/women's feeds, but some
// NORCECA competitions do not appear there. Keep a small official-schedule
// fallback for verified NORCECA events so WTG does not silently show an
// empty Volleyball tab when those competitions are active.
// Times below are local to Leon, Guanajuato (Central Time in Sep 2026 = UTC-6).
const NORCECA_FALLBACKS = {
  "20260911": [
    ["Puerto Rico", "Venezuela", "20:00:00Z"],
    ["Dominican Republic", "Nicaragua", "22:00:00Z"],
    ["United States", "Cuba", "2026-09-12T00:00:00Z"],
    ["Mexico", "Costa Rica", "2026-09-12T02:00:00Z"]
  ],
  "20260912": [
    ["Dominican Republic", "Venezuela", "20:00:00Z"],
    ["Canada", "Puerto Rico", "22:00:00Z"],
    ["Cuba", "Guatemala", "2026-09-13T00:00:00Z"],
    ["United States", "Mexico", "2026-09-13T02:00:00Z"]
  ],
  "20260913": [
    ["Venezuela", "Nicaragua", "20:00:00Z"],
    ["United States", "Costa Rica", "22:00:00Z"],
    ["Dominican Republic", "Canada", "2026-09-14T00:00:00Z"],
    ["Mexico", "Guatemala", "2026-09-14T02:00:00Z"]
  ],
  "20260914": [
    ["Puerto Rico", "Nicaragua", "20:00:00Z"],
    ["Costa Rica", "Guatemala", "22:00:00Z"],
    ["Canada", "Venezuela", "2026-09-15T00:00:00Z"],
    ["Mexico", "Cuba", "2026-09-15T02:00:00Z"]
  ],
  "20260915": [
    ["United States", "Guatemala", "20:00:00Z"],
    ["Cuba", "Costa Rica", "22:00:00Z"],
    ["Canada", "Nicaragua", "2026-09-16T00:00:00Z"],
    ["Dominican Republic", "Puerto Rico", "2026-09-16T02:00:00Z"]
  ]
};

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

function norcecaFallbackGames(date) {
  return (NORCECA_FALLBACKS[date] ?? []).map(([away, home, time], index) => {
    const startTime = time.includes("T") ? time : `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}T${time}`;
    return {
      id: `norceca-wpac-2026-${date}-${index + 1}`,
      sport: "Volleyball",
      league: "NORCECA Women's Pan American Cup",
      name: `${away} vs. ${home}`,
      away,
      home,
      awayTeamId: null,
      homeTeamId: null,
      startTime,
      status: "Scheduled",
      network: "",
      venue: "Domo de la Feria, Leon, Guanajuato, Mexico",
      division: null,
      conferences: { away: { id: null, name: null }, home: { id: null, name: null } },
      conferenceIds: [],
      awayRank: null,
      homeRank: null
    };
  });
}

async function fetchLeague(league, date) {
  const url = `https://site.api.espn.com/apis/site/v2/sports/volleyball/${league}/scoreboard?dates=${date}&limit=500`;
  const response = await fetch(url, {
    headers: { accept: "application/json", "user-agent": "WTG/0.1H8w" }
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

    const games = [...norcecaFallbackGames(date)];
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
      leagues: [...LEAGUES.map((l) => l.label), "NORCECA official schedule fallback"],
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
