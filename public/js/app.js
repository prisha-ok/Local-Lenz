/* ════════════════════════════════════════════════════════════════
   LOCAL LENZ — app.js
   All interactivity: search, transport comparison, provider fares,
   route discovery, explore, safety, auth, local storage, animations
   ════════════════════════════════════════════════════════════════ */

'use strict';

/* ════════════════════════════════════════════════════════════════
   MOCK DATA
   NOTE: Replace these with real API calls in production.
   Suggested integrations:
   - Transport: IRCTC API, RedBus API, Ola API, Uber API, Rapido API
   - Geolocation: Google Maps Geocoding API
   - Places: Google Places API
   ════════════════════════════════════════════════════════════════ */

const INDIAN_CITIES = [
  "Agra", "Ahmedabad", "Ajmer", "Allahabad", "Amritsar", "Aurangabad",
  "Bengaluru", "Bhopal", "Bhubaneswar", "Chandigarh", "Chennai",
  "Coimbatore", "Delhi", "Dehradun", "Goa", "Guwahati", "Gurugram",
  "Hyderabad", "Indore", "Jaipur", "Jaisalmer", "Jammu", "Jodhpur",
  "Kanpur", "Kochi", "Kolkata", "Lucknow", "Ludhiana", "Madurai",
  "Mangaluru", "Mumbai", "Mysuru", "Nagpur", "Nashik", "Noida",
  "Patna", "Pune", "Raipur", "Rajkot", "Ranchi", "Shimla", "Siliguri",
  "Surat", "Thiruvananthapuram", "Udaipur", "Varanasi", "Vijayawada",
  "Visakhapatnam", "Vrindavan", "Mathura", "Lajpat Nagar, Delhi", "Chandni Chowk, Delhi"
];

const state = {
  fromCity: '',
  toCity: '',
  fromCoords: null,              // { lat, lon } — set by autocomplete selection or geolocation
  toCoords: null,                // { lat, lon } — set by autocomplete selection
  currentMode: 'all',
  currentFilter: 'cheapest',
  currentCategory: 'all',
  currentStops: [],
  budgetLimit: null,
  restoreStopsList: null,        // temporary list of stops to restore when loading a saved route
  trustedContact: JSON.parse(localStorage.getItem('ll_trusted') || 'null'),
  user: null,                    // set by Supabase onAuthStateChange in auth.js
  recentSearches: JSON.parse(localStorage.getItem('ll_recent') || '[]'),
  savedJourneys: [],             // loaded from Supabase DB after authentication
  apiData: null,                 // stores the real journey API response { distance, duration, weather, stops, safety }
  routeData: null,               // stores active route metrics dynamically
};


/* ════════════════════════════════════════════════════════════════
   UTILITY FUNCTIONS
   ════════════════════════════════════════════════════════════════ */
function showToast(msg, type = 'info', duration = 3000) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.className = `toast show ${type}`;
  setTimeout(() => { toast.className = 'toast'; }, duration);
}



function formatDuration(minutes) {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function randBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/* ════════════════════════════════════════════════════════════════
   TRANSPORT FARE CALCULATORS
   NOTE: In production, replace with real API responses.
   ════════════════════════════════════════════════════════════════ */

// Cab fare: ~₹12–18 per km
function calcCabFare(distKm) { return Math.round(distKm * randBetween(12, 18)); }
// Bike: ~₹6–10 per km
function calcBikeFare(distKm) { return Math.round(distKm * randBetween(6, 10)); }
// Auto: ₹25 base + ₹12 per km
function calcAutoFare(distKm) { return Math.round(25 + distKm * randBetween(11, 14)); }
// Train: ₹0.6–1.5 per km (sleeper-AC range)
function calcTrainFare(distKm) { return Math.round(distKm * randBetween(0.6, 1.5) * 10) / 10; }
// Bus: ₹0.8–1.2 per km
function calcBusFare(distKm) { return Math.round(distKm * randBetween(0.8, 1.2) * 10) / 10; }

/* ════════════════════════════════════════════════════════════════
   NAVBAR
   ════════════════════════════════════════════════════════════════ */
function initNavbar() {
  const navbar = document.getElementById('navbar');
  const hamburger = document.getElementById('hamburger');
  const mobileNav = document.getElementById('mobile-nav');

  // Scroll effect
  window.addEventListener('scroll', () => {
    navbar.classList.toggle('scrolled', window.scrollY > 40);
    updateActiveNavLink();
  }, { passive: true });

  // Hamburger toggle
  hamburger.addEventListener('click', () => {
    const isOpen = hamburger.classList.toggle('open');
    hamburger.setAttribute('aria-expanded', isOpen);
    mobileNav.classList.toggle('open', isOpen);
    mobileNav.setAttribute('aria-hidden', !isOpen);
  });

  // Close mobile nav on link click
  document.querySelectorAll('.mobile-nav-link').forEach(link => {
    link.addEventListener('click', () => {
      hamburger.classList.remove('open');
      hamburger.setAttribute('aria-expanded', false);
      mobileNav.classList.remove('open');
      mobileNav.setAttribute('aria-hidden', true);
    });
  });
}

function updateActiveNavLink() {
  const sections = ['hero', 'journey-section', 'explore-section', 'compare-section', 'safety-section', 'about-section'];
  let current = '';
  sections.forEach(id => {
    const el = document.getElementById(id);
    if (el && el.getBoundingClientRect().top <= 100) current = id;
  });
  document.querySelectorAll('.nav-link').forEach(link => {
    link.classList.toggle('active', link.getAttribute('href') === `#${current}`);
  });
}

/* ════════════════════════════════════════════════════════════════
   HERO PARTICLES
   ════════════════════════════════════════════════════════════════ */
function initParticles() {
  const container = document.getElementById('hero-particles');
  for (let i = 0; i < 20; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    const size = randBetween(4, 14);
    p.style.cssText = `
      width:${size}px; height:${size}px;
      left:${Math.random() * 100}%;
      animation-duration:${randBetween(8, 18)}s;
      animation-delay:${randBetween(0, 10)}s;
      opacity:${Math.random() * 0.4 + 0.1};
    `;
    container.appendChild(p);
  }
}

/* ════════════════════════════════════════════════════════════════
   AUTOCOMPLETE
   ════════════════════════════════════════════════════════════════ */
function initAutocomplete() {
  setupAutocomplete('input-from', 'from-dropdown', 'fromCity');
  setupAutocomplete('input-to', 'to-dropdown', 'toCity');

  // Swap button
  document.getElementById('swap-btn').addEventListener('click', () => {
    const fromInput = document.getElementById('input-from');
    const toInput = document.getElementById('input-to');
    [fromInput.value, toInput.value] = [toInput.value, fromInput.value];
    [state.fromCity, state.toCity] = [state.toCity, state.fromCity];
    showToast('Locations swapped!', 'info', 1500);
  });
}

let autocompleteDebounceTimer = null;

function setupAutocomplete(inputId, dropdownId, stateKey) {
  const input = document.getElementById(inputId);
  const dropdown = document.getElementById(dropdownId);

  input.addEventListener('input', () => {
    const val = input.value.trim();
    if (val.length < 2) { closeDropdown(dropdown); return; }

    clearTimeout(autocompleteDebounceTimer);
    autocompleteDebounceTimer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(val)}`);
        if (!res.ok) throw new Error('Geocoding search failed');
        const matches = await res.json();
        
        if (!matches || !matches.length) { closeDropdown(dropdown); return; }
        
        dropdown.innerHTML = matches.map(item =>
          `<div class="ac-item" tabindex="0" role="option" data-name="${escapeHtml(item.name)}" data-lat="${item.lat}" data-lon="${item.lon}" data-place-id="${escapeHtml(item.placeId || '')}">
             <span class="ac-icon">📍</span>
             <div style="display:flex; flex-direction:column; text-align:left;">
               <span style="font-weight:600; font-size:13px; color:var(--gray-900); line-height:1.2;">${escapeHtml(item.name)}</span>
               <span style="font-size:10px; color:var(--gray-400); margin-top:2px;">${escapeHtml(item.fullName)}</span>
             </div>
           </div>`
        ).join('');
        
        dropdown.classList.add('open');
        dropdown.querySelectorAll('.ac-item').forEach(item => {
          item.addEventListener('click', async () => {
            const name = item.dataset.name;
            input.value = name;
            state[stateKey] = name;

            const coordKey = stateKey === 'fromCity' ? 'fromCoords' : 'toCoords';
            const lat = parseFloat(item.dataset.lat);
            const lon = parseFloat(item.dataset.lon);
            const placeId = item.dataset.placeId;

            closeDropdown(dropdown);

            if (!isNaN(lat) && !isNaN(lon)) {
              state[coordKey] = { lat, lon };
              return;
            }

            // Google city predictions carry no coordinates — resolve them now
            state[coordKey] = null;
            if (!placeId) return;

            try {
              const res = await fetch(`/api/place-details?placeId=${encodeURIComponent(placeId)}`);
              if (!res.ok) throw new Error('Place details lookup failed');
              const details = await res.json();
              state[coordKey] = { lat: details.lat, lon: details.lon };
            } catch (err) {
              console.error('Could not resolve coordinates:', err.message);
              showToast('Could not pin that location. Try another suggestion.', 'error');
            }
          });
          item.addEventListener('keydown', e => {
            if (e.key === 'Enter') item.click();
          });
        });
      } catch (err) {
        console.error('Autocomplete query failed:', err.message);
      }
    }, 300); // 300ms debounce
  });

  document.addEventListener('click', e => {
    if (!input.contains(e.target) && !dropdown.contains(e.target)) closeDropdown(dropdown);
  });

  input.addEventListener('change', () => {
    state[stateKey] = input.value.trim();
    // Invalidate stale coordinates if user manually changes text
    if (state[stateKey] !== input.value.trim()) {
      const coordKey = stateKey === 'fromCity' ? 'fromCoords' : 'toCoords';
      state[coordKey] = null;
    }
  });
}

function closeDropdown(el) {
  if (el) {
    el.innerHTML = '';
    el.classList.remove('open');
  }
}

/* ════════════════════════════════════════════════════════════════
   SHARING
   ════════════════════════════════════════════════════════════════ */

// A link that reopens the app on this exact journey
function buildShareUrl() {
  const url = new URL(window.location.origin + window.location.pathname);
  if (state.fromCity) url.searchParams.set('from', state.fromCity);
  if (state.toCity) url.searchParams.set('to', state.toCity);
  return url.toString();
}

/**
 * Share via the native share sheet where available, otherwise copy to
 * clipboard. Both are real — no placeholder toast.
 */
async function shareContent(title, text, url) {
  if (navigator.share) {
    try {
      await navigator.share({ title, text, url });
      showToast('Shared successfully', 'success');
      return;
    } catch (err) {
      if (err.name === 'AbortError') return; // user dismissed the sheet
    }
  }

  try {
    await navigator.clipboard.writeText(`${text} ${url}`);
    showToast('Link copied to clipboard', 'success');
  } catch (err) {
    window.prompt('Copy this link:', url);
  }
}

function shareJourney() {
  if (!state.fromCity || !state.toCity) {
    showToast('Plan a journey first, then share it.', 'error');
    return;
  }
  shareContent(
    'Local Lenz journey',
    `My trip from ${state.fromCity} to ${state.toCity} —`,
    buildShareUrl()
  );
}

function shareLiveLocation() {
  if (!navigator.geolocation) {
    showToast('Location is not supported on this device.', 'error');
    return;
  }

  showToast('Getting your location…', 'info', 2000);
  navigator.geolocation.getCurrentPosition(
    pos => {
      const { latitude, longitude } = pos.coords;
      shareContent(
        'My live location',
        'I am here right now —',
        `https://www.google.com/maps?q=${latitude},${longitude}`
      );
    },
    err => showToast(`Could not get your location: ${err.message}`, 'error'),
    { enableHighAccuracy: true, timeout: 10000 }
  );
}

