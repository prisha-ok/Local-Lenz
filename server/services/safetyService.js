/* ════════════════════════════════════════════════════════════════
   LOCAL LENZ — Safety & Emergency Services
   Pulls verified Indian emergency numbers and safety tips.
   Integrates with Supabase database, with high-fidelity static backup.
   ════════════════════════════════════════════════════════════════ */

'use strict';

const VERIFIED_EMERGENCY_NUMBERS = [
  { service: 'National Emergency', number: '112', region: 'All India', description: 'Single emergency helpline for Police, Fire, and Health emergencies.', source: 'Government of India (112.gov.in)', lastVerified: '2026-08-01' },
  { service: 'Police', number: '100', region: 'All India', description: 'Immediate law enforcement assistance helpline.', source: 'Official Police Portal', lastVerified: '2026-08-01' },
  { service: 'Ambulance / Health', number: '108', region: 'All India', description: 'Emergency medical response and transport services.', source: 'Ministry of Health', lastVerified: '2026-08-01' },
  { service: 'Fire Brigade', number: '101', region: 'All India', description: 'Fire hazard reporting and response department.', source: 'National Fire Services', lastVerified: '2026-08-01' },
  { service: 'Women Helpline', number: '1091', region: 'All India', description: 'Dedicated distress response support for women safety.', source: 'Ministry of Women & Child Dev.', lastVerified: '2026-08-01' },
  { service: 'Disaster Management', number: '1078', region: 'All India', description: 'National disaster management control room.', source: 'NDMA India', lastVerified: '2026-08-01' }
];

const SAFETY_TIPS = [
  { category: 'general', title: 'Always Stay Visible', text: 'Prefer well-lit, public transit hubs over secluded dark side alleys when traveling.' },
  { category: 'general', title: 'Validate Fare Card Fares', text: 'Compare rides before booking to avoid overpaying. Always match the license plate in the app.' },
  { category: 'womens', title: 'Share Real-Time Coordinates', text: 'Activate Women\'s Safety Mode to share your route and locations with contacts.' },
  { category: 'womens', title: 'Safe Havens', text: 'Locate nearby police stations or hospitals directly using the Quick Help tool.' }
];

/**
 * Fetch emergency contacts and details for a location.
 * Attempts to load from Supabase if configured, otherwise returns official defaults.
 */
async function getEmergencyNumbers(supabaseClient) {
  if (supabaseClient) {
    try {
      const { data, error } = await supabaseClient
        .from('emergency_contacts_registry')
        .select('*');
      
      if (!error && data && data.length > 0) {
        return data;
      }
    } catch (e) {
      console.warn('Could not read emergency registry from Supabase, falling back to static verified data:', e.message);
    }
  }

  return VERIFIED_EMERGENCY_NUMBERS;
}

/**
 * Get nearby safety locations (hospitals/police stations) utilizing Overpass API (OSM).
 */
async function getNearbySafetyServices(lat, lon, type = 'hospital') {
  if (!lat || !lon) return [];

  const osmType = type === 'police' ? 'police' : 'hospital';
  const radiusMeters = 5000; // 5 km search radius
  
  const query = `
    [out:json][timeout:10];
    (
      node(around:${radiusMeters}, ${lat}, ${lon})["amenity"="${osmType}"];
      way(around:${radiusMeters}, ${lat}, ${lon})["amenity"="${osmType}"];
    );
    out center;
  `;
  const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;
  const USER_AGENT = 'LocalLenz/1.0 (prishaguliani28@gmail.com; travel-assistant)';

  try {
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
    if (!res.ok) throw new Error(`Overpass nearby query failed: ${res.statusText}`);
    
    const data = await res.json();
    if (!data.elements) return [];

    return data.elements.map(el => {
      const latVal = el.lat || (el.center && el.center.lat);
      const lonVal = el.lon || (el.center && el.center.lon);
      
      return {
        name: el.tags.name || `${osmType.charAt(0).toUpperCase() + osmType.slice(1)} Service`,
        lat: latVal,
        lon: lonVal,
        address: el.tags['addr:street'] || el.tags['addr:full'] || 'Address near coordinates',
        phone: el.tags.phone || el.tags['contact:phone'] || 'Call emergency helpline',
        source: 'OpenStreetMap'
      };
    }).slice(0, 4); // Limit to top 4 nearest spots
  } catch (err) {
    console.error(`Nearby safety services search error (${type}):`, err.message);
    return [];
  }
}

module.exports = {
  getEmergencyNumbers,
  getNearbySafetyServices,
  SAFETY_TIPS
};
