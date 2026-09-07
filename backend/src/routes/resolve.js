import express from "express";

import { resolveGame } from "../logic/resolver.js";
import { lookupDirectvGame } from "../logic/directvGuide.js";

const router = express.Router();

const SPORTS = {
  nfl: { sport: "football", league: "nfl", label: "NFL" },
  ncaaf: { sport: "football", league: "college-football", label: "NCAA Football" },
  mlb: { sport: "baseball", league: "mlb", label: "MLB" },
  nhl: { sport: "hockey", league: "nhl", label: "NHL" },
  nba: { sport: "basketball", league: "nba", label: "NBA" },
  ncaab: { sport: "basketball", league: "mens-college-basketball", label: "NCAA Basketball" },
  wnba: { sport: "basketball", league: "wnba", label: "WNBA" }
};

const NCAA_GROUPS = [
  { id: "80", division: "FBS" },
  { id: "81", division: "FCS" }
];

function normalizeDate(value) {
  if (!value) {
    return new Date()
      .toISOString()
      .slice(0, 10)
      .replaceAll("-", "");
  }

  return String(value)
    .replaceAll("-", "")
    .trim();
}

function getBroadcast(competition) {
  const broadcasts = competition?.broadcasts ?? [];

  const names = broadcasts
    .flatMap((broadcast) => broadcast?.names ?? [])
    .filter(Boolean);

  return [...new Set(names)].join(", ");
}

function getConferenceTag(competitor) {
  const id =
    competitor?.team?.conferenceId ??
    competitor?.conferenceId ??
    null;

  const name =
    competitor?.team?.conference?.name ??
    competitor?.conference?.name ??
    competitor?.team?.conferenceName ??
    null;

  return {
    id: id == null ? null : String(id),
    name: name || null
  };
}

function normalizeEvent(event, sportLabel, metadata = {}) {
  const competition = event?.competitions?.[0];
  const competitors = competition?.competitors ?? [];

  const homeTeam = competitors.find(
    (team) => team.homeAway === "home"
  );

  const awayTeam = competitors.find(
    (team) => team.homeAway === "away"
  );

  const homeConference = getConferenceTag(homeTeam);
  const awayConference = getConferenceTag(awayTeam);

  const conferenceIds = [
    awayConference.id,
    homeConference.id
  ].filter(Boolean);

  return {
    id: event?.id ?? null,
    sport: sportLabel,
    name: event?.name ?? null,
    away: awayTeam?.team?.displayName ?? "Away",
    home: homeTeam?.team?.displayName ?? "Home",
    startTime: event?.date ?? null,
    status: event?.status?.type?.description ?? null,
    network: getBroadcast(competition),
    venue: competition?.venue?.fullName ?? null,
    division: metadata.division ?? null,
    conferences: {
      away: awayConference,
      home: homeConference
    },
    conferenceIds: [...new Set(conferenceIds)]
  };
}

async function fetchScoreboard(config, date, groupId = null) {
  let url =
    `https://site.api.espn.com/apis/site/v2/sports/` +
    `${config.sport}/` +
    `${config.league}/scoreboard` +
    `?dates=${date}`;

  if (groupId) {
    url += `&groups=${groupId}&limit=500`;
  }

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `ESPN request failed: ${response.status}`
    );
  }

  return response.json();
}

function dedupeGames(games) {
  const unique = new Map();

  for (const game of games) {
    const key =
      game.id ??
      `${game.away}|${game.home}|${game.startTime}`;

    if (!unique.has(key)) {
      unique.set(key, game);
      continue;
    }

    const existing = unique.get(key);

    if (
      existing?.division === "FCS" &&
      game?.division === "FBS"
    ) {
      unique.set(key, game);
    }
  }

  return [...unique.values()].sort((a, b) => {
    const aTime = new Date(a.startTime ?? 0).getTime();
    const bTime = new Date(b.startTime ?? 0).getTime();
    return aTime - bTime;
  });
}

async function getBaseGames(sportKey, config, date) {
  if (sportKey !== "ncaaf") {
    const data = await fetchScoreboard(
      config,
      date
    );

    return (data.events ?? []).map(
      (event) =>
        normalizeEvent(
          event,
          config.label
        )
    );
  }

  const results = await Promise.all(
    NCAA_GROUPS.map(async (group) => {
      const data = await fetchScoreboard(
        config,
        date,
        group.id
      );

      return (data.events ?? []).map(
        (event) =>
          normalizeEvent(
            event,
            config.label,
            { division: group.division }
          )
      );
    })
  );

  return dedupeGames(
    results.flat()
  );
}

function applyExactPittsburghRegionalChannel(game, directvGuide) {
  const guideChannels = directvGuide?.channels;

  if (!Array.isArray(guideChannels)) {
    return game;
  }

  const snpChannel = guideChannels.find(
    (item) =>
      item?.channel === "659" ||
      item?.channel === "659-1"
  );

  if (!snpChannel) {
    return game;
  }

  const directv = Array.isArray(game.directv)
    ? [...game.directv]
    : [];

  const regionalIndex = directv.findIndex(
    (item) =>
      item?.network === "SportsNet Pittsburgh" ||
      item?.directvChannel === "659"
  );

  const exactRegional = {
    source: snpChannel.network,
    network: snpChannel.network,
    directvChannel: snpChannel.channel,
    type: "regional",
    market: "Pittsburgh",
    zipProfile: "15220",
    note:
      snpChannel.channel === "659-1"
        ? "SportsNet Pittsburgh Plus / alternate"
        : "SportsNet Pittsburgh main feed"
  };

  if (regionalIndex >= 0) {
    directv[regionalIndex] = exactRegional;
  } else {
    directv.unshift(exactRegional);
  }

  return {
    ...game,
    directv
  };
}

async function addDirectvGuideData(game, sportKey) {
  if (sportKey !== "mlb") {
    return game;
  }

  try {
    const directvGuide = await lookupDirectvGame({
      sport: "mlb",
      away: game.away,
      home: game.home,
      zip: "15220"
    });

    const exactGame =
      applyExactPittsburghRegionalChannel(
        game,
        directvGuide
      );

    return {
      ...exactGame,
      directvGuide
    };
  } catch (error) {
    console.error(
      "DIRECTV game lookup error:",
      error
    );

    return {
      ...game,
      directvGuide: null
    };
  }
}

router.get("/", async (req, res) => {
  const sportKey = String(
    req.query.sport ?? "mlb"
  )
    .toLowerCase()
    .trim();

  const config = SPORTS[sportKey];

  if (!config) {
    return res.status(400).json({
      status: "error",
      message: "Unsupported sport"
    });
  }

  const date = normalizeDate(
    req.query.date
  );

  const providerKey = String(
    req.query.provider ?? "directv"
  )
    .toLowerCase()
    .trim();

  try {
    const baseGames = await getBaseGames(
      sportKey,
      config,
      date
    );

    const resolvedGames = baseGames.map(
      (game) =>
        resolveGame(
          game,
          providerKey
        )
    );

    const games = await Promise.all(
      resolvedGames.map(
        (game) =>
          addDirectvGuideData(
            game,
            sportKey
          )
      )
    );

    return res.json({
      status: "ok",
      sport: sportKey,
      date,
      provider: providerKey,
      serverTime: new Date().toISOString(),
      count: games.length,
      divisions:
        sportKey === "ncaaf"
          ? ["FBS", "FCS"]
          : undefined,
      games
    });

  } catch (error) {
    console.error(
      "Resolve route error:",
      error
    );

    return res.status(500).json({
      status: "error",
      message: "Could not resolve games"
    });
  }
});

export default router;
