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

// Route data: key = "From|To", value = route info
const ROUTE_DATA = {
  "Lajpat Nagar, Delhi|Chandni Chowk, Delhi": { distance: 15, duration_road: 40, stops: ["Sarojini Nagar", "India Gate"] },
  "Lajpat Nagar|Chandni Chowk": { distance: 15, duration_road: 40, stops: ["Sarojini Nagar", "India Gate"] },
  "Delhi|Agra": { distance: 206, duration_road: 180, stops: ["Mathura", "Vrindavan", "Faridabad", "Bharatpur"] },
  "Delhi|Jaipur": { distance: 281, duration_road: 270, stops: ["Gurugram", "Alwar", "Behror", "Neemrana"] },
  "Mumbai|Pune": { distance: 148, duration_road: 150, stops: ["Panvel", "Khopoli", "Lonavala", "Khandala"] },
  "Mumbai|Goa": { distance: 594, duration_road: 720, stops: ["Pune", "Kolhapur", "Belgaum", "Panaji"] },
  "Chennai|Bengaluru": { distance: 346, duration_road: 330, stops: ["Kanchipuram", "Vellore", "Krishnagiri", "Hosur"] },
  "Kolkata|Puri": { distance: 500, duration_road: 480, stops: ["Bhubaneswar", "Cuttack", "Kharagpur", "Balasore"] },
  "Hyderabad|Bengaluru": { distance: 570, duration_road: 540, stops: ["Kurnool", "Anantapur", "Chitradurga", "Tumkur"] },
  "Jaipur|Udaipur": { distance: 393, duration_road: 360, stops: ["Kishangarh", "Ajmer", "Chittorgarh", "Rajsamand"] },
  "DEFAULT": { distance: 250, duration_road: 240, stops: ["Waypoint A", "Waypoint B", "Waypoint C"] }
};

// Transport providers per mode
const PROVIDERS = {
  cab: [
    { name: "Ola", emoji: "🟢", type: "Sedan", multiplier: 1.0 },
    { name: "Uber", emoji: "⚫", type: "Go Sedan", multiplier: 1.05 },
    { name: "Rapido", emoji: "🟡", type: "Cab+", multiplier: 0.88 },
    { name: "InDrive", emoji: "🔵", type: "Economy", multiplier: 0.82 }
  ],
  bike: [
    { name: "Rapido", emoji: "🟡", type: "Bike", multiplier: 1.0 },
    { name: "Ola", emoji: "🟢", type: "Bike", multiplier: 1.08 },
    { name: "Uber Moto", emoji: "⚫", type: "Moto", multiplier: 1.03 },
    { name: "Bounce", emoji: "🟠", type: "Self-ride", multiplier: 0.75 }
  ],
  auto: [
    { name: "Rapido Auto", emoji: "🟡", type: "Auto", multiplier: 1.0 },
    { name: "Ola Auto", emoji: "🟢", type: "Auto", multiplier: 1.12 },
    { name: "Uber Auto", emoji: "⚫", type: "Auto", multiplier: 1.07 },
    { name: "Namma Yatri", emoji: "🔷", type: "Metered", multiplier: 0.9 }
  ],
  share: [
    { name: "Ola Share", emoji: "🟢", type: "Carpool", multiplier: 0.55 },
    { name: "Uber Pool", emoji: "⚫", type: "Pool", multiplier: 0.58 },
    { name: "QuickRide", emoji: "🟣", type: "Carpool", multiplier: 0.45 },
    { name: "BlaBlaCar", emoji: "🔵", type: "Long-haul", multiplier: 0.40 }
  ]
};

