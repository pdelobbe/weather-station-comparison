// Station slugs
const stations = {
    "Philippe": "216ccd7e9663b597d059694c2b68cd60",
    "Ken": "e0e95053fed772de0e60444fc4ff88c8",
    "Brian": "fbbe2845876465d1a954e5e49d757bfa"
};

// Weather components with keys and units
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
    if (stationValues.length === 0) return "No data";
    const sorted = isMin
        ? stationValues.sort((a, b) => a.value - b.value)
        : stationValues.sort((a, b) => b.value - a.value);
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
    console.log("Updating UI..."); // Debug log
    const data = {};
    for (const station in stations) {
        data[station] = await fetchWeatherData(stations[station]);
    }

    // Update individual station data
    for (const station in data) {
        const stationData = data[station];
        if (stationData) {
            const stationLower = station.toLowerCase();
            // Use !== undefined to handle 0 correctly
            document.getElementById(`${stationLower}-temp`).innerText = stationData.tempf !== undefined ? stationData.tempf.toFixed(1) : "--";
            document.getElementById(`${stationLower}-wind`).innerText = stationData.windspeedmph !== undefined ? stationData.windspeedmph.toFixed(1) : "--";
            document.getElementById(`${stationLower}-rain`).innerText = stationData.hourlyrainin !== undefined ? stationData.hourlyrainin.toFixed(2) : "--";
            document.getElementById(`${stationLower}-pressure`).innerText = stationData.baromrelin !== undefined ? stationData.baromrelin.toFixed(2) : "--";
            // Update wind direction arrow if available
            if (stationData.winddir !== undefined) {
                const arrow = document.getElementById(`arrow-${stationLower}`);
                if (arrow) {
                    arrow.setAttribute("transform", `rotate(${stationData.winddir}, 50, 50)`);
                }
            }
        }
    }

    // Update Leaderboard Panel
    for (const comp of components) {
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
                    const minValue = hlData[comp.key].l;
                    const maxValue = hlData[comp.key].h;
                    if (minValue !== undefined) minValues.push({ station, value: minValue });
                    if (maxValue !== undefined) maxValues.push({ station, value: maxValue });
                }
            }
        }

        const minLeader = minValues.length > 0 ? getLeader(minValues, true, comp.unit) : "N/A";
        const currentLeader = currentValues.length > 0 ? getLeader(currentValues, false, comp.unit) : "N/A";
        const maxLeader = maxValues.length > 0 ? getLeader(maxValues, false, comp.unit) : "N/A";

        const minElement = document.getElementById(`min-${comp.key}-leader`);
        const currentElement = document.getElementById(`current-${comp.key}-leader`);
        const maxElement = document.getElementById(`max-${comp.key}-leader`);

        if (minElement) minElement.innerText = minLeader;
        if (currentElement) currentElement.innerText = currentLeader;
        if (maxElement) maxElement.innerText = maxLeader;
    }

    // Update timestamp
    document.getElementById("last-updated").innerText = `Last Updated: ${new Date().toLocaleString()}`;
}

// Initial update and periodic refresh
updateUI();
setInterval(updateUI, 10000); // Update every 10 seconds