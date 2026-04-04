// Station slugs
const stations = {
  Philippe: "216ccd7e9663b597d059694c2b68cd60",
  Ken: "e0e95053fed772de0e60444fc4ff88c8",
  Brian: "fbbe2845876465d1a954e5e49d757bfa",
};

// Metrics to compare
// source: "direct" reads from lastData[key], "hl" reads from lastData.hl[hlKey].h or .l
const metrics = [
  { key: "maxtemp", hlKey: "tempf", hlSide: "h", decimals: 1 },
  { key: "mintemp", hlKey: "tempf", hlSide: "l", decimals: 1, lowWins: true },
  { key: "windspeedmph", decimals: 1 },
  { key: "maxdailygust", decimals: 1 },
  { key: "dailyrainin", decimals: 2 },
  { key: "eventrainin", decimals: 2 },
  { key: "baromrelin", decimals: 2 },
];

const REFRESH_INTERVAL = 10; // seconds

// Fetch weather data from Ambient Weather API
async function fetchWeatherData(slug) {
  const url = `https://lightning.ambientweather.net/devices?public.slug=${slug}`;
  try {
    const response = await fetch(url);
    const data = await response.json();
    return data.data[0].lastData;
  } catch (error) {
    console.error("Error fetching data for slug", slug, ":", error);
    return null;
  }
}

// Fetch all stations in parallel
async function fetchAllStations() {
  const entries = Object.entries(stations);
  const results = await Promise.all(
    entries.map(([name, slug]) =>
      fetchWeatherData(slug).then((data) => [name, data])
    )
  );
  return Object.fromEntries(results);
}

// Extract a metric value from station data (direct or from hl high/low)
function getMetricValue(stationData, metric) {
  if (!stationData) return undefined;
  if (metric.hlKey) {
    return stationData.hl?.[metric.hlKey]?.[metric.hlSide];
  }
  return stationData[metric.key];
}

// Determine champion(s) for a metric — lowest wins if metric.lowWins is true
function findChampions(data, metric) {
  const values = [];

  for (const station in data) {
    const val = getMetricValue(data[station], metric);
    if (val === undefined) continue;
    values.push({ station, value: val });
  }

  if (values.length === 0) return { winners: [], values };

  const bestValue = metric.lowWins
    ? Math.min(...values.map((v) => v.value))
    : Math.max(...values.map((v) => v.value));

  const winners = values.filter((v) => v.value === bestValue);
  if (winners.length === values.length) return { winners: [], values };
  return { winners: winners.map((w) => w.station), values };
}

// Find the station with the lowest daily rain (donut buyer)
function findDonutLoser(data) {
  let worst = null;
  let worstValue = Infinity;
  const values = [];

  for (const station in data) {
    if (!data[station] || data[station].dailyrainin === undefined) continue;
    const val = data[station].dailyrainin;
    values.push({ station, value: val });
    if (val < worstValue) {
      worstValue = val;
      worst = station;
    }
  }

  // Check for ties at the bottom
  const tied = values.filter((v) => v.value === worstValue);
  if (tied.length === values.length) return null; // all tied = no loser
  if (tied.length > 1) return tied.map((t) => t.station); // multiple losers
  return [worst];
}

// --- Countdown timer ---
let lastFetchTime = null;
let countdownTimer = null;

function startCountdown() {
  if (countdownTimer) clearInterval(countdownTimer);
  lastFetchTime = Date.now();

  countdownTimer = setInterval(() => {
    const elapsed = Math.floor((Date.now() - lastFetchTime) / 1000);
    const remaining = Math.max(0, REFRESH_INTERVAL - elapsed);
    const el = document.getElementById("last-updated");
    if (el) {
      const time = new Date(lastFetchTime).toLocaleTimeString();
      el.textContent = `Updated ${time} · next in ${remaining}s`;
    }
  }, 1000);
}

