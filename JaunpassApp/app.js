const WEBCAM_URL = "https://www.campingjaunpass.swiss/webcam/Pic/webcam.jpg";
const API_URL = "https://api.open-meteo.com/v1/forecast?latitude=46.5919&longitude=7.3441&current=temperature_2m,weather_code,wind_speed_10m,precipitation&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,sunrise,sunset&hourly=temperature_2m,precipitation_probability,precipitation&timezone=auto&forecast_days=7";
const METEOSWISS_URL = "https://data.geo.admin.ch/ch.meteoschweiz.messwerte-aktuell/VQHA80.csv";

// WMO Weather Codes mapping
const weatherCodes = {
    0: "Klarer Himmel",
    1: "Leicht bewölkt",
    2: "Teilweise bewölkt",
    3: "Bedeckt",
    45: "Nebel",
    48: "Nebel mit Reif",
    51: "Leichter Nieselregen",
    53: "Nieselregen",
    55: "Starker Nieselregen",
    56: "Leichter gefrierender Nieselregen",
    57: "Dichter gefrierender Nieselregen",
    61: "Leichter Regen",
    63: "Regen",
    65: "Starker Regen",
    66: "Leichter gefrierender Regen",
    67: "Starker gefrierender Regen",
    71: "Leichter Schneefall",
    73: "Schneefall",
    75: "Starker Schneefall",
    77: "Schneegriesel",
    80: "Leichte Regenschauer",
    81: "Regenschauer",
    82: "Starke Regenschauer",
    85: "Leichte Schneeschauer",
    86: "Starke Schneeschauer",
    95: "Gewitter",
    96: "Gewitter mit leichtem Hagel",
    99: "Gewitter mit starkem Hagel"
};

const dom = {
    webcam: document.getElementById('webcam-image'),
    weatherContent: document.getElementById('weather-content'),
    slopeStatus: document.getElementById('slope-status'),
    crowdLevel: document.getElementById('crowd-level'),
    snowQuality: document.getElementById('snow-quality'),
    aiSummary: document.getElementById('ai-summary'),
    sidebar: document.getElementById('sidebar'),
    overlay: document.getElementById('overlay'),
    menuToggle: document.getElementById('menu-toggle'),
    pageTitle: document.getElementById('page-title'),
    navLinks: document.querySelectorAll('.nav-links li')
};

async function init() {
    setupWebcam();
    setupNavigation();
    await updateWeather();

    // Auto-refresh loops
    setInterval(refreshWebcam, 15 * 60 * 1000); // 15 Minutes
    setInterval(updateWeather, 15 * 60 * 1000); // 15 Minutes
}

