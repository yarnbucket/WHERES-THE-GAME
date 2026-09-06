// DIRECTV channel lookup for Where's the Game
import express from "express";

const router = express.Router();

const DIRECTV_CHANNELS = {
  ESPN: {
    channel: "206",
    type: "national"
  },
  ESPN2: {
    channel: "209",
    type: "national"
  },
  ESPNU: {
    channel: "208",
    type: "national"
  },
  FS1: {
    channel: "219",
    type: "national"
  },
  FS2: {
    channel: "618",
    type: "national"
  },
  "NFL Network": {
    channel: "212",
    type: "national"
  },
  "MLB Network": {
    channel: "213",
    type: "national"
  },
  "NBA TV": {
    channel: "216",
    type: "national"
  },
  "NHL Network": {
    channel: "215",
    type: "national"
  },
  TNT: {
    channel: "245",
    type: "national"
  },
  TBS: {
    channel: "247",
    type: "national"
  },
  truTV: {
    channel: "246",
    type: "national"
  },
  USA: {
    channel: "242",
    type: "national"
  },
  "CBS Sports Network": {
    channel: "221",
    type: "national"
  },
  SEC: {
    channel: "611",
    type: "national"
  },
  ACCN: {
    channel: "612",
    type: "national"
  },
  BTN: {
    channel: "610",
    type: "national"
  },

  ABC: {
    channel: null,
    type: "local",
    note: "Local DIRECTV channel varies by ZIP code"
  },
  CBS: {
    channel: null,
    type: "local",
    note: "Local DIRECTV channel varies by ZIP code"
  },
  FOX: {
    channel: null,
    type: "local",
    note: "Local DIRECTV channel varies by ZIP code"
  },
  NBC: {
    channel: null,
    type: "local",
    note: "Local DIRECTV channel varies by ZIP code"
  }
};

function lookupChannel(network) {
  if (!network) return null;

  const exact = DIRECTV_CHANNELS[network];

  if (exact) {
    return {
      network,
      ...exact
    };
  }

  return {
    network,
    channel: null,
    type: "unknown",
    note: "DIRECTV channel mapping not yet available"
  };
}

// GET /channels
// Example: /channels?network=ESPN
router.get("/", (req, res) => {
  const network = String(req.query.network ?? "").trim();

  if (!network) {
    return res.json({
      status: "ok",
      count: Object.keys(DIRECTV_CHANNELS).length,
      channels: DIRECTV_CHANNELS
    });
  }

  res.json({
    status: "ok",
    result: lookupChannel(network)
  });
});

export default router;
"SportsNet Pittsburgh": {
  channel: "659",
  type: "regional",
  market: "Pittsburgh"
},

"SportsNet Pittsburgh HD": {
  channel: "659",
  type: "regional",
  market: "Pittsburgh"
},

"AT&T SportsNet Pittsburgh": {
  channel: "659",
  type: "regional",
  market: "Pittsburgh"
},
