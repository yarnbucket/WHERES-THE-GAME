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
  ncaaw: { sport: "basketball", league: "womens-college-basketball", label: "NCAA Women's Basketball" },
  wnba: { sport: "basketball", league: "wnba", label: "WNBA" },
  racing: {
    sport: "racing",
    label: "Racing",
    leagues: [
      { league: "f1", series: "Formula 1" },
      { league: "irl", series: "IndyCar" },
      { league: "nascar-premier", series: "NASCAR Cup" },
      { league: "nascar-secondary", series: "NASCAR Secondary" },
      { league: "nascar-truck", series: "NASCAR Truck" }
    ]
  },
  golf: {
    sport: "golf",
    label: "Golf",
    leagues: [
      { league: "pga", series: "PGA Tour" },
      { league: "lpga", series: "LPGA" },
      { league: "liv", series: "LIV Golf" },
      { league: "eur", series: "DP World Tour" },
      { league: "champions-tour", series: "PGA Tour Champions" },
      { league: "ntw", series: "Korn Ferry Tour" },
      { league: "tgl", series: "TGL" },
      { league: "mens-olympics-golf", series: "Olympic Men's Golf" },
      { league: "womens-olympics-golf", series: "Olympic Women's Golf" }
    ]
  },
  tennis: {
    sport: "tennis",
    label: "Tennis",
    leagues: [
      { league: "atp", series: "ATP" },
      { league: "wta", series: "WTA" }
    ]
  },
  collegesoccer: {
    sport: "soccer",
    label: "College Soccer",
    leagues: [
      { league: "usa.ncaa.m.1", series: "NCAA Men's Soccer" },
      { league: "usa.ncaa.w.1", series: "NCAA Women's Soccer" }
    ]
  },
  soccer: {
    sport: "soccer",
    label: "Soccer",
    leagues: [
      { league: "usa.1", series: "MLS" },
      { league: "usa.open", series: "U.S. Open Cup" },
      { league: "usa.nwsl", series: "NWSL" },
      { league: "usa.usl.1", series: "USL Championship" },

      { league: "eng.1", series: "Premier League" },
      { league: "eng.2", series: "EFL Championship" },
      { league: "eng.fa", series: "FA Cup" },
      { league: "eng.league_cup", series: "Carabao Cup" },

      { league: "esp.1", series: "LALIGA" },
      { league: "esp.2", series: "LALIGA 2" },
      { league: "esp.copa_del_rey", series: "Copa del Rey" },

      { league: "ger.1", series: "Bundesliga" },
      { league: "ger.2", series: "2. Bundesliga" },
      { league: "ger.dfb_pokal", series: "DFB-Pokal" },

      { league: "ita.1", series: "Serie A" },
      { league: "ita.coppa_italia", series: "Coppa Italia" },

      { league: "fra.1", series: "Ligue 1" },
      { league: "fra.coupe_de_france", series: "Coupe de France" },

      { league: "mex.1", series: "Liga MX" },

      { league: "uefa.champions", series: "UEFA Champions League" },
      { league: "uefa.wchampions", series: "UEFA Women's Champions League" },
      { league: "uefa.europa", series: "UEFA Europa League" },
      { league: "uefa.europa.conf", series: "UEFA Conference League" },
      { league: "uefa.nations", series: "UEFA Nations League" },

      { league: "concacaf.champions", series: "Concacaf Champions Cup" },
      { league: "concacaf.leagues.cup", series: "Leagues Cup" },
      { league: "concacaf.gold", series: "Concacaf Gold Cup" },

      { league: "conmebol.libertadores", series: "Copa Libertadores" },
      { league: "conmebol.sudamericana", series: "Copa Sudamericana" },
      { league: "conmebol.america", series: "Copa America" },

      { league: "fifa.world", series: "FIFA World Cup" },
      { league: "fifa.wwc", series: "FIFA Women's World Cup" },
      { league: "fifa.cwc", series: "FIFA Club World Cup" },
      { league: "fifa.worldq", series: "World Cup Qualifying" },
      { league: "fifa.friendly", series: "International Friendly" },
      { league: "fifa.friendly.w", series: "Women's International Friendly" },

      { league: "ksa.1", series: "Saudi Pro League" },
      { league: "jpn.1", series: "J.League" },
      { league: "aus.1", series: "A-League Men" },
      { league: "aus.w.1", series: "A-League Women" }
    ]
  },
  mma: {
    sport: "mma",
    label: "MMA / UFC",
    leagues: [
      { league: "ufc", series: "UFC" },
      { league: "pfl", series: "PFL" },
      { league: "bellator", series: "Bellator" }
    ]
  },
  cbaseball: {
    sport: "baseball",
    league: "college-baseball",
    label: "College Baseball"
  },
  softball: {
    sport: "baseball",
    league: "college-softball",
    label: "College Softball"
  },
  lacrosse: {
    sport: "lacrosse",
    label: "Lacrosse",
    leagues: [
      { league: "pll", series: "Premier Lacrosse League" },
      { league: "nll", series: "National Lacrosse League" },
      { league: "mens-college-lacrosse", series: "NCAA Men's Lacrosse" },
      { league: "womens-college-lacrosse", series: "NCAA Women's Lacrosse" }
    ]
  },
  collegevolleyball: {
    sport: "volleyball",
    label: "College Volleyball",
    leagues: [
      { league: "mens-college-volleyball", series: "NCAA Men's Volleyball" },
      { league: "womens-college-volleyball", series: "NCAA Women's Volleyball" }
    ]
  },
  volleyball: {
    sport: "volleyball",
    label: "Volleyball",
    leagues: [
      { league: "fivb.m", series: "FIVB Men's Volleyball" },
      { league: "fivb.w", series: "FIVB Women's Volleyball" }
    ]
  },
  rugby: {
    sport: "rugby",
    label: "Rugby",
    leagues: [
      { league: "164205", series: "Rugby World Cup" },
      { league: "180659", series: "Six Nations" },
      { league: "267979", series: "Premiership Rugby" },
      { league: "242041", series: "Super Rugby Pacific" },
      { league: "289262", series: "Major League Rugby" }
    ]
  },
  cricket: {
    sport: "cricket",
    label: "Cricket",
    source: "personalized-header"
  },
  collegehockey: {
    sport: "hockey",
    label: "College Hockey",
    leagues: [
      { league: "mens-college-hockey", series: "NCAA Men's Hockey" },
      { league: "womens-college-hockey", series: "NCAA Women's Hockey" }
    ]
  },
  otherhockey: {
    sport: "hockey",
    label: "Other Hockey",
    leagues: [
      { league: "hockey-world-cup", series: "World Cup of Hockey" },
      { league: "olympics-mens-ice-hockey", series: "Olympic Men's Hockey" },
      { league: "olympics-womens-ice-hockey", series: "Olympic Women's Hockey" }
    ]
  },
  otherbasketball: {
    sport: "basketball",
    label: "Other Basketball",
    leagues: [
      { league: "nba-development", series: "NBA G League" },
      { league: "nbl", series: "NBL" },
      { league: "fiba", series: "FIBA World Cup" },
      { league: "nba-summer-california", series: "NBA California Classic" },
      { league: "nba-summer-golden-state", series: "Golden State Summer League" },
      { league: "nba-summer-las-vegas", series: "NBA Las Vegas Summer League" },
      { league: "nba-summer-orlando", series: "Orlando Summer League" },
      { league: "nba-summer-sacramento", series: "Sacramento Summer League" },
      { league: "nba-summer-utah", series: "Salt Lake City Summer League" }
    ]
  },
  otherbaseball: {
    sport: "baseball",
    label: "Other Baseball",
    leagues: [
      { league: "world-baseball-classic", series: "World Baseball Classic" },
      { league: "caribbean-series", series: "Caribbean Series" },
      { league: "dominican-winter-league", series: "Dominican Winter League" },
      { league: "mexican-winter-league", series: "Mexican League" },
      { league: "puerto-rican-winter-league", series: "Puerto Rican Winter League" },
      { league: "venezuelan-winter-league", series: "Venezuelan Winter League" },
      { league: "llb", series: "Little League Baseball World Series" },
      { league: "lls", series: "Little League Softball World Series" },
      { league: "olympics-baseball", series: "Olympic Baseball" }
    ]
  },
  olympics: {
    label: "Olympics / Major Events",
    feeds: [
      { sport: "basketball", league: "mens-olympics-basketball", series: "Olympic Men's Basketball" },
      { sport: "basketball", league: "womens-olympics-basketball", series: "Olympic Women's Basketball" },
      { sport: "hockey", league: "olympics-mens-ice-hockey", series: "Olympic Men's Hockey" },
      { sport: "hockey", league: "olympics-womens-ice-hockey", series: "Olympic Women's Hockey" },
      { sport: "soccer", league: "fifa.olympics", series: "Olympic Men's Soccer" },
      { sport: "soccer", league: "fifa.w.olympics", series: "Olympic Women's Soccer" },
      { sport: "baseball", league: "olympics-baseball", series: "Olympic Baseball" },
      { sport: "golf", league: "mens-olympics-golf", series: "Olympic Men's Golf" },
      { sport: "golf", league: "womens-olympics-golf", series: "Olympic Women's Golf" }
    ]
  },
  australianfootball: {
    sport: "australian-football",
    league: "afl",
    label: "Australian Football"
  },
  otherfootball: {
    sport: "football",
    label: "Other Football",
    leagues: [
      { league: "cfl", series: "CFL" },
      { league: "ufl", series: "UFL" },
      { league: "xfl", series: "XFL" }
    ]
  },
  fieldhockey: {
    sport: "field-hockey",
    league: "womens-college-field-hockey",
    label: "Field Hockey"
  },
  waterpolo: {
    sport: "water-polo",
    label: "Water Polo",
    leagues: [
      { league: "mens-college-water-polo", series: "NCAA Men's Water Polo" },
      { league: "womens-college-water-polo", series: "NCAA Women's Water Polo" }
    ]
  },
  rugbyleague: {
    sport: "rugby-league",
    league: "3",
    label: "Rugby League"
  }
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

