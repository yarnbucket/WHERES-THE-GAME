import express from "express";

import { resolveGame } from "../logic/resolver.js";
import { lookupDirectvGame } from "../logic/directvGuide.js";

const router = express.Router();

const SPORTS = {
  nfl: {
    sport: "football",
    league: "nfl",
    label: "NFL"
  },

  ncaaf: {
    sport: "football",
    league: "college-football",
    label: "NCAA Football"
  },

  mlb: {
    sport: "baseball",
    league: "mlb",
    label: "MLB"
  },

  nhl: {
    sport: "hockey",
    league: "nhl",
    label: "NHL"
  },

  nba: {
    sport: "basketball",
    league: "nba",
    label: "NBA"
  },

  ncaab: {
    sport: "basketball",
    league: "mens-college-basketball",
    label: "NCAA Basketball"
  }
};

// ESPN college-football group IDs.
// .1b scope: FBS + FCS only.
const NCAA_GROUPS = [
  // ESPN college-football group rollups.
  { id: "80", division: "FBS" },
  { id: "81", division: "FCS" },
  { id: "57", division: "DII" },
  { id: "58", division: "DIII" }
];

const NCAA_DIVISION_PRIORITY = {
  FBS: 0,
  FCS: 1,
  DII: 2,
  DIII: 3
};

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

    away:
      awayTeam?.team?.displayName ??
      "Away",

    home:
      homeTeam?.team?.displayName ??
      "Home",

    awayTeamId:
      awayTeam?.team?.id != null
        ? String(awayTeam.team.id)
        : null,

    homeTeamId:
      homeTeam?.team?.id != null
        ? String(homeTeam.team.id)
        : null,

    startTime:
      event?.date ?? null,

    status:
      event?.status?.type?.description ??
      null,

    network:
      getBroadcast(competition),

    venue:
      competition?.venue?.fullName ??
      null,

    // .1b NCAA metadata foundation.
    division:
      metadata.division ?? null,

    conferences: {
      away: awayConference,
      home: homeConference
    },

    conferenceIds:
      [...new Set(conferenceIds)],

    // 0.1H8f: preserve ESPN scoreboard ranking metadata.
    awayRank:
      awayTeam?.curatedRank?.current ??
      awayTeam?.rank ??
      awayTeam?.team?.rank ??
      null,

    homeRank:
      homeTeam?.curatedRank?.current ??
      homeTeam?.rank ??
      homeTeam?.team?.rank ??
      null
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


async function fetchCollegeFootballRankings(date) {
  const seasonMatch = String(date || "").match(/^(\\d{4})/);
  const season = seasonMatch ? seasonMatch[1] : String(new Date().getUTCFullYear());

  const url =
    "https://site.api.espn.com/apis/site/v2/sports/" +
    "football/college-football/rankings" +
    `?season=${encodeURIComponent(season)}`;

  const response = await fetch(url, {
    headers: {
      "accept": "application/json",
      "user-agent": "WTG/0.1H8i"
    }
  });

  if (!response.ok) {
    throw new Error(
      `ESPN rankings request failed: ${response.status}`
    );
  }

  return response.json();
}

