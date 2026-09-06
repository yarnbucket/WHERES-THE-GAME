// DIRECTV live sports guide lookup
// Where's the Game

const DIRECTV_SPORT_IDS = {
  mlb: "61"
};

function cleanText(value) {
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
    .replace(/\bla\b/g, "los angeles")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getUsefulTeamTerms(teamName) {
  const words = normalize(teamName)
    .split(" ")
    .filter(Boolean);

  if (words.length === 0) {
    return [];
  }

  const terms = [];

  // Full team name
  terms.push(words.join(" "));

  // Nickname
  terms.push(words[words.length - 1]);

  // City / location portion
  if (words.length > 1) {
    terms.push(
      words.slice(0, -1).join(" ")
    );
  }

  return [...new Set(terms)]
    .filter(
      (term) =>
        term.length >= 3
    );
}

function findTeamIndex(text, teamName) {
  const normalizedText =
    normalize(text);

  const terms =
    getUsefulTeamTerms(teamName);

  for (const term of terms) {
    const index =
      normalizedText.indexOf(term);

    if (index >= 0) {
      return index;
    }
  }

  return -1;
}

function extractChannels(section) {
  const channels = [];

  const regex =
    /Channel\s+(\d+(?:-\d+)?)\s*(HD)?(?:\s*\[([^\]]+)\])?/gi;

  let match;

  while (
    (match = regex.exec(section)) !== null
  ) {
    const channel = match[1];

    // MLB Extra Innings game channels.
    const number =
      Number(
        channel.split("-")[0]
      );

    if (
      number < 719 ||
      number > 749
    ) {
      continue;
    }

    if (
      !channels.some(
        (item) =>
          item.channel === channel
      )
    ) {
      channels.push({
        channel,
        hd: Boolean(match[2]),
        feed:
          match[3]?.trim() ??
          null
      });
    }
  }

  return channels;
}

function findGameSection(
  fullText,
  away,
  home
) {
  const normalizedText =
    normalize(fullText);

  const awayTerms =
    getUsefulTeamTerms(away);

  const homeTerms =
    getUsefulTeamTerms(home);

  let bestIndex = -1;

  for (const awayTerm of awayTerms) {
    const awayIndex =
      normalizedText.indexOf(
        awayTerm
      );

    if (awayIndex < 0) {
      continue;
    }

    for (const homeTerm of homeTerms) {
      const homeIndex =
        normalizedText.indexOf(
          homeTerm,
          awayIndex
        );

      if (
        homeIndex >= 0 &&
        homeIndex - awayIndex < 250
      ) {
        bestIndex =
          awayIndex;

        break;
      }
    }

    if (bestIndex >= 0) {
      break;
    }
  }

  if (bestIndex < 0) {
    const awayIndex =
      findTeamIndex(
        fullText,
        away
      );

    const homeIndex =
      findTeamIndex(
        fullText,
        home
      );

    if (
      awayIndex >= 0 &&
      homeIndex >= 0
    ) {
      bestIndex =
        Math.min(
          awayIndex,
          homeIndex
        );
    }
  }

  if (bestIndex < 0) {
    return null;
  }

  /*
   * DIRECTV usually lists the channels
   * immediately after the matchup.
   */
  return normalizedText.slice(
    Math.max(0, bestIndex - 100),
    bestIndex + 700
  );
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
    const response =
      await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0"
        }
      });

    if (!response.ok) {
      throw new Error(
        `DIRECTV guide request failed: ${response.status}`
      );
    }

    const html =
      await response.text();

    const fullText =
      cleanText(html);

    const section =
      findGameSection(
        fullText,
        away,
        home
      );

    if (!section) {
      console.log(
        `DIRECTV: matchup not found: ${away} @ ${home}`
      );

      return null;
    }

    const channels =
      extractChannels(section);

    if (channels.length === 0) {
      console.log(
        `DIRECTV: matchup found but no Extra Innings channel: ${away} @ ${home}`
      );

      return null;
    }

    return {
      provider: "DIRECTV",
      package:
        "MLB Extra Innings",
      channels,
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
