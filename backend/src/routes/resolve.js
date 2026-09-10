import express from "express";

import { resolveGame } from "../logic/resolver.js";
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
  cbaseball: { sport: "baseball", league: "college-baseball", label: "College Baseball" },
  nhl: { sport: "hockey", league: "nhl", label: "NHL" },
  collegehockey: { sport: "hockey", league: "mens-college-hockey", label: "College Hockey" },
  nba: { sport: "basketball", league: "nba", label: "NBA" },
  ncaab: { sport: "basketball", league: "mens-college-basketball", label: "NCAA Basketball" },
  ncaaw: { sport: "basketball", league: "womens-college-basketball", label: "NCAA Women's Basketball" },
  wnba: { sport: "basketball", league: "wnba", label: "WNBA" },
  racing: {
    sport: "racing",
    label: "Racing",
    leagues: [
      { league: "f1", label: "Formula 1" },
      { league: "nascar-premier", label: "NASCAR Cup" },
      { league: "irl", label: "IndyCar" }
    ]
  },
  golf: {
    sport: "golf",
    label: "Golf",
    leagues: [
      { league: "pga", label: "PGA TOUR" },
      { league: "lpga", label: "LPGA" },
      { league: "liv", label: "LIV Golf" },
      { league: "eur", label: "DP World Tour" }
    ]
  },
  tennis: {
    sport: "tennis",
    label: "Tennis",
    leagues: [
      { league: "atp", label: "ATP" },
      { league: "wta", label: "WTA" }
    ]
  }
};

const NCAA_GROUPS = [
  { id: "80", division: "FBS" },
  { id: "81", division: "FCS" },
  { id: "57", division: "DII" },
  { id: "58", division: "DIII" }
];

const NCAA_DIVISION_PRIORITY = { FBS: 0, FCS: 1, DII: 2, DIII: 3 };

function normalizeDate(value) {
  if (!value) return new Date().toISOString().slice(0, 10).replaceAll("-", "");
  return String(value).replaceAll("-", "").trim();
}

function uniqueNames(values) {
  return [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))];
}

function broadcastNamesFromList(broadcasts) {
  return uniqueNames((broadcasts ?? []).flatMap((broadcast) => [
    ...(broadcast?.names ?? []),
    broadcast?.name,
    broadcast?.shortName,
    broadcast?.displayName,
    broadcast?.callLetters,
    broadcast?.media?.name,
    broadcast?.media?.shortName,
    broadcast?.media?.displayName,
    broadcast?.media?.callLetters,
    broadcast?.network?.name,
    broadcast?.network?.shortName,
    broadcast?.network?.displayName,
    broadcast?.network?.callLetters
  ]));
}

function getBroadcast(competition) {
  return broadcastNamesFromList(competition?.broadcasts).join(", ");
}

function getGolfEmbeddedBroadcast(event) {
  const competition = event?.competitions?.[0];
  const names = uniqueNames([
    ...broadcastNamesFromList(competition?.broadcasts),
    ...broadcastNamesFromList(event?.broadcasts),
    event?.network,
    competition?.network,
    event?.broadcast,
    competition?.broadcast
  ]);
  return names.join(", ");
}

function golfBroadcastNamesFromObject(value) {
  if (!value || typeof value !== "object") return [];
  return uniqueNames([
    ...(value?.names ?? []),
    value?.name,
    value?.shortName,
    value?.displayName,
    value?.callLetters,
    value?.network,
    value?.media?.name,
    value?.media?.shortName,
    value?.media?.displayName,
    value?.media?.callLetters,
    value?.network?.name,
    value?.network?.shortName,
    value?.network?.displayName,
    value?.network?.callLetters
  ]).filter((name) => !/^(national|regional|international|domestic|english|spanish)$/i.test(name));
}