// Destination data for Explore India section
const DESTINATIONS = [
  { name: "Taj Mahal", state: "Agra, UP", emoji: "🕌", desc: "Iconic white marble mausoleum and UNESCO World Heritage Site.", rating: "⭐ 4.9", category: "historical", grad: "grad-2" },
  { name: "Hawa Mahal", state: "Jaipur, Rajasthan", emoji: "🏯", desc: "The magnificent 'Palace of Winds' with 953 intricately carved windows.", rating: "⭐ 4.8", category: "historical", grad: "grad-2" },
  { name: "Kerala Backwaters", state: "Alleppey, Kerala", emoji: "🌊", desc: "Serene houseboat cruises through lush tropical backwaters.", rating: "⭐ 4.9", category: "nature", grad: "grad-3" },
  { name: "Palolem Beach", state: "Goa", emoji: "🏖️", desc: "Stunning crescent beach with crystal clear waters and beach shacks.", rating: "⭐ 4.7", category: "beaches", grad: "grad-3" },
  { name: "Valley of Flowers", state: "Uttarakhand", emoji: "🌸", desc: "A UNESCO site blooming with rare Himalayan wildflowers in monsoon.", rating: "⭐ 4.8", category: "mountains", grad: "grad-3" },
  { name: "Varanasi Ghats", state: "Varanasi, UP", emoji: "🛕", desc: "Ancient city on the banks of Ganga; cradle of Indian civilisation.", rating: "⭐ 4.8", category: "religious", grad: "grad-4" },
  { name: "Rohtang Pass", state: "Himachal Pradesh", emoji: "🏔️", desc: "Snow-capped high mountain pass with breathtaking Himalayan views.", rating: "⭐ 4.7", category: "mountains", grad: "grad-1" },
  { name: "Hampi Ruins", state: "Karnataka", emoji: "🏛️", desc: "Magnificent ruins of the Vijayanagara Empire set in a surreal landscape.", rating: "⭐ 4.9", category: "historical", grad: "grad-2" },
  { name: "Lakshmi Vilas Palace", state: "Vadodara, Gujarat", emoji: "🏰", desc: "Opulent palace four times the size of Buckingham Palace.", rating: "⭐ 4.6", category: "historical", grad: "grad-6" },
  { name: "Radha Kund", state: "Mathura, UP", emoji: "🌿", desc: "Sacred kund associated with Radha-Krishna, surrounded by temples.", rating: "⭐ 4.7", category: "religious", grad: "grad-4" },
  { name: "Dudhsagar Falls", state: "Goa-Karnataka", emoji: "💧", desc: "One of India's tallest waterfalls — a milky cascade through dense forest.", rating: "⭐ 4.8", category: "nature", grad: "grad-3" },
  { name: "Chettinad Cuisine", state: "Tamil Nadu", emoji: "🍛", desc: "Legendary cuisine known for its bold spices and unique cooking techniques.", rating: "⭐ 5.0", category: "food", grad: "grad-6" },
  { name: "Mysore Palace", state: "Mysuru, Karnataka", emoji: "✨", desc: "Ornate Indo-Saracenic palace lit by 97,000 bulbs during Dasara.", rating: "⭐ 4.8", category: "culture", grad: "grad-4" },
  { name: "Munnar Tea Gardens", state: "Kerala", emoji: "🍃", desc: "Rolling hills blanketed with lush green tea plantations.", rating: "⭐ 4.7", category: "nature", grad: "grad-3" },
  { name: "Golden Temple", state: "Amritsar, Punjab", emoji: "🌟", desc: "The holiest Sikh shrine — a spiritual and architectural masterpiece.", rating: "⭐ 5.0", category: "religious", grad: "grad-6" },
  { name: "Rann of Kutch", state: "Gujarat", emoji: "🌅", desc: "Vast white salt desert, magical under a full moon.", rating: "⭐ 4.8", category: "nature", grad: "grad-5" }
];

