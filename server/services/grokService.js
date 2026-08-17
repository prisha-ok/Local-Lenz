/* ════════════════════════════════════════════════════════════════
   LOCAL LENZ — grokService.js  (Powered by Google Gemini)
   Intelligent Travel Recommendation & Synthesis Layer.

   Architecture:
   Receives verified API-sourced data (OSRM route, weather, OSM stops)
   and fare calculations, then synthesizes them into an optimized
   travel recommendation and custom itinerary using Gemini 2.0 Flash.
   ════════════════════════════════════════════════════════════════ */

'use strict';

// Gemini is called over plain REST so this runs unchanged on Node and on
// Cloudflare Workers, where the Node SDK and module-scope env are unavailable.
const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

function geminiKey() {
  const key = (typeof process !== 'undefined' && process.env && process.env.GEMINI_API_KEY) || '';
  return (key && key !== 'your_gemini_api_key_from_aistudio.google.com') ? key : '';
}

/**
 * Single Gemini generateContent call returning parsed JSON.
 */
async function callGemini(model, prompt) {
  const res = await fetch(`${GEMINI_ENDPOINT}/${model}:generateContent?key=${geminiKey()}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: 'application/json', temperature: 0.2 }
    })
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`${res.status} ${detail.slice(0, 160)}`);
  }

  const data = await res.json();
  const text = data.candidates
    && data.candidates[0]
    && data.candidates[0].content
    && data.candidates[0].content.parts
    && data.candidates[0].content.parts[0]
    && data.candidates[0].content.parts[0].text;

  if (!text) throw new Error('Gemini returned an empty candidate');
  return JSON.parse(text.trim());
}

/**
 * Synthesizes route, weather, POIs, and fares using Gemini 2.0 Flash.
 * Falls back to rule-based JSON if Gemini client is not configured or fails.
 *
 * @param {object} travelData - object containing route, weather, safety, and fare context
 * @returns {Promise<object>} structured analysis response
 */
async function analyzeJourney(travelData) {
  const { origin, destination, distance, duration, weather, stops, fares } = travelData;

  // 1. No key configured — use the local fallback intelligence engine
  if (!geminiKey()) {
    return generateFallbackAnalysis(travelData);
  }

  // 2. Build the prompt
  const prompt = `You are Local Lenz, an expert Indian travel assistant AI.
Analyze the following real-time/API-sourced travel data and generate a structured JSON recommendation.
You MUST output ONLY a valid raw JSON object — no markdown, no code fences, no extra text.

=== TRIP DATA ===
Origin: ${origin}
Destination: ${destination}
OSRM Route Distance: ${distance.toFixed(1)} km
OSRM Road Duration: ${Math.round(duration)} minutes
Destination Weather: ${weather.temperature}°C, ${weather.condition}, Wind ${weather.windSpeed} km/h
Attractions along route: ${JSON.stringify(stops.map(s => ({ name: s.name, type: s.type, distance: s.distance })))}
Fare options (estimated): ${JSON.stringify(fares.options.filter(o => o.available).map(o => ({ mode: o.mode, fareDisplay: o.fareDisplay })))}

=== OUTPUT SCHEMA (return ONLY this JSON) ===
{
  "recommended": {
    "mode": "metro" | "cab" | "bus" | "train" | "bike" | "auto" | "walk",
    "reason": "2-3 sentence explanation referencing distance, weather, cost, and local context."
  },
  "itinerary": [
    {
      "time": "08:00 AM",
      "icon": "🚀",
      "tag": "Departure",
      "tagColor": "#3B82F6",
      "title": "Depart from ${origin}",
      "desc": "Actionable departure tip.",
      "tips": ["Tip 1", "Tip 2"]
    }
  ],
  "budgetSuggestion": {
    "advice": "Smart budget advice specific to this route, referencing the fares provided."
  },
  "discoveryAdvice": "One sentence about top attractions along this specific route."
}

Generate 3-5 logical itinerary steps based on the actual attractions and route. Output ONLY the raw JSON.`;

  // Model fallback chain — try in order until one succeeds
  const MODELS = ['gemini-flash-latest', 'gemini-2.5-flash', 'gemini-2.5-flash-lite'];

  for (const model of MODELS) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const result = await callGemini(model, prompt);

        result.grokAnalyzed = true;
        result.dataStatus  = 'ai-analyzed';
        result.aiProvider  = `Google Gemini (${model})`;
        console.log(`Gemini success: model=${model}, attempt=${attempt}`);
        return result;

      } catch (err) {
        // Quota exhausted — no model will succeed, stop immediately
        if (err.message && err.message.includes('429')) {
          console.warn('Gemini quota exceeded. Using rule-based fallback.');
          return generateFallbackAnalysis(travelData);
        }

        const is503 = err.message && (err.message.includes('503') || err.message.includes('UNAVAILABLE') || err.message.includes('overload'));
        const is404 = err.message && (err.message.includes('404') || err.message.includes('NOT_FOUND') || err.message.includes('no longer available'));

        if (is404) {
          // This model doesn't exist — skip to next model immediately
          console.warn(`Gemini model ${model} not available, trying next.`);
          break;
        }

        if (is503 && attempt < 3) {
          // Temporary overload — wait and retry same model
          const waitMs = attempt * 3000; // 3s, then 6s
          console.warn(`Gemini ${model} overloaded (attempt ${attempt}), retrying in ${waitMs}ms...`);
          await new Promise(r => setTimeout(r, waitMs));
          continue;
        }

        // Unknown error or max retries — try next model
        console.error(`Gemini ${model} failed (attempt ${attempt}): ${err.message}`);
        break;
      }
    }
  }

  console.error('All Gemini models failed. Using rule-based fallback.');
  return generateFallbackAnalysis(travelData);
}

/**
 * Fallback analyzer if Gemini API is unavailable/unconfigured.
 * Uses deterministic rules to provide a structured recommendation.
 */
function generateFallbackAnalysis(travelData) {
  const { origin, destination, distance, weather, stops, fares } = travelData;
  const isIntercity = distance > 50;

  let recommendedMode = 'cab';
  let reason = '';

  if (isIntercity) {
    recommendedMode = 'train';
    reason = `For an intercity trip of ${distance.toFixed(1)} km to ${destination}, a train is the most comfortable and cost-effective option. Fares start from ₹${fares.options.find(o => o.mode === 'train')?.fare || 150}.`;
  } else {
    const hasMetro = fares.options.find(o => o.mode === 'metro' && o.available);
    if (hasMetro) {
      recommendedMode = 'metro';
      reason = `Metro is recommended for this city route to avoid local traffic. It costs around ₹${hasMetro.fare} and is completely weather-proof.`;
    } else if (distance <= 3) {
      recommendedMode = 'walk';
      reason = `At just ${distance.toFixed(1)} km, walking is the healthiest and cheapest way to reach ${destination}. Enjoy the local streets!`;
    } else {
      recommendedMode = 'auto';
      reason = `An Auto Rickshaw is recommended for this local trip of ${distance.toFixed(1)} km, offering a balance of local experience, cost, and agility in traffic.`;
    }
  }

  const itinerary = [];

  itinerary.push({
    time: '08:00 AM',
    icon: '🚀',
    tag: 'Departure',
    tagColor: '#3B82F6',
    title: `Depart from ${origin}`,
    desc: 'Begin your journey! Grab your bags, keep a water bottle handy, and start heading towards your destination.',
    tips: ['Keep your offline map ready', 'Charge your phone to 100%', 'Share route with family']
  });

  stops.slice(0, 3).forEach((stop, i) => {
    itinerary.push({
      time: `${9 + i}:30 AM`,
      icon: '📍',
      tag: 'Sightseeing',
      tagColor: '#8B5CF6',
      title: `Visit ${stop.name}`,
      desc: `A popular landmark located along your route. Stop by to take photographs and explore.`,
      tips: ['Estimated stay: ~30-45 min', 'Perfect spot for pictures']
    });
  });

  itinerary.push({
    time: isIntercity ? '12:30 PM' : '09:30 AM',
    icon: '🏁',
    tag: 'Arrival',
    tagColor: '#F59E0B',
    title: `Arrive at ${destination}`,
    desc: weather && weather.temperature !== null && weather.temperature !== undefined
      ? `You have arrived safely! The weather at your destination is currently ${weather.temperature}°C and ${weather.condition.toLowerCase()}.`
      : 'You have arrived safely! Live weather is unavailable right now, so check conditions locally.',
    tips: ['Check local transit options', 'Find a nearby restaurant to taste regional delicacies']
  });

  return {
    recommended: { mode: recommendedMode, reason },
    itinerary,
    budgetSuggestion: {
      advice: isIntercity
        ? 'Book train tickets in advance via IRCTC to secure lower fares. Cabs will cost significantly more.'
        : 'Choose Metro or Auto Rickshaw over private cabs to save up to 60% on your commute.'
    },
    discoveryAdvice: stops.length > 0
      ? `We found ${stops.length} attractions along your route. We recommend stopping at ${stops[0].name} for a break.`
      : 'Keep an eye out for local tea stalls and landmarks along the road.',
    grokAnalyzed: false,
    dataStatus: 'estimated',
    aiProvider: 'Local Lenz Rule Engine (fallback)'
  };
}

module.exports = { analyzeJourney };
