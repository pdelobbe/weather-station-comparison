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
  { key: "dewpoint", computed: true, decimals: 1 },
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

// Calculate dew point from temp (°F) and humidity (%) using Magnus formula
function calcDewpoint(tempF, humidity) {
  const tempC = (tempF - 32) * 5 / 9;
  const a = 17.27, b = 237.7;
  const alpha = (a * tempC) / (b + tempC) + Math.log(humidity / 100);
  const dewC = (b * alpha) / (a - alpha);
  return dewC * 9 / 5 + 32;
}

// Extract a metric value from station data (direct, hl, or computed)
function getMetricValue(stationData, metric) {
  if (!stationData) return undefined;
  if (metric.computed && metric.key === "dewpoint") {
    if (stationData.tempf !== undefined && stationData.humidity !== undefined) {
      return calcDewpoint(stationData.tempf, stationData.humidity);
    }
    return undefined;
  }
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
    if (!data[station] || data[station].eventrainin === undefined) continue;
    const val = data[station].eventrainin;
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
        .getElementById(`${loserLower}-eventrainin`)
        ?.closest(".metric-cell");
      const badge = document.getElementById(`donut-${loserLower}-eventrainin`);

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

// --- Share Metric ---
const SHARE_W = 600, SHARE_H = 240, SHARE_SCALE = 1.5;
const STATION_COLORS = { philippe: "#58a6ff", ken: "#7ee787", brian: "#d2a8ff" };
const STATION_NAMES = ["Philippe", "Ken", "Brian"];

const METRIC_DISPLAY = {
  maxtemp:      { title: "Max Temperature",    unit: "\u00B0F" },
  mintemp:      { title: "Min Temperature",     unit: "\u00B0F" },
  dewpoint:     { title: "Current Dew Point",   unit: "\u00B0F" },
  windspeedmph: { title: "Wind Speed",          unit: "mph" },
  maxdailygust: { title: "Max Wind Gust",       unit: "mph" },
  dailyrainin:  { title: "Daily Rainfall",      unit: "in" },
  eventrainin:  { title: "Event Rainfall",       unit: "in" },
  baromrelin:   { title: "Barometric Pressure", unit: "inHg" },
};

async function renderShareCard(metricKey) {
  await document.fonts.ready;

  const display = METRIC_DISPLAY[metricKey];
  const canvas = document.createElement("canvas");
  canvas.width = SHARE_W * SHARE_SCALE;
  canvas.height = SHARE_H * SHARE_SCALE;
  const ctx = canvas.getContext("2d");
  ctx.scale(SHARE_SCALE, SHARE_SCALE);

  // Rounded rect helper (polyfill for older iOS)
  function roundedRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
  }

  // Background
  ctx.fillStyle = "#0d1117";
  ctx.fillRect(0, 0, SHARE_W, SHARE_H);

  // Border
  ctx.strokeStyle = "rgba(240,246,252,0.12)";
  ctx.lineWidth = 2;
  roundedRect(1, 1, SHARE_W - 2, SHARE_H - 2, 12);
  ctx.stroke();

  // Metric title
  ctx.textAlign = "center";
  ctx.fillStyle = "#e6edf3";
  ctx.font = "800 24px Inter, sans-serif";
  ctx.fillText(display.title, SHARE_W / 2, 44);

  // Subtitle
  ctx.fillStyle = "#8b949e";
  ctx.font = "500 13px Inter, sans-serif";
  ctx.fillText("Weather Station Showdown", SHARE_W / 2, 68);

  // Date & time in Central Time
  const now = new Date();
  const dateTime = now.toLocaleString("en-US", {
    timeZone: "America/Chicago",
    year: "numeric", month: "long", day: "numeric",
    hour: "numeric", minute: "2-digit", hour12: true,
  });
  ctx.fillStyle = "#484f58";
  ctx.font = "500 12px Inter, sans-serif";
  ctx.fillText(dateTime + " CT", SHARE_W / 2, 88);

  // Separator
  function drawSep(y) {
    ctx.strokeStyle = "rgba(240,246,252,0.08)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(40, y);
    ctx.lineTo(SHARE_W - 40, y);
    ctx.stroke();
  }

  drawSep(102);

  // Read values from DOM
  const entries = STATION_NAMES.map((name) => {
    const lower = name.toLowerCase();
    const valEl = document.getElementById(`${lower}-${metricKey}`);
    const cell = valEl?.closest(".metric-cell");
    return {
      name,
      value: valEl?.textContent || "--",
      isChampion: cell?.classList.contains("champion") || false,
      isDonutLoser: cell?.classList.contains("donut-loser") || false,
    };
  });

  // Station names
  const colX = [150, 300, 450];
  STATION_NAMES.forEach((name, i) => {
    ctx.fillStyle = STATION_COLORS[name.toLowerCase()];
    ctx.font = "700 14px Inter, sans-serif";
    ctx.fillText(name, colX[i], 132);
  });

  // Values
  entries.forEach((entry, i) => {
    if (entry.isDonutLoser) {
      ctx.fillStyle = "#dc5050";
    } else if (entry.isChampion) {
      ctx.fillStyle = "#f0b429";
    } else {
      ctx.fillStyle = "#e6edf3";
    }
    ctx.font = "700 22px Inter, sans-serif";
    let valText = `${entry.value} ${display.unit}`;
    if (entry.isDonutLoser) valText += " \u{1F369}";
    ctx.fillText(valText, colX[i], 168);
  });

  drawSep(195);

  // Convert to PNG blob — same approach as original working version
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/png");
  });
}

function fallbackDownload(blob, metricKey) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `weather-${metricKey}.png`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

async function shareMetric(metricKey, btn) {
  btn.disabled = true;

  try {
    const blob = await renderShareCard(metricKey);
    const file = new File([blob], "weather.png", { type: "image/png" });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file] });
    } else {
      fallbackDownload(blob, metricKey);
    }
  } catch (err) {
    if (err.name !== "AbortError") {
      console.error("Share failed:", err);
      fallbackDownload(blob, metricKey);
    }
  } finally {
    btn.disabled = false;
  }
}

// Boot
document.addEventListener("DOMContentLoaded", () => {
  updateUI();
  setInterval(updateUI, REFRESH_INTERVAL * 1000);
  initPullToRefresh();

  document.querySelectorAll(".share-arrow").forEach((btn) => {
    btn.addEventListener("click", () => shareMetric(btn.dataset.metric, btn));
  });

  // Refresh immediately when app returns from background
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") updateUI();
  });
});
