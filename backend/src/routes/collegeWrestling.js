import express from "express";
import { resolveGame } from "../logic/resolver.js";

const router = express.Router();

// ESPN's wrestling catalog is less uniform than its major-sport scoreboards.
// Keep candidates isolated so a missing feed cannot suppress the other gender.
const FEEDS = [
  { sport: "wrestling", league: "college-wrestling", label: "NCAA Men's Wrestling", gender: "men" },
  { sport: "wrestling", league: "ncaa-wrestling", label: "NCAA Men's Wrestling", gender: "men" },
  { sport: "wrestling", league: "womens-college-wrestling", label: "NCAA Women's Wrestling", gender: "women" }
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

function sourceNames(items = []) {
  return items.flatMap((item) => [
    ...(item?.names ?? []), item?.name, item?.shortName, item?.displayName, item?.callLetters,
    item?.media?.name, item?.media?.shortName, item?.media?.displayName, item?.media?.callLetters,
    item?.network?.name, item?.network?.shortName, item?.network?.displayName, item?.network?.callLetters
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

function conferenceTag(competitor) {
  const id = competitor?.team?.conferenceId ?? competitor?.conferenceId ?? null;
  const name = competitor?.team?.conference?.name ?? competitor?.conference?.name ?? competitor?.team?.conferenceName ?? null;
  return { id: id == null ? null : String(id), name: name || null };
}

function competitorName(item, fallback) {
  return item?.team?.displayName ?? item?.team?.shortDisplayName ?? item?.team?.name ?? item?.displayName ?? item?.name ?? fallback;
}

export function normalizeWrestlingEvent(event, feed) {
  const competition = event?.competitions?.[0] ?? null;
  const competitors = competition?.competitors ?? [];
  const home = competitors.find((item) => item?.homeAway === "home") ?? competitors[0] ?? null;
  const away = competitors.find((item) => item?.homeAway === "away") ?? competitors[1] ?? null;
  const homeConference = conferenceTag(home);
  const awayConference = conferenceTag(away);

  return {
    id: event?.id ?? competition?.id ?? null,
    sport: "College Wrestling",
    league: feed.label,
    gender: feed.gender,
    name: event?.name ?? event?.shortName ?? competition?.name ?? null,
    away: competitorName(away, "Away"),
    home: competitorName(home, "Home"),
    awayTeamId: away?.team?.id != null ? String(away.team.id) : null,
    homeTeamId: home?.team?.id != null ? String(home.team.id) : null,
    startTime: event?.date ?? competition?.date ?? null,
    status: event?.status?.type?.description ?? competition?.status?.type?.description ?? null,
    network: broadcastNames(competition, event),
    venue: competition?.venue?.fullName ?? event?.venue?.fullName ?? null,
    division: event?.division ?? competition?.division ?? "NCAA",
    conferences: { away: awayConference, home: homeConference },
    conferenceIds: unique([awayConference.id, homeConference.id]),
    awayRank: away?.curatedRank?.current ?? away?.rank ?? away?.team?.rank ?? null,
    homeRank: home?.curatedRank?.current ?? home?.rank ?? home?.team?.rank ?? null
  };
}

export function televisedWrestlingGames(games) {
  const seen = new Set();
  return games.filter((game) => {
    if (!String(game?.network || "").trim()) return false;
    const teams = [game.away, game.home].map((value) => String(value || "").toLowerCase()).sort().join("|");
    const key = `${game.gender}|${teams}|${String(game.startTime || "").slice(0, 10)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).sort((a, b) => new Date(a.startTime || 0) - new Date(b.startTime || 0));
}

async function fetchFeed(feed, date) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4500);
  try {
    const url = `https://site.api.espn.com/apis/site/v2/sports/${feed.sport}/${feed.league}/scoreboard?dates=${date}&limit=500`;
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { accept: "application/json", "user-agent": "WTG/college-wrestling-1.0" }
    });
    if (!response.ok) throw new Error(`${feed.league} HTTP ${response.status}`);
    return response.json();
  } finally {
    clearTimeout(timer);
  }
}

router.get("/", async (req, res, next) => {
  if (String(req.query.sport || "").toLowerCase().trim() !== "wrestling") return next();

  const date = normalizeDate(req.query.date);
  const providerKey = String(req.query.provider || "directv").toLowerCase().trim();
  const results = await Promise.allSettled(FEEDS.map(async (feed) => {
    const data = await fetchFeed(feed, date);
    return (data?.events ?? []).map((event) => normalizeWrestlingEvent(event, feed));
  }));
  const failedFeeds = results.map((result, index) => result.status === "rejected" ? FEEDS[index].league : null).filter(Boolean);
  const normalized = results.filter((result) => result.status === "fulfilled").flatMap((result) => result.value);
  const games = televisedWrestlingGames(normalized).map((game) => resolveGame(game, providerKey));

  return res.json({
    status: "ok",
    sport: "wrestling",
    code: "college-wrestling-tv",
    date,
    provider: providerKey,
    scope: "televised-and-streamed",
    count: games.length,
    feeds: FEEDS.map(({ league, label, gender }) => ({ league, label, gender })),
    failedFeeds,
    sourceUrl: "https://www.espn.com/watch/catalog/30f2f3fd-cdcd-30ef-8c0f-063ac28d5661/ncaa-wrestling",
    games
  });
});

export default router;
