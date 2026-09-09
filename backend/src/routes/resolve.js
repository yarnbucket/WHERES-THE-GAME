import express from "express";
import { resolveEvent } from "../logic/resolver.js";
import { lookupDirectvGame } from "../logic/directvGuide.js";

const router = express.Router();

const SPORTS = {
  nfl: { sport: "football", league: "nfl", label: "NFL" },
  ncaaf: { sport: "football", league: "college-football", label: "NCAA Football" },
  otherfootball: {
    sport: "football",
    label: "Other Football",
    leagues: [
      { league: "cfl", label: "CFL" },
      { league: "ufl", label: "UFL" }
    ]
  },
  mlb: { sport: "baseball", league: "mlb", label: "MLB" },
  nhl: { sport: "hockey", league: "nhl", label: "NHL" },
  collegehockey: { sport: "hockey", league: "mens-college-hockey", label: "College Hockey" },
  nba: { sport: "basketball", league: "nba", label: "NBA" },
  ncaab: { sport: "basketball", league: "mens-college-basketball", label: "NCAA Basketball" },
  ncaaw: { sport: "basketball", league: "womens-college-basketball", label: "NCAA Women's Basketball" }
};

function yyyymmdd(date) {
  return String(date || "").replace(/-/g, "");
}

async function fetchScoreboard(sport, league, date) {
  const url = `https://site.api.espn.com/apis/site/v2/sports/${sport}/${league}/scoreboard?dates=${yyyymmdd(date)}`;
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0",
      Accept: "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(`ESPN scoreboard ${response.status}`);
  }

  return response.json();
}

function normalizeEvent(event, sportKey, config) {
  const competition = event?.competitions?.[0] || {};
  const competitors = competition?.competitors || [];
  const away = competitors.find((team) => team.homeAway === "away") || competitors[0] || {};
  const home = competitors.find((team) => team.homeAway === "home") || competitors[1] || {};
  const broadcasts = competition?.broadcasts || [];
  const broadcastNames = broadcasts.flatMap((b) => b?.names || []).filter(Boolean);
  const network = broadcastNames[0] || competition?.geoBroadcasts?.[0]?.media?.shortName || "";

  return {
    id: event?.id,
    sport: sportKey,
    league: config.league,
    leagueLabel: config.label,
    name: event?.name || `${away?.team?.displayName || "Away"} at ${home?.team?.displayName || "Home"}`,
    shortName: event?.shortName || "",
    away: away?.team?.displayName || away?.team?.shortDisplayName || "Away",
    home: home?.team?.displayName || home?.team?.shortDisplayName || "Home",
    awayAbbr: away?.team?.abbreviation || "",
    homeAbbr: home?.team?.abbreviation || "",
    awayId: away?.team?.id || "",
    homeId: home?.team?.id || "",
    awayLogo: away?.team?.logo || "",
    homeLogo: home?.team?.logo || "",
    startTime: event?.date || competition?.date || "",
    status: event?.status?.type?.name || event?.status?.type?.description || "",
    statusDetail: event?.status?.type?.detail || "",
    completed: Boolean(event?.status?.type?.completed),
    network,
    broadcasts: broadcastNames,
    venue: competition?.venue?.fullName || "",
    city: competition?.venue?.address?.city || "",
    state: competition?.venue?.address?.state || "",
    directvGuide: []
  };
}

router.get("/", async (req, res) => {
  try {
    const sportKey = String(req.query.sport || "nfl").toLowerCase();
    const date = String(req.query.date || new Date().toISOString().slice(0, 10));
    const provider = String(req.query.provider || "directv").toLowerCase();
    const config = SPORTS[sportKey];

    if (!config) {
      return res.status(400).json({ error: `Unsupported sport: ${sportKey}` });
    }

    const leagueConfigs = config.leagues || [config];
    const events = [];

    for (const leagueConfig of leagueConfigs) {
      const data = await fetchScoreboard(config.sport, leagueConfig.league, date);
      for (const event of data?.events || []) {
        const normalized = normalizeEvent(event, sportKey, leagueConfig);

        if (sportKey === "mlb" && provider === "directv") {
          try {
            normalized.directvGuide = await lookupDirectvGame({
              date,
              away: normalized.away,
              home: normalized.home
            });
          } catch (error) {
            console.warn("DIRECTV guide lookup failed:", error?.message || error);
          }
        }

        events.push(resolveEvent(normalized, { provider }));
      }
    }

    res.json({ sport: sportKey, date, count: events.length, events });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error?.message || "Failed to resolve games" });
  }
});

export default router;
