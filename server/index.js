/* ════════════════════════════════════════════════════════════════
   LOCAL LENZ — Express Full-Stack Server Backend
   Serves as static router, rate limiter, caching, and API Gateway.
   ════════════════════════════════════════════════════════════════ */

'use strict';

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const rateLimit = require('express-rate-limit');
const { createClient } = require('@supabase/supabase-js');

// Import services
const geoService = require('./services/geoService');
const weatherService = require('./services/weatherService');
const placesService = require('./services/placesService');
const safetyService = require('./services/safetyService');
const fareService = require('./services/fareService');
const grokService = require('./services/grokService');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Supabase Client (safe fallback if env keys are missing)
let supabase = null;
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (supabaseUrl && supabaseAnonKey) {
  try {
    supabase = createClient(supabaseUrl, supabaseAnonKey);
    console.log('Local Lenz Backend: Supabase client connected successfully.');
  } catch (err) {
    console.error('Local Lenz Backend: Failed to initialize Supabase client:', err.message);
  }
} else {
  console.warn('Local Lenz Backend: Supabase env keys missing. Operating in local mock fallback mode for database operations.');
}

// ── MIDDLEWARE ──────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// Serve static frontend files directly from project root
app.use(express.static(path.join(__dirname, '..')));

// Rate Limiter: Prevent abuse of external API queries
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again later.' }
});
app.use('/api/', apiLimiter);

// ── JWT AUTHENTICATION MIDDLEWARE ──────────────────────────────
async function authMiddleware(req, res, next) {
  if (!supabase) {
    // Graceful fallback for local development without DB configured
    req.user = { id: 'mock-user-id', email: 'dev@locallenz.com' };
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing bearer token' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      return res.status(401).json({ error: 'Unauthorized: Invalid token signature' });
    }
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized: Authentication check failed' });
  }
}

// ── 1. API: HEALTH CHECK ────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    databaseConnected: !!supabase
  });
});

// ── 2. API: GEOCODE / AUTOCOMPLETE ──────────────────────────────
app.get('/api/geocode', async (req, res, next) => {
  const query = req.query.q;
  if (!query) {
    return res.status(400).json({ error: 'Query parameter "q" is required' });
  }
  try {
    const suggestions = await geoService.autocomplete(query);
    res.json(suggestions);
  } catch (err) {
    next(err);
  }
});

// ── 3. API: COMPREHENSIVE JOURNEY ───────────────────────────────
// Fetches routing, weather, POIs, and safety details in one clean payload
app.get('/api/journey', async (req, res, next) => {
  const { fromLat, fromLon, toLat, toLon } = req.query;
  
  if (!fromLat || !fromLon || !toLat || !toLon) {
    return res.status(400).json({ error: 'Missing coordinates parameter(s). Required: fromLat, fromLon, toLat, toLon' });
  }

  try {
    // 1. Get Route path from OSRM
    const route = await geoService.getRoute(
      parseFloat(fromLat), parseFloat(fromLon),
      parseFloat(toLat), parseFloat(toLon)
    );

    // 2. Query weather at destination coordinate
    const weather = await weatherService.getWeather(parseFloat(toLat), parseFloat(toLon));

    // 3. Query attractions along the OSRM route line
    const stops = await placesService.discoverAlongRoute(route.geometry);

    // 4. Retrieve emergency contact registry numbers
    const safetyNumbers = await safetyService.getEmergencyNumbers(supabase);

    res.json({
      distance: route.distance,
      duration: route.duration,
      geometry: route.geometry,
      weather: weather,
      stops: stops,
      safety: {
        numbers: safetyNumbers,
        tips: safetyService.SAFETY_TIPS
      },
      metadata: {
        timestamp: new Date().toISOString(),
        routingProvider: 'OSRM Project',
        weatherProvider: 'Open-Meteo',
        placesProvider: 'OpenStreetMap Overpass API'
      }
    });

  } catch (err) {
    console.error('Journey processing failure:', err.message);
    next(err);
  }
});

