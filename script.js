const stations = {
    "Philippe": "216ccd7e9663b597d059694c2b68cd60",
    "Ken": "e0e95053fed772de0e60444fc4ff88c8",
    "Brian": "fbbe2845876465d1a954e5e49d757bfa"
};

async function fetchWeatherData(slug) {
    const url = `https://lightning.ambientweather.net/devices?public.slug=${slug}`;
    try {
        const response = await fetch(url);
        const data = await response.json();
        return data.data[0].lastData;
    } catch (error) {
        console.error('Error fetching data:', error);
        return null;
    }
}

async function updateUI() {
    const data = {};

    // Fetch data for all stations
    for (const station in stations) {
        data[station] = await fetchWeatherData(stations[station]);
    }

    // Update comparison section
    if (data["Philippe"]) {
        document.getElementById("philippe-temp").innerText = data["Philippe"].tempf;
        document.getElementById("philippe-wind").innerText = data["Philippe"].windspeedmph;
        const arrowPhilippe = document.getElementById("arrow-philippe");
        arrowPhilippe.setAttribute("transform", `rotate(${data["Philippe"].winddir} 50 50)`);
    }
    if (data["Ken"]) {
        document.getElementById("ken-temp").innerText = data["Ken"].tempf;
        document.getElementById("ken-wind").innerText = data["Ken"].windspeedmph;
        const arrowKen = document.getElementById("arrow-ken");
        arrowKen.setAttribute("transform", `rotate(${data["Ken"].winddir} 50 50)`);
    }
    if (data["Brian"]) {
        document.getElementById("brian-temp").innerText = data["Brian"].tempf;
        document.getElementById("brian-wind").innerText = data["Brian"].windspeedmph;
        const arrowBrian = document.getElementById("arrow-brian");
        arrowBrian.setAttribute("transform", `rotate(${data["Brian"].winddir} 50 50)`);
    }

    // Update leaderboard (example for temperature)
    const temps = [
        { name: "Philippe", current: data["Philippe"]?.tempf, max: data["Philippe"]?.hl?.tempf?.h, min: data["Philippe"]?.hl?.tempf?.l },
        { name: "Ken", current: data["Ken"]?.tempf, max: data["Ken"]?.hl?.tempf?.h, min: data["Ken"]?.hl?.tempf?.l },
        { name: "Brian", current: data["Brian"]?.tempf, max: data["Brian"]?.hl?.tempf?.h, min: data["Brian"]?.hl?.tempf?.l }
    ].filter(st => st.current !== undefined);

    // Max leader
    const maxSorted = temps.sort((a, b) => b.max - a.max);
    let maxText = maxSorted[0].name;
    if (maxSorted[0].max === maxSorted[1]?.max) maxText += " & " + maxSorted[1].name;
    document.getElementById("max-leaders").innerText = `Temp: ${maxText}`;

    // Min leader
    const minSorted = temps.sort((a, b) => a.min - b.min);
    let minText = minSorted[0].name;
    if (minSorted[0].min === minSorted[1]?.min) minText += " & " + minSorted[1].name;
    document.getElementById("min-leaders").innerText = `Temp: ${minText}`;

    // Current leader
    const currentSorted = temps.sort((a, b) => b.current - a.current);
    let currentText = currentSorted[0].name;
    if (currentSorted[0].current === currentSorted[1]?.current) currentText += " & " + currentSorted[1].name;
    document.getElementById("current-leaders").innerText = `Temp: ${currentText}`;

    // Update timestamp
    document.getElementById("last-updated").innerText = `Last Updated: ${new Date().toLocaleString()}`;
}

// Initial call and periodic updates
updateUI();
setInterval(updateUI, 10000); // Updates every 10 seconds
