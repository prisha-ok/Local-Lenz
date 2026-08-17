/* ════════════════════════════════════════════════════════════════
   LOCAL LENZ — Google Places Service (Google Cloud Places API v1)
   Powers city autocomplete and live Explore destinations.
   Requires GOOGLE_MAPS_API_KEY (Google Cloud → Places API (New)).
   Falls back gracefully to OSM when the key is absent.
   ════════════════════════════════════════════════════════════════ */

'use strict';

const API_KEY  = process.env.GOOGLE_MAPS_API_KEY;
const BASE_URL = 'https://places.googleapis.com/v1';

// In-memory cache to keep billable Places calls down
const cache = new Map();
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

function isConfigured() {
  return !!(API_KEY && API_KEY.trim() && API_KEY !== 'your_google_cloud_maps_api_key');
}

function cacheGet(key) {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > CACHE_TTL_MS) { cache.delete(key); return null; }
  return hit.value;
}

function cacheSet(key, value) {
  cache.set(key, { at: Date.now(), value });
}

/**
 * Low-level Places API (New) Text Search call.
 */
async function searchText(textQuery, fieldMask, extra = {}) {
  const res = await fetch(`${BASE_URL}/places:searchText`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': API_KEY,
      'X-Goog-FieldMask': fieldMask
    },
    body: JSON.stringify({
      textQuery,
      languageCode: 'en',
      regionCode: 'IN',
      maxResultCount: 10,
      ...extra
    })
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Google Places ${res.status}: ${body.slice(0, 200)}`);
  }

  const data = await res.json();
  return data.places || [];
}

/**
 * City / place autocomplete — returns coordinates in a single call so the
 * frontend can plan a journey straight from the selected suggestion.
 */
async function autocompleteCities(query) {
  if (!isConfigured()) return null; // signals caller to use the OSM fallback
  if (!query || query.trim().length < 2) return [];

  const key = `ac:${query.toLowerCase().trim()}`;
  const cached = cacheGet(key);
  if (cached) return cached;

  const fieldMask = [
    'places.id',
    'places.displayName',
    'places.formattedAddress',
    'places.shortFormattedAddress',
    'places.location',
    'places.types'
  ].join(',');

  try {
    const places = await searchText(query, fieldMask);

    const results = places.map(p => {
      const address = p.formattedAddress || '';
      // "Agra, Uttar Pradesh, India" → region "Uttar Pradesh", country "India".
      // With regionCode IN, Google often drops the country: "Jaipur, Rajasthan".
      const parts   = address.split(',').map(s => s.trim()).filter(Boolean);
      const last    = parts.length ? parts[parts.length - 1] : '';
      const hasCountry = /^india$/i.test(last);
      const country = hasCountry ? last : 'India';
      const region  = hasCountry
        ? (parts.length >= 2 ? parts[parts.length - 2] : '')
        : (parts.length >= 2 ? last : '');
      const name    = (p.displayName && p.displayName.text) || parts[0] || query;

      return {
        name: region && !name.includes(region) ? `${name}, ${region}` : name,
        fullName: address,
        lat: p.location ? p.location.latitude : null,
        lon: p.location ? p.location.longitude : null,
        placeId: p.id,
        region,
        country,
        provider: 'google'
      };
    }).filter(r => r.lat !== null && r.lon !== null);

    cacheSet(key, results);
    return results;
  } catch (err) {
    console.error('Google Places autocomplete failed:', err.message);
    return null; // fall back to OSM
  }
}

// Category → real Google Places search query
const CATEGORY_QUERIES = {
  all:        'top tourist destinations in India',
  historical: 'historical monuments and forts in India',
  mountains:  'hill stations and mountain destinations in India',
  beaches:    'best beaches in India',
  religious:  'famous temples and religious places in India',
  nature:     'national parks and nature reserves in India',
  food:       'famous food destinations in India',
  culture:    'cultural heritage sites in India'
};

/**
 * Live Explore destinations, straight from Google Places (real names,
 * real ratings, real photos — no hardcoded data).
 */
async function getDestinations(category = 'all') {
  if (!isConfigured()) return null;

  const cat   = CATEGORY_QUERIES[category] ? category : 'all';
  const key   = `dest:${cat}`;
  const cached = cacheGet(key);
  if (cached) return cached;

  const fieldMask = [
    'places.id',
    'places.displayName',
    'places.formattedAddress',
    'places.location',
    'places.rating',
    'places.userRatingCount',
    'places.editorialSummary',
    'places.photos'
  ].join(',');

  try {
    const places = await searchText(CATEGORY_QUERIES[cat], fieldMask);

    const results = places.map(p => {
      const address = p.formattedAddress || '';
      const parts   = address.split(',').map(s => s.trim()).filter(Boolean);
      const state   = parts.length >= 2 ? parts[parts.length - 2] : 'India';
      const photo   = p.photos && p.photos.length ? p.photos[0].name : null;

      return {
        id: p.id,
        name: (p.displayName && p.displayName.text) || 'Unknown place',
        state: state.replace(/\s*\d{6}$/, ''), // strip trailing PIN codes
        desc: (p.editorialSummary && p.editorialSummary.text) || address,
        rating: p.rating ? `⭐ ${p.rating.toFixed(1)}` : '⭐ New',
        reviews: p.userRatingCount || 0,
        lat: p.location ? p.location.latitude : null,
        lon: p.location ? p.location.longitude : null,
        category: cat,
        photoUrl: photo ? `/api/place-photo?ref=${encodeURIComponent(photo)}` : null,
        provider: 'google'
      };
    });

    cacheSet(key, results);
    return results;
  } catch (err) {
    console.error('Google Places destinations failed:', err.message);
    return null;
  }
}

/**
 * Resolve a Places photo reference to a temporary image URL.
 * Proxied so the API key never reaches the browser.
 */
async function getPhotoUrl(photoName, maxWidth = 600) {
  if (!isConfigured() || !photoName) return null;

  const url = `${BASE_URL}/${photoName}/media?maxWidthPx=${maxWidth}&skipHttpRedirect=true&key=${API_KEY}`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`photo ${res.status}`);
    const data = await res.json();
    return data.photoUri || null;
  } catch (err) {
    console.error('Google Places photo failed:', err.message);
    return null;
  }
}

module.exports = {
  isConfigured,
  autocompleteCities,
  getDestinations,
  getPhotoUrl,
  CATEGORY_QUERIES
};
