// DIRECTV live sports guide lookup
// Where's the Game
//
// Pulls DIRECTV's current sports schedule and
// tries to match a specific game to its listed channel(s).

const DIRECTV_SPORT_IDS = {
  mlb: "61"
};

function normalizeTeamName(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/\bthe\b/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripHtml(value) {
  return String(value ?? "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function extractChannels(text) {
  const results = [];

  const regex =
    /Channel\s+(\d+(?:-\d+)?)\s*(HD)?(?:\s*\[([^\]]+)\])?/gi;

  let match;

  while ((match = regex.exec(text)) !== null) {
    results.push({
      channel: match[1],
      hd: Boolean(match[2]),
      feed: match[3]?.trim() ?? null
    });
  }

  return results;
}

function scoreGameMatch(text, away, home) {
  const cleanText = normalizeTeamName(text);
  const cleanAway = normalizeTeamName(away);
  const cleanHome = normalizeTeamName(home);

  let score = 0;

  if (
    cleanAway &&
    cleanText.includes(cleanAway)
  ) {
    score += 2;
  }

  if (
    cleanHome &&
    cleanText.includes(cleanHome)
  ) {
    score += 2;
  }

  // Also try the last word, usually team nickname/city.
  const awayWords = cleanAway.split(" ");
  const homeWords = cleanHome.split(" ");

  const awayLast =
    awayWords[awayWords.length - 1];

  const homeLast =
    homeWords[homeWords.length - 1];

  if (
    awayLast &&
    cleanText.includes(awayLast)
  ) {
    score += 1;
  }

  if (
    homeLast &&
    cleanText.includes(homeLast)
  ) {
    score += 1;
  }

  return score;
}

export async function lookupDirectvGame({
  sport,
  away,
  home,
  zip = "15220"
}) {
  const sportId =
    DIRECTV_SPORT_IDS[
      String(sport ?? "").toLowerCase()
    ];

  if (!sportId) {
    return null;
  }

  const url =
    "https://sports.directv.com/local_schedule.htm" +
    `?Submit=View&Zip=${encodeURIComponent(zip)}` +
    `&sport=${encodeURIComponent(sportId)}`;

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 Where's-the-Game"
      }
    });

    if (!response.ok) {
      throw new Error(
        `DIRECTV guide request failed: ${response.status}`
      );
    }

    const html =
      await response.text();

    /*
     * DIRECTV's schedule is HTML, not JSON.
     * Split around common date/game boundaries so
     * we can evaluate smaller chunks.
     */
    const chunks =
      html.split(
        /(?:<tr\b|<\/tr>|<br\s*\/?>)/i
      );

    let best = null;

    for (const chunk of chunks) {
      const text = stripHtml(chunk);

      if (!text) {
        continue;
      }

      const score =
        scoreGameMatch(
          text,
          away,
          home
        );

      if (score < 2) {
        continue;
      }

      const channels =
        extractChannels(text);

      if (channels.length === 0) {
        continue;
      }

      if (
        !best ||
        score > best.score
      ) {
        best = {
          score,
          text,
          channels
        };
      }
    }

    if (!best) {
      /*
       * Fallback:
       * search the full page around the matchup.
       */
      const fullText = stripHtml(html);

      const awayNormalized =
        normalizeTeamName(away);

      const homeNormalized =
        normalizeTeamName(home);

      const lower =
        fullText.toLowerCase();

      let index = -1;

      if (awayNormalized) {
        index =
          lower.indexOf(
            awayNormalized
          );
      }

      if (
        index < 0 &&
        homeNormalized
      ) {
        index =
          lower.indexOf(
            homeNormalized
          );
      }

      if (index >= 0) {
        const section =
          fullText.slice(
            Math.max(0, index - 150),
            index + 700
          );

        const channels =
          extractChannels(section);

        if (channels.length > 0) {
          return {
            provider: "DIRECTV",
            package:
              "MLB Extra Innings",
            channels,
            source:
              "DIRECTV Sports Guide"
          };
        }
      }

      return null;
    }

    return {
      provider: "DIRECTV",
      package:
        "MLB Extra Innings",
      channels: best.channels,
      source:
        "DIRECTV Sports Guide"
    };

  } catch (error) {
    console.error(
      "DIRECTV guide lookup failed:",
      error.message
    );

    return null;
  }
}