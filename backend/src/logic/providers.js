// Provider engine for Where's the Game
// Assumption: user has the full sports package / premium add-ons
// for the provider selected in Settings.

export const PROVIDERS = {
  directv: {
    name: "DIRECTV",
    type: "satellite",

    channels: {
      ESPN: "206",
      ESPN2: "209",
      ESPNEWS: "207",
      ESPNU: "208",
      "ESPN Deportes": "466",

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
      "Tennis Channel": "217",
      "Golf Channel": "218",
      "Golf Chnl": "218",
      GOLF: "218",

      BTN: "610",
      "Big Ten Network": "610",

      SEC: "611",
      "SEC Network": "611",

      ACCN: "612",
      "ACC Network": "612",

      "SportsNet Pittsburgh": "659"
    },

    locals: {
      ABC: {
        channel: "4",
        station: "WTAE"
      },

      CBS: {
        channel: "2",
        station: "KDKA"
      },

      FOX: {
        channel: "53",
        station: "WPGH"
      },

      NBC: {
        channel: "11",
        station: "WPXI"
      },

      CW: {
        channel: null,
        station: "The CW"
      },

      "The CW": {
        channel: null,
        station: "The CW"
      }
    },

    leaguePackages: {
      mlb: {
        name: "MLB Extra Innings",
        channelRange: "719-749",
        streaming: "MLB.TV",
        blackoutRules: true
      },

      nba: {
        name: "NBA League Pass",
        channelRange: null,
        streaming: "NBA League Pass",
        blackoutRules: true
      },

      nhl: {
        name: "NHL Center Ice",
        channelRange: "770-793",
        streaming: null,
        blackoutRules: true
      }
    }
  },

  xfinity: {
    name: "Xfinity / Comcast",
    type: "cable",

    channels: {},

    locals: {},

    leaguePackages: {
      mlb: {
        name: "MLB Extra Innings",
        channelRange: null,
        streaming: "MLB.TV",
        blackoutRules: true
      },

      nba: {
        name: "NBA League Pass",
        channelRange: null,
        streaming: "NBA League Pass",
        blackoutRules: true
      },

      nhl: {
        name: "NHL Center Ice",
        channelRange: null,
        streaming: null,
        blackoutRules: true
      }
    }
  },

  fios: {
    name: "Verizon Fios",
    type: "fiber",

    channels: {},

    locals: {},

    leaguePackages: {
      mlb: {
        name: "MLB Extra Innings",
        channelRange: null,
        streaming: "MLB.TV",
        blackoutRules: true
      },

      nba: {
        name: "NBA League Pass",
        channelRange: null,
        streaming: "NBA League Pass",
        blackoutRules: true
      },

      nhl: {
        name: "NHL Center Ice",
        channelRange: "770-793",
        streaming: null,
        blackoutRules: true
      }
    }
  },

  sling: {
    name: "Sling",
    type: "streaming-tv",

    channels: {
      ESPN: null,
      ESPN2: null,
      ESPNU: null,
      ESPNEWS: null,

      FS1: null,
      FS2: null,

      "NFL Network": null,
      "MLB Network": null,
      "NBA TV": null,
      "NHL Network": null,

      "CBS Sports Network": null,
      "Tennis Channel": null,
      "Golf Channel": null,
      "Golf Chnl": null,

      BTN: null,
      "Big Ten Network": null,

      SEC: null,
      "SEC Network": null,

      ACCN: null,
      "ACC Network": null
    },

    locals: {},

    leaguePackages: {}
  }
};

export const STREAMING_SERVICES = {
  "ESPN+": {
    name: "ESPN+"
  },

  ESPN: {
    name: "ESPN"
  },

  "Disney+": {
    name: "Disney+"
  },

  Peacock: {
    name: "Peacock"
  },

  "Prime Video": {
    name: "Prime Video"
  },

  Netflix: {
    name: "Netflix"
  },

  "Apple TV": {
    name: "Apple TV"
  },

  "Apple TV+": {
    name: "Apple TV+"
  },

  "Paramount+": {
    name: "Paramount+"
  },

  Hulu: {
    name: "Hulu"
  },

  "Hulu + Live TV": {
    name: "Hulu + Live TV"
  },

  "YouTube TV": {
    name: "YouTube TV"
  },

  "MLB.TV": {
    name: "MLB.TV"
  },

  "NBA League Pass": {
    name: "NBA League Pass"
  },

  "NFL+": {
    name: "NFL+"
  }
};

export function getProvider(providerKey = "directv") {
  return PROVIDERS[providerKey] ?? PROVIDERS.directv;
}

export function getProviderChannel(
  providerKey,
  network
) {
  const provider = getProvider(providerKey);

  if (!network) {
    return null;
  }

  const cleanNetwork = String(network).trim();

  const exact =
    provider.channels?.[cleanNetwork];

  if (exact !== undefined) {
    return {
      provider: provider.name,
      network: cleanNetwork,
      channel: exact
    };
  }

  const channelKey =
    Object.keys(
      provider.channels ?? {}
    ).find(
      (name) =>
        name.toLowerCase() ===
        cleanNetwork.toLowerCase()
    );

  if (channelKey) {
    return {
      provider: provider.name,
      network: channelKey,
      channel:
        provider.channels[channelKey]
    };
  }

  const localKey =
    Object.keys(
      provider.locals ?? {}
    ).find(
      (name) =>
        name.toLowerCase() ===
        cleanNetwork.toLowerCase()
    );

  if (localKey) {
    return {
      provider: provider.name,
      network: localKey,
      type: "local",
      ...provider.locals[localKey]
    };
  }

  return null;
}

export function getLeaguePackage(
  providerKey,
  sport
) {
  const provider = getProvider(providerKey);

  return (
    provider.leaguePackages?.[sport] ??
    null
  );
}