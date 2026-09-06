import {
  getProviderChannel,
  getLeaguePackage
} from "./providers.js";

// Master source resolver for Where's the Game

const DIRECTV_CHANNELS = {
  // ESPN family
  ESPN: "206",
  ESPN2: "209",
  ESPNEWS: "207",
  ESPNU: "208",

  // FOX family
  FS1: "219",
  FS2: "618",

  // League networks
  "NFL Network": "212",
  "MLB Network": "213",
  "NBA TV": "216",
  "NHL Network": "215",

  // Turner / entertainment sports
  TNT: "245",
  TBS: "247",
  truTV: "246",
  USA: "242",

  // Other national sports networks
  "CBS Sports Network": "221",

  // College sports
  SEC: "611",
  "SEC Network": "611",
  ACCN: "612",
  "ACC Network": "612",
  BTN: "610",
  "Big Ten Network": "610",

  // Pittsburgh regional sports
  "SportsNet Pittsburgh": "659",
  "SportsNet Pittsburgh HD": "659",
  "AT&T SportsNet Pittsburgh": "659",
  SNP: "659"
};

const PITTSBURGH_LOCAL_CHANNELS = {
  ABC: {
    directvChannel: "4",
    station: "WTAE",
    type: "local"
  },

  CBS: {
    directvChannel: "2",
    station: "KDKA",
    type: "local"
  },

  FOX: {
    directvChannel: "53",
    station: "WPGH",
    type: "local"
  },

  NBC: {
    directvChannel: "11",
    station: "WPXI",
    type: "local"
  },

  CW: {
    directvChannel: null,
    station: "The CW",
    type: "local",
    note: "Local DIRECTV channel varies by market"
  },

  "The CW": {
    directvChannel: null,
    station: "The CW",
    type: "local",
    note: "Local DIRECTV channel varies by market"
  }
};

const STREAMING_SOURCES = {
  // ESPN streaming
  ACCNX: {
    service: "ESPN",
    type: "streaming",
    note: "ACC Network Extra"
  },

  "ACC Network Extra": {
    service: "ESPN",
    type: "streaming",
    note: "ACC Network Extra"
  },

  "SEC Network+": {
    service: "ESPN",
    type: "streaming",
    note: "SEC Network+"
  },

  SECN+: {
    service: "ESPN",
    type: "streaming",
    note: "SEC Network+"
  },

  "ESPN+": {
    service: "ESPN+",
    type: "streaming"
  },

  "ESPN Plus": {
    service: "ESPN+",
    type: "streaming"
  },

  // Major streaming services
  Peacock: {
    service: "Peacock",
    type: "streaming"
  },

  "Prime Video": {
    service: "Prime Video",
    type: "streaming"
  },

  Amazon: {
    service: "Prime Video",
    type: "streaming"
  },

  "Amazon Prime Video": {
    service: "Prime Video",
    type: "streaming"
  },

  Netflix: {
    service: "Netflix",
    type: "streaming"
  },

  "Apple TV+": {
    service: "Apple TV+",
    type: "streaming"
  },

  "Apple TV": {
    service: "Apple TV",
    type: "streaming"
  },

  AppleTV: {
    service: "Apple TV",
    type: "streaming"
  },

  Hulu: {
    service: "Hulu",
    type: "streaming"
  },

  "Hulu + Live TV": {
    service: "Hulu + Live TV",
    type: "streaming"
  },

  YouTube: {
    service: "YouTube",
    type: "streaming"
  },

  "YouTube TV": {
    service: "YouTube TV",
    type: "streaming"
  },

  Paramount: {
    service: "Paramount+",
    type: "streaming"
  },

  "Paramount+": {
    service: "Paramount+",
    type: "streaming"
  },

  "NFL+": {
    service: "NFL+",
    type: "streaming"
  },

  "NFL Sunday Ticket": {
    service: "NFL Sunday Ticket",
    type: "streaming"
  },

  "MLB.TV": {
    service: "MLB.TV",
    type: "streaming"
  },

  "NBA League Pass": {
    service: "NBA League Pass",
    type: "streaming"
  },

  "NHL Power Play": {
    service: "ESPN+",
    type: "streaming"
  }
};

