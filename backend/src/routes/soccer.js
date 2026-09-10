import express from "express";
import { resolveGame } from "../logic/resolver.js";

const router = express.Router();

const LEAGUES = [
  { league: "usa.1", label: "MLS" },
  { league: "usa.nwsl", label: "NWSL" },
  { league: "eng.1", label: "Premier League" },
  { league: "eng.2", label: "EFL Championship" },
  { league: "eng.fa", label: "FA Cup" },
  { league: "eng.league_cup", label: "EFL Cup" },
  { league: "esp.1", label: "LaLiga" },
  { league: "esp.copa_del_rey", label: "Copa del Rey" },
  { league: "ger.1", label: "Bundesliga" },
  { league: "ger.dfb_pokal", label: "DFB-Pokal" },
  { league: "ita.1", label: "Serie A" },
  { league: "ita.coppa_italia", label: "Coppa Italia" },
  { league: "fra.1", label: "Ligue 1" },
  { league: "ned.1", label: "Eredivisie" },
  { league: "por.1", label: "Primeira Liga" },
  { league: "sco.1", label: "Scottish Premiership" },
  { league: "mex.1", label: "Liga MX" },
  { league: "uefa.champions", label: "UEFA Champions League" },
  { league: "uefa.europa", label: "UEFA Europa League" },
  { league: "uefa.europa.conf", label: "UEFA Conference League" },
  { league: "concacaf.champions", label: "Concacaf Champions Cup" },
  { league: "fifa.world", label: "FIFA World Cup" },
  { league: "fifa.wwc", label: "FIFA Women's World Cup" },
  { league: "fifa.friendly", label: "International Friendlies" },
  { league: "uefa.nations", label: "UEFA Nations League" },
  { league: "uefa.euro", label: "UEFA European Championship" },
  { league: "bra.1", label: "Brazil Serie A" },
  { league: "arg.1", label: "Argentina Liga Profesional" }
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

function normalizeEvent(event, leagueLabel) {
  const competition = event?.competitions?.[0];
  const competitors = competition?.competitors ?? [];
  const home = competitors.find((item) => item?.homeAway === "home") || competitors[0];
  const away = competitors.find((item) => item?.homeAway === "away") || competitors[1];

  return {
    id: event?.id ?? competition?.id ?? null,
    sport: "Soccer",
    league: leagueLabel,
    name: event?.name ?? competition?.name ?? null,
    away: away?.team?.displayName ?? away?.team?.shortDisplayName ?? "Away",
    home: home?.team?.displayName ?? home?.team?.shortDisplayName ?? "Home",
    awayTeamId: away?.team?.id != null ? String(away.team.id) : null,
    homeTeamId: home?.team?.id != null ? String(home.team.id) : null,
    startTime: event?.date ?? competition?.date ?? null,
    status: event?.status?.type?.description ?? competition?.status?.type?.description ?? null,
    network: broadcastNames(competition, event),
    venue: competition?.venue?.fullName ?? null,
    division: null,
    conferences: { away: { id: null, name: null }, home: { id: null, name: null } },
    conferenceIds: [],
    awayRank: null,
    homeRank: null
  };
}

async function fetchLeague(league, date) {
  const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/${league}/scoreboard?dates=${date}&limit=500`;
  const response = await fetch(url, { headers: { accept: "application/json", "user-agent": "WTG/0.1H8o" } });
  if (!response.ok) throw new Error(`ESPN Soccer ${league} request failed: ${response.status}`);
  return response.json();
}

function dedupe(games) {
  const seen = new Set();
  return games.filter((game) => {
    const teams = [game.away, game.home].map((value) => String(value || "").toLowerCase()).sort().join("|");
    const key = game.id || `${teams}|${game.startTime || ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).sort((a, b) => new Date(a.startTime || 0) - new Date(b.startTime || 0));
}

router.get("/", async (req, res, next) => {
  const sportKey = String(req.query.sport || "").toLowerCase().trim();
  if (sportKey !== "soccer") return next();

  const date = normalizeDate(req.query.date);
  const providerKey = String(req.query.provider || "directv").toLowerCase().trim();

  try {
    const results = await Promise.allSettled(
      LEAGUES.map(async ({ league, label }) => {
        const data = await fetchLeague(league, date);
        return (data?.events ?? []).map((event) => normalizeEvent(event, label));
      })
    );

    const failedLeagues = results
      .map((result, index) => result.status === "rejected" ? LEAGUES[index].label : null)
      .filter(Boolean);

    const baseGames = dedupe(results.filter((result) => result.status === "fulfilled").flatMap((result) => result.value));
    const games = baseGames.map((game) => resolveGame(game, providerKey));

    return res.json({
      status: "ok",
      sport: "soccer",
      date,
      provider: providerKey,
      count: games.length,
      leagues: LEAGUES.map((item) => item.label),
      failedLeagues,
      games
    });
  } catch (error) {
    console.error("Soccer resolve error:", error);
    return res.status(500).json({ status: "error", sport: "soccer", date, count: 0, games: [] });
  }
});

export default router;
