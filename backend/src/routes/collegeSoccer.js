import express from "express";
import { resolveGame } from "../logic/resolver.js";

const router = express.Router();

const LEAGUES = [
  { league: "usa.ncaa.m.1", label: "NCAA Men's Soccer", gender: "men" },
  { league: "usa.ncaa.w.1", label: "NCAA Women's Soccer", gender: "women" }
];

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

function conferenceTag(competitor) {
  const id = competitor?.team?.conferenceId ?? competitor?.conferenceId ?? null;
  const name = competitor?.team?.conference?.name ?? competitor?.conference?.name ?? competitor?.team?.conferenceName ?? null;
  return { id: id == null ? null : String(id), name: name || null };
}

function normalizeEvent(event, leagueConfig) {
  const competition = event?.competitions?.[0];
  const competitors = competition?.competitors ?? [];
  const home = competitors.find((item) => item?.homeAway === "home") || competitors[0];
  const away = competitors.find((item) => item?.homeAway === "away") || competitors[1];
  const homeConference = conferenceTag(home);
  const awayConference = conferenceTag(away);

  return {
    id: event?.id ?? competition?.id ?? null,
    sport: "College Soccer",
    league: leagueConfig.label,
    gender: leagueConfig.gender,
    name: event?.name ?? competition?.name ?? null,
    away: away?.team?.displayName ?? away?.team?.shortDisplayName ?? "Away",
    home: home?.team?.displayName ?? home?.team?.shortDisplayName ?? "Home",
    awayTeamId: away?.team?.id != null ? String(away.team.id) : null,
    homeTeamId: home?.team?.id != null ? String(home.team.id) : null,
    startTime: event?.date ?? competition?.date ?? null,
    status: event?.status?.type?.description ?? competition?.status?.type?.description ?? null,
    network: broadcastNames(competition, event),
    venue: competition?.venue?.fullName ?? null,
    division: "NCAA",
    conferences: { away: awayConference, home: homeConference },
    conferenceIds: [...new Set([awayConference.id, homeConference.id].filter(Boolean))],
    awayRank: away?.curatedRank?.current ?? away?.rank ?? away?.team?.rank ?? null,
    homeRank: home?.curatedRank?.current ?? home?.rank ?? home?.team?.rank ?? null
  };
}

async function fetchLeague(league, date) {
  const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/${league}/scoreboard?dates=${date}&limit=500`;
  const response = await fetch(url, {
    headers: { accept: "application/json", "user-agent": "WTG/0.1H8p" }
  });
  if (!response.ok) throw new Error(`ESPN College Soccer ${league} request failed: ${response.status}`);
  return response.json();
}

function dedupe(games) {
  const seen = new Set();
  return games.filter((game) => {
    const key = String(game.id || `${game.league}|${game.away}|${game.home}|${game.startTime}`);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).sort((a, b) => new Date(a.startTime || 0) - new Date(b.startTime || 0));
}

router.get("/", async (req, res, next) => {
  const sportKey = String(req.query.sport || "").toLowerCase().trim();
  if (sportKey !== "collegesoccer") return next();

  const date = normalizeDate(req.query.date);
  const providerKey = String(req.query.provider || "directv").toLowerCase().trim();

  try {
    const results = await Promise.allSettled(
      LEAGUES.map(async (leagueConfig) => {
        const data = await fetchLeague(leagueConfig.league, date);
        return (data?.events ?? []).map((event) => normalizeEvent(event, leagueConfig));
      })
    );

    const failedLeagues = results
      .map((result, index) => result.status === "rejected" ? LEAGUES[index].label : null)
      .filter(Boolean);

    const baseGames = dedupe(
      results.filter((result) => result.status === "fulfilled").flatMap((result) => result.value)
    );
    const games = baseGames.map((game) => resolveGame(game, providerKey));

    return res.json({
      status: "ok",
      sport: "collegesoccer",
      date,
      provider: providerKey,
      count: games.length,
      leagues: LEAGUES.map((item) => item.label),
      failedLeagues,
      games
    });
  } catch (error) {
    console.error("College Soccer resolve error:", error);
    return res.status(500).json({ status: "error", sport: "collegesoccer", date, count: 0, games: [] });
  }
});

export default router;