function normalizeRacingEvent(event, series) {
  const competition = event?.competitions?.[0];

  return {
    id: `${series}:${event?.id ?? event?.date ?? event?.name ?? "event"}`,
    sport: "Racing",
    series,
    name:
      event?.name ??
      event?.shortName ??
      competition?.name ??
      "Racing Event",
    away: null,
    home: null,
    startTime: event?.date ?? competition?.date ?? null,
    status:
      event?.status?.type?.description ??
      competition?.status?.type?.description ??
      null,
    network: getBroadcast(competition),
    venue:
      competition?.venue?.fullName ??
      event?.venue?.fullName ??
      null,
    division: null,
    conferences: {
      away: { id: null, name: null },
      home: { id: null, name: null }
    },
    conferenceIds: []
  };
}

function normalizeGolfEvent(event, series) {
  const competition = event?.competitions?.[0];

  return {
    id: `${series}:${event?.id ?? event?.date ?? event?.name ?? "event"}`,
    sport: "Golf",
    series,
    name:
      event?.name ??
      event?.shortName ??
      competition?.name ??
      "Golf Tournament",
    away: null,
    home: null,
    startTime: event?.date ?? competition?.date ?? null,
    status:
      event?.status?.type?.description ??
      competition?.status?.type?.description ??
      null,
    network: getBroadcast(competition),
    venue:
      competition?.venue?.fullName ??
      event?.venue?.fullName ??
      null,
    division: null,
    conferences: {
      away: { id: null, name: null },
      home: { id: null, name: null }
    },
    conferenceIds: []
  };
}