// ── 3B. API: SMART JOURNEY WITH GROK ANALYSIS ────────────────────
app.get('/api/smart-journey', async (req, res, next) => {
  const { fromLat, fromLon, toLat, toLon, fromName, toName } = req.query;
  
  if (!fromLat || !fromLon || !toLat || !toLon) {
    return res.status(400).json({ error: 'Missing coordinates parameter(s). Required: fromLat, fromLon, toLat, toLon' });
  }

  const originName = fromName || 'Origin';
  const destName = toName || 'Destination';

  try {
    // 1. Get Route path from OSRM
    const route = await geoService.getRoute(
      parseFloat(fromLat), parseFloat(fromLon),
      parseFloat(toLat), parseFloat(toLon)
    );

    // 2. Query weather at destination coordinate
    const weather = await weatherService.getWeather(parseFloat(toLat), parseFloat(toLon));

    // 3. Query attractions along the OSRM route line
    const stops = await placesService.discoverAlongRoute(route.geometry);

    // 4. Retrieve emergency contact registry numbers
    const safetyNumbers = await safetyService.getEmergencyNumbers(supabase);

    // 5. Generate realistic estimated fares context
    const fares = fareService.buildFareContext(route.distance, originName, destName);

    // 6. Run Grok analysis over the gathered API data and fares
    const grokAnalysis = await grokService.analyzeJourney({
      origin: originName,
      destination: destName,
      distance: route.distance,
      duration: route.duration,
      weather: weather,
      stops: stops,
      fares: fares
    });

    res.json({
      distance: route.distance,
      duration: route.duration,
      geometry: route.geometry,
      weather: weather,
      stops: stops,
      safety: {
        numbers: safetyNumbers,
        tips: safetyService.SAFETY_TIPS
      },
      fares: fares,
      grokAnalysis: grokAnalysis,
      dataStatus: grokAnalysis.dataStatus || 'estimated',
      metadata: {
        timestamp: new Date().toISOString(),
        routingProvider: 'OSRM Project (API-sourced)',
        weatherProvider: 'Open-Meteo (API-sourced)',
        placesProvider: 'OpenStreetMap Overpass API (API-sourced)',
        fareProvider: 'Local Lenz Fare Engine (Estimated)',
        grokProvider: grokAnalysis.grokAnalyzed ? `Google Gemini (${grokAnalysis.aiProvider || 'AI-analyzed'})` : 'Local Lenz Intelligence (Rule-based estimated)'
      }
    });

  } catch (err) {
    console.error('Smart journey processing failure:', err.message);
    next(err);
  }
});


// ── 4. API: NEARBY SAFETY SERVICES ──────────────────────────────
app.get('/api/nearby', async (req, res, next) => {
  const { lat, lon, type } = req.query;
  if (!lat || !lon) {
    return res.status(400).json({ error: 'Latitude and Longitude query parameters are required' });
  }
  try {
    const services = await safetyService.getNearbySafetyServices(
      parseFloat(lat), parseFloat(lon), type
    );
    res.json(services);
  } catch (err) {
    next(err);
  }
});

// ── 5. API: SAVED JOURNEYS (DATABASE persistence) ───────────────
app.get('/api/journeys', authMiddleware, async (req, res, next) => {
  if (!supabase) {
    return res.json([]); // Dev fallback
  }
  try {
    const { data, error } = await supabase
      .from('saved_journeys')
      .select('*')
      .eq('user_id', req.user.id)
      .order('saved_at', { ascending: false });

    if (error) throw error;
    res.json(data);
  } catch (err) {
    next(err);
  }
});