function normalizeEspnRefUrl(value) {
  const url = String(value || "").trim().replace("sports.core.api.espn.pvt", "sports.core.api.espn.com");
  if (!/^https:\/\/(sports\.core\.api\.espn\.com|site\.api\.espn\.com|site\.web\.api\.espn\.com)\//i.test(url)) return null;
  return url;
}

async function fetchEspnJson(url) {
  const safeUrl = normalizeEspnRefUrl(url);
  if (!safeUrl) return null;
  const response = await fetch(safeUrl, { headers: { accept: "application/json", "user-agent": "WTG/0.1H8k" } });
  if (!response.ok) return null;
  return response.json();
}

async function golfCoreBroadcastNames(data) {
  const items = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
  const names = items.flatMap(golfBroadcastNamesFromObject);

  const resolved = await Promise.allSettled(items.map(async (item) => {
    const itemRef = normalizeEspnRefUrl(item?.$ref);
    const broadcast = itemRef ? await fetchEspnJson(itemRef) : item;
    if (!broadcast) return [];

    const result = golfBroadcastNamesFromObject(broadcast);
    const mediaRef = normalizeEspnRefUrl(broadcast?.media?.$ref);
    if (mediaRef) {
      const media = await fetchEspnJson(mediaRef);
      if (media) result.push(...golfBroadcastNamesFromObject(media));
    }
    const networkRef = normalizeEspnRefUrl(broadcast?.network?.$ref);
    if (networkRef) {
      const network = await fetchEspnJson(networkRef);
      if (network) result.push(...golfBroadcastNamesFromObject(network));
    }
    return result;
  }));

  for (const result of resolved) if (result.status === "fulfilled") names.push(...result.value);
  return uniqueNames(names).filter((name) => !/^(national|regional|international|domestic|english|spanish)$/i.test(name));
}

function golfNetworksFromHtml(html) {
  const text = String(html || "");
  const known = [
    "Golf Channel", "CBS Sports Network", "NBC", "CBS", "ABC", "USA",
    "FS1", "FS2", "TNT", "TBS", "Peacock", "Paramount+"
  ];
  return known.filter((network) => text.toLowerCase().includes(network.toLowerCase()));
}

async function fetchGolfLeaderboardBroadcast(eventId) {
  try {
    const url = `https://www.espn.com/golf/leaderboard/_/tournamentId/${encodeURIComponent(eventId)}`;
    const response = await fetch(url, { headers: { accept: "text/html", "user-agent": "Mozilla/5.0 WTG/0.1H8k" } });
    if (!response.ok) return "";
    const html = await response.text();
    return uniqueNames(golfNetworksFromHtml(html)).join(", ");
  } catch (error) {
    console.error("Golf leaderboard broadcast lookup error:", error);
    return "";
  }
}

async function fetchGolfBroadcast(event, league) {
  const embedded = getGolfEmbeddedBroadcast(event);
  if (embedded) return embedded;

  const eventId = event?.id;
  const competitionId = event?.competitions?.[0]?.id ?? eventId;
  if (!eventId || !competitionId) return "";

  try {
    const summaryUrl = `https://site.api.espn.com/apis/site/v2/sports/golf/${league}/summary?event=${encodeURIComponent(eventId)}`;
    const summaryResponse = await fetch(summaryUrl, { headers: { accept: "application/json", "user-agent": "WTG/0.1H8k" } });
    if (summaryResponse.ok) {
      const summary = await summaryResponse.json();
      const headerCompetition = summary?.header?.competitions?.[0];
      const summaryNames = uniqueNames([
        ...broadcastNamesFromList(headerCompetition?.broadcasts),
        ...broadcastNamesFromList(summary?.broadcasts),
        summary?.header?.network,
        headerCompetition?.network
      ]);
      if (summaryNames.length) return summaryNames.join(", ");
    }
  } catch (error) {
    console.error("Golf summary broadcast lookup error:", error);
  }

  try {
    const coreUrl = `https://sports.core.api.espn.com/v2/sports/golf/leagues/${league}/events/${encodeURIComponent(eventId)}/competitions/${encodeURIComponent(competitionId)}/broadcasts?lang=en&region=us&limit=100`;
    const coreResponse = await fetch(coreUrl, { headers: { accept: "application/json", "user-agent": "WTG/0.1H8k" } });
    if (coreResponse.ok) {
      const core = await coreResponse.json();
      const names = await golfCoreBroadcastNames(core);
      if (names.length) return names.join(", ");
    }
  } catch (error) {
    console.error("Golf core broadcast lookup error:", error);
  }

  return fetchGolfLeaderboardBroadcast(eventId);
}

function getConferenceTag(competitor) {
  const id = competitor?.team?.conferenceId ?? competitor?.conferenceId ?? null;
  const name = competitor?.team?.conference?.name ?? competitor?.conference?.name ?? competitor?.team?.conferenceName ?? null;
  return { id: id == null ? null : String(id), name: name || null };
}

function normalizeEvent(event, sportLabel, metadata = {}) {
  const competition = event?.competitions?.[0];
  const competitors = competition?.competitors ?? [];
  const homeTeam = competitors.find((team) => team.homeAway === "home");
  const awayTeam = competitors.find((team) => team.homeAway === "away");
  const homeConference = getConferenceTag(homeTeam);
  const awayConference = getConferenceTag(awayTeam);
  const conferenceIds = [awayConference.id, homeConference.id].filter(Boolean);

  return {
    id: event?.id ?? null,
    sport: sportLabel,
    league: metadata.league ?? null,
    name: event?.name ?? null,
    away: awayTeam?.team?.displayName ?? "Away",
    home: homeTeam?.team?.displayName ?? "Home",
    awayTeamId: awayTeam?.team?.id != null ? String(awayTeam.team.id) : null,
    homeTeamId: homeTeam?.team?.id != null ? String(homeTeam.team.id) : null,
    startTime: event?.date ?? null,
    status: event?.status?.type?.description ?? null,
    network: getBroadcast(competition),
    venue: competition?.venue?.fullName ?? null,
    division: metadata.division ?? null,
    conferences: { away: awayConference, home: homeConference },
    conferenceIds: [...new Set(conferenceIds)],
    awayRank: awayTeam?.curatedRank?.current ?? awayTeam?.rank ?? awayTeam?.team?.rank ?? null,
    homeRank: homeTeam?.curatedRank?.current ?? homeTeam?.rank ?? homeTeam?.team?.rank ?? null
  };
}

function normalizeSingleEvent(event, sportLabel, leagueLabel, fallbackName, networkOverride = null) {
  const competition = event?.competitions?.[0];
  const eventName = event?.name ?? competition?.name ?? fallbackName;
  return {
    id: event?.id ?? null,
    sport: sportLabel,
    league: leagueLabel,
    name: eventName,
    away: leagueLabel,
    home: eventName,
    awayTeamId: null,
    homeTeamId: null,
    startTime: event?.date ?? competition?.date ?? null,
    status: event?.status?.type?.description ?? competition?.status?.type?.description ?? null,
    network: networkOverride ?? getBroadcast(competition),
    venue: competition?.venue?.fullName ?? event?.venue?.fullName ?? null,
    division: null,
    conferences: { away: { id: null, name: null }, home: { id: null, name: null } },
    conferenceIds: [],
    awayRank: null,
    homeRank: null
  };
}

function normalizeRacingEvent(event, leagueLabel) {
  return normalizeSingleEvent(event, "Racing", leagueLabel, "Race");
}

async function normalizeGolfEvent(event, leagueLabel, leagueSlug) {
  const network = await fetchGolfBroadcast(event, leagueSlug);
  return normalizeSingleEvent(event, "Golf", leagueLabel, "Golf Tournament", network || null);
}

async function fetchScoreboard(config, date, groupId = null) {
  let url = `https://site.api.espn.com/apis/site/v2/sports/${config.sport}/${config.league}/scoreboard?dates=${date}`;
  if (groupId) url += `&groups=${groupId}&limit=500`;
  const response = await fetch(url, { headers: { accept: "application/json", "user-agent": "WTG/0.1H8n" } });
  if (!response.ok) throw new Error(`ESPN request failed: ${response.status}`);
  return response.json();
}

async function fetchCollegeFootballRankings(date) {
  const seasonMatch = String(date || "").match(/^(\d{4})/);
  const season = seasonMatch ? seasonMatch[1] : String(new Date().getUTCFullYear());
  const url = `https://site.api.espn.com/apis/site/v2/sports/football/college-football/rankings?season=${encodeURIComponent(season)}`;
  const response = await fetch(url, { headers: { accept: "application/json", "user-agent": "WTG/0.1H8i" } });
  if (!response.ok) throw new Error(`ESPN rankings request failed: ${response.status}`);
  return response.json();
}

function normalizeRankTeamName(value) {
  return String(value || "").toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, " ").trim();
}

