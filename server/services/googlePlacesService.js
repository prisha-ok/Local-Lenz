/* ════════════════════════════════════════════════════════════════
   LOCAL LENZ — Google Places Service (Google Cloud Places API v1)
   Powers city autocomplete and live Explore destinations.
   Requires GOOGLE_MAPS_API_KEY (Google Cloud → Places API (New)).
   Falls back gracefully to OSM when the key is absent.
   ════════════════════════════════════════════════════════════════ */

'use strict';

const BASE_URL = 'https://places.googleapis.com/v1';

// Read lazily: on Cloudflare Workers, environment bindings are not available
// at module-evaluation time, only once a request is being handled.
function apiKey() {
  return (typeof process !== 'undefined' && process.env && process.env.GOOGLE_MAPS_API_KEY) || '';
}

// In-memory cache to keep billable Places calls down
const cache = new Map();
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

function isConfigured() {
  const key = apiKey();
  return !!(key && key.trim() && key !== 'your_google_cloud_maps_api_key');
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
      'X-Goog-Api-Key': apiKey(),
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
 * City autocomplete via the Places Autocomplete endpoint, restricted to
 * (cities). Text Search matches business names — typing "Mum" returned
 * "Mum's Pizza" instead of Mumbai — so cities go through this endpoint.
 *
 * Predictions carry no coordinates; those are resolved by getPlaceDetails()
 * once the user actually picks a suggestion, which keeps the per-keystroke
 * cost to a single call.
 */
async function autocompleteCities(query) {
  if (!isConfigured()) return null; // signals caller to use the OSM fallback
  if (!query || query.trim().length < 2) return [];

  const key = `ac:${query.toLowerCase().trim()}`;
  const cached = cacheGet(key);
  if (cached) return cached;

  try {
    const res = await fetch(`${BASE_URL}/places:autocomplete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey()
      },
      body: JSON.stringify({
        input: query,
        includedPrimaryTypes: ['(cities)'],
        includedRegionCodes: ['in'],
        languageCode: 'en'
      })
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Google Places ${res.status}: ${body.slice(0, 200)}`);
    }

    const data = await res.json();
    const suggestions = data.suggestions || [];

    const results = suggestions
      .filter(s => s.placePrediction)
      .map(s => {
        const pred = s.placePrediction;
        const full = (pred.text && pred.text.text) || '';
        // "Mumbai, Maharashtra, India" → name "Mumbai", region "Maharashtra"
        const parts = full.split(',').map(v => v.trim()).filter(Boolean);
        const place = (pred.structuredFormat
          && pred.structuredFormat.mainText
          && pred.structuredFormat.mainText.text) || parts[0] || full;
        const region = parts.length >= 3 ? parts[parts.length - 2] : '';

        return {
          name: region ? `${place}, ${region}` : place,
          fullName: full,
          lat: null,               // resolved on selection
          lon: null,
          placeId: pred.placeId,
          region,
          country: 'India',
          provider: 'google',
          needsDetails: true
        };
      })
      .filter(r => r.name && r.placeId);

    cacheSet(key, results);
    return results;
  } catch (err) {
    console.error('Google Places autocomplete failed:', err.message);
    return null; // fall back to OSM
  }
}

/**
 * Resolve a place id to coordinates. Called once, when a suggestion is picked.
 */
async function getPlaceDetails(placeId) {
  if (!isConfigured() || !placeId) return null;

  const key = `det:${placeId}`;
  const cached = cacheGet(key);
  if (cached) return cached;

  try {
    const res = await fetch(`${BASE_URL}/places/${encodeURIComponent(placeId)}`, {
      headers: {
        'X-Goog-Api-Key': apiKey(),
        'X-Goog-FieldMask': 'id,displayName,formattedAddress,location'
      }
    });

    if (!res.ok) throw new Error(`details ${res.status}`);

    const p = await res.json();
    if (!p.location) return null;

    const address = p.formattedAddress || '';
    const parts = address.split(',').map(v => v.trim()).filter(Boolean);
    const last = parts.length ? parts[parts.length - 1] : '';
    const hasCountry = /^india$/i.test(last);

    const details = {
      name: (p.displayName && p.displayName.text) || parts[0] || '',
      fullName: address,
      lat: p.location.latitude,
      lon: p.location.longitude,
      placeId: p.id || placeId,
      region: hasCountry
        ? (parts.length >= 2 ? parts[parts.length - 2] : '')
        : (parts.length >= 2 ? last : ''),
      country: hasCountry ? last : 'India',
      provider: 'google'
    };

    cacheSet(key, details);
    return details;
  } catch (err) {
    console.error('Google Places details failed:', err.message);
    return null;
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

  const url = `${BASE_URL}/${photoName}/media?maxWidthPx=${maxWidth}&skipHttpRedirect=true&key=${apiKey()}`;
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
  getPlaceDetails,
  getDestinations,
  getPhotoUrl,
  CATEGORY_QUERIES
};