function normalizeSourceName(source) {
  return String(source ?? "")
    .trim()
    .replace(/\s+/g, " ");
}

function splitSources(sourceString) {
  if (!sourceString) {
    return [];
  }

  return String(sourceString)
    .split(",")
    .map(normalizeSourceName)
    .filter(Boolean);
}

function findCaseInsensitive(map, source) {
  return (
    Object.keys(map).find(
      (name) =>
        name.toLowerCase() === source.toLowerCase()
    ) ?? null
  );
}

function isPittsburghTeam(game) {
  const teams =
    `${game?.away ?? ""} ${game?.home ?? ""}`.toLowerCase();

  return (
    teams.includes("pittsburgh pirates") ||
    teams.includes("pittsburgh penguins")
  );
}

export function resolveSource(source) {
  const cleanSource = normalizeSourceName(source);

  if (!cleanSource) {
    return null;
  }

  // DIRECTV national / regional channels
  const directvKey = findCaseInsensitive(
    DIRECTV_CHANNELS,
    cleanSource
  );

  if (directvKey) {
    const channel = DIRECTV_CHANNELS[directvKey];

    return {
      source: cleanSource,
      network: directvKey,
      directvChannel: channel,
      type:
        channel === "659"
          ? "regional"
          : "national"
    };
  }

  // Pittsburgh local broadcast profile
  const localKey = findCaseInsensitive(
    PITTSBURGH_LOCAL_CHANNELS,
    cleanSource
  );

  if (localKey) {
    return {
      source: cleanSource,
      network: localKey,
      ...PITTSBURGH_LOCAL_CHANNELS[localKey],
      market: "Pittsburgh",
      zipProfile: "15220"
    };
  }

  // Known streaming sources
  const streamingKey = findCaseInsensitive(
    STREAMING_SOURCES,
    cleanSource
  );

  if (streamingKey) {
    return {
      source: cleanSource,
      ...STREAMING_SOURCES[streamingKey]
    };
  }

  // Team-branded regional TV feeds
  // Examples: Reds.TV, Brewers.TV, Padres.TV, Rockies.TV
  if (/\.TV$/i.test(cleanSource)) {
    return {
      source: cleanSource,
      network: cleanSource,
      service: cleanSource,
      directvChannel: null,
      type: "regional",
      streaming: true,
      note:
        "Regional TV / streaming service; DIRECTV availability varies by market"
    };
  }

  // Unknown sources are preserved instead of discarded
  return {
    source: cleanSource,
    type: "unknown",
    directvChannel: null,
    note:
      "Source recognized from schedule but not yet mapped"
  };
}

export function resolveNetwork(networkString) {
  return splitSources(networkString)
    .map(resolveSource)
    .filter(Boolean);
}

export function resolveGame(game) {
  const sources = resolveNetwork(game.network);

  const hasRecognizedTvSource = sources.some(
    (item) =>
      item.type === "national" ||
      item.type === "local" ||
      item.type === "regional"
  );

  // Pittsburgh fallback for Pirates / Penguins
  if (
    isPittsburghTeam(game) &&
    !hasRecognizedTvSource
  ) {
    sources.push({
      source: "SportsNet Pittsburgh",
      network: "SportsNet Pittsburgh",
      directvChannel: "659",
      type: "regional",
      market: "Pittsburgh",
      note: "Pittsburgh regional feed"
    });
  }

  const directv = sources.filter(
    (item) =>
      item.directvChannel ||
      item.type === "local" ||
      item.type === "regional" ||
      item.type === "national"
  );

  const streaming = sources.filter(
    (item) =>
      item.type === "streaming" ||
      item.streaming === true
  );

  return {
    id: game.id ?? null,
    sport: game.sport ?? null,
    name: game.name ?? null,
    away: game.away ?? null,
    home: game.home ?? null,
    startTime: game.startTime ?? null,
    status: game.status ?? null,
    venue: game.venue ?? null,
    broadcast: game.network ?? null,

    // Current frontend compatibility
    directv,

    // Master viewing-source data
    sources,
    streaming
  };
}