/* ════════════════════════════════════════════════════════════════
   GEOLOCATION
   ════════════════════════════════════════════════════════════════ */
function initGeolocation() {
  document.getElementById('btn-location').addEventListener('click', () => {
    if (!navigator.geolocation) {
      showToast('Geolocation not supported by your browser', 'error');
      return;
    }
    showToast('Detecting your location…', 'info');
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`);
          if (!res.ok) throw new Error('Reverse geocoding failed');
          const data = await res.json();
          const address = data.address || {};
          const cityName = address.city || address.town || address.village || address.suburb || 'My Location';
          
          document.getElementById('input-from').value = cityName;
          state.fromCity = cityName;
          state.fromCoords = { lat, lon };
          showToast(`📍 Location detected: ${cityName}`, 'success');
        } catch (e) {
          const coordStr = `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
          document.getElementById('input-from').value = coordStr;
          state.fromCity = coordStr;
          state.fromCoords = { lat, lon };
          showToast(`📍 Location coordinates: ${coordStr}`, 'success');
        }
      },
      () => { showToast('Could not access location. Please allow permissions.', 'error'); }
    );
  });
}

/* ════════════════════════════════════════════════════════════════
   JOURNEY SEARCH
   ════════════════════════════════════════════════════════════════ */
function initSearch() {
  document.getElementById('btn-search').addEventListener('click', triggerSearch);
  document.getElementById('input-to').addEventListener('keydown', e => {
    if (e.key === 'Enter') triggerSearch();
  });
  document.getElementById('input-from').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('input-to').focus();
  });
}

/**
 * Resolve a typed place name to coordinates.
 *
 * Google city predictions carry no coordinates, so the top match may need a
 * follow-up details lookup before it can be routed.
 */
async function geocodeToCoords(query) {
  try {
    const res = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`);
    if (!res.ok) return null;

    const results = await res.json();
    if (!results || !results.length) return null;

    const top = results[0];
    if (top.lat != null && top.lon != null) {
      return { lat: top.lat, lon: top.lon };
    }

    if (!top.placeId) return null;

    const details = await fetch(`/api/place-details?placeId=${encodeURIComponent(top.placeId)}`);
    if (!details.ok) return null;

    const place = await details.json();
    return (place.lat != null && place.lon != null) ? { lat: place.lat, lon: place.lon } : null;
  } catch (err) {
    console.error('Geocoding failed:', err.message);
    return null;
  }
}

async function triggerSearch() {
  const fromVal = document.getElementById('input-from').value.trim();
  const toVal = document.getElementById('input-to').value.trim();

  if (!fromVal) {
    showToast('Please enter your starting location.', 'error');
    document.getElementById('input-from').focus();
    return;
  }
  if (!toVal) {
    showToast('Please enter your destination.', 'error');
    document.getElementById('input-to').focus();
    return;
  }
  if (fromVal.toLowerCase() === toVal.toLowerCase()) {
    showToast('Starting point and destination cannot be the same.', 'error');
    return;
  }

  state.fromCity = fromVal;
  state.toCity = toVal;

  // Save to recent searches
  saveRecentSearch(fromVal, toVal);

  // Smooth scroll to results
  document.getElementById('journey-section').scrollIntoView({ behavior: 'smooth' });

  showLoading();

  const loadingStepsContainer = document.getElementById('loading-steps');
  const stepsText = [
    'Geocoding locations',
    'Calculating route',
    'Checking weather',
    'Discovering places',
    'Preparing results'
  ];
  loadingStepsContainer.innerHTML = '';
  stepsText.forEach((step, idx) => {
    setTimeout(() => {
      const stepEl = document.createElement('div');
      stepEl.className = 'loading-step-item fade-in-up';
      stepEl.style.cssText = 'display:flex; align-items:center; gap:8px; animation: fadeInUp 0.3s ease forwards;';
      stepEl.innerHTML = `<span style="color:var(--color-accent); font-weight:bold;">✓</span> <span>${step}</span>`;
      loadingStepsContainer.appendChild(stepEl);
    }, (idx + 1) * 280);
  });

  try {
    // 1. Ensure we have coordinates for both cities.
    // Coords are already set when a suggestion was picked; when the user just
    // typed a name we geocode it here.
    if (!state.fromCoords) state.fromCoords = await geocodeToCoords(fromVal);
    if (!state.toCoords) state.toCoords = await geocodeToCoords(toVal);

    // 2. Call the real smart-journey API if we have coordinates
    let apiData = null;
    const haveCoords = state.fromCoords && state.toCoords
      && state.fromCoords.lat != null && state.fromCoords.lon != null
      && state.toCoords.lat != null && state.toCoords.lon != null;

    if (haveCoords) {
      const params = new URLSearchParams({
        fromLat: state.fromCoords.lat,
        fromLon: state.fromCoords.lon,
        toLat: state.toCoords.lat,
        toLon: state.toCoords.lon,
        fromName: state.fromCity,
        toName: state.toCity
      });
      const journeyRes = await fetch(`/api/smart-journey?${params}`);
      if (journeyRes.ok) {
        apiData = await journeyRes.json();
      } else {
        throw new Error(`Smart Journey API error: ${journeyRes.status}`);
      }
    } else {
      throw new Error('Could not resolve coordinates for one or both locations. Please select real locations from the dropdown.');
    }

    if (!apiData) {
      throw new Error('Unable to fetch route data. Please try again.');
    }

    state.apiData = apiData;

    // 3. Log search to DB (fire and forget — does not block UI)
    if (state.user) {
      const token = (await window._supabaseClient?.auth?.getSession())?.data?.session?.access_token;
      if (token) {
        fetch('/api/search-history', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ origin: fromVal, destination: toVal })
        }).catch(() => {}); // non-blocking
      }
    }

    hideLoading();
    renderResults();
  } catch (err) {
    console.error('triggerSearch failed:', err.message);
    state.apiData = null;
    state.routeData = null;
    hideLoading();
    document.getElementById('journey-results').style.display = 'none';
    showToast(`⚠️ ${err.message || 'Live data unavailable'}`, 'error', 5000);
  }
}

function showLoading() {
  document.getElementById('journey-loading').style.display = 'flex';
  document.getElementById('journey-results').style.display = 'none';
  const btn = document.getElementById('btn-search');
  btn.classList.add('loading');
  btn.innerHTML = `<div class="loading-spinner" style="width:20px;height:20px;border-width:2px;border-color:rgba(255,255,255,.3);border-top-color:white;margin-right:8px;"></div> Searching…`;
}

function hideLoading() {
  document.getElementById('journey-loading').style.display = 'none';
  const btn = document.getElementById('btn-search');
  btn.classList.remove('loading');
  btn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M21 3L3 10.53v.98l6.84 2.65L12.48 21h.98L21 3z" fill="white"/></svg> Plan My Journey`;
}

function renderResults() {
  const resultsEl = document.getElementById('journey-results');
  resultsEl.style.display = 'block';

  if (!state.apiData) return;

  const apiDistKm = state.apiData.distance;
  const apiDurMin = state.apiData.duration;
  
  const routeData = {
    distance: apiDistKm,
    duration_road: apiDurMin,
    stops: (state.apiData.stops || []).map(s => s.name)
  };
  state.routeData = routeData;

  // Header
  document.getElementById('result-from').textContent = state.fromCity;
  document.getElementById('result-to').textContent = state.toCity;
  const distLabel = `${routeData.distance} km (OSRM)`;
  document.getElementById('result-distance').textContent = distLabel;
  document.getElementById('result-date').textContent = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

  // Update dynamic status badges
  const statusBadge = document.getElementById('result-status-badge');
  const itineraryBadge = document.getElementById('itinerary-badge');
  const budgetBadge = document.getElementById('budget-badge');
  const weatherBadge = document.getElementById('weather-badge');

  const isGrok = state.apiData.grokAnalysis && state.apiData.grokAnalysis.grokAnalyzed;
  
  if (statusBadge) {
    statusBadge.textContent = isGrok ? '🤖 AI-Analyzed' : '🟢 Live / API-sourced';
    statusBadge.style.backgroundColor = isGrok ? 'var(--color-primary)' : 'var(--teal)';
    statusBadge.style.color = 'white';
  }
  if (itineraryBadge) {
    itineraryBadge.textContent = isGrok ? '🤖 AI-Analyzed' : '🟡 Estimated (Fallback)';
    itineraryBadge.style.backgroundColor = isGrok ? 'var(--color-primary)' : 'var(--gray-100)';
    itineraryBadge.style.color = isGrok ? 'white' : 'var(--gray-700)';
  }
  if (budgetBadge) {
    budgetBadge.textContent = '🟡 Estimated (Fare Engine)';
    budgetBadge.style.backgroundColor = 'var(--gray-100)';
    budgetBadge.style.color = 'var(--gray-700)';
  }
  if (weatherBadge) {
    weatherBadge.textContent = '🟢 Live — Open-Meteo';
    weatherBadge.style.backgroundColor = 'var(--teal)';
    weatherBadge.style.color = 'white';
  }

  // Reset mode to all
  state.currentMode = 'all';
  resetModeSelector();
  document.getElementById('provider-comparison').style.display = 'none';
  document.getElementById('transport-overview').style.display = 'block';

  // Render transport cards
  renderTransportCards(routeData);

  // Initialize all subsections
  initJourneySubsections(routeData);
}


/* ════════════════════════════════════════════════════════════════
   MODE SELECTOR
   ════════════════════════════════════════════════════════════════ */
function initModeSelector() {
  document.getElementById('mode-selector-grid').addEventListener('click', e => {
    const btn = e.target.closest('.mode-btn');
    if (!btn) return;
    const mode = btn.dataset.mode;

    document.querySelectorAll('.mode-btn').forEach(b => {
      b.classList.remove('active');
      b.setAttribute('aria-pressed', 'false');
    });
    btn.classList.add('active');
    btn.setAttribute('aria-pressed', 'true');

    state.currentMode = mode;

    if (mode === 'all' || mode === 'train' || mode === 'bus') {
      // Show transport overview cards
      document.getElementById('provider-comparison').style.display = 'none';
      document.getElementById('transport-overview').style.display = 'block';
      if (mode !== 'all') {
        // Filter the transport cards to just this mode
        filterTransportCardsByMode(mode);
      } else {
        document.querySelectorAll('.transport-card').forEach(c => c.style.display = 'block');
      }
    } else {
      // Show provider comparison
      document.getElementById('transport-overview').style.display = 'none';
      showProviderComparison(mode);
    }
  });

  // Back button
  document.getElementById('btn-back-modes').addEventListener('click', () => {
    document.getElementById('provider-comparison').style.display = 'none';
    document.getElementById('transport-overview').style.display = 'block';
    resetModeSelector();
  });
}

function resetModeSelector() {
  document.querySelectorAll('.mode-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.mode === 'all');
    b.setAttribute('aria-pressed', b.dataset.mode === 'all' ? 'true' : 'false');
  });
  document.querySelectorAll('.transport-card').forEach(c => c.style.display = 'block');
}

