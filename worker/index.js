/* ════════════════════════════════════════════════════════════════
   LOCAL LENZ — Cloudflare Workers entrypoint
   Same API surface as server/index.js, expressed as a fetch handler.
   Static assets are served by the ASSETS binding; everything under
   /api/* is handled here, reusing the shared service modules.
   ════════════════════════════════════════════════════════════════ */

import { createClient } from '@supabase/supabase-js';

import geoService from '../server/services/geoService.js';
import weatherService from '../server/services/weatherService.js';
import placesService from '../server/services/placesService.js';
import safetyService from '../server/services/safetyService.js';
import fareService from '../server/services/fareService.js';
import grokService from '../server/services/grokService.js';
import googlePlaces from '../server/services/googlePlacesService.js';

// ── HELPERS ─────────────────────────────────────────────────────
const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS'
    }
  });

const bad = (message, status = 400) => json({ error: message }, status);

/**
 * Workers expose configuration on `env`, but the shared services read
 * process.env. Mirror the bindings across on each request.
 */
function bridgeEnv(env) {
  if (typeof process === 'undefined' || !process.env) return;
  for (const key of Object.keys(env)) {
    if (typeof env[key] === 'string') process.env[key] = env[key];
  }
}

function getSupabase(env) {
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) return null;
  try {
    return createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);
  } catch (err) {
    console.error('Supabase init failed:', err.message);
    return null;
  }
}

/**
 * Verify the caller's Supabase JWT. Returns null when unauthenticated —
 * unlike the Express version there is no mock-user fallback here.
 */
async function requireUser(request, supabase) {
  if (!supabase) return null;
  const header = request.headers.get('authorization') || '';
  if (!header.startsWith('Bearer ')) return null;

  try {
    const { data, error } = await supabase.auth.getUser(header.slice(7));
    if (error || !data.user) return null;
    return data.user;
  } catch (err) {
    return null;
  }
}

// Fixed-window rate limiter. Per-isolate rather than global, which is a
// reasonable trade for a read-only public API.
const hits = new Map();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_HITS = 100;

function rateLimited(request) {
  const ip = request.headers.get('cf-connecting-ip') || 'unknown';
  const now = Date.now();
  const entry = hits.get(ip);

  if (!entry || now - entry.start > WINDOW_MS) {
    hits.set(ip, { start: now, count: 1 });
    return false;
  }
  entry.count += 1;
  return entry.count > MAX_HITS;
}

