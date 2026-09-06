const sportTabs = document.querySelectorAll(".sport-tabs button");
const gamesList = document.getElementById("gamesList");
const statusMessage = document.getElementById("statusMessage");
const scheduleTitle = document.getElementById("scheduleTitle");
const dateLabel = document.getElementById("dateLabel");
const previousDay = document.getElementById("previousDay");
const nextDay = document.getElementById("nextDay");
const todayButton = document.getElementById("todayButton");
const bottomNavButtons = document.querySelectorAll(".bottom-nav button");

let selectedSport = "mlb";
let selectedDate = new Date();
let showFavoritesOnly = false;
let currentGames = [];

// --------------------------------------------------
// FAVORITES
// --------------------------------------------------

function getFavorites() {
  try {
    const saved = JSON.parse(
      localStorage.getItem("wtg-favorites") || "[]"
    );

    if (!Array.isArray(saved)) {
      return [];
    }

    return saved.filter(
      (item) =>
        item &&
        typeof item === "object" &&
        item.id !== undefined
    );
  } catch (error) {
    console.error("Could not read favorites:", error);
    return [];
  }
}

function saveFavorites(favorites) {
  localStorage.setItem(
    "wtg-favorites",
    JSON.stringify(favorites)
  );
}

function isFavorite(gameId) {
  const id = String(gameId);

  return getFavorites().some(
    (game) => String(game.id) === id
  );
}

function toggleFavorite(game) {
  if (!game || game.id === undefined) {
    return;
  }

  const id = String(game.id);
  const favorites = getFavorites();

  const alreadyFavorite = favorites.some(
    (item) => String(item.id) === id
  );

  if (alreadyFavorite) {
    saveFavorites(
      favorites.filter(
        (item) => String(item.id) !== id
      )
    );
  } else {
    saveFavorites([
      ...favorites,
      {
        id: game.id,
        sport: game.sport ?? null,
        name: game.name ?? null,
        away: game.away ?? null,
        home: game.home ?? null,
        startTime: game.startTime ?? null,
        status: game.status ?? null,
        venue: game.venue ?? null,
        broadcast:
          game.broadcast ??
          game.network ??
          null,
        directv: game.directv ?? []
      }
    ]);
  }
}

// --------------------------------------------------
// DATE / TEXT HELPERS
// --------------------------------------------------

function toApiDate(date) {
  return date
    .toISOString()
    .slice(0, 10)
    .replaceAll("-", "");
}

