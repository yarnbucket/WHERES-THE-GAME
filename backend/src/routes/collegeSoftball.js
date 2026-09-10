import express from "express";
import { resolveGame } from "../logic/resolver.js";

const router = express.Router();

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
    ...(b?.names ?? []), b?.name, b?.shortName, b?.displayName, b?.callLetters,
    b?.media?.name, b?.media?.shortName, b?.media?.displayName, b?.media?.callLetters,
    b?.network?.name, b?.network?.shortName, b?.network?.displayName, b?.network?.callLetters
  ])).join(", ");
}

function conferenceTag(competitor) {
  const id = competitor?.team?.conferenceId ?? competitor?.conferenceId ?? null;
  const name = competitor?.team?.conference?.name ?? competitor?.conference?.name ?? competitor?.team?.conferenceName ?? null;
  return { id: id == null ? null : String(id), name: name || null };
}

function normalizeEvent(event) {
  const competition = event?.competitions?.[0];
  const competitors = competition?.competitors ?? [];
  const home = competitors.find((c) => c?.homeAway === "home") ?? competitors[1];
  const away = competitors.find((c) => c?.homeAway === "away") ?? competitors[0];
  const awayConference = conferenceTag(away);
  const homeConference = conferenceTag(home);

  return {
    id: event?.id ?? null,
    sport: "College Softball",
    league: "NCAA Softball",
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
    conferences: { away: awayConference, home: homeConference },
    conferenceIds: [...new Set([awayConference.id, homeConference.id].filter(Boolean))],
    awayRank: away?.curatedRank?.current ?? away?.rank ?? away?.team?.rank ?? null,
    homeRank: home?.curatedRank?.current ?? home?.rank ?? home?.team?.rank ?? null
  };
}

async function fetchScoreboard(date) {
  const url = `https://site.api.espn.com/apis/site/v2/sports/baseball/college-softball/scoreboard?dates=${date}&limit=500`;
  const response = await fetch(url, {
    headers: { accept: "application/json", "user-agent": "WTG/0.1H8w" }
  });
  if (!response.ok) throw new Error(`ESPN college softball request failed: ${response.status}`);
  return response.json();
}

router.get("/", async (req, res, next) => {
  const sportKey = String(req.query.sport ?? "").toLowerCase().trim();
  if (sportKey !== "softball") return next();

  const date = normalizeDate(req.query.date);
  const providerKey = String(req.query.provider ?? "directv").toLowerCase().trim();

  try {
    const data = await fetchScoreboard(date);
    const games = (data?.events ?? []).map(normalizeEvent);

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
      sport: "softball",
      league: "NCAA Softball",
      date,
      provider: providerKey,
      count: resolved.length,
      games: resolved
    });
  } catch (error) {
    console.error("College Softball resolver error:", error);
    return res.status(500).json({ status: "error", message: "Could not resolve college softball events" });
  }
});

export default router;
