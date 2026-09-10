import express from "express";
import { resolveGame } from "../logic/resolver.js";

const router = express.Router();

const LEAGUES = [
  { league: "atp", label: "ATP" },
  { league: "wta", label: "WTA" }
];

// Official late-round US Open session schedule. ESPN's Tennis scoreboard is
// tournament-centric and can leave future bracket slots incomplete or stamped
// at midnight. We keep real matchups when ESPN supplies them and synthesize a
// coverage card only when an official televised/streamed session would
// otherwise disappear from WTG.
const US_OPEN_DAY_RULES = {
  "20260911": [
    {
      league: "WTA",
      terms: ["doubles", "final"],
      slots: [{ time: "12:00", title: "Women's Doubles Championship", networks: ["ESPN2"] }]
    },
    {
      league: "ATP",
      terms: ["singles", "semi"],
      slots: [
        { time: "15:00", title: "Men's Singles Semifinal #1", networks: ["ESPN", "ESPN Deportes"] },
        { time: "19:00", title: "Men's Singles Semifinal #2", networks: ["ESPN", "ESPN Deportes"] }
      ]
    }
  ],
  "20260912": [
    {
      league: "ATP",
      terms: ["doubles", "final"],
      slots: [{ time: "12:00", title: "Men's Doubles Championship", networks: ["ESPN App"] }]
    },
    {
      league: "WTA",
      terms: ["singles", "final"],
      slots: [{ time: "16:00", title: "Women's Singles Championship", networks: ["ESPN", "ESPN Deportes"] }]
    }
  ],
  "20260913": [
    {
      league: "ATP",
      terms: ["singles", "final"],
      slots: [{ time: "14:00", title: "Men's Singles Championship", networks: ["ABC", "ESPN Deportes"] }]
    }
  ]
};

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

function easternTimeParts(value) {
  const date = new Date(value || 0);
  if (!Number.isFinite(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour12: false,
    hour: "2-digit",
    minute: "2-digit"
  }).formatToParts(date);
  const get = (type) => parts.find((part) => part.type === type)?.value || "";
  return { hour: Number(get("hour")), minute: Number(get("minute")) };
}

function isMidnightPlaceholder(value) {
  const parts = easternTimeParts(value);
  return Boolean(parts && (parts.hour === 0 || parts.hour === 24) && parts.minute === 0);
}

function easternIso(dateKey, hhmm) {
  const year = Number(dateKey.slice(0, 4));
  const month = Number(dateKey.slice(4, 6));
  const day = Number(dateKey.slice(6, 8));
  const [hour, minute] = hhmm.split(":").map(Number);
  // September US Open dates are EDT (UTC-4).
  return new Date(Date.UTC(year, month - 1, day, hour + 4, minute, 0)).toISOString();
}

function unique(values) {
  return [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))];
}

function broadcastNames(competition, event = null) {
  return unique([
    ...(competition?.broadcasts ?? []).flatMap((item) => [
      ...(item?.names ?? []),
      item?.name,
      item?.shortName,
      item?.displayName,
      item?.media?.name,
      item?.media?.shortName,
      item?.media?.displayName,
      item?.network?.name,
      item?.network?.shortName,
      item?.network?.displayName
    ]),
    ...(competition?.geoBroadcasts ?? []).flatMap((item) => [
      item?.media?.shortName,
      item?.media?.name,
      item?.media?.displayName,
      item?.network?.shortName,
      item?.network?.name,
      item?.network?.displayName
    ]),
    ...(event?.broadcasts ?? []).flatMap((item) => [
      ...(item?.names ?? []),
      item?.name,
      item?.shortName,
      item?.displayName,
      item?.media?.name,
      item?.media?.shortName,
      item?.media?.displayName
    ]),
    competition?.broadcast,
    competition?.network,
    event?.broadcast,
    event?.network
  ]);
}

function competitorName(competitor) {
  return competitor?.athlete?.displayName ||
    competitor?.athlete?.fullName ||
    competitor?.team?.displayName ||
    competitor?.displayName ||
    "TBD";
}

function matchMetadataText(event, grouping, competition) {
  return unique([
    event?.name,
    event?.shortName,
    grouping?.grouping?.displayName,
    grouping?.grouping?.name,
    grouping?.displayName,
    competition?.name,
    competition?.shortName,
    competition?.round?.displayName,
    competition?.round?.name,
    competition?.type?.text,
    competition?.type?.name,
    competition?.notes?.[0]?.headline
  ]).join(" ").toLowerCase();
}

function getUsOpenRule(date, leagueLabel, event, grouping, competition) {
  const tournament = `${event?.name || ""} ${event?.shortName || ""}`.toLowerCase();
  if (!tournament.includes("us open")) return null;
  const text = matchMetadataText(event, grouping, competition);
  const rules = US_OPEN_DAY_RULES[date] || [];
  return rules.find((rule) =>
    rule.league === leagueLabel &&
    rule.terms.every((term) => text.includes(term))
  ) || null;
}

function completeCompetitors(competition) {
  const competitors = competition?.competitors ?? [];
  if (competitors.length < 2) return false;
  const names = competitors.slice(0, 2).map(competitorName);
  return names.every((name) => name && name.toUpperCase() !== "TBD");
}

