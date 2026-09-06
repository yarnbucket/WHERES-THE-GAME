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

function extractChannels(section) {
  const results = [];

  const regex =
    /Channel\s+(\d+(?:-\d+)?)\s*(HD)?(?:\s*\[([^\]]+)\])?/gi;

  let match;

  while ((match = regex.exec(section)) !== null) {
    const channel = match[1];
    const baseNumber = Number(channel.split("-")[0]);

    // MLB Extra Innings game channels
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

    const normalizedText =
      normalize(text);

    const matchup =
      normalize(
        `${away} at ${home}`
      );

    const matchupIndex =
      normalizedText.indexOf(matchup);

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
     * The channel information appears immediately
     * after the matchup on DIRECTV's schedule.
     */
    const section =
      text.slice(
        matchupIndex,
        matchupIndex + 700
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