// Discovery stops per known routes
const DISCOVERY_STOPS = {
  "Lajpat Nagar, Delhi|Chandni Chowk, Delhi": [
    { name: "Sarojini Nagar", emoji: "🛍️", desc: "India's premier budget fashion market. Great local shopping experience.", dist: "~5 km from route", category: "Shopping", duration: "60 min", cost: 150 },
    { name: "India Gate", emoji: "🏛️", desc: "Historic national war memorial surrounded by gardens and fountains.", dist: "~8 km from route", category: "Heritage", duration: "45 min", cost: 50 }
  ],
  "Lajpat Nagar|Chandni Chowk": [
    { name: "Sarojini Nagar", emoji: "🛍️", desc: "India's premier budget fashion market. Great local shopping experience.", dist: "~5 km from route", category: "Shopping", duration: "60 min", cost: 150 },
    { name: "India Gate", emoji: "🏛️", desc: "Historic national war memorial surrounded by gardens and fountains.", dist: "~8 km from route", category: "Heritage", duration: "45 min", cost: 50 }
  ],
  "Delhi|Agra": [
    { name: "Mathura", emoji: "🛕", desc: "Birthplace of Lord Krishna; dotted with temples and ghats.", dist: "~50 km from route" },
    { name: "Vrindavan", emoji: "🌸", desc: "Sacred town of temples, the playground of young Krishna.", dist: "~55 km from route" },
    { name: "Faridabad", emoji: "🏙️", desc: "Industrial city with the ancient Baba Farid Dargah.", dist: "~40 km from route" },
    { name: "Bharatpur", emoji: "🦅", desc: "Keoladeo National Park — a UNESCO bird sanctuary.", dist: "~15 km from route" }
  ],
  "Delhi|Jaipur": [
    { name: "Neemrana Fort", emoji: "🏯", desc: "15th-century heritage fort-palace with stunning views.", dist: "~122 km from route" },
    { name: "Alwar", emoji: "🌿", desc: "Gateway to Sariska Tiger Reserve and historic forts.", dist: "~160 km from route" },
    { name: "Bhangarh Fort", emoji: "👻", desc: "India's 'most haunted' fort with striking Rajput architecture.", dist: "~175 km from route" }
  ],
  "Mumbai|Pune": [
    { name: "Lonavala", emoji: "🌧️", desc: "Scenic hill station famous for chikki and monsoon waterfalls.", dist: "~8 km from route" },
    { name: "Khandala", emoji: "🌄", desc: "Picturesque twin town with the iconic Rajmachi viewpoint.", dist: "~10 km from route" },
    { name: "Karla Caves", emoji: "🗿", desc: "Ancient rock-cut Buddhist caves from the 2nd century BCE.", dist: "~18 km from route" }
  ],
  "DEFAULT": [
    { name: "Heritage Stop", emoji: "🏛️", desc: "Historic site along the route worth exploring.", dist: "~30 km from route" },
    { name: "Nature Escape", emoji: "🌿", desc: "Scenic natural area perfect for a short break.", dist: "~45 km from route" },
    { name: "Local Flavour", emoji: "🍛", desc: "Renowned for local cuisine and street food.", dist: "~20 km from route" }
  ]
};

/* ════════════════════════════════════════════════════════════════
   APP STATE
   ════════════════════════════════════════════════════════════════ */