function getApTop25Map(data) {
  const rankings = Array.isArray(data?.rankings) ? data.rankings : [];
  const apPoll = rankings.find((poll) => {
    const text = String(poll?.name || poll?.shortName || poll?.headline || poll?.type || "").toLowerCase();
    return text.includes("ap top 25") || text.includes("associated press") || /^ap\b/.test(text);
  });
  const byId = new Map();
  const byName = new Map();
  for (const item of apPoll?.ranks ?? []) {
    const rank = Number(item?.current ?? item?.rank ?? item?.currentRank ?? item?.ranking);
    if (!Number.isFinite(rank) || rank < 1 || rank > 25) continue;
    const team = item?.team ?? {};
    const id = team?.id != null ? String(team.id) : item?.teamId != null ? String(item.teamId) : null;
    if (id) byId.set(id, rank);
    for (const name of [team?.displayName, team?.shortDisplayName, team?.name, team?.location, team?.abbreviation, item?.teamName, item?.name]) {
      const normalized = normalizeRankTeamName(name);
      if (normalized) byName.set(normalized, rank);
    }
  }
  return {
    byId, byName,
    pollName: apPoll?.name || apPoll?.shortName || "AP Top 25",
    rankedTeamCount: byId.size || byName.size,
    week: data?.latestWeek?.number ?? data?.week?.number ?? apPoll?.week ?? null,
    season: data?.latestSeason?.year ?? data?.season?.year ?? null,
    healthy: Boolean(apPoll && (byId.size || byName.size))
  };
}