function filterTransportCardsByMode(mode) {
  document.querySelectorAll('.transport-card').forEach(c => {
    c.style.display = c.classList.contains(mode) ? 'block' : 'none';
  });
}

/* ════════════════════════════════════════════════════════════════
   PROVIDER FARE COMPARISON
   ════════════════════════════════════════════════════════════════ */
function showProviderComparison(mode) {
  const compEl = document.getElementById('provider-comparison');
  compEl.style.display = 'block';

  const modeLabels = { cab: 'Cab', bike: 'Bike Taxi', auto: 'Auto Rickshaw', share: 'Share Cab / Carpool' };
  const modeIcons = { cab: '🚕', bike: '🏍️', auto: '🛺', share: '🚐' };

  document.getElementById('provider-mode-icon').textContent = modeIcons[mode] || '🚗';
  document.getElementById('provider-title').textContent = `${modeLabels[mode] || mode} Fare Comparison`;

  const providers = PROVIDERS[mode] || PROVIDERS.cab;
  const routeData = state.routeData;
  const dist = routeData.distance;

  // Calculate base fare per mode
  let baseFare;
  if (mode === 'cab') baseFare = calcCabFare(dist);
  else if (mode === 'bike') baseFare = calcBikeFare(dist);
  else if (mode === 'auto') baseFare = calcAutoFare(dist);
  else baseFare = Math.round(dist * 7); // share cab

  // Build provider fare objects
  const fares = providers.map(p => ({
    ...p,
    fare: Math.round(baseFare * p.multiplier),
    eta: randBetween(2, 8), // minutes away
    duration: Math.round(routeData.duration_road + randBetween(-15, 15))
  }));

  // Sort by fare
  fares.sort((a, b) => a.fare - b.fare);
  const lowestFare = fares[0].fare;

  const grid = document.getElementById('provider-cards-grid');
  grid.innerHTML = fares.map((p, i) => `
    <div class="provider-card${p.fare === lowestFare ? ' lowest' : ''}" data-provider="${p.name}">
      ${p.fare === lowestFare ? '<div class="lowest-badge">🏆 LOWEST FARE</div>' : ''}
      <div class="provider-logo-row">
        <span class="provider-emoji">${p.emoji}</span>
        <div class="provider-name-col">
          <span class="provider-name">${p.name}</span>
          <span class="provider-type">${p.type}</span>
        </div>
      </div>
      <div class="provider-fare">₹${p.fare.toLocaleString('en-IN')}<span> approx</span></div>
      <div class="provider-meta-row">
        <span class="provider-meta-item">⏱ ${formatDuration(p.duration)}</span>
        <span class="provider-meta-item">🛵 ${p.eta} min away</span>
      </div>
      <button class="btn-book-provider" onclick="handleBookProvider('${p.name}', '${mode}', ${p.fare})">
        ${p.fare === lowestFare ? '✓ Book Best Price' : `Book with ${p.name}`}
      </button>
    </div>
  `).join('');

  // Scroll to comparison
  compEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

window.handleBookProvider = function(provider, mode, fare) {
  // In production: deep link to respective app or affiliate link
  showToast(`Opening ${provider}… (Production: deep-link to ${provider} app)`, 'info', 3000);
};

/* ════════════════════════════════════════════════════════════════
   TRANSPORT CARDS (All Overview)
   ════════════════════════════════════════════════════════════════ */
function renderTransportCards(routeData) {
  const dist = routeData.distance;
  const roadTime = routeData.duration_road;
  const isDelhi = (state.fromCity.toLowerCase().includes("delhi") || state.toCity.toLowerCase().includes("delhi"));

  // Check if we have Grok's recommendation
  const grokRecMode = state.apiData && state.apiData.grokAnalysis && state.apiData.grokAnalysis.recommended 
    ? state.apiData.grokAnalysis.recommended.mode 
    : null;

  let cards = [];

  if (state.apiData && state.apiData.fares && state.apiData.fares.options) {
    // ── Use backend-sourced fare details ──
    const backendFares = state.apiData.fares.options;

    cards = backendFares.map(opt => {
      const mode = opt.mode;
      let durationStr = '';
      let badge = '';
      let action = '';
      let note = '';

      if (mode === 'metro') {
        durationStr = isDelhi ? '35 min' : '45 min';
        badge = 'Economical';
        action = 'View Metro Info';
        note = isDelhi ? 'Yellow & Blue Lines' : 'Local Transit';
      } else if (mode === 'train') {
        durationStr = formatDuration(roadTime * 0.7);
        badge = 'Best Value';
        action = 'View Train Options';
        note = 'Sleeper • 3AC • 2AC';
      } else if (mode === 'bus') {
        durationStr = formatDuration(roadTime * 1.15);
        badge = 'Standard';
        action = 'View Bus Options';
        note = 'AC • Non-AC • Sleeper';
      } else if (mode === 'cab') {
        durationStr = formatDuration(roadTime);
        badge = 'Door-to-Door';
        action = 'Compare Cabs';
        note = 'Sedan • SUV • Premium';
      } else if (mode === 'bike') {
        durationStr = formatDuration(Math.round(roadTime * 0.9));
        badge = 'Fastest';
        action = 'Compare Bikes';
        note = 'Solo Rider';
      } else if (mode === 'auto') {
        durationStr = formatDuration(Math.round(roadTime * 1.05));
        badge = 'Local Fav';
        action = 'Compare Autos';
        note = 'Short trips';
      } else {
        durationStr = '--';
        badge = 'Standard';
        action = 'Explore';
        note = '';
      }

      // If this is Grok's recommendation, highlight it
      if (grokRecMode && mode === grokRecMode) {
        badge = '⭐ Grok\'s Pick';
      }

      return {
        type: mode,
        icon: opt.icon || '🚗',
        title: opt.label || mode.charAt(0).toUpperCase() + mode.slice(1),
        fare: opt.available ? opt.fareDisplay : 'N/A',
        duration: durationStr,
        options: opt.provider || 'Local services',
        distance: `${dist.toFixed(1)} km`,
        badge: badge,
        action: action,
        note: opt.fareNote || note,
        available: opt.available
      };
    }).filter(c => c.available !== false); // hide unavailable modes

  } else {
    // ── Local Fallback Mode (Fixed train/bus double-multiplication bug) ──
    const trainFareVal = Math.round(calcTrainFare(dist));
    const busFareVal = Math.round(calcBusFare(dist));

    cards = [
      {
        type: 'metro', icon: '🚇', title: 'Metro',
        fare: isDelhi ? '₹40' : '₹60',
        duration: '35 min',
        options: 'Delhi Metro Rail (DMRC)',
        distance: `${dist.toFixed(1)} km`,
        badge: (grokRecMode === 'metro') ? '⭐ Grok\'s Pick' : (isDelhi ? 'Recommended' : 'Economical'),
        action: 'View Metro Info',
        note: 'Yellow & Blue Lines'
      },
      {
        type: 'train', icon: '🚆', title: 'Train',
        fare: `₹${trainFareVal}`,
        duration: formatDuration(roadTime * 0.7),
        options: `${randBetween(8, 25)} trains available`,
        distance: `${dist.toFixed(1)} km`,
        badge: (grokRecMode === 'train') ? '⭐ Grok\'s Pick' : 'Best Value',
        action: 'View Train Options',
        note: 'Sleeper • 3AC • 2AC'
      },
      {
        type: 'bus', icon: '🚌', title: 'Bus',
        fare: `₹${busFareVal}`,
        duration: formatDuration(roadTime * 1.15),
        options: `${randBetween(5, 20)} buses available`,
        distance: `${dist.toFixed(1)} km`,
        badge: (grokRecMode === 'bus') ? '⭐ Grok\'s Pick' : 'Economical',
        action: 'View Bus Options',
        note: 'AC • Non-AC • Sleeper'
      },
      {
        type: 'cab', icon: '🚕', title: 'Cab',
        fare: `₹${calcCabFare(dist)}`,
        duration: formatDuration(roadTime),
        options: 'Ola • Uber • Rapido • InDrive',
        distance: `${dist.toFixed(1)} km`,
        badge: (grokRecMode === 'cab') ? '⭐ Grok\'s Pick' : 'Door-to-Door',
        action: 'Compare Cabs',
        note: 'Sedan • SUV • Premium'
      },
      {
        type: 'bike', icon: '🏍️', title: 'Bike Taxi',
        fare: `₹${calcBikeFare(dist)}`,
        duration: formatDuration(Math.round(roadTime * 0.9)),
        options: 'Rapido • Ola Bike • Uber Moto',
        distance: `${dist.toFixed(1)} km`,
        badge: (grokRecMode === 'bike') ? '⭐ Grok\'s Pick' : 'Fastest',
        action: 'Compare Bikes',
        note: 'Budget option'
      },
      {
        type: 'auto', icon: '🛺', title: 'Auto Rickshaw',
        fare: `₹${calcAutoFare(dist)}`,
        duration: formatDuration(Math.round(roadTime * 1.05)),
        options: 'Rapido Auto • Ola Auto • Metered',
        distance: `${dist.toFixed(1)} km`,
        badge: (grokRecMode === 'auto') ? '⭐ Grok\'s Pick' : 'Local Fav',
        action: 'Compare Autos',
        note: 'For shorter trips'
      }
    ];
  }

  // Filter out auto/bike if it's an intercity trip (distance > 50km) and we are in local fallback
  if (dist > 50 && !(state.apiData && state.apiData.fares)) {
    cards = cards.filter(c => c.type !== 'auto' && c.type !== 'bike');
  }

  sortCards(cards, state.currentFilter);
  renderCardElements(cards);
}

function sortCards(cards, filter) {
  if (filter === 'cheapest') {
    cards.sort((a, b) => parseInt(a.fare.replace(/[₹,–]/g, '')) - parseInt(b.fare.replace(/[₹,–]/g, '')));
  } else if (filter === 'fastest') {
    // Metro/Bike/Cab first
    const order = ['metro', 'bike', 'cab', 'train', 'bus', 'auto'];
    cards.sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type));
  } else { // convenient
    const order = ['metro', 'cab', 'train', 'bike', 'auto', 'bus'];
    cards.sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type));
  }
}

