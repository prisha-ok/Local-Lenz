/* ════════════════════════════════════════════════════════════════
   LOCAL LENZ — grokService.js
   Intelligent Travel Recommendation & Synthesis Layer using Grok.
   
   Architecture:
   Receives verified API-sourced data (OSRM route, weather, OSM stops)
   and fare calculations, then synthesizes them into an optimized
   travel recommendation and custom itinerary.
   ════════════════════════════════════════════════════════════════ */

'use strict';

const { OpenAI } = require('openai');

// Initialize OpenAI client pointing to xAI's API
let openai = null;
const apiKey = process.env.XAI_API_KEY;

if (apiKey && apiKey !== 'your_xai_api_key_from_console.x.ai') {
  try {
    openai = new OpenAI({
      apiKey: apiKey,
      baseURL: 'https://api.x.ai/v1'
    });
    console.log('Local Lenz Backend: Grok AI service initialized successfully.');
  } catch (err) {
    console.error('Local Lenz Backend: Failed to initialize Grok client:', err.message);
  }
} else {
  console.warn('Local Lenz Backend: XAI_API_KEY missing or default in .env. Grok will operate in fallback mock analysis mode.');
}

/**
 * Synthesizes route, weather, POIs, and fares using Grok chat completion.
 * Falls back to rule-based JSON if Grok client is not configured or fails.
 * 
 * @param {object} travelData - object containing route, weather, safety, and fare context
 * @returns {Promise<object>} structured analysis response
 */
async function analyzeJourney(travelData) {
  const { origin, destination, distance, duration, weather, stops, fares } = travelData;

  // 1. If Grok isn't initialized, use local fallback intelligence engine immediately
  if (!openai) {
    return generateFallbackAnalysis(travelData);
  }

  // 2. Build the system prompt
  const systemPrompt = `You are Local Lenz, an expert Indian travel assistant.
Your job is to analyze real-time/API-sourced travel data and generate a structured JSON recommendation.
You must output ONLY a valid JSON object matching the schema below. Do not include markdown code block formatting (like \`\`\`json) or any pre/post text. Just return the raw JSON string.

Output Schema:
{
  "recommended": {
    "mode": "train" | "cab" | "bus" | "metro" | "bike" | "auto" | "walk",
    "reason": "A 2-3 sentence personalized explanation of why this mode is recommended based on the OSRM distance, weather conditions, safety, and travel cost."
  },
  "itinerary": [
    {
      "time": "08:00 AM",
      "icon": "🚀",
      "tag": "Departure",
      "tagColor": "#3B82F6",
      "title": "Depart from [Origin]",
      "desc": "Actionable start tips.",
      "tips": ["Tip 1", "Tip 2"]
    },
    ... (generate 3-5 logical steps based on the actual stops along the route provided in the user prompt)
  ],
  "budgetSuggestion": {
    "advice": "Grok's smart advice on how to keep costs low on this route, referencing the fares provided."
  },
  "discoveryAdvice": "A brief sentence summarizing the attractions along the route and when to stop."
}`;

  // 3. Build user prompt with actual travel data
  const userPrompt = `Analyze this trip:
Origin: ${origin}
Destination: ${destination}
OSRM Route Distance: ${distance.toFixed(1)} km
OSRM Route Road Duration: ${Math.round(duration)} minutes
Destination Weather: ${weather.temperature}°C, ${weather.condition}, Wind ${weather.windSpeed} km/h
Attractions Discovered along route: ${JSON.stringify(stops.map(s => ({ name: s.name, type: s.type, distance: s.distance })))}
Estimated Fare Context: ${JSON.stringify(fares.options.filter(o => o.available))}

Remember, you are the intelligence layer. Do not invent coordinates or base route parameters. Use the provided fares and OSRM route metrics.
Generate the optimal route recommendation, budget advice, and dynamic itinerary now. Output ONLY raw JSON.`;

  try {
    const response = await openai.chat.completions.create({
      model: 'grok-beta',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.2,
      response_format: { type: "json_object" }
    });

    const content = response.choices[0].message.content.trim();
    const result = JSON.parse(content);
    
    // Add metadata marking that it was analyzed by Grok
    result.grokAnalyzed = true;
    result.dataStatus = 'ai-analyzed';
    return result;

  } catch (err) {
    console.error('Grok analysis query failed, using rule-based fallback:', err.message);
    return generateFallbackAnalysis(travelData);
  }
}

/**
 * Fallback analyzer if Grok API is unavailable/unconfigured.
 * Uses deterministic rules to provide a structured recommendation.
 */
function generateFallbackAnalysis(travelData) {
  const { origin, destination, distance, weather, stops, fares } = travelData;
  const isIntercity = distance > 50;

  // Determine recommendation rule-based
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

  // Create a structured itinerary
  const itinerary = [];
  const totalStops = stops.length;

  itinerary.push({
    time: '08:00 AM',
    icon: '🚀',
    tag: 'Departure',
    tagColor: '#3B82F6',
    title: `Depart from ${origin}`,
    desc: 'Begin your journey! Grab your bags, keep a water bottle handy, and start heading towards your destination.',
    tips: ['Keep your offline map ready', 'Charge your phone to 100%', 'Share route with family']
  });

  // Mid stops
  stops.slice(0, 3).forEach((stop, i) => {
    const timeStr = `${9 + i}:30 AM`;
    itinerary.push({
      time: timeStr,
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
    desc: `You have arrived safely! The weather at your destination is currently ${weather.temperature}°C and ${weather.condition.toLowerCase()}.`,
    tips: ['Check local transit options', 'Find a nearby restaurant to taste regional delicacies']
  });

  return {
    recommended: {
      mode: recommendedMode,
      reason: reason
    },
    itinerary: itinerary,
    budgetSuggestion: {
      advice: isIntercity 
        ? 'Book train tickets in advance via IRCTC to secure lower fares. Cabs will cost significantly more.' 
        : 'Choose Metro or Auto Rickshaw over private cabs to save up to 60% on your commute.'
    },
    discoveryAdvice: totalStops > 0 
      ? `We found ${totalStops} attractions along your route. We recommend stopping at ${stops[0].name} for a break.`
      : 'Keep an eye out for local tea stalls and landmarks along the road.',
    grokAnalyzed: false,
    dataStatus: 'estimated'
  };
}

module.exports = { analyzeJourney };