// ── ROUTER ──────────────────────────────────────────────────────
async function handleApi(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;
  const q = url.searchParams;

  if (request.method === 'OPTIONS') return json({}, 204);
  if (rateLimited(request)) return bad('Too many requests. Please try again later.', 429);

  const supabase = getSupabase(env);

  // 1. HEALTH
  if (path === '/api/health') {
    return json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      databaseConnected: !!supabase,
      googlePlacesConfigured: googlePlaces.isConfigured(),
      runtime: 'cloudflare-workers'
    });
  }

  // 2. GEOCODE / AUTOCOMPLETE
  if (path === '/api/geocode') {
    const query = q.get('q');
    if (!query) return bad('Query parameter "q" is required');
    return json(await geoService.autocomplete(query));
  }

  // 2A. PLACE DETAILS (coordinates for a picked suggestion)
  if (path === '/api/place-details') {
    const placeId = q.get('placeId');
    if (!placeId) return bad('Query parameter "placeId" is required');
    const details = await googlePlaces.getPlaceDetails(placeId);
    if (!details) return bad('Place details unavailable', 404);
    return json(details);
  }

  // 2B. EXPLORE DESTINATIONS
  if (path === '/api/destinations') {
    const category = q.get('category') || 'all';
    const destinations = await googlePlaces.getDestinations(category);
    if (!destinations) {
      return json({
        destinations: [],
        provider: 'unavailable',
        message: googlePlaces.isConfigured()
          ? 'Google Places request failed. Please try again.'
          : 'Live destinations need GOOGLE_MAPS_API_KEY in your environment.'
      });
    }
    return json({ destinations, provider: 'google', category });
  }

  // 2C. PLACE PHOTO PROXY
  if (path === '/api/place-photo') {
    const ref = q.get('ref');
    if (!ref) return bad('Query parameter "ref" is required');
    const photoUrl = await googlePlaces.getPhotoUrl(ref);
    if (!photoUrl) return bad('Photo unavailable', 404);
    return Response.redirect(photoUrl, 302);
  }

  // 3 / 3B. JOURNEY + SMART JOURNEY
  if (path === '/api/journey' || path === '/api/smart-journey') {
    const fromLat = q.get('fromLat'), fromLon = q.get('fromLon');
    const toLat = q.get('toLat'), toLon = q.get('toLon');
    if (!fromLat || !fromLon || !toLat || !toLon) {
      return bad('Missing coordinates parameter(s). Required: fromLat, fromLon, toLat, toLon');
    }

    const smart = path === '/api/smart-journey';
    const originName = q.get('fromName') || 'Origin';
    const destName = q.get('toName') || 'Destination';

    try {
      const route = await geoService.getRoute(
        parseFloat(fromLat), parseFloat(fromLon),
        parseFloat(toLat), parseFloat(toLon)
      );

      // Weather, POIs and helplines are independent — fetch them together
      const [weather, stops, safetyNumbers] = await Promise.all([
        weatherService.getWeather(parseFloat(toLat), parseFloat(toLon)),
        placesService.discoverAlongRoute(route.geometry),
        safetyService.getEmergencyNumbers(supabase)
      ]);

      const base = {
        distance: route.distance,
        duration: route.duration,
        geometry: route.geometry,
        weather,
        stops,
        safety: { numbers: safetyNumbers, tips: safetyService.SAFETY_TIPS }
      };

      if (!smart) {
        return json({
          ...base,
          metadata: {
            timestamp: new Date().toISOString(),
            routingProvider: 'OSRM Project',
            weatherProvider: 'Open-Meteo',
            placesProvider: 'OpenStreetMap Overpass API'
          }
        });
      }

      const fares = fareService.buildFareContext(route.distance, originName, destName);
      const grokAnalysis = await grokService.analyzeJourney({
        origin: originName,
        destination: destName,
        distance: route.distance,
        duration: route.duration,
        weather,
        stops,
        fares
      });

      return json({
        ...base,
        fares,
        grokAnalysis,
        dataStatus: grokAnalysis.dataStatus || 'estimated',
        metadata: {
          timestamp: new Date().toISOString(),
          routingProvider: 'OSRM Project (API-sourced)',
          weatherProvider: 'Open-Meteo (API-sourced)',
          placesProvider: 'OpenStreetMap Overpass API (API-sourced)',
          fareProvider: 'Local Lenz Fare Engine (Estimated)',
          grokProvider: grokAnalysis.grokAnalyzed
            ? `Google Gemini (${grokAnalysis.aiProvider || 'AI-analyzed'})`
            : 'Local Lenz Intelligence (Rule-based estimated)'
        }
      });
    } catch (err) {
      console.error('Journey processing failure:', err.message);
      return bad('Could not build this journey. Please try again.', 502);
    }
  }

  // 4. NEARBY SAFETY SERVICES
  if (path === '/api/nearby') {
    const lat = q.get('lat'), lon = q.get('lon');
    if (!lat || !lon) return bad('Latitude and Longitude query parameters are required');
    return json(await safetyService.getNearbySafetyServices(parseFloat(lat), parseFloat(lon), q.get('type')));
  }

  // ── AUTHENTICATED TABLE ROUTES ────────────────────────────────
  const TABLES = {
    '/api/journeys':           { table: 'saved_journeys',  order: 'saved_at' },
    '/api/favourites':         { table: 'favourites' },
    '/api/emergency-contacts': { table: 'emergency_contacts' },
    '/api/search-history':     { table: 'search_history',  order: 'searched_at', limit: 10 }
  };

  const routeBase = '/' + path.split('/').slice(1, 3).join('/');
  const cfg = TABLES[routeBase];

  if (cfg) {
    if (!supabase) return json(request.method === 'GET' ? [] : { success: true });

    const user = await requireUser(request, supabase);
    if (!user) return bad('Unauthorized: valid bearer token required', 401);

    try {
      if (request.method === 'GET') {
        let query = supabase.from(cfg.table).select('*').eq('user_id', user.id);
        if (cfg.order) query = query.order(cfg.order, { ascending: false });
        if (cfg.limit) query = query.limit(cfg.limit);
        const { data, error } = await query;
        if (error) throw error;
        return json(data);
      }

      if (request.method === 'POST') {
        const body = await request.json().catch(() => ({}));
        const { data, error } = await supabase
          .from(cfg.table)
          .insert({ ...body, user_id: user.id })
          .select()
          .single();
        if (error) throw error;
        return json(data, 201);
      }

      if (request.method === 'DELETE') {
        const id = path.split('/')[3];
        if (!id) return bad('Record id is required');
        const { error } = await supabase
          .from(cfg.table)
          .delete()
          .eq('id', id)
          .eq('user_id', user.id);
        if (error) throw error;
        return json({ success: true });
      }
    } catch (err) {
      console.error(`${cfg.table} operation failed:`, err.message);
      return bad('Database operation failed', 500);
    }
  }

  return bad('Not found', 404);
}

export default {
  async fetch(request, env, ctx) {
    bridgeEnv(env);

    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) {
      try {
        return await handleApi(request, env);
      } catch (err) {
        console.error('Unhandled worker error:', err && err.stack);
        return json({ error: 'An unexpected error occurred. Please try again later.' }, 500);
      }
    }

    // Everything else is a static asset
    return env.ASSETS.fetch(request);
  }
};