const state = {
  fromCity: '',
  toCity: '',
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

function getRouteKey(from, to) {
  const key = `${from}|${to}`;
  if (ROUTE_DATA[key]) return key;
  const rev = `${to}|${from}`;
  if (ROUTE_DATA[rev]) return rev;
  return 'DEFAULT';
}

function getRouteData(from, to) {
  const key = getRouteKey(from, to);
  return ROUTE_DATA[key] || ROUTE_DATA['DEFAULT'];
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

function setupAutocomplete(inputId, dropdownId, stateKey) {
  const input = document.getElementById(inputId);
  const dropdown = document.getElementById(dropdownId);

  input.addEventListener('input', () => {
    const val = input.value.trim().toLowerCase();
    if (val.length < 1) { closeDropdown(dropdown); return; }
    const matches = INDIAN_CITIES.filter(c => c.toLowerCase().startsWith(val)).slice(0, 6);
    if (!matches.length) { closeDropdown(dropdown); return; }
    dropdown.innerHTML = matches.map(c =>
      `<div class="ac-item" tabindex="0" role="option">
         <span class="ac-icon">📍</span>${c}
       </div>`
    ).join('');
    dropdown.classList.add('open');
    dropdown.querySelectorAll('.ac-item').forEach(item => {
      item.addEventListener('click', () => {
        input.value = item.textContent.trim();
        state[stateKey] = item.textContent.trim();
        closeDropdown(dropdown);
      });
      item.addEventListener('keydown', e => {
        if (e.key === 'Enter') item.click();
      });
    });
  });

  document.addEventListener('click', e => {
    if (!input.contains(e.target) && !dropdown.contains(e.target)) closeDropdown(dropdown);
  });

  input.addEventListener('change', () => { state[stateKey] = input.value.trim(); });
}

function closeDropdown(el) { el.innerHTML = ''; el.classList.remove('open'); }

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
      () => {
        // In production: reverse geocode with Google Maps API
        document.getElementById('input-from').value = 'Your Current Location';
        state.fromCity = 'Delhi'; // Mock — replace with real reverse geocode
        showToast('📍 Location detected! (Mock: using Delhi)', 'success');
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

function triggerSearch() {
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

  // Save to recent
  saveRecentSearch(fromVal, toVal);

  // Smooth scroll to results
  document.getElementById('journey-section').scrollIntoView({ behavior: 'smooth' });

  showLoading();
  
  const loadingStepsContainer = document.getElementById('loading-steps');
  const stepsText = [
    "Checking route",
    "Comparing transportation",
    "Discovering places",
    "Preparing itinerary",
    "Estimating budget"
  ];
  
  loadingStepsContainer.innerHTML = "";
  
  stepsText.forEach((step, idx) => {
    setTimeout(() => {
      const stepEl = document.createElement('div');
      stepEl.className = "loading-step-item fade-in-up";
      stepEl.style.cssText = "display:flex; align-items:center; gap:8px; animation: fadeInUp 0.3s ease forwards;";
      stepEl.innerHTML = `<span style="color:var(--color-accent); font-weight:bold;">✓</span> <span>${step}</span>`;
      loadingStepsContainer.appendChild(stepEl);
    }, (idx + 1) * 300);
  });

  setTimeout(() => {
    hideLoading();
    renderResults();
  }, 1900); // 1.9 seconds total
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

  const routeData = getRouteData(state.fromCity, state.toCity);

  // Header
  document.getElementById('result-from').textContent = state.fromCity;
  document.getElementById('result-to').textContent = state.toCity;
  document.getElementById('result-distance').textContent = `~${routeData.distance} km`;
  document.getElementById('result-date').textContent = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

  // Reset mode to all
  state.currentMode = 'all';
  resetModeSelector();
  document.getElementById('provider-comparison').style.display = 'none';
  document.getElementById('transport-overview').style.display = 'block';

  // Render transport cards
  renderTransportCards(routeData);

  // Initialize all sections
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
  const routeData = getRouteData(state.fromCity, state.toCity);
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

  const cards = [
    {
      type: 'metro', icon: '🚇', title: 'Metro',
      fare: isDelhi ? '₹40' : '₹60',
      duration: '35 min',
      options: 'Delhi Metro Rail (DMRC)',
      distance: `${dist} km`,
      badge: isDelhi ? 'Recommended' : 'Economical',
      action: 'View Metro Info',
      note: 'Yellow & Blue Lines'
    },
    {
      type: 'train', icon: '🚆', title: 'Train',
      fare: `₹${Math.round(calcTrainFare(dist) * dist)}`,
      duration: formatDuration(roadTime * 0.7),
      options: `${randBetween(8, 25)} trains available`,
      distance: `${dist} km`,
      badge: 'Best Value',
      action: 'View Train Options',
      note: 'Sleeper • 3AC • 2AC'
    },
    {
      type: 'bus', icon: '🚌', title: 'Bus',
      fare: `₹${Math.round(calcBusFare(dist) * dist)}`,
      duration: formatDuration(roadTime * 1.15),
      options: `${randBetween(5, 20)} buses available`,
      distance: `${dist} km`,
      badge: 'Economical',
      action: 'View Bus Options',
      note: 'AC • Non-AC • Sleeper'
    },
    {
      type: 'cab', icon: '🚕', title: 'Cab',
      fare: `₹${calcCabFare(dist)}`,
      duration: formatDuration(roadTime),
      options: 'Ola • Uber • Rapido • InDrive',
      distance: `${dist} km`,
      badge: 'Door-to-Door',
      action: 'Compare Cabs',
      note: 'Sedan • SUV • Premium'
    },
    {
      type: 'bike', icon: '🏍️', title: 'Bike Taxi',
      fare: `₹${calcBikeFare(dist)}`,
      duration: formatDuration(Math.round(roadTime * 0.9)),
      options: 'Rapido • Ola Bike • Uber Moto',
      distance: `${dist} km`,
      badge: 'Fastest',
      action: 'Compare Bikes',
      note: 'Budget option'
    },
    {
      type: 'auto', icon: '🛺', title: 'Auto Rickshaw',
      fare: `₹${calcAutoFare(dist)}`,
      duration: formatDuration(Math.round(roadTime * 1.05)),
      options: 'Rapido Auto • Ola Auto • Metered',
      distance: `${dist} km`,
      badge: 'Local Fav',
      action: 'Compare Autos',
      note: 'For shorter trips'
    }
  ];

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
      const routeData = getRouteData(state.fromCity, state.toCity);
      renderTransportCards(routeData);
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
        // Check if this was originally a recommended stop
        const routeKey = getRouteKey(state.fromCity, state.toCity);
        const discoveryStops = DISCOVERY_STOPS[routeKey] || DISCOVERY_STOPS['DEFAULT'];
        const matchedRec = discoveryStops.find(ds => ds.name.toLowerCase() === stopName.toLowerCase());
        if (matchedRec) {
          type = 'recommended';
          emoji = matchedRec.emoji || '⭐';
          desc = matchedRec.desc;
        }
      }
      return { name: stopName, type, emoji, desc };
    });
    // Clear restore list so subsequent searches start fresh
    state.restoreStopsList = null;
  } else {
    const routeKey = getRouteKey(state.fromCity, state.toCity);
    const discoveryStops = DISCOVERY_STOPS[routeKey] || DISCOVERY_STOPS['DEFAULT'];
    
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
  renderWeatherInfo();
  renderSafetyQuickTips();
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
  const routeData = getRouteData(state.fromCity, state.toCity);
  renderAllSubsections(routeData);
};

