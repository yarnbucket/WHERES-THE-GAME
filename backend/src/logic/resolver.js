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
  BTN: "610"
};

const LOCAL_NETWORKS = ["ABC", "CBS", "FOX", "NBC"];

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
        type: "national"
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
    directv: resolveNetwork(game.network)
  };
}