function rankForGameTeam(game, side, rankMap) {
  const id = game?.[`${side}TeamId`];
  if (id != null && rankMap.byId.has(String(id))) return rankMap.byId.get(String(id));
  const exact = normalizeRankTeamName(game?.[side]);
  if (exact && rankMap.byName.has(exact)) return rankMap.byName.get(exact);
  if (exact.length >= 5) {
    for (const [name, rank] of rankMap.byName.entries()) {
      if (name.length >= 5 && (exact === name || exact.includes(name) || name.includes(exact))) return rank;
    }
  }
  return null;
}

function applyCollegeFootballRankings(games, rankMap) {
  return games.map((game) => ({
    ...game,
    awayRank: rankForGameTeam(game, "away", rankMap) ?? game?.awayRank ?? null,
    homeRank: rankForGameTeam(game, "home", rankMap) ?? game?.homeRank ?? null,
    rankingPoll: rankMap.pollName,
    rankingWeek: rankMap.week,
    rankingSeason: rankMap.season,
    rankingHealthy: rankMap.healthy
  }));
}

function dedupeGames(games) {
  const unique = new Map();
  for (const game of games) {
    const key = game.id ?? `${game.away}|${game.home}|${game.startTime}`;
    if (!unique.has(key)) { unique.set(key, game); continue; }
    const existing = unique.get(key);
    const existingPriority = NCAA_DIVISION_PRIORITY[existing?.division] ?? 99;
    const incomingPriority = NCAA_DIVISION_PRIORITY[game?.division] ?? 99;
    if (incomingPriority < existingPriority) unique.set(key, game);
  }
  return [...unique.values()].sort((a, b) => new Date(a.startTime ?? 0).getTime() - new Date(b.startTime ?? 0).getTime());
}

async function getBaseGames(sportKey, config, date) {
  if (Array.isArray(config?.leagues)) {
    const results = await Promise.allSettled(
      config.leagues.map(async (leagueConfig) => {
        const data = await fetchScoreboard({ sport: config.sport, league: leagueConfig.league }, date);
        const events = data.events ?? [];
        if (sportKey === "golf") {
          return Promise.all(events.map((event) => normalizeGolfEvent(event, leagueConfig.label, leagueConfig.league)));
        }
        return events.map((event) => {
          if (sportKey === "racing") return normalizeRacingEvent(event, leagueConfig.label);
          return normalizeEvent(event, config.label, { league: leagueConfig.label });
        });
      })
    );
    return dedupeGames(results.filter((result) => result.status === "fulfilled").flatMap((result) => result.value));
  }

  if (sportKey !== "ncaaf") {
    const data = await fetchScoreboard(config, date);
    return (data.events ?? []).map((event) => normalizeEvent(event, config.label));
  }

  const results = await Promise.all(NCAA_GROUPS.map(async (group) => {
    const data = await fetchScoreboard(config, date, group.id);
    return (data.events ?? []).map((event) => normalizeEvent(event, config.label, { division: group.division }));
  }));
  const games = dedupeGames(results.flat());
  try {
    const rankingData = await fetchCollegeFootballRankings(date);
    const rankMap = getApTop25Map(rankingData);
    if (!rankMap.healthy) return games.map((game) => ({ ...game, rankingPoll: rankMap.pollName, rankingWeek: rankMap.week, rankingSeason: rankMap.season, rankingHealthy: false }));
    return applyCollegeFootballRankings(games, rankMap);
  } catch (error) {
    console.error("College football rankings lookup error:", error);
    return games;
  }
}