function formatDate(date) {
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

function formatTime(dateString) {
  if (!dateString) {
    return "TBD";
  }

  return new Date(dateString).toLocaleTimeString(
    "en-US",
    {
      hour: "numeric",
      minute: "2-digit",
      timeZone: "America/New_York",
      timeZoneName: "short"
    }
  );
}

function sportLabel(key) {
  const labels = {
    nfl: "NFL",
    ncaaf: "NCAA Football",
    mlb: "MLB",
    nhl: "NHL",
    nba: "NBA",
    ncaab: "NCAA Basketball"
  };

  return labels[key] ?? key.toUpperCase();
}

// --------------------------------------------------
// DIRECTV DISPLAY
// --------------------------------------------------

function getDirectvDisplay(game) {
  const options = Array.isArray(game.directv)
    ? game.directv
    : [];

  const national = options.find(
    (item) =>
      item.directvChannel &&
      item.type === "national"
  );

  if (national) {
    return {
      channel: national.directvChannel,
      note: national.network ?? "National"
    };
  }

  const local = options.find(
    (item) =>
      item.directvChannel &&
      item.type === "local"
  );

  if (local) {
    const stationLabel = local.station
      ? `${local.station} • ${local.network}`
      : local.network;

    return {
      channel: local.directvChannel,
      note: stationLabel
    };
  }

  const regional = options.find(
    (item) =>
      item.directvChannel &&
      item.type === "regional"
  );

  if (regional) {
    return {
      channel: regional.directvChannel,
      note: regional.network ?? "Regional"
    };
  }

  if (options.length > 0) {
    return {
      channel: "--",
      note: "Regional / streaming"
    };
  }

  return {
    channel: "--",
    note: "No DIRECTV mapping yet"
  };
}

// --------------------------------------------------
// GAME CARD
// --------------------------------------------------

function renderGame(game) {
  const directv = getDirectvDisplay(game);
  const favorite = isFavorite(game.id);

  return `
    <article class="game-card">
      <div class="game-main">
        <span class="game-sport">
          ${game.sport ?? ""}
        </span>

        <div class="game-title-row">
          <h3 class="game-name">
            ${game.away ?? "Away"} @ ${game.home ?? "Home"}
          </h3>

          <button
            class="favorite-button ${favorite ? "active" : ""}"
            data-game-id="${game.id}"
            aria-label="${
              favorite
                ? "Remove game from favorites"
                : "Add game to favorites"
            }"
          >
            ${favorite ? "★" : "☆"}
          </button>
        </div>

        <p class="game-time">
          ${formatTime(game.startTime)}
        </p>

        <p class="game-network">
          ${
            game.broadcast ??
            game.network ??
            "Broadcast information unavailable"
          }
        </p>

        <p class="game-venue">
          ${game.venue ?? ""}
        </p>
      </div>

      <div class="directv-box">
        <div class="directv-label">
          DIRECTV
        </div>

        <div class="directv-channel">
          ${directv.channel}
        </div>

        <div class="directv-note">
          ${directv.note}
        </div>
      </div>
    </article>
  `;
}

// --------------------------------------------------
// FAVORITES VIEW
// --------------------------------------------------

function loadFavorites() {
  const favorites = getFavorites();

  currentGames = [...favorites].sort(
    (a, b) =>
      new Date(a.startTime || 0) -
      new Date(b.startTime || 0)
  );

  dateLabel.textContent = "Favorites";
  scheduleTitle.textContent =
    `Favorite Games (${favorites.length})`;

  gamesList.innerHTML = "";

  if (favorites.length === 0) {
    statusMessage.style.display = "block";
    statusMessage.textContent =
      "No favorite games yet. Tap ☆ on any game to add it.";
    return;
  }

  statusMessage.style.display = "none";

  gamesList.innerHTML =
    currentGames.map(renderGame).join("");
}

// --------------------------------------------------
// LIVE SCHEDULE
// --------------------------------------------------

async function loadGames() {
  if (showFavoritesOnly) {
    loadFavorites();
    return;
  }

  statusMessage.style.display = "block";
  statusMessage.textContent = "Loading games...";
  gamesList.innerHTML = "";

  dateLabel.textContent = formatDate(selectedDate);

  scheduleTitle.textContent =
    `${sportLabel(selectedSport)} Games`;

  try {
    const date = toApiDate(selectedDate);

    const response = await fetch(
      `/resolve?sport=${selectedSport}&date=${date}`
    );

    if (!response.ok) {
      throw new Error(
        `Request failed: ${response.status}`
      );
    }

    const data = await response.json();

    currentGames = Array.isArray(data.games)
      ? data.games
      : [];

    if (currentGames.length === 0) {
      statusMessage.style.display = "block";
      statusMessage.textContent =
        "No games found for this sport and date.";
      return;
    }

    statusMessage.style.display = "none";

    scheduleTitle.textContent =
      `${sportLabel(selectedSport)} Games (${currentGames.length})`;

    gamesList.innerHTML =
      currentGames.map(renderGame).join("");
  } catch (error) {
    console.error("Schedule error:", error);

    statusMessage.style.display = "block";
    statusMessage.textContent =
      "Could not load the schedule. Make sure the backend server is running.";
  }
}

// --------------------------------------------------
// SPORT TABS
// --------------------------------------------------

sportTabs.forEach((button) => {
  button.addEventListener("click", () => {
    showFavoritesOnly = false;

    sportTabs.forEach((item) =>
      item.classList.remove("active")
    );

    button.classList.add("active");

    selectedSport = button.dataset.sport;

    setBottomNavActive("Today");
    loadGames();
  });
});

// --------------------------------------------------
// DATE BUTTONS
// --------------------------------------------------

previousDay.addEventListener("click", () => {
  showFavoritesOnly = false;

  selectedDate.setDate(
    selectedDate.getDate() - 1
  );

  selectedDate = new Date(selectedDate);

  setBottomNavActive("Today");
  loadGames();
});

nextDay.addEventListener("click", () => {
  showFavoritesOnly = false;

  selectedDate.setDate(
    selectedDate.getDate() + 1
  );

  selectedDate = new Date(selectedDate);

  setBottomNavActive("Today");
  loadGames();
});

todayButton.addEventListener("click", () => {
  showFavoritesOnly = false;
  selectedDate = new Date();

  setBottomNavActive("Today");
  loadGames();
});

// --------------------------------------------------
// FAVORITE STAR CLICKS
// --------------------------------------------------

gamesList.addEventListener("click", (event) => {
  const button =
    event.target.closest(".favorite-button");

  if (!button) {
    return;
  }

  const gameId = String(
    button.dataset.gameId
  );

  const game = currentGames.find(
    (item) =>
      String(item.id) === gameId
  );

  if (!game) {
    return;
  }

  toggleFavorite(game);

  if (showFavoritesOnly) {
    loadFavorites();
  } else {
    gamesList.innerHTML =
      currentGames.map(renderGame).join("");
  }
});

// --------------------------------------------------
// BOTTOM NAVIGATION
// --------------------------------------------------

function setBottomNavActive(label) {
  bottomNavButtons.forEach((button) => {
    const text =
      button.querySelector("small")
        ?.textContent
        .trim();

    button.classList.toggle(
      "active",
      text === label
    );
  });
}

bottomNavButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const label =
      button.querySelector("small")
        ?.textContent
        .trim();

    if (label === "Favorites") {
      showFavoritesOnly = true;
      setBottomNavActive("Favorites");
      loadFavorites();
      return;
    }

    if (label === "Today") {
      showFavoritesOnly = false;
      selectedDate = new Date();
      setBottomNavActive("Today");
      loadGames();
    }
  });
});

// --------------------------------------------------
// START APP
// --------------------------------------------------

setBottomNavActive("Today");
loadGames();