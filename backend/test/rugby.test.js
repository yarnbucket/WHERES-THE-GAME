import test from "node:test";
import assert from "node:assert/strict";
import { dedupeRugbyGames } from "../src/routes/rugby.js";

test("live Rugby data wins over a matching verified fallback", () => {
  const live = {
    id: "espn-1",
    away: "Japan",
    home: "United States of America",
    startTime: "2026-09-12T10:10:00Z",
    network: "CBS"
  };
  const fallback = {
    id: "fallback-1",
    away: "Japan",
    home: "United States of America",
    startTime: "2026-09-12T10:05:00Z",
    network: "Paramount+",
    verifiedFallback: true
  };

  assert.deepEqual(dedupeRugbyGames([live, fallback]), [live]);
});

test("a missing live matchup is filled by the verified fallback", () => {
  const live = {
    id: "espn-1",
    away: "Fiji",
    home: "Canada",
    startTime: "2026-09-12T07:00:00Z"
  };
  const fallback = {
    id: "fallback-2",
    away: "South Africa",
    home: "New Zealand",
    startTime: "2026-09-12T21:00:00Z",
    verifiedFallback: true
  };

  assert.deepEqual(dedupeRugbyGames([live, fallback]), [live, fallback]);
});