function normalizeRankTeamName(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function getApTop25Map(data) {
  const rankings = Array.isArray(data?.rankings)
    ? data.rankings
    : [];

  const apPoll = rankings.find((poll) => {
    const text = String(
      poll?.name ||
      poll?.shortName ||
      poll?.headline ||
      poll?.type ||
      ""
    ).toLowerCase();

    return (
      text.includes("ap top 25") ||
      text.includes("associated press") ||
      /^ap\b/.test(text)
    );
  });

  const byId = new Map();
  const byName = new Map();

  for (const item of apPoll?.ranks ?? []) {
    const rank = Number(
      item?.current ??
      item?.rank ??
      item?.currentRank ??
      item?.ranking
    );

    if (!Number.isFinite(rank) || rank < 1 || rank > 25) {
      continue;
    }

    const team = item?.team ?? {};
    const id =
      team?.id != null
        ? String(team.id)
        : item?.teamId != null
          ? String(item.teamId)
          : null;

    if (id) {
      byId.set(id, rank);
    }

    for (const name of [
      team?.displayName,
      team?.shortDisplayName,
      team?.name,
      team?.location,
      team?.abbreviation,
      item?.teamName,
      item?.name
    ]) {
      const normalized = normalizeRankTeamName(name);
      if (normalized) {
        byName.set(normalized, rank);
      }
    }
  }

  return {
    byId,
    byName,
    pollName:
      apPoll?.name ||
      apPoll?.shortName ||
      "AP Top 25",
    rankedTeamCount: byId.size || byName.size,
    week:
      data?.latestWeek?.number ??
      data?.week?.number ??
      apPoll?.week ??
      null,
    season:
      data?.latestSeason?.year ??
      data?.season?.year ??
      null,
    healthy: Boolean(apPoll && (byId.size || byName.size))
  };
}

function rankForGameTeam(game, side, rankMap) {
  const id = game?.[`${side}TeamId`];

  if (id != null && rankMap.byId.has(String(id))) {
    return rankMap.byId.get(String(id));
  }

  const exact = normalizeRankTeamName(game?.[side]);
  if (exact && rankMap.byName.has(exact)) {
    return rankMap.byName.get(exact);
  }

  // ESPN naming can vary slightly between scoreboard and rankings.
  // Only use a contained-name fallback for reasonably specific names.
  if (exact.length >= 5) {
    for (const [name, rank] of rankMap.byName.entries()) {
      if (
        name.length >= 5 &&
        (exact === name ||
         exact.includes(name) ||
         name.includes(exact))
      ) {
        return rank;
      }
    }
  }

  return null;
}

function applyCollegeFootballRankings(games, rankMap) {
  return games.map((game) => ({
    ...game,
    awayRank:
      rankForGameTeam(game, "away", rankMap) ??
      game?.awayRank ??
      null,
    homeRank:
      rankForGameTeam(game, "home", rankMap) ??
      game?.homeRank ??
      null,
    rankingPoll: rankMap.pollName,
    rankingWeek: rankMap.week,
    rankingSeason: rankMap.season,
    rankingHealthy: rankMap.healthy
  }));
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

    // Cross-division games can appear in more than one ESPN group feed.
    // Keep the highest NCAA division classification for the shared event.
    const existing = unique.get(key);
    const existingPriority =
      NCAA_DIVISION_PRIORITY[existing?.division] ?? 99;
    const incomingPriority =
      NCAA_DIVISION_PRIORITY[game?.division] ?? 99;

    if (incomingPriority < existingPriority) {
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

  // .1b: collect FBS and FCS independently, then merge.
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

  const games = dedupeGames(
    results.flat()
  );

  // The scoreboard feed does not reliably include poll rank on each
  // competitor. Pull ESPN's rankings feed separately and join the
  // current AP Top 25 to each scheduled game by stable team ID/name.
  try {
    const rankingData =
      await fetchCollegeFootballRankings(date);

    const rankMap =
      getApTop25Map(rankingData);

    if (!rankMap.healthy) {
      console.error(
        "AP Top 25 rankings were returned without usable ranked teams."
      );

      return games.map((game) => ({
        ...game,
        rankingPoll: rankMap.pollName,
        rankingWeek: rankMap.week,
        rankingSeason: rankMap.season,
        rankingHealthy: false
      }));
    }

    return applyCollegeFootballRankings(
      games,
      rankMap
    );
  } catch (error) {
    console.error(
      "College football rankings lookup error:",
      error
    );

    // Do not break the schedule if the rankings endpoint is temporarily
    // unavailable. Existing scoreboard rank metadata remains as fallback.
    return games;
  }
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

    return {
      ...game,
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


function normalizeSearchValue(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchLeagueTeams(config) {
  const url =
    `https://site.api.espn.com/apis/site/v2/sports/` +
    `${config.sport}/${config.league}/teams?limit=2000`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`ESPN teams request failed: ${response.status}`);
  }

  return response.json();
}

function extractTeams(data) {
  const output = [];

  const walk = (value) => {
    if (!value || typeof value !== "object") return;

    if (Array.isArray(value)) {
      value.forEach(walk);
      return;
    }

    const team = value?.team;
    if (
      team &&
      typeof team === "object" &&
      team.id != null &&
      (team.displayName || team.name)
    ) {
      output.push(team);
    }

    for (const child of Object.values(value)) {
      if (child && typeof child === "object") walk(child);
    }
  };

  walk(data);

  const seen = new Set();
  return output.filter((team) => {
    const id = String(team?.id ?? "");
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

function teamSearchText(team) {
  return normalizeSearchValue([
    team?.displayName,
    team?.shortDisplayName,
    team?.name,
    team?.nickname,
    team?.location,
    team?.abbreviation
  ].filter(Boolean).join(" "));
}

function teamMatchesNextSearch(team, query) {
  const normalized = normalizeSearchValue(query);
  if (!normalized) return false;

  const haystack = teamSearchText(team);
  const terms = normalized.split(" ").filter(Boolean);

  return terms.every((term) => haystack.includes(term));
}

async function fetchTeamSchedule(config, teamId, season) {
  const url =
    `https://site.api.espn.com/apis/site/v2/sports/` +
    `${config.sport}/${config.league}/teams/` +
    `${encodeURIComponent(teamId)}/schedule` +
    `?season=${encodeURIComponent(season)}`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`ESPN team schedule request failed: ${response.status}`);
  }

  return response.json();
}

function scheduleEvents(data) {
  if (Array.isArray(data?.events)) return data.events;
  if (Array.isArray(data?.schedule)) return data.schedule;
  return [];
}

async function nextGameForTeam(sportKey, config, team, providerKey) {
  const now = Date.now();
  const thisYear = new Date().getUTCFullYear();
  const seasons = [thisYear, thisYear + 1];

  const results = await Promise.allSettled(
    seasons.map((season) =>
      fetchTeamSchedule(config, team.id, season)
    )
  );

  const events = results
    .filter((result) => result.status === "fulfilled")
    .flatMap((result) => scheduleEvents(result.value));

  const upcoming = events
    .filter((event) => {
      const when = new Date(event?.date || 0).getTime();
      const status = String(
        event?.status?.type?.state ||
        event?.status?.type?.name ||
        event?.status?.type?.description ||
        ""
      ).toLowerCase();

      return (
        Number.isFinite(when) &&
        when >= now &&
        !status.includes("final") &&
        !status.includes("post")
      );
    })
    .sort((a, b) =>
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );

  if (!upcoming.length) return null;

  let game = normalizeEvent(
    upcoming[0],
    config.label,
    {}
  );

  game = {
    ...game,
    _sportKey: sportKey,
    searchTeamId: String(team.id),
    searchTeamName: team.displayName || team.name || null
  };

  game = resolveGame(game, providerKey);
  game = await addDirectvGuideData(game, sportKey);

  return game;
}

router.get("/next", async (req, res) => {
  const query = String(req.query.q || "").trim();
  const providerKey = String(req.query.provider || "directv")
    .toLowerCase()
    .trim();

  if (!query) {
    return res.json({
      status: "ok",
      query,
      count: 0,
      games: []
    });
  }

  try {
    const leagueResults = await Promise.allSettled(
      Object.entries(SPORTS).map(async ([sportKey, config]) => {
        const teamData = await fetchLeagueTeams(config);
        const teams = extractTeams(teamData)
          .filter((team) => teamMatchesNextSearch(team, query))
          .slice(0, 8);

        const games = await Promise.all(
          teams.map((team) =>
            nextGameForTeam(
              sportKey,
              config,
              team,
              providerKey
            )
          )
        );

        return games.filter(Boolean);
      })
    );

    const allGames = leagueResults
      .filter((result) => result.status === "fulfilled")
      .flatMap((result) => result.value)
      .filter(Boolean);

    // If a city/search phrase matched more than one team, show each
    // matching team's next game, with the soonest game first.
    const deduped = [];
    const seen = new Set();

    for (const game of allGames.sort(
      (a, b) =>
        new Date(a.startTime).getTime() -
        new Date(b.startTime).getTime()
    )) {
      const key = `${game._sportKey}:${game.searchTeamId}:${game.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push(game);
    }

    return res.json({
      status: "ok",
      query,
      count: deduped.length,
      games: deduped
    });
  } catch (error) {
    console.error("Next-game search error:", error);

    return res.status(500).json({
      status: "error",
      query,
      count: 0,
      games: []
    });
  }
});

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
      count: games.length,
      divisions:
        sportKey === "ncaaf"
          ? ["FBS", "FCS", "DII", "DIII"]
          : undefined,
      rankingSource:
        sportKey === "ncaaf"
          ? (games.find((g) => g?.rankingPoll)?.rankingPoll || null)
          : undefined,
      rankingWeek:
        sportKey === "ncaaf"
          ? (games.find((g) => g?.rankingWeek != null)?.rankingWeek ?? null)
          : undefined,
      rankingSeason:
        sportKey === "ncaaf"
          ? (games.find((g) => g?.rankingSeason != null)?.rankingSeason ?? null)
          : undefined,
      rankingHealthy:
        sportKey === "ncaaf"
          ? Boolean(games.find((g) => g?.rankingHealthy === true))
          : undefined,
      rankedTeamCount:
        sportKey === "ncaaf"
          ? new Set(
              games.flatMap((g) => [
                Number(g?.awayRank) >= 1 && Number(g?.awayRank) <= 25
                  ? String(g?.awayTeamId || g?.away || "")
                  : null,
                Number(g?.homeRank) >= 1 && Number(g?.homeRank) <= 25
                  ? String(g?.homeTeamId || g?.home || "")
                  : null
              ]).filter(Boolean)
            ).size
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
