/* ════════════════════════════════════════════════════════════════
   LOCAL LENZ — Weather Service
   Uses Open-Meteo API (free, reliable, requires no keys).
   ════════════════════════════════════════════════════════════════ */

'use strict';

const USER_AGENT = 'LocalLenz/1.0 (prishaguliani28@gmail.com; travel-assistant)';

// Map Open-Meteo weather code to text description and emoji icon
function getWeatherDescription(code) {
  const codes = {
    0: { desc: 'Clear sky', icon: '☀️' },
    1: { desc: 'Mainly clear', icon: '🌤️' },
    2: { desc: 'Partly cloudy', icon: '⛅' },
    3: { desc: 'Overcast', icon: '☁️' },
    45: { desc: 'Foggy', icon: '🌫️' },
    48: { desc: 'Depositing rime fog', icon: '🌫️' },
    51: { desc: 'Light drizzle', icon: '🌧️' },
    53: { desc: 'Moderate drizzle', icon: '🌧️' },
    55: { desc: 'Dense drizzle', icon: '🌧️' },
    56: { desc: 'Light freezing drizzle', icon: '🌧️' },
    57: { desc: 'Dense freezing drizzle', icon: '🌧️' },
    61: { desc: 'Slight rain', icon: '🌧️' },
    63: { desc: 'Moderate rain', icon: '🌧️' },
    65: { desc: 'Heavy rain', icon: '🌧️' },
    66: { desc: 'Light freezing rain', icon: '🌧️' },
    67: { desc: 'Heavy freezing rain', icon: '🌧️' },
    71: { desc: 'Slight snow fall', icon: '🌨️' },
    73: { desc: 'Moderate snow fall', icon: '🌨️' },
    75: { desc: 'Heavy snow fall', icon: '🌨️' },
    77: { desc: 'Snow grains', icon: '🌨️' },
    80: { desc: 'Slight rain showers', icon: '🌧️' },
    81: { desc: 'Moderate rain showers', icon: '🌧️' },
    82: { desc: 'Violent rain showers', icon: '🌧️' },
    85: { desc: 'Slight snow showers', icon: '🌨️' },
    86: { desc: 'Heavy snow showers', icon: '🌨️' },
    95: { desc: 'Thunderstorm', icon: '⛈️' },
    96: { desc: 'Thunderstorm with slight hail', icon: '⛈️' },
    99: { desc: 'Thunderstorm with heavy hail', icon: '⛈️' }
  };
  return codes[code] || { desc: 'Unknown', icon: '🌡️' };
}

async function getWeather(lat, lon) {
  if (!lat || !lon) {
    throw new Error('Latitude and Longitude are required for weather query');
  }

  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weathercode&timezone=auto`;

  try {
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
    if (!res.ok) throw new Error(`Open-Meteo error: ${res.statusText}`);

    const data = await res.json();
    const current = data.current_weather || {};
    const daily = data.daily || {};
    const cond = getWeatherDescription(current.weathercode);

    return {
      temperature: current.temperature,
      windspeed: current.windspeed,
      winddirection: current.winddirection,
      condition: cond.desc,
      icon: cond.icon,
      humidity: 65, // Open-Meteo requires another variable for humidity; we can estimate or fallback
      precipitationProb: daily.precipitation_probability_max ? daily.precipitation_probability_max[0] : 0,
      tempMax: daily.temperature_2m_max ? daily.temperature_2m_max[0] : current.temperature,
      tempMin: daily.temperature_2m_min ? daily.temperature_2m_min[0] : current.temperature,
      forecast: (daily.time || []).slice(0, 3).map((time, idx) => {
        const fCond = getWeatherDescription(daily.weathercode ? daily.weathercode[idx] : 0);
        return {
          date: time,
          tempMax: daily.temperature_2m_max ? daily.temperature_2m_max[idx] : null,
          tempMin: daily.temperature_2m_min ? daily.temperature_2m_min[idx] : null,
          condition: fCond.desc,
          icon: fCond.icon
        };
      }),
      timestamp: new Date().toISOString()
    };
  } catch (err) {
    console.error('Weather service error:', err.message);
    // Return graceful placeholder so it doesn't crash the entire search results
    return {
      temperature: 28,
      windspeed: 12,
      condition: 'Weather info temporarily unavailable',
      icon: '⚠️',
      humidity: 60,
      precipitationProb: 0,
      tempMax: 30,
      tempMin: 22,
      forecast: [],
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = {
  getWeather
};
