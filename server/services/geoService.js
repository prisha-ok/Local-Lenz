/* ════════════════════════════════════════════════════════════════
   LOCAL LENZ — Geo & Route Service
   Uses Nominatim (OSM) for geocoding/autocomplete and OSRM for routing.
   ════════════════════════════════════════════════════════════════ */

'use strict';

const USER_AGENT = 'LocalLenz/1.0 (prishaguliani28@gmail.com; travel-assistant)';

const googlePlaces = require('./googlePlacesService');

/**
 * Autocomplete place queries using OSM Nominatim.
 * Limits suggestions to India for local relevance, but can be configured.
 */
async function autocomplete(query) {
  if (!query || query.trim().length < 2) return [];

  // 1. Preferred source: Google Cloud Places API (real city data + coordinates)
  const googleResults = await googlePlaces.autocompleteCities(query);
  if (googleResults && googleResults.length) return googleResults;

  // 2. Fallback source: Photon — an OSM geocoder built for type-ahead search,
  //    so partial input like "Jaip" still resolves to Jaipur. No key required.
  const photonResults = await photonAutocomplete(query);
  if (photonResults && photonResults.length) return photonResults;

  // 3. Last resort: Nominatim (only reliable for complete place names)

  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=8&addressdetails=1&countrycodes=in`;

  try {
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(15000) });
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
        country: countryName,
        provider: 'osm'
      };
    });
  } catch (err) {
    console.error('Autocomplete service error:', err.message);
    return [];
  }
}


/**
 * Type-ahead autocomplete via Photon (OSM). Prioritises cities and towns.
 */
async function photonAutocomplete(query) {
  const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=12&lang=en`;

  try {
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(15000) });
    if (!res.ok) throw new Error(`Photon error: ${res.statusText}`);

    const data = await res.json();
    const features = data.features || [];

    const CITY_TYPES = ['city', 'town', 'village', 'municipality', 'district', 'suburb', 'state'];

    return features
      .filter(f => f.properties && f.properties.countrycode === 'IN')
      .map(f => {
        const p = f.properties;
        const [lon, lat] = f.geometry.coordinates;
        const place = p.name || p.city || '';
        const region = p.state || p.county || '';

        return {
          name: region && region !== place ? `${place}, ${region}` : place,
          fullName: [p.name, p.city, p.county, p.state, p.country].filter((v, i, a) => v && a.indexOf(v) === i).join(', '),
          lat,
          lon,
          placeId: `${p.osm_type}${p.osm_id}`,
          region,
          country: p.country || 'India',
          provider: 'photon',
          isCity: CITY_TYPES.includes(p.osm_value) || CITY_TYPES.includes(p.type)
        };
      })
      .filter(r => r.name)
      // Cities and towns first, so "city to city" search surfaces the obvious match
      .sort((a, b) => (b.isCity === true) - (a.isCity === true))
      .filter((r, i, arr) => arr.findIndex(o => o.name.toLowerCase() === r.name.toLowerCase()) === i)
      .slice(0, 8);
  } catch (err) {
    console.error('Photon autocomplete error:', err.message);
    return [];
  }
}

/**
 * Get route info from OSRM between two coordinates.
 */
async function getRoute(fromLat, fromLon, toLat, toLon) {
  const url = `http://router.project-osrm.org/route/v1/driving/${fromLon},${fromLat};${toLon},${toLat}?overview=full&geometries=geojson`;

  try {
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(15000) });
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