app.post('/api/journeys', authMiddleware, async (req, res, next) => {
  const { from_city, to_city, stops } = req.body;
  if (!from_city || !to_city) {
    return res.status(400).json({ error: 'from_city and to_city are required' });
  }

  if (!supabase) {
    return res.json({ id: 'mock-id', from_city, to_city, stops, saved_at: new Date() });
  }

  try {
    const { data, error } = await supabase
      .from('saved_journeys')
      .insert({
        user_id: req.user.id,
        from_city,
        to_city,
        stops: stops || []
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    next(err);
  }
});

app.delete('/api/journeys/:id', authMiddleware, async (req, res, next) => {
  if (!supabase) {
    return res.json({ success: true });
  }
  try {
    const { error } = await supabase
      .from('saved_journeys')
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', req.user.id);

    if (error) throw error;
    res.json({ success: true, message: 'Journey deleted successfully' });
  } catch (err) {
    next(err);
  }
});

// ── 6. API: FAVOURITES (DATABASE persistence) ───────────────────
app.get('/api/favourites', authMiddleware, async (req, res, next) => {
  if (!supabase) return res.json([]);
  try {
    const { data, error } = await supabase
      .from('favourites')
      .select('*')
      .eq('user_id', req.user.id);
    if (error) throw error;
    res.json(data);
  } catch (err) {
    next(err);
  }
});

app.post('/api/favourites', authMiddleware, async (req, res, next) => {
  const { place_id, place_name, category, description, lat, lon } = req.body;
  if (!place_id || !place_name) {
    return res.status(400).json({ error: 'place_id and place_name are required' });
  }
  if (!supabase) return res.json({ success: true });
  try {
    const { data, error } = await supabase
      .from('favourites')
      .insert({
        user_id: req.user.id,
        place_id,
        place_name,
        category,
        description,
        latitude: lat,
        longitude: lon
      })
      .select()
      .single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    next(err);
  }
});

app.delete('/api/favourites/:id', authMiddleware, async (req, res, next) => {
  if (!supabase) return res.json({ success: true });
  try {
    const { error } = await supabase
      .from('favourites')
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', req.user.id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// ── 7. API: EMERGENCY CONTACTS (DATABASE persistence) ───────────
app.get('/api/emergency-contacts', authMiddleware, async (req, res, next) => {
  if (!supabase) return res.json([]);
  try {
    const { data, error } = await supabase
      .from('emergency_contacts')
      .select('*')
      .eq('user_id', req.user.id);
    if (error) throw error;
    res.json(data);
  } catch (err) {
    next(err);
  }
});

app.post('/api/emergency-contacts', authMiddleware, async (req, res, next) => {
  const { name, phone, relationship } = req.body;
  if (!name || !phone) {
    return res.status(400).json({ error: 'name and phone are required' });
  }
  if (!supabase) return res.json({ success: true });
  try {
    const { data, error } = await supabase
      .from('emergency_contacts')
      .insert({
        user_id: req.user.id,
        name,
        phone,
        relationship
      })
      .select()
      .single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    next(err);
  }
});

app.delete('/api/emergency-contacts/:id', authMiddleware, async (req, res, next) => {
  if (!supabase) return res.json({ success: true });
  try {
    const { error } = await supabase
      .from('emergency_contacts')
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', req.user.id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// ── 8. API: SEARCH HISTORY ──────────────────────────────────────
app.get('/api/search-history', authMiddleware, async (req, res, next) => {
  if (!supabase) return res.json([]);
  try {
    const { data, error } = await supabase
      .from('search_history')
      .select('*')
      .eq('user_id', req.user.id)
      .order('searched_at', { ascending: false })
      .limit(10);
    if (error) throw error;
    res.json(data);
  } catch (err) {
    next(err);
  }
});

app.post('/api/search-history', authMiddleware, async (req, res, next) => {
  const { origin, destination } = req.body;
  if (!origin || !destination) return res.sendStatus(400);
  if (!supabase) return res.sendStatus(201);
  try {
    await supabase
      .from('search_history')
      .insert({ user_id: req.user.id, origin, destination });
    res.sendStatus(201);
  } catch (err) {
    next(err);
  }
});

app.delete('/api/search-history/:id', authMiddleware, async (req, res, next) => {
  if (!supabase) return res.json({ success: true });
  try {
    await supabase
      .from('search_history')
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', req.user.id);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// ── CENTRALIZED ERROR HANDLER ───────────────────────────────────
app.use((err, req, res, next) => {
  console.error(`[Error] Request to ${req.originalUrl} failed:`, err.stack || err.message);
  
  const status = err.status || 500;
  const msg = process.env.NODE_ENV === 'production'
    ? 'An unexpected error occurred. Please try again later.'
    : err.message || 'Internal Server Error';
    
  res.status(status).json({ error: msg });
});

// Start listening
app.listen(PORT, () => {
  console.log(`===================================================`);
  console.log(`Local Lenz server running at: http://localhost:${PORT}`);
  console.log(`Serving static files from project root directory.`);
  console.log(`===================================================`);
});
