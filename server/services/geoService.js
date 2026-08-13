/* ════════════════════════════════════════════════════════════════
   LOCAL LENZ — Geo & Route Service
   Uses Nominatim (OSM) for geocoding/autocomplete and OSRM for routing.
   ════════════════════════════════════════════════════════════════ */

'use strict';

const USER_AGENT = 'LocalLenz/1.0 (prishaguliani28@gmail.com; travel-assistant)';

/**
 * Autocomplete place queries using OSM Nominatim.
 * Limits suggestions to India for local relevance, but can be configured.
 */
async function autocomplete(query) {
  if (!query || query.trim().length < 2) return [];

  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=8&addressdetails=1&countrycodes=in`;

  try {
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
    if (!res.ok) throw new Error(`Nominatim error: ${res.statusText}`);
    
    const data = await res.json();
    
    return data.map(item => {
      const address = item.address || {};
      const cityName = address.city || address.town || address.village || address.suburb || address.county || '';
      const stateName = address.state || '';
      const countryName = address.country || '';
      
      // Clean up place name display
      let displayName = item.display_name;
      if (cityName && stateName) {
        displayName = `${cityName}, ${stateName}`;
      }

      return {
        name: displayName,
        fullName: item.display_name,
        lat: parseFloat(item.lat),
        lon: parseFloat(item.lon),
        placeId: item.place_id,
        region: stateName,
        country: countryName
      };
    });
  } catch (err) {
    console.error('Autocomplete service error:', err.message);
    return [];
  }
}

/**
 * Get route info from OSRM between two coordinates.
 */
async function getRoute(fromLat, fromLon, toLat, toLon) {
  const url = `http://router.project-osrm.org/route/v1/driving/${fromLon},${fromLat};${toLon},${toLat}?overview=full&geometries=geojson`;

  try {
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
    if (!res.ok) throw new Error(`OSRM error: ${res.statusText}`);

    const data = await res.json();
    if (!data.routes || !data.routes.length) {
      throw new Error('No route found between coordinates');
    }

    const route = data.routes[0];
    const distanceKm = parseFloat((route.distance / 1000).toFixed(1)); // m -> km
    const durationMin = Math.round(route.duration / 60); // sec -> min

    // OSRM coordinates are [lon, lat], swap to [lat, lon] for Leaflet map compatibility
    const geometry = route.geometry.coordinates.map(coord => [coord[1], coord[0]]);

    return {
      distance: distanceKm,
      duration: durationMin,
      geometry: geometry,
      waypoints: data.waypoints || []
    };
  } catch (err) {
    console.error('Routing service error:', err.message);
    throw err;
  }
}

module.exports = {
  autocomplete,
  getRoute
};
