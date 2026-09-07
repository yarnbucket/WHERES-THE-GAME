// DIRECTV live sports guide lookup
// Where's the Game
// WTG 0.1Ba: bound each lookup to one matchup to prevent channel bleed.

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

  if (normalized) aliases.add(normalized);

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

function findMatchup(text, away, home) {
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
        return {
          index: match.index,
          end: match.index + match[0].length
        };
      }
    }
  }

  return null;
}

function findNextMatchupIndex(text, startIndex) {
  const remainder = text.slice(startIndex);

  // DIRECTV's cleaned schedule is a sequence of matchup titles followed by
  // channel lines. Stop at the next matchup title instead of reading a fixed
  // number of characters into the next game's listing.
  const nextMatchupRegex =
    /\b[A-Z][A-Za-z0-9.&'’()/-]*(?:\s+[A-Z][A-Za-z0-9.&'’()/-]*){0,5}\s+(?:at|@|vs\.?|versus)\s+[A-Z][A-Za-z0-9.&'’()/-]*(?:\s+[A-Z][A-Za-z0-9.&'’()/-]*){0,5}\b/;

  const match = nextMatchupRegex.exec(remainder);

  return match
    ? startIndex + match.index
    : text.length;
}

function channelType(channel) {
  if (channel === "213") {
    return {
      type: "national",
      network: "MLB Network"
    };
  }

  if (channel === "213-1") {
    return {
      type: "national",
      network: "MLB Network Alt"
    };
  }

  if (channel === "659") {
    return {
      type: "regional",
      network: "SportsNet Pittsburgh"
    };
  }

  if (channel === "659-1") {
    return {
      type: "regional",
      network: "SportsNet Pittsburgh Plus"
    };
  }

  const baseNumber = Number(channel.split("-")[0]);

  if (baseNumber >= 721 && baseNumber <= 749) {
    return {
      type: "package",
      network: "MLB Extra Innings"
    };
  }

  return null;
}

function extractChannels(section) {
  const results = [];

  const regex =
    /Channel\s+(\d+(?:-\d+)?)\s*(HD)?(?:\s*\[([^\]]+)\])?/gi;

  let match;

  while ((match = regex.exec(section)) !== null) {
    const channel = match[1];
    const metadata = channelType(channel);

    if (!metadata) {
      continue;
    }

    if (!results.some((item) => item.channel === channel)) {
      results.push({
        channel,
        hd: Boolean(match[2]),
        feed: match[3]?.trim() ?? null,
        type: metadata.type,
        network: metadata.network
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

    const html = await response.text();
    const text = cleanHtml(html);

    const matchup =
      findMatchup(
        text,
        away,
        home
      );

    if (!matchup) {
      console.log(
        `DIRECTV matchup not found: ${away} at ${home}`
      );

      return null;
    }

    const nextMatchupIndex =
      findNextMatchupIndex(
        text,
        matchup.end
      );

    const section =
      text.slice(
        matchup.index,
        nextMatchupIndex
      );

    const channels =
      extractChannels(section);

    if (channels.length === 0) {
      console.log(
        `DIRECTV matchup found but channel not found: ${away} at ${home}`
      );

      return null;
    }

    return {
      provider: "DIRECTV",
      package:
        channels.some((item) => item.type === "package")
          ? "MLB Extra Innings"
          : null,
      channels,
      source: "DIRECTV Sports Guide",
      zip
    };

  } catch (error) {
    console.error(
      "DIRECTV guide lookup failed:",
      error.message
    );

    return null;
  }
}
