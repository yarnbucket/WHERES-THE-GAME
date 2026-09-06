// Resolver engine for Where's the Game

const DIRECTV_CHANNELS = {
  ESPN: "206",
  ESPN2: "209",
  ESPNU: "208",
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
  ACCN: "612",
  BTN: "610",

  // Pittsburgh regional sports
  "SportsNet Pittsburgh": "659",
  "SportsNet Pittsburgh HD": "659",
  "AT&T SportsNet Pittsburgh": "659",
  SNP: "659"
};

const LOCAL_NETWORKS = ["ABC", "CBS", "FOX", "NBC"];

function isPittsburghTeam(game) {
  const teams = `${game?.away ?? ""} ${game?.home ?? ""}`.toLowerCase();

  return (
    teams.includes("pittsburgh pirates") ||
    teams.includes("pittsburgh penguins")
  );
}

export function resolveNetwork(networkString) {
  if (!networkString) {
    return [];
  }

  const networks = networkString
    .split(",")
    .map((network) => network.trim())
    .filter(Boolean);

  return networks.map((network) => {
    if (DIRECTV_CHANNELS[network]) {
      return {
        network,
        directvChannel: DIRECTV_CHANNELS[network],
        type:
          DIRECTV_CHANNELS[network] === "659"
            ? "regional"
            : "national"
      };
    }

    if (LOCAL_NETWORKS.includes(network)) {
      return {
        network,
        directvChannel: null,
        type: "local",
        note: "DIRECTV local channel varies by ZIP code"
      };
    }

    return {
      network,
      directvChannel: null,
      type: "unknown",
      note: "DIRECTV mapping not yet available"
    };
  });
}

export function resolveGame(game) {
  const directv = resolveNetwork(game.network);

  // If ESPN does not provide the Pittsburgh regional feed,
  // add SportsNet Pittsburgh as the regional DIRECTV option
  // for Pirates and Penguins games unless a recognized
  // national/local DIRECTV broadcast is already present.
  const hasRecognizedBroadcast = directv.some(
    (item) =>
      item.type === "national" ||
      item.type === "local" ||
      item.type === "regional"
  );

  if (isPittsburghTeam(game) && !hasRecognizedBroadcast) {
    directv.push({
      network: "SportsNet Pittsburgh",
      directvChannel: "659",
      type: "regional",
      note: "Pittsburgh regional feed"
    });
  }

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
    directv
  };
}