function renderDiscoveryGrid() {
  const routeKey = getRouteKey(state.fromCity, state.toCity);
  const discoveryStops = DISCOVERY_STOPS[routeKey] || DISCOVERY_STOPS['DEFAULT'];
  const currentNames = state.currentStops.map(s => s.name.toLowerCase());
  const remaining = discoveryStops.filter(s => !currentNames.includes(s.name.toLowerCase()));
  
  const grid = document.getElementById('discovery-cards-grid');
  if (remaining.length === 0) {
    grid.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:var(--gray-500);font-size:0.9rem;padding:20px;">You have added all suggested spots along the route! 🗺️</p>';
    return;
  }
  
  grid.innerHTML = remaining.map(s => `
    <div class="discovery-card">
      <div class="discovery-card-img">${s.emoji}</div>
      <div class="dc-body">
        <div class="dc-name">📍 ${s.name}</div>
        <div class="dc-desc">${s.desc}</div>
        <div class="dc-meta">🗺️ ${s.dist}</div>
        <button class="btn-explore" style="width:100%;cursor:pointer;" onclick="addStopFromDiscovery('${s.name}', '${s.desc}', '${s.emoji}')">Add Stop +</button>
      </div>
    </div>
  `).join('');
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
  const routeData = getRouteData(state.fromCity, state.toCity);
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
  const steps = [];
  const totalStops = state.currentStops.length;

  // Spread available travel hours (8AM to 8PM = 12 hours) across stops
  const START_HOUR = 8; // 8:00 AM
  const END_HOUR = 20;  // 8:00 PM
  const totalMinutes = (END_HOUR - START_HOUR) * 60;

  // Richer activity suggestions per stop type
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

  container.innerHTML = steps.map((s, i) => `
    <div class="itinerary-item" style="--iti-accent:${s.tagColor};">
      <div class="iti-time">
        <span>${s.time}</span>
        <span class="iti-icon">${s.icon}</span>
      </div>
      <div class="iti-detail">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
          <h4 style="margin:0;font-size:0.95rem;">${s.title}</h4>
          <span style="font-size:0.7rem;font-weight:700;background:${s.tagColor}20;color:${s.tagColor};padding:2px 8px;border-radius:20px;white-space:nowrap;">${s.tag}</span>
        </div>
        <p style="margin:0 0 8px;font-size:0.85rem;color:var(--gray-600);">${s.desc}</p>
        <ul style="margin:0;padding-left:16px;font-size:0.78rem;color:var(--gray-500);">
          ${s.tips.map(t => `<li>${t}</li>`).join('')}
        </ul>
      </div>
    </div>
  `).join('');
}