async function addDirectvGuideData(game, sportKey) {
  if (sportKey !== "mlb") return game;
  try {
    const directvGuide = await lookupDirectvGame({ sport: "mlb", away: game.away, home: game.home, zip: "15220" });
    return { ...game, directvGuide };
  } catch (error) {
    console.error("DIRECTV game lookup error:", error);
    return { ...game, directvGuide: null };
  }
}

function normalizeSearchValue(value) {
  return String(value || "").toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

async function fetchLeagueTeams(config) {
  if (Array.isArray(config?.leagues)) {
    const results = await Promise.allSettled(config.leagues.map((league) => fetchLeagueTeams({ sport: config.sport, league: league.league })));
    return { sports: results.filter((result) => result.status === "fulfilled").map((result) => result.value) };
  }
  const url = `https://site.api.espn.com/apis/site/v2/sports/${config.sport}/${config.league}/teams?limit=2000`;
  const response = await fetch(url, { headers: { accept: "application/json", "user-agent": "WTG/0.1H8n" } });
  if (!response.ok) throw new Error(`ESPN teams request failed: ${response.status}`);
  return response.json();
}

function extractTeams(data) {
  const output = [];
  const walk = (value) => {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) { value.forEach(walk); return; }
    const team = value?.team;
    if (team && typeof team === "object" && team.id != null && (team.displayName || team.name)) output.push(team);
    for (const child of Object.values(value)) if (child && typeof child === "object") walk(child);
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
  return normalizeSearchValue([team?.displayName, team?.shortDisplayName, team?.name, team?.nickname, team?.location, team?.abbreviation].filter(Boolean).join(" "));
}

function teamMatchesNextSearch(team, query) {
  const normalized = normalizeSearchValue(query);
  if (!normalized) return false;
  const haystack = teamSearchText(team);
  return normalized.split(" ").filter(Boolean).every((term) => haystack.includes(term));
}

let teamDirectoryCache={expires:0,teams:[]};
async function getTeamDirectory(){
  if(teamDirectoryCache.expires>Date.now()&&teamDirectoryCache.teams.length)return teamDirectoryCache.teams;
  const results=await Promise.allSettled(Object.entries(SPORTS).flatMap(([sportKey,config])=>{
    const leagues=Array.isArray(config.leagues)?config.leagues:[{league:config.league,label:config.label}];
    return leagues.map(async league=>{
      const data=await fetchLeagueTeams({sport:config.sport,league:league.league});
      return extractTeams(data).map(team=>({
        id:String(team.id),sportKey,league:league.label||config.label,
        name:team.displayName||team.name,
        abbreviation:team.abbreviation||"",
        logo:team.logos?.[0]?.href||team.logo||"",
        color:String(team.color||"").replace(/^#/,""),
        alternateColor:String(team.alternateColor||"").replace(/^#/,"")
      }));
    });
  }));
  const seen=new Set();
  const teams=results.filter(result=>result.status==="fulfilled").flatMap(result=>result.value).filter(team=>{
    const key=`${team.sportKey}:${team.id}`;
    if(!team.name||seen.has(key))return false;
    seen.add(key);return true;
  }).sort((a,b)=>a.name.localeCompare(b.name));
  teamDirectoryCache={expires:Date.now()+6*60*60*1000,teams};
  return teams;
}

router.get("/teams",async(req,res)=>{
  const query=String(req.query.q||"").trim();
  if(query.length<2)return res.json({status:"ok",query,count:0,teams:[]});
  try{
    const normalized=normalizeSearchValue(query);
    const teams=(await getTeamDirectory()).filter(team=>{
      const text=normalizeSearchValue(`${team.name} ${team.abbreviation} ${team.league}`);
      return normalized.split(" ").every(term=>text.includes(term));
    }).slice(0,60);
    return res.json({status:"ok",query,count:teams.length,teams});
  }catch(error){
    console.error("Team directory error:",error);
    return res.status(500).json({status:"error",query,count:0,teams:[]});
  }
});

async function fetchTeamSchedule(config, teamId, season) {
  const url = `https://site.api.espn.com/apis/site/v2/sports/${config.sport}/${config.league}/teams/${encodeURIComponent(teamId)}/schedule?season=${encodeURIComponent(season)}`;
  const response = await fetch(url, { headers: { accept: "application/json", "user-agent": "WTG/0.1H8n" } });
  if (!response.ok) throw new Error(`ESPN team schedule request failed: ${response.status}`);
  return response.json();
}

function scheduleEvents(data) {
  if (Array.isArray(data?.events)) return data.events;
  if (Array.isArray(data?.schedule)) return data.schedule;
  return [];
}

async function nextGameForTeam(sportKey, config, team, providerKey) {
  if (Array.isArray(config?.leagues)) return null;
  const now = Date.now();
  const thisYear = new Date().getUTCFullYear();
  const results = await Promise.allSettled([thisYear, thisYear + 1].map((season) => fetchTeamSchedule(config, team.id, season)));
  const events = results.filter((result) => result.status === "fulfilled").flatMap((result) => scheduleEvents(result.value));
  const upcoming = events.filter((event) => {
    const when = new Date(event?.date || 0).getTime();
    const status = String(event?.status?.type?.state || event?.status?.type?.name || event?.status?.type?.description || "").toLowerCase();
    return Number.isFinite(when) && when >= now && !status.includes("final") && !status.includes("post");
  }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  if (!upcoming.length) return null;
  let game = normalizeEvent(upcoming[0], config.label, {});
  game = { ...game, _sportKey: sportKey, searchTeamId: String(team.id), searchTeamName: team.displayName || team.name || null };
  game = resolveGame(game, providerKey);
  return addDirectvGuideData(game, sportKey);
}

router.get("/next", async (req, res) => {
  const query = String(req.query.q || "").trim();
  const providerKey = String(req.query.provider || "directv").toLowerCase().trim();
  if (!query) return res.json({ status: "ok", query, count: 0, games: [] });
  try {
    const leagueResults = await Promise.allSettled(Object.entries(SPORTS).map(async ([sportKey, config]) => {
      if (Array.isArray(config?.leagues)) return [];
      const teamData = await fetchLeagueTeams(config);
      const teams = extractTeams(teamData).filter((team) => teamMatchesNextSearch(team, query)).slice(0, 8);
      const games = await Promise.all(teams.map((team) => nextGameForTeam(sportKey, config, team, providerKey)));
      return games.filter(Boolean);
    }));
    const allGames = leagueResults.filter((result) => result.status === "fulfilled").flatMap((result) => result.value).filter(Boolean);
    const deduped = [];
    const seen = new Set();
    for (const game of allGames.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())) {
      const key = `${game._sportKey}:${game.searchTeamId}:${game.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push(game);
    }
    return res.json({ status: "ok", query, count: deduped.length, games: deduped });
  } catch (error) {
    console.error("Next-game search error:", error);
    return res.status(500).json({ status: "error", query, count: 0, games: [] });
  }
});

router.get("/", async (req, res) => {
  const sportKey = String(req.query.sport ?? "mlb").toLowerCase().trim();
  const config = SPORTS[sportKey];
  if (!config) return res.status(400).json({ status: "error", message: "Unsupported sport" });
  const date = normalizeDate(req.query.date);
  const providerKey = String(req.query.provider ?? "directv").toLowerCase().trim();
  try {
    const baseGames = await getBaseGames(sportKey, config, date);
    const resolvedGames = baseGames.map((game) => resolveGame(game, providerKey));
    const games = await Promise.all(resolvedGames.map((game) => addDirectvGuideData(game, sportKey)));
    return res.json({
      status: "ok", sport: sportKey, date, provider: providerKey, count: games.length,
      leagues: Array.isArray(config?.leagues) ? config.leagues.map((league) => league.label) : undefined,
      divisions: sportKey === "ncaaf" ? ["FBS", "FCS", "DII", "DIII"] : undefined,
      rankingSource: sportKey === "ncaaf" ? (games.find((g) => g?.rankingPoll)?.rankingPoll || null) : undefined,
      rankingWeek: sportKey === "ncaaf" ? (games.find((g) => g?.rankingWeek != null)?.rankingWeek ?? null) : undefined,
      rankingSeason: sportKey === "ncaaf" ? (games.find((g) => g?.rankingSeason != null)?.rankingSeason ?? null) : undefined,
      rankingHealthy: sportKey === "ncaaf" ? Boolean(games.find((g) => g?.rankingHealthy === true)) : undefined,
      rankedTeamCount: sportKey === "ncaaf" ? new Set(games.flatMap((g) => [Number(g?.awayRank) >= 1 && Number(g?.awayRank) <= 25 ? String(g?.awayTeamId || g?.away || "") : null, Number(g?.homeRank) >= 1 && Number(g?.homeRank) <= 25 ? String(g?.homeTeamId || g?.home || "") : null]).filter(Boolean)).size : undefined,
      games
    });
  } catch (error) {
    console.error("Resolve route error:", error);
    return res.status(500).json({ status: "error", message: "Could not resolve games" });
  }
});

export default router;
