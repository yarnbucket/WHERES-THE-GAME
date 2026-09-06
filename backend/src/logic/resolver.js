// Master source resolver for Where's the Game

const DIRECTV_CHANNELS = {
  ESPN: "206",
  ESPN2: "209",
  ESPNU: "208",
  ESPNEWS: "207",
  FS1: "219",
  FS2: "618",
  "NFL Network": "212",
  "MLB Network": "213",
  "NBA TV": "216",
  "NHL Network": "215",
  TNT: "245",
  TBS: "247",
  truTV: "246",
  USA: "242",
  "CBS Sports Network": "221",
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
  }
};

const STREAMING_SOURCES = {
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
  Netflix: {
    service: "Netflix",
    type: "streaming"
  },
  "Apple TV+": {
    service: "Apple TV+",
    type: "streaming"
  },
  AppleTV: {
    service: "Apple TV+",
    type: "streaming"
  },
  "Apple TV": {
    service: "Apple TV+",
    type: "streaming"
  },
  Hulu: {
    service: "Hulu",
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

function isPittsburghTeam(game) {
  const teams =
    `${game?.away ?? ""} ${game?.home ?? ""}`.toLowerCase();

  return (
    teams.includes("pittsburgh pirates") ||
    teams.includes("pittsburgh penguins")
  );
}

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
  const key = Object.keys(map).find(
    (name) =>
      name.toLowerCase() === source.toLowerCase()
  );

  return key ?? null;
}

export function resolveSource(source) {
  const cleanSource = normalizeSourceName(source);

  if (!cleanSource) {
    return null;
  }

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

  // Common team-branded streaming feeds
  if (/\.TV$/i.test(cleanSource)) {
    return {
      source: cleanSource,
      service: cleanSource,
      type: "streaming"
    };
  }

  return {
    source: cleanSource,
    type: "unknown",
    directvChannel: null,
    note: "Source recognized from schedule but not yet mapped"
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
    (item) => item.type === "streaming"
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

    // Keep this for the current frontend
    directv,

    // New master source data
    sources,
    streaming
  };
}
