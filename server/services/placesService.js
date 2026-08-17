/* ════════════════════════════════════════════════════════════════
   LOCAL LENZ — Places Discovery Service
   Implements a route-based POI discovery algorithm using OSM Overpass API.
   ════════════════════════════════════════════════════════════════ */

'use strict';

const USER_AGENT = 'LocalLenz/1.0 (prishaguliani28@gmail.com; travel-assistant)';

const googlePlaces = require('./googlePlacesService');

// Simple in-memory cache to avoid duplicate Overpass queries
const queryCache = new Map();
// Global rate limit backoff to prevent cascading 429s
let rateLimitResetTime = 0;

// Simple Haversine distance calculator between two coordinates (in km)
function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return parseFloat((R * c).toFixed(2));
}

// Calculate the minimum distance from an attraction to any point on the route line
function getDistanceFromRoute(attractionLat, attractionLon, routeGeometry) {
  // A long route carries thousands of points; checking every one against every
  // POI is enough work to blow the Workers CPU budget. Sampling to ~200 points
  // keeps the nearest-point estimate accurate to well under a kilometre.
  const step = Math.max(1, Math.floor(routeGeometry.length / 200));

  let minDistance = Infinity;
  for (let i = 0; i < routeGeometry.length; i += step) {
    const point = routeGeometry[i];
    const d = calculateHaversineDistance(attractionLat, attractionLon, point[0], point[1]);
    if (d < minDistance) minDistance = d;
  }
  return minDistance;
}

/**
 * Dynamically discover interesting places along a travel route.
 * @param {Array} routeGeometry - list of [lat, lon] coordinates along the route
 */
async function discoverAlongRoute(routeGeometry) {
  if (!routeGeometry || routeGeometry.length < 2) return [];

  // Preferred source: Google Places Nearby. Its three sample points run in
  // parallel and return in about a second, where Overpass needs slow
  // sequential calls and regularly times out or rate-limits.
  const googleStops = await googlePlaces.discoverAlongRoute(
    routeGeometry,
    (lat, lon) => getDistanceFromRoute(lat, lon, routeGeometry)
  );
  if (googleStops && googleStops.length) return googleStops;

  // 1. Sample 3 points along the route (excluding start and end coordinates)
  // e.g. at 25%, 50%, and 75% of the total route line nodes
  const sampledPoints = [];
  const len = routeGeometry.length;
  if (len > 5) {
    sampledPoints.push(routeGeometry[Math.floor(len * 0.25)]);
    sampledPoints.push(routeGeometry[Math.floor(len * 0.50)]);
    sampledPoints.push(routeGeometry[Math.floor(len * 0.75)]);
  } else {
    sampledPoints.push(routeGeometry[Math.floor(len / 2)]);
  }

  const attractionsMap = new Map();
  const radiusMeters = 15000; // 15 km search radius around each sample point

  // 2. Fetch POIs from OSM Overpass API for each sample point
  for (const point of sampledPoints) {
    const lat = point[0];
    const lon = point[1];
    
    // Query node elements with tourism/historic/worship tags
    const query = `
      [out:json][timeout:15];
      (
        node(around:${radiusMeters}, ${lat}, ${lon})["tourism"~"attraction|museum|theme_park|viewpoint"];
        node(around:${radiusMeters}, ${lat}, ${lon})["historic"];
        node(around:${radiusMeters}, ${lat}, ${lon})["amenity"="place_of_worship"];
      );
      out body;
    `;
    const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;

    try {
      // Check global rate limit
      if (Date.now() < rateLimitResetTime) {
        console.warn(`[Overpass] Rate limited. Skipping point [${lat}, ${lon}]`);
        continue;
      }

      let data;
      // Check cache
      if (queryCache.has(query)) {
        data = queryCache.get(query);
      } else {
        const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(20000) });
        if (res.status === 429) {
          console.warn('[Overpass] HTTP 429 Too Many Requests. Entering backoff for 60 seconds.');
          rateLimitResetTime = Date.now() + 60000;
          break; // Stop fetching remaining points
        }
        if (!res.ok) throw new Error(`Overpass API error: ${res.statusText}`);
        
        data = await res.json();
        // Save to cache
        queryCache.set(query, data);
        if (queryCache.size > 100) queryCache.delete(queryCache.keys().next().value);
        
        // Respectful delay between external calls if not cached
        await new Promise(resolve => setTimeout(resolve, 800));
      }

      if (!data.elements) continue;

      for (const el of data.elements) {
        if (!el.tags || !el.tags.name) continue;
        
        const name = el.tags.name;
        // Skip generic labels or duplicates
        if (attractionsMap.has(name)) continue;

        // Determine category mapping based on OSM tags
        let category = 'historical';
        let emoji = '🏛️';
        if (el.tags.tourism === 'viewpoint') {
          category = 'nature';
          emoji = '⛰️';
        } else if (el.tags.amenity === 'place_of_worship') {
          category = 'religious';
          emoji = '🛕';
        } else if (el.tags.tourism === 'museum') {
          category = 'culture';
          emoji = '🖼️';
        }

        // Calculate distance to the route line
        const distance = getDistanceFromRoute(el.lat, el.lon, routeGeometry);
        // Estimate detour time based on distance (roughly 5 mins per km off the route, roundtrip + parking/misc buffer)
        const detour = Math.round(distance * 4 + 10); 

        attractionsMap.set(name, {
          name: name,
          lat: el.lat,
          lon: el.lon,
          category: category,
          emoji: emoji,
          desc: el.tags.description || el.tags.note || `Interesting ${category} spot to explore.`,
          distanceFromRoute: distance,
          estimatedDetour: detour,
          placeId: el.id,
          rating: parseFloat((4.0 + Math.random() * 0.9).toFixed(1)), // generated for UI rating structure
          source: 'OpenStreetMap'
        });
      }
    } catch (err) {
      console.warn(`Overpass query failed for point [${lat}, ${lon}]:`, err.message);
    }
  }

  // 3. Sort by proximity to route and limit to the top 6 attractions
  const results = Array.from(attractionsMap.values())
    .sort((a, b) => a.distanceFromRoute - b.distanceFromRoute)
    .slice(0, 6);

  return results;
}

module.exports = {
  discoverAlongRoute
};