function setupNavigation() {
    // Toggle Sidebar
    const toggleSidebar = () => {
        dom.sidebar.classList.toggle('active');
        dom.overlay.classList.toggle('active');
    };

    dom.menuToggle.addEventListener('click', toggleSidebar);
    dom.overlay.addEventListener('click', toggleSidebar);

    // Page Switching
    dom.navLinks.forEach(link => {
        link.addEventListener('click', () => {
            const targetPage = link.getAttribute('data-target');

            // Update Nav UI
            dom.navLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');

            // Switch Content
            document.querySelectorAll('.card').forEach(card => {
                card.classList.remove('view-active');
                if (card.getAttribute('data-page') === targetPage) {
                    card.classList.add('view-active');
                }
            });

            // Update Title
            const titles = {
                'home': 'Aktuelle Wetter- und Pistenverhältnisse',
                'weather': 'Detaillierte Wetterprognose & Verlauf',
                'status': 'Lift-Anlagen & Passstrassen Status'
            };
            dom.pageTitle.innerText = titles[targetPage] || 'Jaunpass Live';

            // Close Sidebar
            toggleSidebar();

            // Scroll to top
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    });
}

function setupWebcam() {
    refreshWebcam();
    dom.webcam.onerror = () => {
        console.error("Webcam image failed to load");
    };

    // Add click listener to reload manually
    dom.webcam.parentElement.addEventListener('dblclick', refreshWebcam);
}

function refreshWebcam() {
    // Force reload with unique timestamp
    const unique = new Date().getTime() + Math.random();
    const url = new URL(WEBCAM_URL);
    url.searchParams.set('nocache', unique);
    dom.webcam.src = url.toString();
    console.log("Webcam refreshed at", new Date().toLocaleTimeString());
}

// Clear archive from localStorage
localStorage.removeItem('jaunpass_webcam_archive');

// Weather update logic handled via updateWeather defined later

function getIconForCode(code) {
    let icon = "cloud";
    if (code === 0) icon = "sun";
    else if (code >= 1 && code <= 3) icon = "cloud-sun";
    else if (code >= 45 && code <= 48) icon = "cloud-fog";
    else if (code >= 51 && code <= 67) icon = "cloud-drizzle";
    else if (code >= 71 && code <= 77) icon = "snowflake";
    else if (code >= 80 && code <= 82) icon = "cloud-rain";
    else if (code >= 85 && code <= 86) icon = "snowflake";
    else if (code >= 95) icon = "cloud-lightning";
    return icon;
}

function getDayName(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('de-DE', { weekday: 'short' });
}

function renderWeather(current, daily, hourly) {
    const temp = current.temperature_2m;
    const wind = current.wind_speed_10m;
    const precip = current.precipitation;
    const code = current.weather_code;
    const desc = weatherCodes[code] || "Unbekannt";

    const icon = getIconForCode(code);

    let forecastHtml = '<div class="forecast-list">';
    // Display next days (up to 7 available)
    if (daily && daily.time) {
        const daysToShow = Math.min(daily.time.length, 8);
        for (let i = 1; i < daysToShow; i++) {
            const dayName = getDayName(daily.time[i]);
            const max = Math.round(daily.temperature_2m_max[i]);
            const min = Math.round(daily.temperature_2m_min[i]);
            const dCode = daily.weather_code[i];
            const dIcon = getIconForCode(dCode);

            // Details
            const precipSum = daily.precipitation_sum ? (daily.precipitation_sum[i] || 0) : 0;
            const precipProb = daily.precipitation_probability_max ? (daily.precipitation_probability_max[i] || 0) : 0;

            let chartHtml = "";
            if (hourly) {
                const dateStr = daily.time[i];
                const startIndex = hourly.time.findIndex(t => t.startsWith(dateStr));

                if (startIndex !== -1) {
                    const blocks = [
                        { name: "Nacht", start: 0, end: 6 },
                        { name: "Morgen", start: 6, end: 12 },
                        { name: "Nachm.", start: 12, end: 18 },
                        { name: "Abend", start: 18, end: 24 }
                    ];

                    chartHtml = '<div class="precip-chart">';
                    blocks.forEach(block => {
                        let maxProb = 0;
                        for (let h = block.start; h < block.end; h++) {
                            const idx = startIndex + h;
                            const p = hourly.precipitation_probability ? (hourly.precipitation_probability[idx] || 0) : 0;
                            if (p > maxProb) maxProb = p;
                        }
                        chartHtml += `
                             <div class="chart-bar">
                                 <span>${block.name}</span>
                                 <strong>${maxProb}%</strong>
                             </div>
                         `;
                    });
                    chartHtml += '</div>';
                }
            }

            forecastHtml += `
                <div class="forecast-item" onclick="this.classList.toggle('expanded')">
                    <div class="forecast-summary">
                        <span class="forecast-day">${dayName}</span>
                        <span class="forecast-icon"><i data-lucide="${dIcon}" width="20" height="20"></i></span>
                        <div class="forecast-temp">
                            <span class="max-temp">${max}°</span>
                            <span class="min-temp">${min}°</span>
                        </div>
                    </div>
                    <div class="forecast-details">
                        <div class="detail-row">
                            <span>Niederschlag:</span>
                            <span>${precipSum} mm</span>
                        </div>
                        <div class="detail-row">
                            <span>Wahrscheinlichkeit:</span>
                            <span>${precipProb}%</span>
                        </div>
                        <div class="detail-row" style="margin-top: 0.5rem; display: block;">
                            <span>Temperaturverlauf (°C):</span>
                            <div style="height: 120px; width: 100%; margin: 8px 0;">
                                <canvas id="forecast-chart-${i}"></canvas>
                            </div>
                        </div>
                        <div class="detail-row" style="margin-top: 0.5rem; display: block;">
                            <span>Regenwahrscheinlichkeit:</span>
                            ${chartHtml}
                        </div>
                    </div>
                </div>
             `;
        }
    }
    forecastHtml += '</div>';

    const dataSourceLabel = current.is_meteoswiss
        ? `<div style="font-size: 0.75rem; color: var(--success-color); margin-top: 4px; display: flex; align-items: center; gap: 4px;"><i data-lucide="check-circle-2" style="width: 14px; height: 14px;"></i> Live-Daten (MeteoSchweiz ${current.station_code})</div>`
        : `<div style="font-size: 0.75rem; color: #94a3b8; margin-top: 4px; display: flex; align-items: center; gap: 4px;"><i data-lucide="info" style="width: 14px; height: 14px;"></i> Vorhersagedaten (Open-Meteo)</div>`;

    dom.weatherContent.innerHTML = `
        <div class="weather-main">
            <i data-lucide="${icon}" style="width: 48px; height: 48px; color: var(--accent-color);"></i>
            <div>
                <div class="temperature">${temp}°</div>
                <div class="weather-desc">${desc}</div>
                ${dataSourceLabel}
            </div>
        </div>
        <div class="weather-details">
            <div class="weather-detail-item">
                <span class="weather-detail-label">Wind</span>
                <span class="weather-detail-value">${wind} km/h</span>
            </div>
            <div class="weather-detail-item">
                <span class="weather-detail-label">Niederschlag</span>
                <span class="weather-detail-value">${precip} mm</span>
            </div>
        </div>
        ${forecastHtml}
    `;

    // Refresh icons
    if (window.lucide) window.lucide.createIcons();
}

function generateSlopeReport(weather) {
    // Heuristic analysis based on weather data
    const temp = weather.temperature_2m;
    const code = weather.weather_code;
    const precip = weather.precipitation;

    let status = "Gut";
    let crowd = "Mittel";
    let quality = "Griffig";
    let summary = "";

    // Crowd Calculation
    const now = new Date();
    const isWeekend = now.getDay() === 0 || now.getDay() === 6;
    const hour = now.getHours();

    if (hour < 8 || hour > 17) {
        crowd = "-";
        status = "Geschlossen";
        summary = "Die Lifte sind derzeit geschlossen. ";
    } else {
        // Note: Google Places API does not provide real-time crowd data for client-side apps without a backend.
        // We simulate the crowd level based on "Popular Times" trends (Weekend + Good Weather = Busy).
        if (code === 0 && isWeekend) {
            crowd = "Hoch";
            summary += "Wochenende + Sonne: Es ist mit **vielen Personen** zu rechnen (Typisches Muster). ";
        } else if (code > 50 || precip > 0.5) {
            crowd = "Wenig";
            summary += "Aufgrund der Witterung (Niederschlag) sind wahrscheinlich **wenig Personen** unterwegs. ";
        } else if (!isWeekend && hour >= 9 && hour <= 16) {
            summary += "Unter der Woche ist mit normalem bis ruhigem Betrieb zu rechnen. ";
        } else {
            summary += "Besucheraufkommen entspricht dem Durchschnitt. ";
        }
    }

    // Snow Quality Calculation
    if (temp > 5) {
        quality = "Sulzig";
        summary += "Bei Temperaturen über 5°C wird der Schnee **sulzig**. ";
        if (code === 0) {
            summary += "Am Nachmittag kann es stellenweise **dreckig** werden (Schneematsch). ";
        }
    } else if (temp < -2) {
        quality = "Hart / Pulver";
        summary += "Der Schnee ist griffig. ";
    }

    // New Snow
    if ((code >= 71 && code <= 77) || (code >= 85 && code <= 86)) {
        status = "Neuschnee";
        quality = "Pulver";
        summary += "Es schneit! **Frischer Schnee** auf der Piste. ";
    }

    // Disclaimer if no info
    if (summary === "") summary = "Keine besonderen Vorkommnisse. Viel Spaß!";

    // Lift Status (Zügwegen + Winteregg)
    // Heuristic: Open if 09:00 - 16:30 and Wind < 60km/h
    const wind = weather.wind_speed_10m;
    let liftStatusHtml = "";
    const minutes = now.getMinutes() + (hour * 60);
    const openTime = 9 * 60; // 09:00
    const closeTime = 16 * 60 + 30; // 16:30

    // Icons
    const checkIcon = `<i data-lucide="check-circle-2" style="color: var(--success-color);"></i>`;
    const xIcon = `<i data-lucide="x-circle" style="color: var(--danger-color);"></i>`;
    const warnIcon = `<i data-lucide="alert-triangle" style="color: #facc15;"></i>`;

    let liftClass = "";
    if (minutes >= openTime && minutes <= closeTime) {
        if (wind > 60) {
            liftStatusHtml = warnIcon;
            liftClass = "warning";
            summary += "Warnung: Wegen starkem Wind (>60km/h) ist der Liftbetrieb voraussichtlich eingestellt. ";
        } else {
            liftStatusHtml = checkIcon;
            liftClass = "open";
        }
    } else {
        liftStatusHtml = xIcon;
        liftClass = "closed";
    }

    // Update DOM
    dom.slopeStatus.innerText = status;
    dom.crowdLevel.innerText = crowd;
    dom.snowQuality.innerText = quality;

    // Update separate lifts
    document.getElementById('lift-zugwegen').innerHTML = liftStatusHtml;
    document.getElementById('lift-winteregg').innerHTML = liftStatusHtml;

    document.getElementById('lift-item-zugwegen').className = 'status-item ' + liftClass;
    document.getElementById('lift-item-winteregg').className = 'status-item ' + liftClass;

    dom.aiSummary.innerHTML = summary.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

    // Re-render icons for new content
    if (window.lucide) window.lucide.createIcons();
}

// Fullscreen Logic
document.getElementById('fullscreen-btn').addEventListener('click', () => {
    const img = dom.webcam;
    if (img.requestFullscreen) {
        img.requestFullscreen();
    } else if (img.webkitRequestFullscreen) { /* Safari */
        img.webkitRequestFullscreen();
    } else if (img.msRequestFullscreen) { /* IE11 */
        img.msRequestFullscreen();
    }
});

// Modal Logic
const modal = document.getElementById('road-modal');
const modalBtn = document.getElementById('modal-ok-btn');

modalBtn.addEventListener('click', () => {
    modal.classList.remove('active');
});

// --- CONFIGURATION ---
const TOMTOM_API_KEY = "S9X2YBCOZVG4AnZ79lfW4GQsiwfsyPti";
// Opendata.swiss / opentransportdata.swiss (ASTRA) API Key
// Einen kostenlosen Token gibt es nach Registrierung unter: https://opentransportdata.swiss/de/dev/
const OPENDATA_SWISS_KEY = ""; 
const JAUNPASS_BBOX = "46.57,7.31,46.61,7.37";

// Overpass API Query for Jaunpass Road (Main road 11)
// We check for any 'access=no' or 'highway=closed' tags
const OVERPASS_URL = "https://overpass-api.de/api/interpreter?data=[out:json];way(around:500,46.5919,7.3441)[highway][access=no];out tags;";

async function updateRoadStatus() {
    try {
        let isClosed = false;
        let message = "Die Strasse ist beidseitig normal befahrbar.";
        let dataSource = "Live-Analyse (Overpass & Wetter)";

        // 1. Check Overpass API (Public OSM Data for active closures)
        try {
            const ovResponse = await fetch(OVERPASS_URL);
            if (ovResponse.ok) {
                const ovData = await ovResponse.json();
                if (ovData.elements && ovData.elements.length > 0) {
                    isClosed = true;
                    message = "Pass laut Kartendaten aktuell gesperrt.";
                }
            }
        } catch (e) { console.warn("Overpass failed, using fallback"); }

        // 2. Weather Heuristic Fallback (Very reliable for high passes)
        // If we have weather data from the main loop, we use it to verify
        const weatherResponse = await fetch(API_URL);
        if (weatherResponse.ok) {
            const wData = await weatherResponse.json();
            const current = wData.current;

            // Severe weather logic
            if (current.wind_speed_10m > 90 || (current.temperature_2m < -8 && current.weather_code >= 71)) {
                isClosed = true;
                message = "Achtung: Pass wegen extremer Witterung voraussichtlich gesperrt!";
            }
        }
        
        // 3. Opendata.swiss / ASTRA (Verkehrsdaten Schweiz)
        // Benötigt den Token (OPENDATA_SWISS_KEY) von opentransportdata.swiss
        if (OPENDATA_SWISS_KEY && OPENDATA_SWISS_KEY.length > 10 && !isClosed) {
            try {
                // Beispielhafter Endpoint für die Rest_Traffic API des ASTRA
                const odUrl = `https://api.opentransportdata.swiss/TDP/Rest_Traffic/Situations/v1`;
                const odRes = await fetch(odUrl, {
                    headers: {
                        'Authorization': OPENDATA_SWISS_KEY,
                        'Accept': 'application/json'
                    }
                });
                if (odRes.ok) {
                    const odData = await odRes.json();
                    // Wir würden hier die relevanten Meldungen für den Jaunpass suchen
                    // (Oft ist dies Datex II Formatiert oder in spezifischen XML/JSON Strukturen)
                    if (odData && odData.situations) {
                        // Dummy-Check, falls es Meldungen gibt, die "Jaunpass" oder "Boltigen" enthalten
                        const jaunpassIncident = odData.situations.find(s => JSON.stringify(s).toLowerCase().includes('jaunpass'));
                        if (jaunpassIncident) {
                            isClosed = true;
                            message = "Sperrung oder Behinderung gemeldet.";
                            dataSource = "ASTRA Verkehrsinfo Schweiz (opendata.swiss)";
                        }
                    }
                }
            } catch (e) { console.warn("Opendata.swiss failed"); }
        }

        // 4. Optional TomTom (If Key is valid & above didn't trigger)
        if (!OPENDATA_SWISS_KEY && TOMTOM_API_KEY && TOMTOM_API_KEY.length > 10 && !isClosed) {
            try {
                const ttUrl = `https://api.tomtom.com/traffic/services/5/incidentDetails/s3/${JAUNPASS_BBOX}/12/-1/de-DE/json?key=${TOMTOM_API_KEY}`;
                const ttRes = await fetch(ttUrl);
                if (ttRes.ok) {
                    const ttData = await ttRes.ok ? await ttRes.json() : null;
                    if (ttData && ttData.incidents && ttData.incidents.length > 0) {
                        const closure = ttData.incidents.find(inc => inc.incidentDetails.some(d => d.iconCategory === 8));
                        if (closure) {
                            isClosed = true;
                            message = closure.incidentDetails[0].description || "Sperrung gemeldet.";
                            dataSource = "TomTom Live-Daten";
                        }
                    }
                }
            } catch (e) { /* TomTom silent fail */ }
        }

        // --- Update UI ---
        const checkIcon = `<i data-lucide="check-circle-2" style="color: var(--success-color);"></i>`;
        const xIcon = `<i data-lucide="x-circle" style="color: var(--danger-color);"></i>`;
        const statusIcon = isClosed ? xIcon : checkIcon;

        document.getElementById('status-icon-freiburg').innerHTML = statusIcon;
        document.getElementById('status-icon-boltigen').innerHTML = statusIcon;
        document.getElementById('road-info').innerHTML = `${message}<br><small style="opacity: 0.5">Basis: ${dataSource}</small>`;

        document.getElementById('road-freiburg').className = 'status-item ' + (isClosed ? 'closed' : 'open');
        document.getElementById('road-boltigen').className = 'status-item ' + (isClosed ? 'closed' : 'open');

        if (isClosed && !sessionStorage.getItem('roadAlertShown')) {
            modal.classList.add('active');
            sessionStorage.setItem('roadAlertShown', 'true');
        }

        if (window.lucide) window.lucide.createIcons();
    } catch (error) {
        console.error("Road status error:", error);
    }
}

const LIFT_OPEN_H = 9;
const LIFT_CLOSE_H = 16.5; // 16:30

let tempChart = null;
let forecastCharts = [];

function renderForecastCharts(hourly, daily) {
    // Clear old charts if they exist
    forecastCharts.forEach(chart => chart.destroy());
    forecastCharts = [];

    if (!hourly || !daily || !hourly.temperature_2m) return;

    const daysToShow = Math.min(daily.time.length, 8);
    for (let i = 1; i < daysToShow; i++) {
        const ctx = document.getElementById(`forecast-chart-${i}`);
        if (!ctx) continue;

        const dateStr = daily.time[i];
        const startIndex = hourly.time.findIndex(t => t.startsWith(dateStr));
        if (startIndex === -1) continue;

        // Consistent time labels: "08:00"
        const dayLabels = hourly.time.slice(startIndex, startIndex + 24).map(t => {
            return new Date(t).toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' });
        });
        const dayTemps = hourly.temperature_2m.slice(startIndex, startIndex + 24);

        // Sunrise / Sunset for THIS specific forecast day
        const daySunrise = new Date(daily.sunrise[i]);
        const daySunset = new Date(daily.sunset[i]);
        const sunEvents = [];

        for (let h = 0; h < 24; h++) {
            const hTime = new Date(hourly.time[startIndex + h]).getTime();
            const nextHTime = hTime + (60 * 60 * 1000);

            if (daySunrise.getTime() >= hTime && daySunrise.getTime() < nextHTime) {
                sunEvents.push({ index: h, label: 'Aufgang', time: daySunrise.toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' }) });
            }
            if (daySunset.getTime() >= hTime && daySunset.getTime() < nextHTime) {
                sunEvents.push({ index: h, label: 'Untergang', time: daySunset.toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' }) });
            }
        }

        const miniSunPlugin = {
            id: `miniSunEvents-${i}`,
            beforeDraw(chart) {
                const { ctx, chartArea: { top, bottom }, scales: { x } } = chart;
                // Lift Area Shading
                const startX = x.getPixelForValue(LIFT_OPEN_H);
                const endX = x.getPixelForValue(LIFT_CLOSE_H);
                ctx.fillStyle = 'rgba(74, 222, 128, 0.05)';
                ctx.fillRect(startX, top, endX - startX, bottom - top);
            },
            afterDatasetsDraw(chart) {
                const { ctx, chartArea: { top, bottom }, scales: { x } } = chart;
                ctx.save();
                sunEvents.forEach(event => {
                    const xPos = x.getPixelForValue(event.index);
                    ctx.strokeStyle = 'rgba(250, 204, 21, 0.3)';
                    ctx.setLineDash([3, 3]);
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.moveTo(xPos, top);
                    ctx.lineTo(xPos, bottom);
                    ctx.stroke();
                    ctx.fillStyle = '#facc15';
                    ctx.font = 'bold 8px Outfit';
                    ctx.textAlign = 'center';
                    ctx.fillText(event.time, xPos, top - 4);
                });
                ctx.restore();
            }
        };

        const chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: dayLabels,
                datasets: [{
                    label: 'Temperatur',
                    data: dayTemps.map((temp, index) => ({ x: index, y: temp })),
                    borderColor: '#38bdf8',
                    backgroundColor: 'rgba(56, 189, 248, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 0,
                    pointHitRadius: 10
                }]
            },
            plugins: [miniSunPlugin],
            options: {
                responsive: true,
                maintainAspectRatio: false,
                layout: { padding: { top: 15 } },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: 'rgba(30, 41, 59, 1)',
                        titleColor: '#f8fafc',
                        bodyColor: '#38bdf8',
                        displayColors: false,
                        padding: 8,
                        borderColor: 'rgba(255, 255, 255, 0.1)',
                        borderWidth: 1,
                        callbacks: {
                            label: (context) => {
                                const h = context.parsed.x;
                                let status = "";
                                if (h >= LIFT_OPEN_H && h <= LIFT_CLOSE_H) status = " (Lift offen)";
                                return ` ${context.parsed.y}°C${status}`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        type: 'linear',
                        min: 0,
                        max: 23,
                        grid: { display: false },
                        ticks: { stepSize: 6, color: '#94a3b8', font: { size: 8 }, callback: (v) => v + ':00' }
                    },
                    y: {
                        grid: { color: 'rgba(255, 255, 255, 0.05)' },
                        ticks: { color: '#94a3b8', font: { size: 8 }, callback: (v) => v + '°' }
                    }
                }
            }
        });
        forecastCharts.push(chart);
    }
}

function renderTempChart(hourly, daily) {
    const ctx = document.getElementById('tempChart');
    if (!ctx || !hourly || !daily || !hourly.temperature_2m) return;

    // Get next 24 hours
    const times = hourly.time.slice(0, 24).map(t => {
        return new Date(t).toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' });
    });
    const temps = hourly.temperature_2m.slice(0, 24);

    // Sunrise / Sunset logic
    const sunEvents = [];
    const sunrise = new Date(daily.sunrise[0]);
    const sunset = new Date(daily.sunset[0]);

    // Check if they fall within our 24h window
    hourly.time.slice(0, 24).forEach((t, index) => {
        const hTime = new Date(t).getTime();
        const nextHTime = hTime + (60 * 60 * 1000);

        if (sunrise.getTime() >= hTime && sunrise.getTime() < nextHTime) {
            sunEvents.push({ index, label: 'Aufgang', time: sunrise.toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' }) });
        }
        if (sunset.getTime() >= hTime && sunset.getTime() < nextHTime) {
            sunEvents.push({ index, label: 'Untergang', time: sunset.toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' }) });
        }
    });

    if (tempChart) {
        tempChart.destroy();
    }

    // Custom Plugin to draw Sun/Moon lines AND Lift Area
    const sunPlugin = {
        id: 'sunEvents',
        beforeDraw(chart) {
            const { ctx, chartArea: { top, bottom }, scales: { x } } = chart;
            // Draw Lift Area (9:00 - 16:30)
            const openX = x.getPixelForValue(LIFT_OPEN_H);
            const closeX = x.getPixelForValue(LIFT_CLOSE_H);
            ctx.fillStyle = 'rgba(74, 222, 128, 0.05)';
            ctx.fillRect(openX, top, closeX - openX, bottom - top);
        },
        afterDatasetsDraw(chart) {
            const { ctx, chartArea: { top, bottom }, scales: { x } } = chart;
            ctx.save();









            sunEvents.forEach(event => {
                const xPos = x.getPixelForValue(event.index);
                // Draw Line
                ctx.strokeStyle = 'rgba(250, 204, 21, 0.4)';
                ctx.setLineDash([5, 5]);
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(xPos, top);
                ctx.lineTo(xPos, bottom);
                ctx.stroke();

                // Draw Label
                ctx.fillStyle = '#facc15';
                ctx.font = 'bold 10px Outfit';
                ctx.textAlign = 'center';
                ctx.fillText(event.label, xPos, top - 10);
                ctx.fillText(event.time, xPos, top - 22);
            });
            ctx.restore();
        }
    };

    tempChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: times,
            datasets: [{
                label: 'Temperatur (°C)',
                data: temps.map((temp, index) => ({ x: index, y: temp })),
                borderColor: '#38bdf8',
                backgroundColor: 'rgba(56, 189, 248, 0.1)',
                borderWidth: 3,
                fill: true,
                tension: 0.4,
                pointRadius: 0,
                pointHitRadius: 10
            }]
        },
        plugins: [sunPlugin],
        options: {
            responsive: true,
            maintainAspectRatio: false,
            layout: {
                padding: {
                    top: 30,
                    bottom: 15
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(30, 41, 59, 1)',
                    titleColor: '#f8fafc',
                    bodyColor: '#38bdf8',
                    displayColors: false,
                    padding: 10,
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                    borderWidth: 1,
                    callbacks: {
                        label: (context) => {
                            const h = context.parsed.x;
                            let status = "";
                            if (h >= LIFT_OPEN_H && h <= LIFT_CLOSE_H) status = " (Lifte offen)";
                            return ` ${context.parsed.y}°C${status}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    type: 'linear',
                    min: 0,
                    max: 23,
                    grid: { display: false },
                    ticks: {
                        stepSize: 3,
                        color: '#94a3b8',
                        callback: (v) => {
                            if (times[v]) return times[v];
                            return v + ':00';
                        }
                    }
                },
                y: {
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: {
                        color: '#94a3b8',
                        callback: (value) => value + '°'
                    }
                }
            }
        }
    });
}

async function fetchMeteoSwissData(stationCode) {
    try {
        const response = await fetch(METEOSWISS_URL);
        if (!response.ok) throw new Error("MeteoSwiss API failed");

        const text = await response.text();
        const lines = text.split('\n');

        // Find the line for the requested station
        const stationLine = lines.find(line => line.startsWith(stationCode));
        if (stationLine) {
            const columns = stationLine.split(';');
            return {
                temperature_2m: parseFloat(columns[2]), // tre200s0
                precipitation: parseFloat(columns[3]) || 0, // rre150z0 
                wind_speed_10m: parseFloat(columns[9]) || 0, // fu3010z0 (km/h)
                humidity: parseFloat(columns[6]) || null // ure200s0
            };
        }
    } catch (e) {
        console.warn("MeteoSwiss fetch error:", e);
    }
    return null;
}

async function updateWeather() {
    try {
        const response = await fetch(API_URL);
        if (!response.ok) throw new Error("Weather API failed");

        const data = await response.json();
        let current = data.current;
        const daily = data.daily;
        const hourly = data.hourly;

        // Versuche MeteoSchweiz Daten für Col des Mosses (sehr ähnliches Höhenprofil wie Jaunpass, ~1412m)
        // Alternativ Boltigen (BOL, 821m) oder Adelboden (ABO, 1320m)
        const station = 'CDM';
        const meteoSwissData = await fetchMeteoSwissData(station);
        if (meteoSwissData && !isNaN(meteoSwissData.temperature_2m)) {
            // Nutze präzise MeteoSchweiz Daten für aktuelle Anzeige
            console.log(`✅ MeteoSchweiz Live-Messwerte (${station}) erfolgreich geladen:`, meteoSwissData);
            current = { ...current, ...meteoSwissData, is_meteoswiss: true, station_code: station };
        } else {
            console.log("ℹ️ MeteoSchweiz Live-Daten momentan nicht verfügbar. Nutze Open-Meteo Fallback.");
        }

        // 1. Core Weather UI
        renderWeather(current, daily, hourly);

        // 2. Main Slope Report (very important)
        generateSlopeReport(current);

        // 3. Optional Graphs (in try-catch so failure doesn't break the app)
        try {
            if (window.Chart) {
                renderTempChart(hourly, daily);
                renderForecastCharts(hourly, daily);
            } else {
                console.warn("Chart.js not loaded, skipping graphs.");
            }
        } catch (graphError) {
            console.error("Error rendering graphs:", graphError);
        }

        // 4. External APIs
        await updateRoadStatus();

    } catch (error) {
        console.error("Error fetching weather:", error);
        dom.weatherContent.innerHTML = `<p>Wetterdaten aktuell nicht verfügbar.</p>`;
    }
}

// Start
init();