function normalizeTennisEvent(event, series) {
  const competition = event?.competitions?.[0];
  const competitors = competition?.competitors ?? [];

  const playerNames = competitors
    .map((item) =>
      item?.athlete?.displayName ??
      item?.team?.displayName ??
      item?.displayName ??
      null
    )
    .filter(Boolean);

  const matchupName =
    playerNames.length >= 2
      ? `${playerNames[0]} vs ${playerNames[1]}`
      : null;

  return {
    id: `${series}:${event?.id ?? event?.date ?? event?.name ?? "event"}`,
    sport: "Tennis",
    series,
    name:
      matchupName ??
      event?.name ??
      event?.shortName ??
      competition?.name ??
      "Tennis Match",
    away: null,
    home: null,
    startTime: event?.date ?? competition?.date ?? null,
    status:
      event?.status?.type?.description ??
      competition?.status?.type?.description ??
      null,
    network: getBroadcast(competition),
    venue:
      competition?.venue?.fullName ??
      event?.venue?.fullName ??
      null,
    division: null,
    conferences: {
      away: { id: null, name: null },
      home: { id: null, name: null }
    },
    conferenceIds: []
  };
}

function cricketDateKey(value) {
  const parsed = new Date(value ?? 0);
  if (Number.isNaN(parsed.getTime())) return null;

  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  })
    .format(parsed)
    .replaceAll("-", "");
}

