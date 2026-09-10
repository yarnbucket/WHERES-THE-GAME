import test from "node:test";
import assert from "node:assert/strict";
import { normalizeWrestlingEvent, televisedWrestlingGames } from "../src/routes/collegeWrestling.js";

const feed = { label: "NCAA Women's Wrestling", gender: "women" };

function event(network = "ESPN+") {
  return {
    id: "w-1",
    date: "2026-11-15T19:00:00Z",
    name: "Iowa vs North Central",
    competitions: [{
      venue: { fullName: "Carver-Hawkeye Arena" },
      broadcasts: network ? [{ names: [network] }] : [],
      competitors: [
        { homeAway: "home", team: { id: "1", displayName: "Iowa Hawkeyes" } },
        { homeAway: "away", team: { id: "2", displayName: "North Central Cardinals" } }
      ]
    }]
  };
}

test("normalizes a women's wrestling dual with its viewing source", () => {
  const game = normalizeWrestlingEvent(event(), feed);
  assert.equal(game.gender, "women");
  assert.equal(game.network, "ESPN+");
  assert.equal(game.home, "Iowa Hawkeyes");
  assert.equal(game.away, "North Central Cardinals");
});

test("TV-first filtering excludes meets without a viewing source", () => {
  const televised = normalizeWrestlingEvent(event("Big Ten Network"), feed);
  const untelevised = { ...normalizeWrestlingEvent(event(""), feed), id: "w-2" };
  assert.deepEqual(televisedWrestlingGames([televised, untelevised]), [televised]);
});

test("duplicate feed candidates produce only one wrestling card", () => {
  const game = normalizeWrestlingEvent(event(), feed);
  assert.equal(televisedWrestlingGames([game, { ...game, id: "duplicate" }]).length, 1);
});
