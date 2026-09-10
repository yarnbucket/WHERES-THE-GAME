const BACKEND = "https://wheres-the-game.onrender.com";
const FRONTEND = "https://yarnbucket.github.io/WHERES-THE-GAME/";
const TEST_DATE = "20260912";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchWithTimeout(url, options = {}, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal, cache: "no-store" });
  } finally {
    clearTimeout(timer);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function validateOnce() {
  const apiUrl = `${BACKEND}/resolve?sport=rugby&date=${TEST_DATE}&provider=directv&_=${Date.now()}`;
  const apiResponse = await fetchWithTimeout(apiUrl);
  assert(apiResponse.ok, `Rugby API HTTP ${apiResponse.status}`);
  const data = await apiResponse.json();
  const games = Array.isArray(data?.games) ? data.games : [];
  assert(games.length > 0, "Rugby API returned zero games");

  const japanUsa = games.find((game) =>
    game?.id === "wtg-rugby-pnc-japan-usa-20260912" ||
    /japan/i.test(`${game?.away} ${game?.home} ${game?.name}`) && /united states|usa/i.test(`${game?.away} ${game?.home} ${game?.name}`)
  );
  assert(japanUsa, "Expected Japan vs USA regression game is missing");

  const sourceText = JSON.stringify({
    network: japanUsa.network,
    broadcast: japanUsa.broadcast,
    sources: japanUsa.sources,
    streaming: japanUsa.streaming
  });
  assert(/Paramount\+/i.test(sourceText), "Japan vs USA is missing Paramount+");

  const indexResponse = await fetchWithTimeout(`${FRONTEND}index.html?_=${Date.now()}`);
  assert(indexResponse.ok, `Frontend index HTTP ${indexResponse.status}`);
  const indexHtml = await indexResponse.text();
  assert(indexHtml.includes("wtg-rugby-display-patch.js"), "Published frontend is missing Rugby display bridge");

  const bridgeResponse = await fetchWithTimeout(`${FRONTEND}wtg-rugby-display-patch.js?_=${Date.now()}`);
  assert(bridgeResponse.ok, `Rugby frontend bridge HTTP ${bridgeResponse.status}`);
  const bridgeJs = await bridgeResponse.text();
  assert(bridgeJs.includes('selectedSport!=="rugby"'), "Published Rugby bridge content is not current");
  assert(bridgeJs.includes('/resolve?sport=rugby'), "Published Rugby bridge does not call Rugby resolver");

  const renderRoot = await fetchWithTimeout(`${BACKEND}/?_=${Date.now()}`, { redirect: "manual" });
  assert([301, 302, 303, 307, 308].includes(renderRoot.status), `Render root did not redirect; HTTP ${renderRoot.status}`);
  const location = renderRoot.headers.get("location") || "";
  assert(location.startsWith(FRONTEND), `Render root points to wrong frontend: ${location || "missing location"}`);

  console.log(`WTG LIVE VALIDATION PASS: Rugby ${games.length} games; Japan-USA + Paramount+ confirmed; published frontend bridge present; Render root uses single frontend.`);
}

let lastError = null;
for (let attempt = 1; attempt <= 10; attempt += 1) {
  try {
    await validateOnce();
    process.exit(0);
  } catch (error) {
    lastError = error;
    console.error(`WTG live validation attempt ${attempt}/10 failed: ${error.message}`);
    if (attempt < 10) await sleep(15000);
  }
}

console.error(`WTG LIVE VALIDATION FAILED: ${lastError?.message || "unknown error"}`);
process.exit(1);