function renderCardElements(cards) {
  const grid = document.getElementById('transport-cards-grid');
  grid.innerHTML = cards.map(c => `
    <div class="transport-card ${c.type} reveal-child">
      <div class="tc-header">
        <div class="tc-icon-title">
          <span class="tc-icon">${c.icon}</span>
          <span class="tc-title">${c.title}</span>
        </div>
        <span class="tc-badge">${c.badge}</span>
      </div>
      <div class="tc-stats">
        <div class="tc-stat">
          <div class="tc-stat-label">Duration</div>
          <div class="tc-stat-value">${c.duration}</div>
        </div>
        <div class="tc-stat">
          <div class="tc-stat-label">Distance</div>
          <div class="tc-stat-value">${c.distance}</div>
        </div>
        <div class="tc-stat">
          <div class="tc-stat-label">Options</div>
          <div class="tc-stat-value" style="font-size:0.8rem;">${c.options}</div>
        </div>
        <div class="tc-stat">
          <div class="tc-stat-label">Class</div>
          <div class="tc-stat-value" style="font-size:0.78rem;">${c.note}</div>
        </div>
      </div>
      <div class="tc-price-row">
        <span class="tc-price-from">from</span>
        <span class="tc-price">${c.fare}</span>
        <span class="tc-price-suffix">approx</span>
      </div>
      <button class="btn-tc-action" onclick="handleTransportAction('${c.type}')">
        ${c.action} →
      </button>
    </div>
  `).join('');

  // Trigger reveal animations for new cards
  setTimeout(() => {
    grid.querySelectorAll('.reveal-child').forEach((el, i) => {
      setTimeout(() => el.classList.add('visible'), i * 80);
    });
  }, 50);
}

window.handleTransportAction = function(type) {
  if (['cab', 'bike', 'auto', 'share'].includes(type)) {
    // Switch to mode selector + provider view
    document.querySelectorAll('.mode-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.mode === type);
      b.setAttribute('aria-pressed', b.dataset.mode === type ? 'true' : 'false');
    });
    state.currentMode = type;
    document.getElementById('transport-overview').style.display = 'none';
    showProviderComparison(type);
    document.getElementById('mode-selector-section').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  } else if (type === 'metro') {
    showMetroInfo();
    document.getElementById('mode-selector-section').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  } else if (type === 'train') {
    showToast('🚆 In production: connects to IRCTC / Rail API', 'info', 3000);
  } else if (type === 'bus') {
    showToast('🚌 In production: connects to RedBus / State Transport API', 'info', 3000);
  }
};

