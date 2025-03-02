// Station slugs (replace with your actual slugs if different)
const stations = {
    "Philippe": "216ccd7e9663b597d059694c2b68cd60",
    "Ken": "e0e95053fed772de0e60444fc4ff88c8",
    "Brian": "fbbe2845876465d1a954e5e49d757bfa"
};

// Define weather components with their API keys and units
const components = [
    { name: "Temperature", key: "tempf", unit: "°F" },
    { name: "Wind Speed", key: "windspeedmph", unit: "mph" },
    { name: "Rain", key: "hourlyrainin", unit: "in/hr" },
    { name: "Pressure", key: "baromrelin", unit: "inHg" }
];

// Fetch weather data from Ambient Weather API
async function fetchWeatherData(slug) {
    const url = `https://lightning.ambientweather.net/devices?public.slug=${slug}`;
    try {
        const response = await fetch(url);
        const data = await response.json();
        return data.data[0].lastData;
    } catch (error) {
        console.error("Error fetching data:", error);
        return null;
    }
}

// Determine leaderboard leader with tie handling
function getLeader(stationValues, isMin, unit) {
    if (stationValues.length === 0) return "No data (--";
    const sorted = isMin
        ? stationValues.sort((a, b) => a.value - b.value)
        : stationValues.sort((a, b) => b.value - a.value);
    if (sorted.length === 1) {
        return `${sorted[0].station} (${sorted[0].value.toFixed(1)}${unit})`;
    }
    const topValue = sorted[0].value;
    const topStations = sorted.filter((s) => s.value === topValue);
    if (topStations.length === 3) {
        return "3-way tie";
    } else if (topStations.length === 2) {
        return `${topStations[0].station} & ${topStations[1].station} (${topValue.toFixed(1)}${unit})`;
    } else {
        return `${sorted[0].station} (${topValue.toFixed(1)}${unit})`;
    }
}

// Update the UI with fetched data
async function updateUI() {
    const data = {};
    for (const station in stations) {
        data[station] = await fetchWeatherData(stations[station]);
    }

    // Update Current Data Panel
    for (const station of Object.keys(stations)) {
        const stationData = data[station];
        const prefix = station.toLowerCase();
        if (stationData) {
            document.getElementById(`${prefix}-temp`).innerText = stationData.tempf?.toFixed(1) || "--";
            document.getElementById(`${prefix}-wind`).innerText = stationData.windspeedmph?.toFixed(1) || "--";
            document.getElementById(`${prefix}-rain`).innerText = stationData.hourlyrainin?.toFixed(1) || "--";
            document.getElementById(`${prefix}-pressure`).innerText = stationData.baromrelin?.toFixed(1) || "--";
            if (stationData.winddir !== undefined) {
                const arrow = document.getElementById(`arrow-${prefix}`);
                arrow.setAttribute("transform", `rotate(${stationData.winddir} 50 50)`);
            }
        }
    }

    // Update Leaderboard Panel
    for (const comp of components) {
        const minValues = Object.entries(data)
            .map(([station, d]) => ({ station, value: d?.hl?.[comp.key]?.l }))
            .filter((item) => item.value !== undefined);
        const currentValues = Object.entries(data)
            .map(([station, d]) => ({ station, value: d?.[comp.key] }))
            .filter((item) => item.value !== undefined);
        const maxValues = Object.entries(data)
            .map(([station, d]) => ({ station, value: d?.hl?.[comp.key]?.h }))
            .filter((item) => item.value !== undefined);

        const minLeader = getLeader(minValues, true, comp.unit);
        const currentLeader = getLeader(currentValues, false, comp.unit);
        const maxLeader = getLeader(maxValues, false, comp.unit);

        document.getElementById(`min-${comp.key}-leader`).innerText = minLeader;
        document.getElementById(`current-${comp.key}-leader`).innerText = currentLeader;
        document.getElementById(`max-${comp.key}-leader`).innerText = maxLeader;
    }

    // Update timestamp
    document.getElementById("last-updated").innerText = `Last Updated: ${new Date().toLocaleString()}`;
}

// Initial update and periodic refresh
updateUI();
setInterval(updateUI, 10000); // Refresh every 10 seconds
