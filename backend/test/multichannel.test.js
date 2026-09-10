import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

test("the multi-channel patch deduplicates aliases sharing one channel number", () => {
  const context = {
    console,
    window: { getDirectvDisplay: () => ({ label: "DIRECTV", channel: "—", note: "" }) },
    document: {
      head: { appendChild() {} },
      body: {},
      createElement: () => ({}) ,
      querySelectorAll: () => []
    },
    MutationObserver: class { observe() {} },
    queueMicrotask() {}
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(new URL("../../wtg-multichannel-patch.js", import.meta.url), "utf8"), context);

  const display = context.window.getDirectvDisplay({
    directv: [
      { directvChannel: "206", network: "ESPN", type: "national" },
      { directvChannel: "206", network: "ESPN HD", type: "national" },
      { directvChannel: "4", station: "WTAE", type: "local" }
    ]
  });

  assert.deepEqual(JSON.parse(JSON.stringify(display.channels)), [
    { channel: "4", label: "WTAE" },
    { channel: "206", label: "ESPN" }
  ]);
  assert.equal(display.hiddenChannelCount, 0);
});