function normalizeCricketEvent(event, series) {
  const competition = event?.competitions?.[0];
  const competitors =
    competition?.competitors ??
    event?.competitors ??
    [];

  const names = competitors
    .map((item) =>
      item?.team?.displayName ??
      item?.team?.shortDisplayName ??
      item?.displayName ??
      item?.name ??
      null
    )
    .filter(Boolean);

  const title =
    event?.name ??
    event?.shortName ??
    competition?.name ??
    (names.length >= 2
      ? `${names[0]} vs ${names[1]}`
      : "Cricket Match");

  return {
    id: `Cricket:${event?.id ?? event?.date ?? title}`,
    sport: "Cricket",
    series,
    name: title,
    away: null,
    home: null,
    startTime:
      event?.date ??
      competition?.date ??
      null,
    status:
      event?.status?.type?.description ??
      competition?.status?.type?.description ??
      event?.status?.type?.name ??
      null,
    network: getBroadcast(competition),
    venue:
      competition?.venue?.fullName ??
      event?.venue?.fullName ??
      null,
    division: null,
    conferences: {
      away: { id: null, name: null },
      home: { id: null, name: null }
    },
    conferenceIds: []
  };
}

async function fetchCricketGames(date) {
  const url =
    "https://site.api.espn.com/apis/personalized/v2/scoreboard/header" +
    "?sport=cricket&region=us&tz=America%2FNew_York";

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `ESPN Cricket request failed: ${response.status}`
    );
  }

  const data = await response.json();
  const leagues = data?.sports?.[0]?.leagues ?? [];
  const games = [];

  for (const league of leagues) {
    const series =
      league?.name ??
      league?.shortName ??
      league?.abbreviation ??
      "Cricket";

    for (const event of league?.events ?? []) {
      const eventDate =
        event?.date ??
        event?.competitions?.[0]?.date ??
        null;

      if (
        date &&
        eventDate &&
        cricketDateKey(eventDate) !== date
      ) {
        continue;
      }

      games.push(
        normalizeCricketEvent(
          event,
          series
        )
      );
    }
  }

  return dedupeGames(games);
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
  if (sportKey === "racing") {
    const results = await Promise.all(
      config.leagues.map(async (seriesConfig) => {
        const data = await fetchScoreboard(
          {
            sport: config.sport,
            league: seriesConfig.league,
            label: config.label
          },
          date
        );

        return (data.events ?? []).map(
          (event) =>
            normalizeRacingEvent(
              event,
              seriesConfig.series
            )
        );
      })
    );

    return dedupeGames(
      results.flat()
    );
  }

  if (sportKey === "golf") {
    const results = await Promise.all(
      config.leagues.map(async (seriesConfig) => {
        const data = await fetchScoreboard(
          {
            sport: config.sport,
            league: seriesConfig.league,
            label: config.label
          },
          date
        );

        return (data.events ?? []).map(
          (event) =>
            normalizeGolfEvent(
              event,
              seriesConfig.series
            )
        );
      })
    );

    return dedupeGames(
      results.flat()
    );
  }

  if (sportKey === "tennis") {
    const results = await Promise.all(
      config.leagues.map(async (seriesConfig) => {
        const data = await fetchScoreboard(
          {
            sport: config.sport,
            league: seriesConfig.league,
            label: config.label
          },
          date
        );

        return (data.events ?? []).map(
          (event) =>
            normalizeTennisEvent(
              event,
              seriesConfig.series
            )
        );
      })
    );

    return dedupeGames(
      results.flat()
    );
  }

  if (sportKey === "soccer" || sportKey === "collegesoccer") {
    const results = await Promise.all(
      config.leagues.map(async (seriesConfig) => {
        const data = await fetchScoreboard(
          {
            sport: config.sport,
            league: seriesConfig.league,
            label: config.label
          },
          date
        );

        return (data.events ?? []).map(
          (event) => ({
            ...normalizeEvent(
              event,
              config.label
            ),
            series: seriesConfig.series
          })
        );
      })
    );

    return dedupeGames(
      results.flat()
    );
  }

  if (sportKey === "mma") {
    const results = await Promise.all(
      config.leagues.map(async (seriesConfig) => {
        const data = await fetchScoreboard(
          {
            sport: config.sport,
            league: seriesConfig.league,
            label: config.label
          },
          date
        );

        return (data.events ?? []).map(
          (event) => ({
            ...normalizeEvent(
              event,
              config.label
            ),
            series: seriesConfig.series
          })
        );
      })
    );

    return dedupeGames(
      results.flat()
    );
  }

  if (sportKey === "lacrosse") {
    const results = await Promise.all(
      config.leagues.map(async (seriesConfig) => {
        const data = await fetchScoreboard(
          {
            sport: config.sport,
            league: seriesConfig.league,
            label: config.label
          },
          date
        );

        return (data.events ?? []).map(
          (event) => ({
            ...normalizeEvent(
              event,
              config.label
            ),
            series: seriesConfig.series
          })
        );
      })
    );

    return dedupeGames(
      results.flat()
    );
  }

  if (sportKey === "volleyball" || sportKey === "collegevolleyball") {
    const results = await Promise.all(
      config.leagues.map(async (seriesConfig) => {
        const data = await fetchScoreboard(
          {
            sport: config.sport,
            league: seriesConfig.league,
            label: config.label
          },
          date
        );

        return (data.events ?? []).map(
          (event) => ({
            ...normalizeEvent(
              event,
              config.label
            ),
            series: seriesConfig.series
          })
        );
      })
    );

    return dedupeGames(
      results.flat()
    );
  }

  if (sportKey === "rugby") {
    const results = await Promise.all(
      config.leagues.map(async (seriesConfig) => {
        const data = await fetchScoreboard(
          {
            sport: config.sport,
            league: seriesConfig.league,
            label: config.label
          },
          date
        );

        return (data.events ?? []).map(
          (event) => ({
            ...normalizeEvent(
              event,
              config.label
            ),
            series: seriesConfig.series
          })
        );
      })
    );

    return dedupeGames(
      results.flat()
    );
  }

  if (sportKey === "cricket") {
    return fetchCricketGames(date);
  }

  if (sportKey === "otherhockey" || sportKey === "collegehockey") {
    const results = await Promise.all(
      config.leagues.map(async (seriesConfig) => {
        const data = await fetchScoreboard(
          {
            sport: config.sport,
            league: seriesConfig.league,
            label: config.label
          },
          date
        );

        return (data.events ?? []).map(
          (event) => ({
            ...normalizeEvent(
              event,
              config.label
            ),
            series: seriesConfig.series
          })
        );
      })
    );

    return dedupeGames(
      results.flat()
    );
  }

  if (sportKey === "otherbasketball") {
    const results = await Promise.all(
      config.leagues.map(async (seriesConfig) => {
        const data = await fetchScoreboard(
          {
            sport: config.sport,
            league: seriesConfig.league,
            label: config.label
          },
          date
        );

        return (data.events ?? []).map(
          (event) => ({
            ...normalizeEvent(
              event,
              config.label
            ),
            series: seriesConfig.series
          })
        );
      })
    );

    return dedupeGames(
      results.flat()
    );
  }

  if (sportKey === "otherbaseball") {
    const results = await Promise.all(
      config.leagues.map(async (seriesConfig) => {
        const data = await fetchScoreboard(
          {
            sport: config.sport,
            league: seriesConfig.league,
            label: config.label
          },
          date
        );

        return (data.events ?? []).map(
          (event) => ({
            ...normalizeEvent(
              event,
              config.label
            ),
            series: seriesConfig.series
          })
        );
      })
    );

    return dedupeGames(
      results.flat()
    );
  }

  if (sportKey === "olympics") {
    const results = await Promise.all(
      config.feeds.map(async (feedConfig) => {
        const data = await fetchScoreboard(
          {
            sport: feedConfig.sport,
            league: feedConfig.league,
            label: config.label
          },
          date
        );

        return (data.events ?? []).map(
          (event) => ({
            ...normalizeEvent(
              event,
              config.label
            ),
            series: feedConfig.series
          })
        );
      })
    );

    return dedupeGames(
      results.flat()
    );
  }

  if (sportKey === "otherfootball") {
    const results = await Promise.all(
      config.leagues.map(async (seriesConfig) => {
        const data = await fetchScoreboard(
          {
            sport: config.sport,
            league: seriesConfig.league,
            label: config.label
          },
          date
        );

        return (data.events ?? []).map(
          (event) => ({
            ...normalizeEvent(
              event,
              config.label
            ),
            series: seriesConfig.series
          })
        );
      })
    );

    return dedupeGames(results.flat());
  }

  if (sportKey === "waterpolo") {
    const results = await Promise.all(
      config.leagues.map(async (seriesConfig) => {
        const data = await fetchScoreboard(
          {
            sport: config.sport,
            league: seriesConfig.league,
            label: config.label
          },
          date
        );

        return (data.events ?? []).map(
          (event) => ({
            ...normalizeEvent(
              event,
              config.label
            ),
            series: seriesConfig.series
          })
        );
      })
    );

    return dedupeGames(results.flat());
  }

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
      (game) => ({
        ...resolveGame(
          game,
          providerKey
        ),
        series: game.series ?? null
      })
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