function showMetroInfo() {
  const compEl = document.getElementById('provider-comparison');
  compEl.style.display = 'block';
  document.getElementById('transport-overview').style.display = 'none';
  document.getElementById('provider-mode-icon').textContent = '🚇';
  document.getElementById('provider-title').textContent = 'Delhi Metro — Route Info';

  const isDelhi = (state.fromCity.toLowerCase().includes('delhi') || state.toCity.toLowerCase().includes('delhi'));

  const grid = document.getElementById('provider-cards-grid');
  if (isDelhi) {
    grid.innerHTML = `
      <div class="provider-card lowest" style="grid-column:1/-1;">
        <div class="lowest-badge">🚇 RECOMMENDED ROUTE</div>
        <div class="provider-logo-row">
          <span class="provider-emoji">🔵</span>
          <div class="provider-name-col">
            <span class="provider-name">Delhi Metro Rail Corporation (DMRC)</span>
            <span class="provider-type">Yellow Line / Blue Line</span>
          </div>
        </div>
        <div class="provider-fare">₹40<span> approx</span></div>
        <div class="provider-meta-row">
          <span class="provider-meta-item">⏱ 35 min</span>
          <span class="provider-meta-item">🏪 Interchange at Rajiv Chowk</span>
          <span class="provider-meta-item">🕐 First train: 5:30 AM</span>
        </div>
        <div style="padding:12px 16px;font-size:0.85rem;color:var(--gray-600);background:rgba(0,0,0,0.03);border-radius:8px;margin-top:8px;line-height:1.6;">
          <strong>Sample Route:</strong> Lajpat Nagar (Violet Line) → Central Secretariat → Chawri Bazar (Yellow Line) → Chandni Chowk<br>
          <span style="color:var(--color-accent);font-size:0.8rem;">⚠️ Sample data — verify on DMRC website or app for actual fares and schedules.</span>
        </div>
        <button class="btn-book-provider" onclick="showToast('Opening DMRC official app… (Production: deep-link)', 'info', 3000)">
          ✓ View on DMRC App
        </button>
      </div>
      <div class="provider-card">
        <div class="provider-logo-row">
          <span class="provider-emoji">🟠</span>
          <div class="provider-name-col">
            <span class="provider-name">Rapid Metro / Airport Line</span>
            <span class="provider-type">Orange Line</span>
          </div>
        </div>
        <div class="provider-fare">₹60<span> approx</span></div>
        <div class="provider-meta-row">
          <span class="provider-meta-item">⏱ 20 min (Airport Express)</span>
          <span class="provider-meta-item">🛄 Luggage storage available</span>
        </div>
        <button class="btn-book-provider" onclick="showToast('Airport Express info: check DMRC. (Sample data)', 'info', 3000)">
          View Airport Express
        </button>
      </div>
      <div class="provider-card">
        <div class="provider-logo-row">
          <span class="provider-emoji">🟣</span>
          <div class="provider-name-col">
            <span class="provider-name">Magenta Line / Pink Line</span>
            <span class="provider-type">Phase III Corridors</span>
          </div>
        </div>
        <div class="provider-fare">₹30–₹55<span> approx</span></div>
        <div class="provider-meta-row">
          <span class="provider-meta-item">⏱ 25–40 min</span>
          <span class="provider-meta-item">♿ Accessible stations</span>
        </div>
        <button class="btn-book-provider" onclick="showToast('Check DMRC app for Magenta/Pink Line stops. (Sample)', 'info', 3000)">
          View Line Details
        </button>
      </div>
    `;
  } else {
    grid.innerHTML = `
      <div class="provider-card" style="grid-column:1/-1;text-align:center;padding:30px;">
        <div style="font-size:2rem;margin-bottom:12px;">🚇</div>
        <p style="font-size:1rem;color:var(--gray-600);">Metro is available in Delhi, Mumbai, Bengaluru, Hyderabad, Chennai &amp; Kolkata.</p>
        <p style="font-size:0.85rem;color:var(--gray-400);margin-top:8px;">Select a city route to view metro line information. (Sample data)</p>
      </div>
    `;
  }
  compEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

/* ════════════════════════════════════════════════════════════════
   FILTERS
   ════════════════════════════════════════════════════════════════ */
function initFilters() {
  const filters = [
    { id: 'filter-cheapest', key: 'cheapest' },
    { id: 'filter-fastest', key: 'fastest' },
    { id: 'filter-convenient', key: 'convenient' }
  ];
  filters.forEach(({ id, key }) => {
    document.getElementById(id).addEventListener('click', () => {
      filters.forEach(f => {
        const btn = document.getElementById(f.id);
        btn.classList.toggle('active', f.key === key);
        btn.setAttribute('aria-pressed', f.key === key);
      });
      state.currentFilter = key;
      // No search run yet — nothing to re-sort
      if (!state.routeData) return;
      renderTransportCards(state.routeData);
    });
  });
}

function initJourneySubsections(routeData) {
  if (state.restoreStopsList && state.restoreStopsList.length) {
    // Reconstruct state.currentStops from the saved string array
    state.currentStops = state.restoreStopsList.map((stopName, idx) => {
      let type = 'user-added';
      let emoji = '📍';
      let desc = 'Saved stop along the route';
      if (idx === 0) {
        type = 'start';
        emoji = '📍';
        desc = 'Starting point of your journey';
      } else if (idx === state.restoreStopsList.length - 1) {
        type = 'dest';
        emoji = '🏁';
        desc = 'Destination point';
      } else {
        // Check if this was originally a real API stop or a recommended stop
        const apiStops = state.apiData && state.apiData.stops ? state.apiData.stops : [];
        const matchedApi = apiStops.find(ds => ds.name && ds.name.toLowerCase() === stopName.toLowerCase());
        if (matchedApi) {
          type = 'recommended';
          emoji = matchedApi.emoji || '⭐';
          desc = matchedApi.desc || 'Interesting place along the route';
        }
        // Anything else is a stop the user added themselves
      }
      return { name: stopName, type, emoji, desc };
    });
    // Clear restore list so subsequent searches start fresh
    state.restoreStopsList = null;
  } else {
    // Discovery stops come from the API; there is no mock list to fall back on
    const discoveryStops = state.apiData && state.apiData.stops ? state.apiData.stops : [];

    state.currentStops = [
      { name: state.fromCity, type: 'start', emoji: '📍', desc: 'Starting point of your journey' }
    ];

    discoveryStops.slice(0, 2).forEach(s => {
      state.currentStops.push({
        name: s.name,
        type: 'recommended',
        emoji: s.emoji || '⭐',
        desc: s.desc
      });
    });

    state.currentStops.push({
      name: state.toCity,
      type: 'dest',
      emoji: '🏁',
      desc: 'Destination point'
    });
  }
  
  const addStopBtn = document.getElementById('btn-add-stop');
  const addStopRow = document.getElementById('add-stop-row');
  const confirmStopBtn = document.getElementById('btn-confirm-stop');
  const cancelStopBtn = document.getElementById('btn-cancel-stop');
  const addStopInput = document.getElementById('add-stop-input');
  
  addStopBtn.onclick = () => {
    addStopRow.style.display = addStopRow.style.display === 'none' ? 'flex' : 'none';
    if (addStopRow.style.display === 'flex') addStopInput.focus();
  };
  
  cancelStopBtn.onclick = () => {
    addStopRow.style.display = 'none';
    addStopInput.value = '';
  };
  
  confirmStopBtn.onclick = () => {
    const newStopName = addStopInput.value.trim();
    if (!newStopName) {
      showToast('Please enter a stop name', 'error');
      return;
    }
    if (state.currentStops.some(s => s.name.toLowerCase() === newStopName.toLowerCase())) {
      showToast('Stop is already in your route', 'error');
      return;
    }
    
    const dest = state.currentStops.pop();
    state.currentStops.push({
      name: newStopName,
      type: 'user-added',
      emoji: '📍',
      desc: 'Added by user along the way'
    });
    state.currentStops.push(dest);
    
    addStopRow.style.display = 'none';
    addStopInput.value = '';
    
    showToast(`📍 Added stop: ${newStopName} to route!`, 'success');
    renderAllSubsections(routeData);
  };
  
  document.querySelectorAll('.jf-step').forEach(stepEl => {
    stepEl.onclick = () => {
      const step = stepEl.dataset.step;
      const targetId = {
        transport: 'journey-section',
        stops: 'stops-section',
        itinerary: 'itinerary-section',
        budget: 'budget-section',
        weather: 'weather-section',
        safety: 'safety-quick-section'
      }[step];
      
      const targetEl = document.getElementById(targetId);
      if (targetEl) {
        targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        document.querySelectorAll('.jf-step').forEach(s => s.classList.remove('active'));
        stepEl.classList.add('active');
      }
    };
  });
  
  document.getElementById('btn-save-trip').onclick = () => {
    const trip = {
      from: state.fromCity,
      to: state.toCity,
      stops: state.currentStops.map(s => s.name),
      date: new Date().toLocaleDateString('en-IN')
    };
    // Persist to Supabase (auth.js). Falls back gracefully if not logged in.
    saveJourneyToDB(trip);
  };
  
  renderAllSubsections(routeData);
}

function renderAllSubsections(routeData) {
  renderStopsTimeline();
  renderDiscoveryGrid();
  renderMockMapFromStops();
  renderAIItinerary();
  renderBudgetEstimate(routeData);
  renderWeatherInfo(state.apiData ? state.apiData.weather : null);
  renderSafetyQuickTips(state.apiData ? state.apiData.safety : null);
}

function renderStopsTimeline() {
  const container = document.getElementById('stops-timeline');
  container.innerHTML = state.currentStops.map((stop, index) => {
    const isStart = index === 0;
    const isDest = index === state.currentStops.length - 1;
    const isRecommended = stop.type === 'recommended';
    
    let badgeHtml = '';
    if (isStart) badgeHtml = `<span class="timeline-badge" style="background:#E2E8F0;color:var(--gray-700)">Start</span>`;
    else if (isDest) badgeHtml = `<span class="timeline-badge" style="background:rgba(245,158,11,0.15);color:var(--saffron)">Destination</span>`;
    else if (isRecommended) badgeHtml = `<span class="timeline-badge">⭐ Recommended Stop</span>`;
    else badgeHtml = `<span class="timeline-badge" style="background:rgba(15,155,142,0.15);color:var(--teal)">User Stop</span>`;
    
    let removeBtnHtml = '';
    if (!isStart && !isDest) {
      removeBtnHtml = `<button class="btn-remove-stop" onclick="removeStop(${index})">Remove</button>`;
    }
    
    return `
      <div class="timeline-item ${isStart ? 'start' : ''} ${isDest ? 'dest' : ''}">
        <div class="timeline-dot"></div>
        <div class="timeline-content">
          <div class="timeline-name">
            <span>${stop.name}</span>
            ${badgeHtml}
          </div>
          <div class="timeline-type">${stop.type === 'start' ? 'Origin' : stop.type === 'dest' ? 'Terminal' : 'Waystation'}</div>
          <div class="timeline-desc">${stop.desc || 'Scenic stop along the route.'}</div>
        </div>
        ${removeBtnHtml}
      </div>
    `;
  }).join('');
}

window.removeStop = function(index) {
  const removedName = state.currentStops[index].name;
  state.currentStops.splice(index, 1);
  showToast(`Removed stop: ${removedName}`, 'info');
  const routeData = state.routeData;
  renderAllSubsections(routeData);
};

function renderDiscoveryGrid() {
  // Prefer real API stops from OSM Overpass
  const allDiscoveryStops = state.apiData && state.apiData.stops ? state.apiData.stops : [];

  const currentNames = state.currentStops.map(s => s.name.toLowerCase());
  const remaining = allDiscoveryStops.filter(s => !currentNames.includes(s.name.toLowerCase()));

  const grid = document.getElementById('discovery-cards-grid');
  if (remaining.length === 0) {
    grid.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:var(--gray-500);font-size:0.9rem;padding:20px;">You have added all suggested spots along the route! 🗺️</p>';
    return;
  }

  // Build HTML for each discovery stop — handle both real API format and mock format
  grid.innerHTML = remaining.map(s => {
    const emoji = s.emoji || '📍';
    const desc = s.desc || 'An interesting place along your route.';
    const distLabel = s.dist
      ? `🗺️ ${s.dist}`
      : s.distanceFromRoute != null
        ? `🗺️ ~${s.distanceFromRoute.toFixed(1)} km from route`
        : '';
    const detourLabel = s.estimatedDetour ? ` · ⏱ ~${s.estimatedDetour} min detour` : '';
    const sourceLabel = s.source ? `<span style="font-size:0.7rem;color:var(--gray-400);">${s.source}</span>` : '';
    const safeEmoji = emoji.replace(/'/g, '');
    const safeName = s.name.replace(/'/g, '\\&#39;');
    const safeDesc = desc.replace(/'/g, '\\&#39;');
    return `
    <div class="discovery-card">
      <div class="discovery-card-img">${emoji}</div>
      <div class="dc-body">
        <div class="dc-name">📍 ${s.name}</div>
        <div class="dc-desc">${desc}</div>
        ${distLabel ? `<div class="dc-meta">${distLabel}${detourLabel}</div>` : ''}
        ${sourceLabel}
        <button class="btn-explore" style="width:100%;cursor:pointer;margin-top:8px;" onclick="addStopFromDiscovery('${s.name}', '${desc}', '${safeEmoji}')">Add Stop +</button>
      </div>
    </div>
  `;
  }).join('');
}

window.addStopFromDiscovery = function(name, desc, emoji) {
  const dest = state.currentStops.pop();
  state.currentStops.push({
    name: name,
    type: 'recommended',
    emoji: emoji,
    desc: desc
  });
  state.currentStops.push(dest);
  showToast(`⭐ Added recommended stop: ${name}`, 'success');
  const routeData = state.routeData;
  renderAllSubsections(routeData);
};

function renderMockMapFromStops() {
  // Build an inline SVG route diagram from currentStops
  const stops = state.currentStops;
  if (!stops || stops.length === 0) return;

  // Find or create the SVG map container
  let mapContainer = document.getElementById('route-map-svg-wrap');
  if (!mapContainer) {
    const stopsSection = document.getElementById('stops-section');
    if (!stopsSection) return;
    mapContainer = document.createElement('div');
    mapContainer.id = 'route-map-svg-wrap';
    mapContainer.style.cssText = 'margin:24px 0 8px;overflow-x:auto;';
    // Insert before the discovery cards grid
    const discoveryGrid = document.getElementById('discovery-cards-grid');
    stopsSection.insertBefore(mapContainer, discoveryGrid);
  }

  const svgW = Math.max(500, stops.length * 160);
  const svgH = 120;
  const nodeR = 14;
  const y = svgH / 2;
  const gap = (svgW - 60) / (stops.length - 1 || 1);

  const nodeColors = stops.map((s, i) => {
    if (i === 0) return '#3B82F6';          // start — blue
    if (i === stops.length - 1) return '#F59E0B'; // end — amber
    if (s.type === 'recommended') return '#10B981'; // recommended — green
    return '#8B5CF6';                       // user-added — purple
  });

  let svgNodes = '';
  let svgLines = '';

  stops.forEach((stop, i) => {
    const x = 30 + i * gap;
    const prevX = i > 0 ? 30 + (i - 1) * gap : null;

    // Connector line
    if (i > 0) {
      svgLines += `<line x1="${prevX + nodeR}" y1="${y}" x2="${x - nodeR}" y2="${y}" stroke="#CBD5E1" stroke-width="3" stroke-dasharray="6 3"/>`;
    }

    // Node circle
    const color = nodeColors[i];
    const isEnd = i === stops.length - 1;
    svgNodes += `
      <circle cx="${x}" cy="${y}" r="${nodeR}" fill="${color}" opacity="0.15"/>
      <circle cx="${x}" cy="${y}" r="${nodeR - 4}" fill="${color}"/>
      <text x="${x}" y="${y + 4}" text-anchor="middle" font-size="10" fill="white" font-weight="bold">${i + 1}</text>
      <text x="${x}" y="${y + nodeR + 14}" text-anchor="middle" font-size="10" fill="#374151" font-weight="600">${stop.name.length > 14 ? stop.name.slice(0, 13) + '…' : stop.name}</text>
      <text x="${x}" y="${y - nodeR - 6}" text-anchor="middle" font-size="9" fill="${color}">${i === 0 ? 'START' : isEnd ? 'END' : (stop.type === 'recommended' ? '⭐ Rec.' : '📍 Stop')}</text>
    `;
  });

  mapContainer.innerHTML = `
    <div style="font-size:0.8rem;font-weight:700;color:var(--gray-500);letter-spacing:0.06em;text-transform:uppercase;margin-bottom:10px;">📍 Route Visualisation</div>
    <svg width="100%" viewBox="0 0 ${svgW} ${svgH}" xmlns="http://www.w3.org/2000/svg" style="min-width:${Math.min(svgW, 400)}px;">
      <rect width="${svgW}" height="${svgH}" rx="12" fill="rgba(241,245,249,0.9)"/>
      ${svgLines}
      ${svgNodes}
    </svg>
    <p style="font-size:0.72rem;color:var(--gray-400);margin-top:6px;">Schematic only — not to geographical scale.</p>
  `;
}

function renderAIItinerary() {
  const container = document.getElementById('itinerary-list');
  const grok = state.apiData && state.apiData.grokAnalysis ? state.apiData.grokAnalysis : null;

  let steps = [];
  let recommendationHtml = '';

  // 1. If Grok analysis is available, render the recommendation summary panel
  if (grok) {
    const rec = grok.recommended || {};
    const budget = grok.budgetSuggestion || {};
    const disc = grok.discoveryAdvice || '';
    
    const modeIcons = { metro: '🚇', train: '🚆', bus: '🚌', cab: '🚕', bike: '🏍️', auto: '🛺', walk: '🚶' };
    const modeLabel = rec.mode ? (rec.mode.charAt(0).toUpperCase() + rec.mode.slice(1)) : 'Optimal Mode';
    const modeIcon = modeIcons[rec.mode] || '🚗';

    recommendationHtml = `
      <div class="grok-recommendation-card" style="background: linear-gradient(135deg, rgba(15, 155, 142, 0.05) 0%, rgba(59, 130, 246, 0.05) 100%); border: 1.5px solid rgba(15, 155, 142, 0.2); border-radius: var(--radius-md); padding: 16px; margin-bottom: 20px; box-shadow: 0 4px 12px rgba(0,0,0,0.02);">
        <div style="display:flex; align-items:center; gap:8px; margin-bottom:10px;">
          <span style="font-size:1.4rem;">🤖</span>
          <h4 style="margin:0; font-size:1rem; color:var(--gray-800); font-weight:700;">Grok Intelligent Travel Analysis</h4>
          <span class="rss-badge" style="margin-left:auto; background:var(--color-primary); color:white;">AI-Analyzed</span>
        </div>
        
        <div style="display:flex; align-items:flex-start; gap:12px; background:white; padding:12px; border-radius:8px; border:1px solid var(--gray-150); margin-bottom:12px;">
          <span style="font-size:2rem; padding:4px; background:var(--gray-100); border-radius:8px;">${modeIcon}</span>
          <div>
            <div style="font-size:0.75rem; font-weight:600; color:var(--gray-400); text-transform:uppercase;">Recommended Mode</div>
            <div style="font-size:1.1rem; font-weight:700; color:var(--gray-800); margin:2px 0 4px;">${modeLabel}</div>
            <p style="margin:0; font-size:0.85rem; color:var(--gray-600); line-height:1.4;">${rec.reason || 'Optimal travel mode calculated based on your route parameters.'}</p>
          </div>
        </div>

        <div style="display:grid; grid-template-columns:1fr; gap:8px; font-size:0.8rem; color:var(--gray-600);">
          ${budget.advice ? `<div style="display:flex; align-items:center; gap:6px;">🪙 <strong>Budget:</strong> ${budget.advice}</div>` : ''}
          ${disc ? `<div style="display:flex; align-items:center; gap:6px;">📍 <strong>Stops:</strong> ${disc}</div>` : ''}
        </div>
      </div>
    `;

    // Use Grok's custom generated itinerary steps if they exist
    if (grok.itinerary && grok.itinerary.length) {
      steps = grok.itinerary;
    }
  }

  // 2. Fallback to generating steps locally if Grok didn't supply them
  if (!steps.length) {
    const totalStops = state.currentStops.length;
    const START_HOUR = 8; // 8:00 AM
    const END_HOUR = 20;  // 8:00 PM
    const totalMinutes = (END_HOUR - START_HOUR) * 60;

    const midActivities = [
      { icon: '🍽️', label: 'Try local cuisine and street food' },
      { icon: '📸', label: 'Photograph the landmark and surroundings' },
      { icon: '🛍️', label: 'Browse local handicrafts and souvenirs' },
      { icon: '🚶', label: 'Take a guided walking tour of the area' },
      { icon: '☕', label: 'Relax at a local café and plan next leg' }
    ];

    function toTimeStr(totalMinFromStart) {
      const absMin = START_HOUR * 60 + totalMinFromStart;
      const h = Math.floor(absMin / 60) % 24;
      const m = absMin % 60;
      const ampm = h >= 12 ? 'PM' : 'AM';
      const dispH = h > 12 ? h - 12 : h === 0 ? 12 : h;
      return `${dispH}:${m.toString().padStart(2, '0')} ${ampm}`;
    }

    state.currentStops.forEach((stop, i) => {
      const frac = totalStops > 1 ? i / (totalStops - 1) : 0;
      const minuteOffset = Math.round(frac * totalMinutes);
      const timeStr = toTimeStr(minuteOffset);

      if (i === 0) {
        steps.push({
          time: timeStr,
          icon: '🚀',
          tag: 'Departure',
          tagColor: '#3B82F6',
          title: `Depart from ${stop.name}`,
          desc: `Begin your journey! Confirm your booking, pack essentials, and double-check your travel documents.`,
          tips: ['Keep ID & tickets ready', 'Share location with a trusted contact', 'Charge your devices']
        });
      } else if (i === totalStops - 1) {
        steps.push({
          time: timeStr,
          icon: '🏁',
          tag: 'Arrival',
          tagColor: '#F59E0B',
          title: `Arrive at ${stop.name}`,
          desc: `Welcome to your destination! Head to your accommodation, freshen up, and explore at your own pace.`,
          tips: ['Note emergency numbers', 'Check local transport options', 'Explore nearby dining']
        });
      } else {
        const activity = midActivities[(i - 1) % midActivities.length];
        const stayDuration = Math.max(30, Math.round(totalMinutes / (totalStops + 1)));
        const nextStop = state.currentStops[i + 1];
        const isRec = stop.type === 'recommended';
        steps.push({
          time: timeStr,
          icon: isRec ? '⭐' : '📍',
          tag: isRec ? 'Recommended Stop' : 'Custom Stop',
          tagColor: isRec ? '#10B981' : '#8B5CF6',
          title: `Explore ${stop.name}`,
          desc: stop.desc || `Take ${stayDuration} min to explore this stop. ${activity.icon} ${activity.label}.`,
          tips: [
            `Estimated stay: ~${stayDuration} min`,
            nextStop ? `Next: ${nextStop.name}` : 'Heading to final destination',
            'Hydrate and rest before continuing'
          ]
        });
      }
    });
  }

  // 3. Render HTML
  const itineraryHtml = steps.map((s, i) => `
    <div class="itinerary-item" style="--iti-accent:${s.tagColor || '#10B981'};">
      <div class="iti-time">
        <span>${s.time}</span>
        <span class="iti-icon">${s.icon || '📍'}</span>
      </div>
      <div class="iti-detail">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
          <h4 style="margin:0;font-size:0.95rem;">${s.title}</h4>
          <span style="font-size:0.7rem;font-weight:700;background:${s.tagColor || '#10B981'}20;color:${s.tagColor || '#10B981'};padding:2px 8px;border-radius:20px;white-space:nowrap;">${s.tag || 'Stop'}</span>
        </div>
        <p style="margin:0 0 8px;font-size:0.85rem;color:var(--gray-600);">${s.desc}</p>
        <ul style="margin:0;padding-left:16px;font-size:0.78rem;color:var(--gray-500);">
          ${(s.tips || []).map(t => `<li>${t}</li>`).join('')}
        </ul>
      </div>
    </div>
  `).join('');

  container.innerHTML = recommendationHtml + itineraryHtml;
}

function renderBudgetEstimate(routeData) {
  const container = document.getElementById('budget-grid');
  const dist = routeData.distance;
  const numMidStops = Math.max(0, state.currentStops.length - 2);

  // Cost breakdown
  let transportCost;
  let transportLabel = 'Transport (Cab est.)';
  let transportIcon = '🚕';

  if (state.apiData && state.apiData.fares && state.apiData.fares.options) {
    const grokRecMode = state.apiData.grokAnalysis && state.apiData.grokAnalysis.recommended 
      ? state.apiData.grokAnalysis.recommended.mode 
      : null;
    const recommendedOpt = state.apiData.fares.options.find(o => o.mode === grokRecMode && o.available);
    const fallbackOpt = state.apiData.fares.options.find(o => o.available);
    const targetOpt = recommendedOpt || fallbackOpt;

    if (targetOpt) {
      transportCost = targetOpt.fare || 0;
      transportLabel = `Transport (${targetOpt.label})`;
      transportIcon = targetOpt.icon || '🚕';
    } else {
      transportCost = Math.round(dist * 12);
      transportLabel = 'Transport (Est.)';
    }
  } else {
    transportCost = Math.round(dist * randBetween(10, 15)); // ₹10–15/km cab estimate
  }

  const foodCost = Math.round((numMidStops + 1) * randBetween(120, 200));
  const sightCost = Math.round(numMidStops * randBetween(80, 150));
  const miscCost = Math.round(dist * 0.5 + 50);  // parking, tolls etc.
  const total = transportCost + foodCost + sightCost + miscCost;

  // Budget limit (saved in state or default 2000)
  if (!state.budgetLimit) state.budgetLimit = 2000;
  const isOverBudget = total > state.budgetLimit;

  const items = [
    { label: transportLabel, val: transportCost, icon: transportIcon },
    { label: 'Food & Drinks', val: foodCost, icon: '🍽️' },
    { label: 'Sightseeing & Entry', val: sightCost, icon: '🎟️' },
    { label: 'Misc (Tolls, Parking)', val: miscCost, icon: '🅿️' }
  ];

  // Budget limit control
  let limitHtml = `
    <div id="budget-limit-row" style="grid-column:1/-1;display:flex;align-items:center;gap:12px;padding:14px 16px;background:rgba(0,0,0,0.03);border-radius:10px;margin-bottom:4px;flex-wrap:wrap;">
      <label for="budget-limit-input" style="font-size:0.85rem;font-weight:600;color:var(--gray-600);white-space:nowrap;">💰 My Budget Limit:</label>
      <div style="display:flex;align-items:center;gap:6px;">
        <span style="font-weight:700;color:var(--gray-700);">₹</span>
        <input id="budget-limit-input" type="number" min="0" step="100" value="${state.budgetLimit}"
          style="width:100px;padding:6px 10px;border:1.5px solid var(--gray-300);border-radius:6px;font-size:0.9rem;font-weight:600;"
          onchange="updateBudgetLimit(this.value)" aria-label="Set budget limit in rupees" />
      </div>
      <span id="budget-limit-status" style="font-size:0.82rem;padding:4px 12px;border-radius:20px;font-weight:700;
        background:${isOverBudget ? 'rgba(239,68,68,0.12)' : 'rgba(16,185,129,0.12)'};
        color:${isOverBudget ? '#DC2626' : '#059669'};">
        ${isOverBudget ? '⚠️ Over budget by ₹' + (total - state.budgetLimit).toLocaleString('en-IN') : '✅ Within budget'}
      </span>
    </div>
  `;

  // If over budget show a warning banner
  let warningHtml = '';
  if (isOverBudget) {
    warningHtml = `
      <div style="grid-column:1/-1;padding:12px 16px;background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.2);border-radius:10px;">
        <p style="margin:0;font-size:0.85rem;color:#B91C1C;font-weight:600;">⚠️ Your estimated trip cost (₹${total.toLocaleString('en-IN')}) exceeds your budget limit (₹${state.budgetLimit.toLocaleString('en-IN')}).</p>
        <p style="margin:4px 0 0;font-size:0.78rem;color:var(--gray-500);">Consider removing optional stops, switching to a bus or metro, or adjusting your limit above.</p>
      </div>
    `;
  }

  const itemsHtml = items.map(item => `
    <div class="budget-item">
      <div class="budget-val">₹${item.val.toLocaleString('en-IN')}</div>
      <div class="budget-label">${item.icon} ${item.label}</div>
    </div>
  `).join('');

  const totalHtml = `
    <div class="budget-item" style="grid-column:1/-1;background:${isOverBudget ? 'rgba(239,68,68,0.08)' : 'rgba(15,155,142,0.08)'};
      border:1.5px solid ${isOverBudget ? 'rgba(239,68,68,0.3)' : 'var(--teal)'}40;border-radius:12px;">
      <div class="budget-val" style="color:${isOverBudget ? '#DC2626' : 'var(--teal)'};font-size:1.5rem;">₹${total.toLocaleString('en-IN')}</div>
      <div class="budget-label" style="font-weight:700;">🧾 Estimated Total</div>
      <div style="font-size:0.72rem;color:var(--gray-400);margin-top:4px;">Sample estimates. Actual costs may vary.</div>
    </div>
  `;

  container.innerHTML = limitHtml + warningHtml + itemsHtml + totalHtml;
}

window.updateBudgetLimit = function(val) {
  state.budgetLimit = parseInt(val) || 0;
  const routeData = state.routeData;
  renderBudgetEstimate(routeData);
};

function renderWeatherInfo(weatherData) {
  document.getElementById('weather-city').textContent = state.toCity;
  const container = document.getElementById('weather-row');

  if (weatherData && weatherData.temperature != null) {
    // Real weather data from Open-Meteo API
    const temp = Math.round(weatherData.temperature);
    const cond = weatherData.condition || 'Weather data';
    const icon = weatherData.icon || '🌡️';
    const tempMax = weatherData.tempMax != null ? Math.round(weatherData.tempMax) : temp;
    const tempMin = weatherData.tempMin != null ? Math.round(weatherData.tempMin) : temp;
    const windspeed = weatherData.windspeed != null ? Math.round(weatherData.windspeed) : '--';
    const precipProb = weatherData.precipitationProb != null ? weatherData.precipitationProb : 0;

    const forecastHtml = (weatherData.forecast || []).map(f => `
      <div class="weather-forecast-item" style="text-align:center;padding:8px;border-radius:8px;background:rgba(0,0,0,0.04);">
        <div style="font-size:0.7rem;color:var(--gray-400);">${new Date(f.date).toLocaleDateString('en-IN', {weekday:'short'})}</div>
        <div style="font-size:1.1rem;">${f.icon || '🌡️'}</div>
        <div style="font-size:0.78rem;font-weight:600;">${f.tempMax != null ? Math.round(f.tempMax) : '?'}°/${f.tempMin != null ? Math.round(f.tempMin) : '?'}°</div>
        <div style="font-size:0.65rem;color:var(--gray-500);">${f.condition || ''}</div>
      </div>
    `).join('');

    container.innerHTML = `
      <div class="weather-main">
        <span class="weather-icon-big">${icon}</span>
        <div class="weather-cond-col">
          <span class="weather-temp">${temp}°C</span>
          <span class="weather-cond">${cond}</span>
          <span style="font-size:0.75rem;color:var(--gray-400);">H:${tempMax}° / L:${tempMin}°</span>
          <span style="font-size:0.65rem;color:var(--color-accent);margin-top:2px;">📡 Live — Open-Meteo</span>
        </div>
      </div>
      <div class="weather-detail-grid">
        <div class="weather-detail-item">💨 Wind: ${windspeed} km/h</div>
        <div class="weather-detail-item">🌧️ Rain chance: ${precipProb}%</div>
        <div class="weather-detail-item">📅 Today's range: ${tempMin}° – ${tempMax}°</div>
      </div>
      ${forecastHtml ? `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-top:12px;">${forecastHtml}</div>` : ''}
    `;
  } else {
    // Fallback: estimated/mock weather
    const temps = [24, 26, 28, 30, 32, 22];
    const conditions = ['Clear Sky', 'Mostly Sunny', 'Partly Cloudy', 'Scattered Showers', 'Thunderstorms', 'Mist / Fog'];
    const icons = ['☀️', '🌤️', '⛅', '🌦️', '⛈️', '🌫️'];
    const idx = randBetween(0, temps.length - 1);
    const temp = temps[idx];
    const cond = conditions[idx];
    const icon = icons[idx];
    container.innerHTML = `
      <div class="weather-main">
        <span class="weather-icon-big">${icon}</span>
        <div class="weather-cond-col">
          <span class="weather-temp">${temp}°C</span>
          <span class="weather-cond">${cond}</span>
          <span style="font-size:0.65rem;color:var(--gray-400);margin-top:2px;">⚠️ Estimated (live unavailable)</span>
        </div>
      </div>
      <div class="weather-detail-grid">
        <div class="weather-detail-item">💧 Humidity: ${randBetween(40, 85)}%</div>
        <div class="weather-detail-item">💨 Wind speed: ${randBetween(5, 18)} km/h</div>
        <div class="weather-detail-item">👁️ Visibility: ${randBetween(6, 10)} km</div>
      </div>
    `;
  }
}

function renderSafetyQuickTips(safetyData) {
  const container = document.getElementById('safety-tips-row');

  // Build tips from real safety data or static fallback
  const tips = [
    { title: 'Share Live Location', desc: 'Always keep trusted contacts updated on your journey using the Share link.', icon: '📍' },
    { title: 'Verify Ride & OTP', desc: 'Verify the vehicle license plate, driver details and never share OTP before trip starts.', icon: '🛡️' },
    { title: 'Carry Emergency Contacts', desc: 'Keep helpline numbers saved offline in case of cellular network outages.', icon: '📞' }
  ];

  let numbersHtml = '';
  if (safetyData && safetyData.numbers && safetyData.numbers.length) {
    numbersHtml = `
      <div class="safety-tip-card" style="grid-column:1/-1;">
        <h4>🚨 Emergency Helpline Numbers</h4>
        <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:8px;">
          ${safetyData.numbers.map(n => `
            <span style="padding:4px 10px;border-radius:20px;background:rgba(239,68,68,0.1);color:#DC2626;font-size:0.8rem;font-weight:600;">
              ${n.name}: ${n.number}
            </span>
          `).join('')}
        </div>
      </div>
    `;
  }

  const apiTips = safetyData && safetyData.tips ? safetyData.tips.slice(0, 3) : [];
  const displayTips = apiTips.length ? apiTips.map(t => ({ title: t.title || t, desc: t.desc || '', icon: t.icon || '✅' })) : tips;

  container.innerHTML = numbersHtml + displayTips.map(t => `
    <div class="safety-tip-card">
      <h4>${t.icon} ${t.title}</h4>
      <p>${t.desc}</p>
    </div>
  `).join('');
}


/* ════════════════════════════════════════════════════════════════
   EXPLORE INDIA
   ════════════════════════════════════════════════════════════════ */
function initExplore() {
  renderDestinations('all');

  document.getElementById('category-tabs').addEventListener('click', e => {
    const tab = e.target.closest('.cat-tab');
    if (!tab) return;
    document.querySelectorAll('.cat-tab').forEach(t => {
      t.classList.remove('active');
      t.setAttribute('aria-selected', 'false');
    });
    tab.classList.add('active');
    tab.setAttribute('aria-selected', 'true');
    state.currentCategory = tab.dataset.cat;
    renderDestinations(state.currentCategory);
  });

  // "Plan Trip" on a destination card should actually plan the trip, not
  // just drop you back at an empty-looking search box.
  document.getElementById('destinations-grid').addEventListener('click', e => {
    const card = e.target.closest('.dest-card');
    if (!card) return;

    const name = card.dataset.name;
    const lat  = parseFloat(card.dataset.lat);
    const lon  = parseFloat(card.dataset.lon);

    document.getElementById('input-to').value = name;
    state.toCity = name;
    state.toCoords = (!isNaN(lat) && !isNaN(lon)) ? { lat, lon } : null;

    const fromInput = document.getElementById('input-from');
    const hasOrigin = fromInput.value.trim().length > 0;

    document.getElementById('hero').scrollIntoView({ behavior: 'smooth' });

    if (hasOrigin) {
      showToast(`Planning your trip to ${name}…`, 'success');
      // Let the scroll settle before the results section jumps again
      setTimeout(() => triggerSearch(), 500);
    } else {
      showToast(`${name} set as your destination — add a starting point`, 'success');
      setTimeout(() => fromInput.focus(), 500);
    }
  });
}

// Presentation only — the destination data itself comes from Google Places
const CATEGORY_STYLE = {
  all:        { emoji: '🌏', grad: 'grad-1' },
  historical: { emoji: '🏛️', grad: 'grad-2' },
  mountains:  { emoji: '🏔️', grad: 'grad-3' },
  beaches:    { emoji: '🏖️', grad: 'grad-4' },
  religious:  { emoji: '🛕', grad: 'grad-5' },
  nature:     { emoji: '🌿', grad: 'grad-6' },
  food:       { emoji: '🍛', grad: 'grad-1' },
  culture:    { emoji: '🎭', grad: 'grad-2' }
};

function escapeHtml(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

const destinationsCache = {};

async function renderDestinations(category) {
  const grid = document.getElementById('destinations-grid');
  const style = CATEGORY_STYLE[category] || CATEGORY_STYLE.all;

  if (destinationsCache[category]) {
    paintDestinations(destinationsCache[category], style);
    return;
  }

  grid.innerHTML = '<p style="text-align:center;color:var(--gray-400);grid-column:1/-1;padding:40px">Loading live destinations…</p>';

  try {
    const res = await fetch(`/api/destinations?category=${encodeURIComponent(category)}`);
    if (!res.ok) throw new Error('Destination lookup failed');
    const data = await res.json();
    const list = data.destinations || [];

    if (!list.length) {
      grid.innerHTML = `<p style="text-align:center;color:var(--gray-400);grid-column:1/-1;padding:40px">${escapeHtml(data.message || 'No destinations found for this category yet. 🌏')}</p>`;
      return;
    }

    destinationsCache[category] = list;
    paintDestinations(list, style);
  } catch (err) {
    console.error('Destinations failed:', err.message);
    grid.innerHTML = '<p style="text-align:center;color:var(--gray-400);grid-column:1/-1;padding:40px">Could not load destinations right now. Please try again. 🌏</p>';
  }
}

function paintDestinations(list, style) {
  const grid = document.getElementById('destinations-grid');
  grid.innerHTML = list.map(d => {
    const photo = d.photoUrl
      ? `style="background-image:url('${escapeHtml(d.photoUrl)}');background-size:cover;background-position:center;"`
      : '';
    const reviews = d.reviews ? ` (${Number(d.reviews).toLocaleString()})` : '';

    return `
    <div class="dest-card" data-name="${escapeHtml(d.name)}" data-lat="${d.lat}" data-lon="${d.lon}" style="cursor:pointer">
      <div class="dest-card-img ${style.grad}" ${photo}>
        ${d.photoUrl ? '' : `<span>${style.emoji}</span>`}
        <div class="dest-card-tag">${escapeHtml(capitalize(d.category || 'all'))}</div>
      </div>
      <div class="dest-card-body">
        <div class="dest-card-name">${escapeHtml(d.name)}</div>
        <div class="dest-card-state">📍 ${escapeHtml(d.state)}</div>
        <div class="dest-card-desc">${escapeHtml(d.desc)}</div>
        <div class="dest-card-footer">
          <span class="dest-card-rating">${escapeHtml(d.rating)}${reviews}</span>
          <button class="btn-dest-explore" type="button">Plan Trip</button>
        </div>
      </div>
    </div>`;
  }).join('');
}

function capitalize(str) { return str.charAt(0).toUpperCase() + str.slice(1); }

function initSafety() {
  const sosModal = document.getElementById('sos-modal');
  const sosModalClose = document.getElementById('sos-modal-close');

  // SOS activation on all triggers
  document.querySelectorAll('#btn-sos, .btn-sos-inline').forEach(el => {
    el.onclick = () => {
      sosModal.style.display = '';
    };
  });

  sosModalClose.onclick = () => {
    sosModal.style.display = 'none';
  };
  
  sosModal.onclick = e => {
    if (e.target === sosModal) sosModal.style.display = 'none';
  };

  // Share journey — native share sheet, clipboard fallback
  document.querySelectorAll('#btn-share-journey, .btn-share-journey').forEach(el => {
    el.onclick = shareJourney;
  });

  // Share live location from the women's safety panel
  const shareLocationBtn = document.getElementById('wp-share-location');
  if (shareLocationBtn) shareLocationBtn.onclick = shareLiveLocation;

  // Trusted Contact
  const trustedBtn = document.getElementById('btn-trusted-contact');
  if (trustedBtn) {
    trustedBtn.onclick = () => {
      const name = prompt("Enter Trusted Contact Name:");
      if (!name) return;
      const phone = prompt("Enter Trusted Contact Phone Number:");
      if (!phone) return;
      state.trustedContact = { name, phone };
      localStorage.setItem('ll_trusted', JSON.stringify(state.trustedContact));
      showToast(`👥 Saved Trusted Contact: ${name} (${phone})`, 'success');
    };
  }

  // Safety tips button
  const tipsBtn = document.getElementById('btn-safety-tips-btn');
  if (tipsBtn) {
    tipsBtn.onclick = () => {
      const quickSafetySec = document.getElementById('safety-quick-section');
      if (quickSafetySec) {
        quickSafetySec.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else {
        showToast('💡 Tips: Travel only in verified vehicles, share location, keep emergency contacts handy.', 'info', 5000);
      }
    };
  }

  // Women's mode panel toggle
  const womensBtn = document.getElementById('btn-womens-mode');
  const womensPanel = document.getElementById('womens-panel');
  const womensClose = document.getElementById('btn-womens-close');

  if (womensBtn && womensPanel) {
    womensBtn.onclick = () => {
      const isActive = womensBtn.classList.toggle('active');
      womensBtn.setAttribute('aria-pressed', isActive);
      womensPanel.style.display = isActive ? 'block' : 'none';
      womensPanel.setAttribute('aria-hidden', !isActive);
      if (isActive) {
        showToast('💜 Women\'s Safety Mode Activated. Emergency quick links enabled.', 'success');
      } else {
        showToast('Women\'s Safety Mode Deactivated.', 'info');
      }
    };
  }

  if (womensClose && womensPanel && womensBtn) {
    womensClose.onclick = () => {
      womensBtn.classList.remove('active');
      womensBtn.setAttribute('aria-pressed', 'false');
      womensPanel.style.display = 'none';
      womensPanel.setAttribute('aria-hidden', 'true');
      showToast('Women\'s Safety Mode Deactivated.', 'info');
    };
  }
}


/* ════════════════════════════════════════════════════════════════
   AUTH MODAL
   Wired to Supabase (auth.js). Form validation remains identical.
   ════════════════════════════════════════════════════════════════ */
function initAuth() {
  const modal = document.getElementById('auth-modal');
  const loginForm = document.getElementById('login-form');
  const signupForm = document.getElementById('signup-form');
  const dashboard = document.getElementById('user-dashboard');
  const modalClose = document.getElementById('modal-close');

  function openModal(showForm) {
    modal.style.display = '';
    loginForm.style.display = 'none';
    signupForm.style.display = 'none';
    dashboard.style.display = 'none';

    if (state.user) {
      showDashboard();
    } else if (showForm === 'signup') {
      signupForm.style.display = 'block';
    } else {
      loginForm.style.display = 'block';
    }
  }

  function closeModal() { modal.style.display = 'none'; }

  // Triggers
  document.getElementById('btn-open-login').addEventListener('click', () => openModal('login'));
  document.getElementById('btn-open-signup').addEventListener('click', () => openModal('signup'));
  document.getElementById('btn-mobile-login').addEventListener('click', () => openModal('login'));
  document.getElementById('btn-mobile-signup').addEventListener('click', () => openModal('signup'));
  modalClose.addEventListener('click', closeModal);
  modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

  // My Trips link in nav
  document.getElementById('btn-nav-mytrips')?.addEventListener('click', () => openModal('login'));
  document.getElementById('btn-mobile-mytrips')?.addEventListener('click', () => openModal('login'));

  // Toggle between forms
  document.getElementById('switch-to-signup').addEventListener('click', () => {
    loginForm.style.display = 'none'; signupForm.style.display = 'block';
  });
  document.getElementById('switch-to-login').addEventListener('click', () => {
    signupForm.style.display = 'none'; loginForm.style.display = 'block';
  });

  // ── LOGIN SUBMIT → Supabase signInWithPassword ─────────────────
  document.getElementById('login-form-el').addEventListener('submit', async e => {
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim();
    const pw = document.getElementById('login-password').value;
    let valid = true;
    if (!email) {
      document.getElementById('login-email-err').textContent = 'Email is required';
      valid = false;
    } else {
      document.getElementById('login-email-err').textContent = '';
    }
    if (pw.length < 6) {
      document.getElementById('login-pw-err').textContent = 'Password must be at least 6 characters';
      valid = false;
    } else {
      document.getElementById('login-pw-err').textContent = '';
    }
    if (!valid) return;
    await authSignIn(email, pw);
  });

  // ── SIGNUP SUBMIT → Supabase signUp + profile insert ────────────
  document.getElementById('signup-form-el').addEventListener('submit', async e => {
    e.preventDefault();
    const name = document.getElementById('signup-name').value.trim();
    const email = document.getElementById('signup-email').value.trim();
    const phone = document.getElementById('signup-phone')?.value.trim() || '';
    const pw = document.getElementById('signup-password').value;
    let valid = true;
    if (!name) {
      document.getElementById('signup-name-err').textContent = 'Name is required';
      valid = false;
    } else {
      document.getElementById('signup-name-err').textContent = '';
    }
    if (!email || !email.includes('@')) {
      document.getElementById('signup-email-err').textContent = 'Valid email required';
      valid = false;
    } else {
      document.getElementById('signup-email-err').textContent = '';
    }
    if (pw.length < 6) {
      document.getElementById('signup-pw-err').textContent = 'Password must be at least 6 characters';
      valid = false;
    } else {
      document.getElementById('signup-pw-err').textContent = '';
    }
    if (!valid) return;
    await authSignUp(name, email, phone, pw);
  });

  // ── LOGOUT → Supabase signOut ────────────────────────────────────
  document.getElementById('btn-logout').addEventListener('click', () => {
    authSignOut();
    closeModal();
  });

  // Password visibility toggle (unchanged)
  document.querySelectorAll('.toggle-pw').forEach(btn => {
    btn.addEventListener('click', () => {
      const input = document.getElementById(btn.dataset.target);
      input.type = input.type === 'password' ? 'text' : 'password';
      btn.textContent = input.type === 'password' ? '👁' : '🙈';
    });
  });
}

function showDashboard() {
  document.getElementById('login-form').style.display = 'none';
  document.getElementById('signup-form').style.display = 'none';
  document.getElementById('user-dashboard').style.display = 'block';
  document.getElementById('dashboard-greeting').textContent = `Hi, ${state.user?.name}! 👋`;
  renderDashboardLists();
}

function renderDashboardLists() {
  const recentEl = document.getElementById('recent-list');
  if (state.recentSearches.length) {
    recentEl.innerHTML = state.recentSearches.slice(0, 4).map(r => {
      return `
        <div class="journey-item" onclick="loadSavedJourney('${r.from.replace(/'/g, "\\'")}', '${r.to.replace(/'/g, "\\'")}', '[]')">
          <span class="journey-item-icon">🗺️</span>
          <span>${r.from} → ${r.to}</span>
        </div>
      `;
    }).join('');
  } else {
    recentEl.innerHTML = '<p class="empty-state">No recent journeys yet</p>';
  }

  const savedEl = document.getElementById('saved-list');
  if (state.savedJourneys.length) {
    savedEl.innerHTML = state.savedJourneys.slice(0, 4).map(s => {
      const stopsEscaped = JSON.stringify(s.stops).replace(/"/g, '&quot;');
      return `
        <div class="journey-item" style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
          <div onclick="loadSavedJourney('${s.from.replace(/'/g, "\\'")}', '${s.to.replace(/'/g, "\\'")}', '${stopsEscaped}')" style="display:flex; align-items:center; gap:8px; flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
            <span class="journey-item-icon">❤️</span>
            <span style="overflow:hidden; text-overflow:ellipsis;">${s.from} → ${s.to}</span>
          </div>
          <button onclick="event.stopPropagation(); deleteJourneyFromDB('${s.dbId}')" class="btn-delete-saved" aria-label="Delete saved journey" style="background:none; border:none; color:var(--red-em); font-size:1.1rem; cursor:pointer; padding: 2px 6px; display:flex; align-items:center; justify-content:center;">✕</button>
        </div>
      `;
    }).join('');
  } else {
    savedEl.innerHTML = '<p class="empty-state">No saved journeys yet</p>';
  }
}

// ── Global Helper for dashboard links ──
window.loadSavedJourney = function(from, to, stopsJsonStr) {
  try {
    state.restoreStopsList = JSON.parse(stopsJsonStr);
  } catch (e) {
    state.restoreStopsList = null;
  }
  document.getElementById('input-from').value = from;
  document.getElementById('input-to').value = to;
  
  // Close modal if open
  const modal = document.getElementById('auth-modal');
  if (modal) modal.style.display = 'none';
  
  // Run search
  triggerSearch();
};

function updateNavForUser() {
  const loginBtn = document.getElementById('btn-open-login');
  const signupBtn = document.getElementById('btn-open-signup');
  const mobileLoginBtn = document.getElementById('btn-mobile-login');
  const mobileSignupBtn = document.getElementById('btn-mobile-signup');
  if (state.user) {
    if (loginBtn) loginBtn.textContent = `👤 ${state.user.name}`;
    if (signupBtn) signupBtn.textContent = 'My Trips';
    if (mobileLoginBtn) mobileLoginBtn.textContent = `👤 ${state.user.name}`;
    if (mobileSignupBtn) mobileSignupBtn.textContent = '❤️ My Trips';
  } else {
    if (loginBtn) loginBtn.textContent = 'Login';
    if (signupBtn) signupBtn.textContent = 'Sign Up';
    if (mobileLoginBtn) mobileLoginBtn.textContent = 'Login';
    if (mobileSignupBtn) mobileSignupBtn.textContent = 'Sign Up';
  }
}

/* ════════════════════════════════════════════════════════════════
   LOCAL STORAGE HELPERS
   ════════════════════════════════════════════════════════════════ */
function saveRecentSearch(from, to) {
  state.recentSearches = state.recentSearches.filter(r => !(r.from === from && r.to === to));
  state.recentSearches.unshift({ from, to, date: new Date().toLocaleDateString('en-IN') });
  state.recentSearches = state.recentSearches.slice(0, 10);
  localStorage.setItem('ll_recent', JSON.stringify(state.recentSearches));
}

/* ════════════════════════════════════════════════════════════════
   SCROLL REVEAL ANIMATIONS
   ════════════════════════════════════════════════════════════════ */
function initScrollReveal() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        // Also trigger children
        entry.target.querySelectorAll('.reveal-child').forEach((child, i) => {
          setTimeout(() => child.classList.add('visible'), i * 100);
        });
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

  document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
}

/* ════════════════════════════════════════════════════════════════
   SMOOTH SCROLL FOR ALL ANCHOR LINKS
   ════════════════════════════════════════════════════════════════ */
function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      const target = document.getElementById(this.getAttribute('href').slice(1));
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });
}

/* ════════════════════════════════════════════════════════════════
   THEME TOGGLE (DARK / LIGHT MODE)
   ════════════════════════════════════════════════════════════════ */
function initThemeToggle() {
  const toggleBtn = document.getElementById('theme-toggle');
  const toggleMobileBtn = document.getElementById('theme-toggle-mobile');
  
  const currentTheme = localStorage.getItem('ll_theme') || 'light';
  document.documentElement.setAttribute('data-theme', currentTheme);
  updateToggleButtons(currentTheme);

  if (toggleBtn) {
    toggleBtn.onclick = toggleTheme;
  }
  if (toggleMobileBtn) {
    toggleMobileBtn.onclick = toggleTheme;
  }

  function toggleTheme() {
    const theme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('ll_theme', theme);
    updateToggleButtons(theme);
    showToast(`🌓 Switched to ${theme} mode`, 'success', 1500);
  }

  function updateToggleButtons(theme) {
    const icon = theme === 'dark' ? '🌙' : '☀️';
    if (toggleBtn) toggleBtn.textContent = icon;
    if (toggleMobileBtn) toggleMobileBtn.innerHTML = `${icon} Theme Mode`;
  }
}

/* ════════════════════════════════════════════════════════════════
   BOOT
   ════════════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  // Each section boots independently — a failure in one must never leave the
  // rest of the page's buttons unwired.
  const bootSteps = [
    ['Supabase',      initSupabase],   // must run first to restore session
    ['Theme toggle',  initThemeToggle],
    ['Navbar',        initNavbar],
    ['Particles',     initParticles],
    ['Autocomplete',  initAutocomplete],
    ['Geolocation',   initGeolocation],
    ['Search',        initSearch],
    ['Mode selector', initModeSelector],
    ['Filters',       initFilters],
    ['Explore',       initExplore],
    ['Safety',        initSafety],
    ['Auth',          initAuth],
    ['Scroll reveal', initScrollReveal],
    ['Smooth scroll', initSmoothScroll]
  ];

  bootSteps.forEach(([name, fn]) => {
    try {
      fn();
    } catch (err) {
      console.error(`Local Lenz: "${name}" failed to initialise —`, err);
    }
  });
});