function renderBudgetEstimate(routeData) {
  const container = document.getElementById('budget-grid');
  const dist = routeData.distance;
  const numMidStops = Math.max(0, state.currentStops.length - 2);

  // Cost breakdown
  const transportCost = Math.round(dist * randBetween(10, 15)); // ₹10–15/km cab estimate
  const foodCost = Math.round((numMidStops + 1) * randBetween(120, 200));
  const sightCost = Math.round(numMidStops * randBetween(80, 150));
  const miscCost = Math.round(dist * 0.5 + 50);  // parking, tolls etc.
  const total = transportCost + foodCost + sightCost + miscCost;

  // Budget limit (saved in state or default 2000)
  if (!state.budgetLimit) state.budgetLimit = 2000;
  const isOverBudget = total > state.budgetLimit;

  const items = [
    { label: 'Transport (Cab est.)', val: transportCost, icon: '🚕' },
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
  const routeData = getRouteData(state.fromCity, state.toCity);
  renderBudgetEstimate(routeData);
};

function renderWeatherInfo() {
  document.getElementById('weather-city').textContent = state.toCity;
  const container = document.getElementById('weather-row');
  
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
      </div>
    </div>
    <div class="weather-detail-grid">
      <div class="weather-detail-item">💧 Humidity: ${randBetween(40, 85)}%</div>
      <div class="weather-detail-item">💨 Wind speed: ${randBetween(5, 18)} km/h</div>
      <div class="weather-detail-item">👁️ Visibility: ${randBetween(6, 10)} km</div>
    </div>
  `;
}

function renderSafetyQuickTips() {
  const container = document.getElementById('safety-tips-row');
  const tips = [
    { title: 'Share Live Location', desc: 'Always keep trusted contacts updated on your journey using the Share link.', icon: '📍' },
    { title: 'Verify Ride & OTP', desc: 'Verify the vehicle license plate, driver details and never share OTP before trip starts.', icon: '🛡️' },
    { title: 'Carry Emergency Contacts', desc: 'Keep helpline numbers saved offline in case of cellular network outages.', icon: '📞' }
  ];
  
  container.innerHTML = tips.map(t => `
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
}

function renderDestinations(category) {
  const filtered = category === 'all' ? DESTINATIONS : DESTINATIONS.filter(d => d.category === category);
  const grid = document.getElementById('destinations-grid');
  if (!filtered.length) {
    grid.innerHTML = '<p style="text-align:center;color:var(--gray-400);grid-column:1/-1;padding:40px">More destinations coming soon! 🌏</p>';
    return;
  }
  grid.innerHTML = filtered.map(d => `
    <div class="dest-card" onclick="showToast('Exploring ${d.name}! 🌟', 'success')">
      <div class="dest-card-img ${d.grad}">
        <span>${d.emoji}</span>
        <div class="dest-card-tag">${capitalize(d.category)}</div>
      </div>
      <div class="dest-card-body">
        <div class="dest-card-name">${d.name}</div>
        <div class="dest-card-state">📍 ${d.state}</div>
        <div class="dest-card-desc">${d.desc}</div>
        <div class="dest-card-footer">
          <span class="dest-card-rating">${d.rating}</span>
          <button class="btn-dest-explore" onclick="event.stopPropagation(); showToast('Exploring ${d.name}! 🌟', 'success')">Explore</button>
        </div>
      </div>
    </div>
  `).join('');
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

  // Share journey
  document.querySelectorAll('#btn-share-journey, .btn-share-journey').forEach(el => {
    el.onclick = () => {
      showToast('📤 Journey shared with trusted contacts! (Production: uses Web Share API)', 'success', 3000);
    };
  });

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
  initSupabase();        // ← Supabase: must run first to restore session
  initThemeToggle();
  initNavbar();
  initParticles();
  initAutocomplete();
  initGeolocation();
  initSearch();
  initModeSelector();
  initFilters();
  initExplore();
  initSafety();
  initAuth();
  initScrollReveal();
  initSmoothScroll();
});