function normalizeMatch(event, grouping, competition, leagueLabel, selectedDate, slot = null) {
  const competitors = competition?.competitors ?? [];
  const home = competitors.find((item) => item.homeAway === "home") || competitors[0];
  const away = competitors.find((item) => item.homeAway === "away") || competitors[1];
  const round = competition?.round?.displayName || grouping?.grouping?.displayName || grouping?.displayName || slot?.title || "Match";
  const tournament = event?.name || event?.shortName || "Tennis";
  const espnStart = competition?.date || competition?.startDate || event?.date || null;
  const names = broadcastNames(competition, event);

  let startTime = espnStart;
  if (slot && (!startTime || isMidnightPlaceholder(startTime))) {
    startTime = easternIso(selectedDate, slot.time);
  }

  const networks = names.length ? names : (slot?.networks || []);

  return {
    id: competition?.id || `${event?.id || tournament}-${round}-${startTime || ""}`,
    sport: "Tennis",
    league: leagueLabel,
    name: `${tournament} — ${round}`,
    away: competitorName(away),
    home: competitorName(home),
    awayTeamId: away?.id != null ? String(away.id) : away?.athlete?.id != null ? String(away.athlete.id) : null,
    homeTeamId: home?.id != null ? String(home.id) : home?.athlete?.id != null ? String(home.athlete.id) : null,
    startTime,
    status: competition?.status?.type?.description || competition?.status?.type?.detail || null,
    network: unique(networks).join(", "),
    venue: competition?.venue?.fullName || event?.venue?.fullName || null,
    division: null,
    conferences: { away: { id: null, name: null }, home: { id: null, name: null } },
    conferenceIds: [],
    awayRank: null,
    homeRank: null,
    tournament,
    round,
    matchType: grouping?.grouping?.displayName || grouping?.displayName || competition?.type?.text || null
  };
}

function coverageFallback(date, rule, slot, index) {
  return {
    id: `us-open-${date}-${rule.league}-${rule.terms.join("-")}-${index}`,
    sport: "Tennis",
    league: rule.league,
    name: `US Open — ${slot.title}`,
    away: "US Open",
    home: slot.title,
    awayTeamId: null,
    homeTeamId: null,
    startTime: easternIso(date, slot.time),
    status: "Scheduled",
    network: unique(slot.networks).join(", "),
    venue: "USTA Billie Jean King National Tennis Center",
    division: null,
    conferences: { away: { id: null, name: null }, home: { id: null, name: null } },
    conferenceIds: [],
    awayRank: null,
    homeRank: null,
    tournament: "US Open",
    round: slot.title,
    matchType: slot.title,
    isCoveragePlaceholder: true
  };
}

async function fetchLeague(league, date) {
  const url = `https://site.api.espn.com/apis/site/v2/sports/tennis/${league}/scoreboard?dates=${date}`;
  const response = await fetch(url, {
    headers: { accept: "application/json", "user-agent": "WTG/0.1H8o" }
  });
  if (!response.ok) throw new Error(`ESPN Tennis ${league} request failed: ${response.status}`);
  return response.json();
}

function matchesForDate(data, date, leagueLabel) {
  const ordinary = [];
  const usOpenByRule = new Map();
  const dayRules = (US_OPEN_DAY_RULES[date] || []).filter((rule) => rule.league === leagueLabel);

  for (const rule of dayRules) {
    const key = `${rule.league}|${rule.terms.join("|")}`;
    usOpenByRule.set(key, { rule, items: [] });
  }

  for (const event of data?.events ?? []) {
    const isUsOpen = `${event?.name || ""} ${event?.shortName || ""}`.toLowerCase().includes("us open");

    for (const grouping of event?.groupings ?? []) {
      for (const competition of grouping?.competitions ?? []) {
        const rawDate = competition?.date || competition?.startDate || event?.date;
        if (easternDateKey(rawDate) !== date) continue;

        if (isUsOpen && dayRules.length) {
          const rule = getUsOpenRule(date, leagueLabel, event, grouping, competition);
          if (!rule) continue;
          if (completeCompetitors(competition)) {
            const key = `${rule.league}|${rule.terms.join("|")}`;
            usOpenByRule.get(key)?.items.push({ event, grouping, competition });
          }
          continue;
        }

        // Outside official late-round US Open fallbacks, do not render
        // half-built bracket cards such as "player vs TBD".
        if (!completeCompetitors(competition)) continue;
        ordinary.push(normalizeMatch(event, grouping, competition, leagueLabel, date));
      }
    }
  }

  for (const { rule, items } of usOpenByRule.values()) {
    // Preserve ESPN match order and attach each complete matchup to its
    // official session slot. If ESPN has not populated that bracket slot yet,
    // keep the official viewing session visible as a coverage card.
    rule.slots.forEach((slot, index) => {
      const item = items[index];
      if (item) ordinary.push(normalizeMatch(item.event, item.grouping, item.competition, leagueLabel, date, slot));
      else ordinary.push(coverageFallback(date, rule, slot, index));
    });
  }

  return ordinary;
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
