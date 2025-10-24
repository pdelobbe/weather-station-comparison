// Station slugs
const stations = {
  "Philippe": "216ccd7e9663b597d059694c2b68cd60",
  "Ken": "e0e95053fed772de0e60444fc4ff88c8",
  "Brian": "fbbe2845876465d1a954e5e49d757bfa"
};

// Weather components with keys and units
const components = [
  { name: "Temperature", key: "tempf", unit: "°F", decimals: 1 },
  { name: "Wind Speed", key: "windspeedmph", unit: "mph", decimals: 1 },
  { name: "Wind Gust", key: "windgustmph", unit: "mph", decimals: 1 },
  { name: "Daily Rain", key: "dailyrainin", unit: "inches", decimals: 2 },
  { name: "Event Rain", key: "eventrainin", unit: "inches", decimals: 2 },
  { name: "Pressure", key: "baromrelin", unit: "inHg", decimals: 2 }
];

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

// Determine leaderboard leader with tie handling
function getLeader(stationValues, isMin, unit, decimals) {
  if (stationValues.length === 0) return "No data";
  const sorted = isMin
    ? stationValues.sort((a, b) => a.value - b.value)
    : stationValues.sort((a, b) => b.value - a.value);
  const topValue = sorted[0].value;
  const topStations = sorted.filter((s) => s.value === topValue);
  if (topStations.length === 3) {
    return `3-way tie (${topValue.toFixed(decimals)}${unit})`;
  }
  if (topStations.length === 2) {
    return `${topStations[0].station} & ${topStations[1].station} (${topValue.toFixed(decimals)}${unit})`;
  }
  return `${sorted[0].station} (${topValue.toFixed(decimals)}${unit})`;
}

// Update the UI with fetched data
async function updateUI() {
  const data = {};
  for (const station in stations) {
    data[station] = await fetchWeatherData(stations[station]);
    console.log(`${station} data:`, data[station]);
  }

  // Update station data
  setTimeout(() => {
    for (const station in data) {
      const stationData = data[station];
      if (stationData) {
        const stationLower = station.toLowerCase();
        components.forEach(comp => {
          const elementId = `${stationLower}-${comp.key}`;
          const element = document.getElementById(elementId);
          if (element) {
            const value = stationData[comp.key];
            console.log(`Updating ${elementId} with value:`, value);
            element.textContent = value !== undefined ? value.toFixed(comp.decimals) : "--";
          } else {
            console.error(`Element not found: ${elementId}`);
          }
        });

        if (stationData.winddir !== undefined) {
          const arrow = document.getElementById(`arrow-${stationLower}`);
          if (arrow) {
            arrow.setAttribute("transform", `rotate(${stationData.winddir}, 50, 50)`);
          } else {
            console.error(`Arrow element not found for ${stationLower}`);
          }
        }
      }
    }

    // Update leaderboard after station data
    components.forEach(comp => {
      const minValues = [];
      const currentValues = [];
      const maxValues = [];

      for (const station in data) {
        const stationData = data[station];
        if (stationData) {
          const currentValue = stationData[comp.key];
          if (currentValue !== undefined) {
            currentValues.push({ station, value: currentValue });
          }

          const hlData = stationData.hl;
          if (hlData && hlData[comp.key]) {
            const useMaxForMin = ["windspeedmph", "windgustmph", "dailyrainin", "eventrainin"].includes(comp.key);
            const minValue = useMaxForMin ? hlData[comp.key].h : hlData[comp.key].l;
            const maxValue = hlData[comp.key].h;

            console.log(`${station} ${comp.key} - Min Value (using ${useMaxForMin ? 'max' : 'low'}):`, minValue, "Max Value:", maxValue);

            if (minValue !== undefined) minValues.push({ station, value: minValue });
            if (maxValue !== undefined) maxValues.push({ station, value: maxValue });
          } else {
            console.log(`${station} - No hl data for ${comp.key}`);
          }
        }
      }

      const minElement = document.getElementById(`min-${comp.key}-leader`);
      const currentElement = document.getElementById(`current-${comp.key}-leader`);
      const maxElement = document.getElementById(`max-${comp.key}-leader`);

      if (minElement) {
        const minLeaderText = getLeader(minValues, true, comp.unit, comp.decimals);
        minElement.textContent = minLeaderText;

        // Add donut image for daily rain min leader
        if (comp.key === "dailyrainin") {
          const donutSpan = document.getElementById("min-dailyrainin-donut");
          if (donutSpan) {
            donutSpan.innerHTML = minLeaderText !== "No data"
              ? '<img src="https://pngimg.com/uploads/donut/donut_PNG63.png" alt="Donut" style="width: 16px; height: 16px; margin-left: 5px; vertical-align: middle;">'
              : '';
          }
        }
      }

      if (currentElement) currentElement.textContent = getLeader(currentValues, false, comp.unit, comp.decimals);
      if (maxElement) maxElement.textContent = getLeader(maxValues, false, comp.unit, comp.decimals);
    });
  }, 200); // Increased delay to 200ms for Safari

  document.getElementById("last-updated").textContent = `Last Updated: ${new Date().toLocaleString()}`;
}

// Run updateUI when DOM is fully loaded and every 10 seconds
document.addEventListener("DOMContentLoaded", () => {
  updateUI();
  setInterval(updateUI, 10000);
});
