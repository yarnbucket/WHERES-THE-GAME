// DIRECTV live sports guide lookup
// Where's the Game

const DIRECTV_SPORT_IDS = {
  mlb: "61"
};

function cleanHtml(value) {
  return String(value ?? "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#39;/gi, "'")
    .replace(/&quot;/gi, "\"")
    .replace(/\s+/g, " ")
    .trim();
}

function normalize(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegex(value) {
  return String(value ?? "")
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function teamAliases(teamName) {
  const normalized = normalize(teamName);
  const words = normalized.split(" ").filter(Boolean);
  const aliases = new Set();

  if (normalized) {
    aliases.add(normalized);
  }

  // Common nickname endings help when DIRECTV abbreviates the city
  // differently from ESPN (example: Los Angeles Angels vs LA Angels).
  if (words.length >= 2) {
    aliases.add(words.slice(-2).join(" "));
  }

  if (words.length >= 1) {
    aliases.add(words.slice(-1).join(" "));
  }

  return [...aliases]
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);
}

function findMatchupIndex(text, away, home) {
  const awayAliases = teamAliases(away);
  const homeAliases = teamAliases(home);

  for (const awayAlias of awayAliases) {
    for (const homeAlias of homeAliases) {
      const awayPattern =
        escapeRegex(awayAlias).replace(/\s+/g, "\\s+");

      const homePattern =
        escapeRegex(homeAlias).replace(/\s+/g, "\\s+");

      const regex = new RegExp(
        `${awayPattern}\\s+(?:at|@|vs\\.?|versus)\\s+${homePattern}`,
        "i"
      );

      const match = regex.exec(text);

      if (match) {
        return match.index;
      }
    }
  }

  return -1;
}

function extractChannels(section) {
  const results = [];

  const regex =
    /Channel\s+(\d+(?:-\d+)?)\s*(HD)?(?:\s*\[([^\]]+)\])?/gi;

  let match;

  while ((match = regex.exec(section)) !== null) {
    const channel = match[1];
    const baseNumber = Number(channel.split("-")[0]);

    // MLB Extra Innings individual game feeds.
    if (baseNumber < 721 || baseNumber > 749) {
      continue;
    }

    if (
      !results.some(
        (item) => item.channel === channel
      )
    ) {
      results.push({
        channel,
        hd: Boolean(match[2]),
        feed: match[3]?.trim() ?? null
      });
    }
  }

  return results;
}

export async function lookupDirectvGame({
  sport,
  away,
  home,
  zip = "15220"
}) {
  const sportKey =
    String(sport ?? "")
      .toLowerCase()
      .trim();

  const sportId =
    DIRECTV_SPORT_IDS[sportKey];

  if (!sportId) {
    return null;
  }

  const url =
    "https://sports.directv.com/local_schedule.htm" +
    `?Submit=View` +
    `&Zip=${encodeURIComponent(zip)}` +
    `&sport=${encodeURIComponent(sportId)}`;

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/152 Safari/537.36",
        "Accept":
          "text/html,application/xhtml+xml"
      }
    });

    if (!response.ok) {
      console.error(
        "DIRECTV response status:",
        response.status
      );

      return null;
    }

    const html =
      await response.text();

    const text =
      cleanHtml(html);

    /*
     * Search the actual cleaned DIRECTV text so the index used
     * for slicing stays aligned with the same string.
     *
     * Also accept shortened team-name variants. This fixes cases
     * such as ESPN "Los Angeles Angels" vs DIRECTV "LA Angels".
     */
    const matchupIndex =
      findMatchupIndex(
        text,
        away,
        home
      );

    if (matchupIndex < 0) {
      console.log(
        `DIRECTV matchup not found: ${away} at ${home}`
      );

      console.log(
        "DIRECTV page sample:",
        text.slice(0, 500)
      );

      return null;
    }

    /*
     * DIRECTV places the feed/channel data immediately after
     * the matchup. Keep the window tight enough to avoid
     * accidentally collecting channels from later games.
     */
    const section =
      text.slice(
        matchupIndex,
        matchupIndex + 500
      );

    const channels =
      extractChannels(section);

    if (channels.length === 0) {
      console.log(
        `DIRECTV matchup found but channel not found: ${away} at ${home}`
      );

      console.log(
        "DIRECTV section:",
        section
      );

      return null;
    }

    return {
      provider: "DIRECTV",
      package: "MLB Extra Innings",
      channels,
      source: "DIRECTV Sports Guide"
    };

  } catch (error) {
    console.error(
      "DIRECTV guide lookup failed:",
      error.message
    );

    return null;
  }
}
