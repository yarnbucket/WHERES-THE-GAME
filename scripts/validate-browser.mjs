import { chromium } from "playwright";

const FRONTEND = "https://yarnbucket.github.io/WHERES-THE-GAME/";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 412, height: 915 } });

try {
  await page.addInitScript(() => {
    localStorage.setItem("wtg-viewing-mode", "standard");
  });

  await page.goto(`${FRONTEND}?e2e=${Date.now()}`, {
    waitUntil: "networkidle",
    timeout: 60000
  });

  await page.waitForFunction(() => typeof loadGames === "function", null, { timeout: 20000 });

  await page.evaluate(async () => {
    selectedViewingMode = "standard";
    selectedSport = "rugby";
    selectedDate = new Date("2026-09-12T12:00:00-04:00");
    favoritesOnly = false;
    activeCollegeFilter = "all";
    activeProFilter = "all";
    renderSportTabs();
    renderCollegeFilter();
    renderProFilter();
    await loadGames();
  });

  await page.waitForFunction(() => {
    const cards = document.querySelectorAll(".game-card");
    const text = document.body.innerText;
    return cards.length > 0 && /Japan/i.test(text) && /United States|USA/i.test(text) && /Paramount\+/i.test(text);
  }, null, { timeout: 30000 });

  const result = await page.evaluate(() => ({
    cardCount: document.querySelectorAll(".game-card").length,
    title: document.getElementById("scheduleTitle")?.textContent || "",
    text: document.getElementById("gamesList")?.innerText || ""
  }));

  if (!/Rugby/i.test(result.title)) throw new Error(`Rugby title not active: ${result.title}`);
  if (!/Japan/i.test(result.text) || !/United States|USA/i.test(result.text)) throw new Error("Japan vs USA is not rendered");
  if (!/Paramount\+/i.test(result.text)) throw new Error("Paramount+ is not rendered");

  console.log(`WTG BROWSER VALIDATION PASS: ${result.cardCount} Rugby card(s) rendered on mobile viewport; Japan-USA and Paramount+ visible.`);
} catch (error) {
  console.error(`WTG BROWSER VALIDATION FAILED: ${error.message}`);
  console.error(await page.locator("body").innerText().catch(() => "Unable to read page body"));
  process.exitCode = 1;
} finally {
  await browser.close();
}