// --- Pull to refresh ---
function initPullToRefresh() {
  const app = document.querySelector(".app");
  const indicator = document.getElementById("pull-indicator");
  let startY = 0;
  let pulling = false;
  const threshold = 80;

  app.addEventListener("touchstart", (e) => {
    if (window.scrollY === 0) {
      startY = e.touches[0].clientY;
      pulling = true;
    }
  }, { passive: true });

  app.addEventListener("touchmove", (e) => {
    if (!pulling) return;
    const dy = e.touches[0].clientY - startY;
    if (dy > 0 && dy < 150) {
      const progress = Math.min(dy / threshold, 1);
      indicator.style.height = `${dy * 0.4}px`;
      indicator.style.opacity = progress;
      indicator.textContent = progress >= 1 ? "Release to refresh" : "Pull to refresh";
    }
  }, { passive: true });

  app.addEventListener("touchend", () => {
    if (!pulling) return;
    pulling = false;
    const h = parseFloat(indicator.style.height) || 0;
    if (h >= threshold * 0.4) {
      indicator.textContent = "Refreshing...";
      indicator.style.height = "24px";
      indicator.style.opacity = "1";
      updateUI().then(() => {
        indicator.style.height = "0";
        indicator.style.opacity = "0";
      });
    } else {
      indicator.style.height = "0";
      indicator.style.opacity = "0";
    }
  });
}

// Update the entire UI
async function updateUI() {
  const data = await fetchAllStations();
  const wins = { Philippe: 0, Ken: 0, Brian: 0 };

  // Update each metric row
  metrics.forEach((metric) => {
    const result = findChampions(data, metric);

    for (const station in data) {
      const stationLower = station.toLowerCase();
      const valueEl = document.getElementById(`${stationLower}-${metric.key}`);
      const cellEl = valueEl?.closest(".metric-cell");

      if (!valueEl || !cellEl) continue;

      const val = getMetricValue(data[station], metric);
      if (val !== undefined) {
        valueEl.textContent = val.toFixed(metric.decimals);
      } else {
        valueEl.textContent = "--";
      }

      // Champion highlighting — all tied winners get the crown
      cellEl.classList.remove("champion", "donut-loser");
      if (result.winners.includes(station)) {
        cellEl.classList.add("champion");
        wins[station]++;
      }
    }
  });

  // Donut loser for daily rain
  const donutLosers = findDonutLoser(data);
  document.querySelectorAll(".donut-badge").forEach((el) => (el.innerHTML = ""));

  if (donutLosers) {
    donutLosers.forEach((loser) => {
      const loserLower = loser.toLowerCase();
      const cell = document
        .getElementById(`${loserLower}-dailyrainin`)
        ?.closest(".metric-cell");
      const badge = document.getElementById(`donut-${loserLower}-dailyrainin`);

      if (cell) {
        cell.classList.add("donut-loser");
        cell.classList.remove("champion");
      }
      if (badge) {
        badge.innerHTML = "🍩";
      }
    });
  }

  // Wind direction compasses
  for (const station in data) {
    const stationLower = station.toLowerCase();
    const stationData = data[station];

    if (stationData && stationData.winddir !== undefined) {
      const arrow = document.getElementById(`arrow-${stationLower}`);
      if (arrow) {
        arrow.setAttribute("transform", `rotate(${stationData.winddir}, 60, 60)`);
      }
      const degEl = document.getElementById(`${stationLower}-winddir`);
      if (degEl) {
        degEl.textContent = `${Math.round(stationData.winddir)}°`;
      }
    }
  }

  // Win tally
  const maxWins = Math.max(...Object.values(wins));
  for (const station in wins) {
    const stationLower = station.toLowerCase();
    const countEl = document.getElementById(`wins-${stationLower}`);
    const cardEl = document.getElementById(`tally-${stationLower}`);

    if (countEl) countEl.textContent = wins[station];
    if (cardEl) {
      cardEl.classList.toggle(
        "top-winner",
        wins[station] === maxWins && maxWins > 0
      );
    }
  }

  // Reset countdown
  startCountdown();
}

// Boot
document.addEventListener("DOMContentLoaded", () => {
  updateUI();
  setInterval(updateUI, REFRESH_INTERVAL * 1000);
  initPullToRefresh();

  // Refresh immediately when app returns from background
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") updateUI();
  });
});
