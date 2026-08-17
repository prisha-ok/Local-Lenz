/* ════════════════════════════════════════════════════════════════
   LOCAL LENZ — fareService.js
   Realistic Indian transport fare calculations.
   All values are ESTIMATES based on standard Indian fare structures.
   NOT real-time booking prices.

   Data status: 🟡 Estimated (formula-based, city standard fares)
   ════════════════════════════════════════════════════════════════ */

'use strict';

/**
 * Delhi Metro DMRC fare slabs (official 2024 structure).
 * Source: DMRC official website slab structure.
 * @param {number} distKm - route distance in km
 * @returns {number} fare in INR
 */
function metroFare(distKm) {
  if (distKm <= 2)  return 10;
  if (distKm <= 5)  return 20;
  if (distKm <= 12) return 30;
  if (distKm <= 21) return 40;
  if (distKm <= 32) return 50;
  return 60; // max fare
}

/**
 * Indian Railways estimated fare — Sleeper and AC classes.
 * Formula: per-km rate multiplied by distance.
 * NOTE: Real prices vary by train type, quota, and booking date.
 * @param {number} distKm - route distance in km
 * @returns {{ sleeper: number, threeAC: number, twoAC: number }}
 */
function trainFares(distKm) {
  // Standard IRCTC per-km rate estimates (not live booking prices)
  const sleeperRate  = 0.42;  // ₹0.42/km for Sleeper class
  const threeACRate  = 1.25;  // ₹1.25/km for 3AC
  const twoACRate    = 1.85;  // ₹1.85/km for 2AC

  // Base fares (minimum booking charge)
  const sleeperBase  = 105;
  const threeACBase  = 185;
  const twoACBase    = 245;

  return {
    sleeper: Math.round(sleeperBase + distKm * sleeperRate),
    threeAC: Math.round(threeACBase + distKm * threeACRate),
    twoAC:   Math.round(twoACBase   + distKm * twoACRate)
  };
}

/**
 * State/private bus fare estimate.
 * @param {number} distKm
 * @returns {{ nonAC: number, ac: number, volvo: number }}
 */
function busFares(distKm) {
  return {
    nonAC:  Math.round(Math.max(20, distKm * 0.75)),
    ac:     Math.round(Math.max(35, distKm * 1.20)),
    volvo:  Math.round(Math.max(60, distKm * 2.10))
  };
}

/**
 * Cab (app-based) fare estimate. ₹10-18 per km + ₹30 base.
 * @param {number} distKm
 * @returns {{ economy: number, sedan: number }}
 */
function cabFares(distKm) {
  const base = 30;
  return {
    economy: Math.round(base + distKm * 10),
    sedan:   Math.round(base + distKm * 15)
  };
}

/**
 * Auto-rickshaw fare. ₹25 base + ₹12/km (metered estimate).
 * @param {number} distKm
 */
function autoFare(distKm) {
  return Math.round(25 + distKm * 12);
}

/**
 * Bike taxi fare. ₹5-9 per km.
 * @param {number} distKm
 */
function bikeFare(distKm) {
  return Math.round(Math.max(20, distKm * 7));
}

/**
 * Walking — always free, only practical for short distances.
 * @param {number} distKm
 */
function walkFare(distKm) {
  return 0;
}

/**
 * Determine if a route is city-level or intercity.
 * City routes: <=50 km. Intercity: >50 km.
 */
function isIntercity(distKm) {
  return distKm > 50;
}

/**
 * Build a full fare context object for a given distance.
 * Used by grokService to pass to Grok for intelligent analysis.
 *
 * @param {number} distKm - route distance in km
 * @param {string} fromCity - origin city name
 * @param {string} toCity - destination city name
 * @returns {object} fareContext
 */
function buildFareContext(distKm, fromCity, toCity) {
  const intercity = isIntercity(distKm);
  const isDelhiRoute = (fromCity + toCity).toLowerCase().includes('delhi');

  const context = {
    distanceKm: distKm,
    routeType: intercity ? 'intercity' : 'city',
    dataStatus: 'estimated', // all fare values are estimates
    disclaimer: 'All fares are formula-based estimates for comparison purposes. Actual prices depend on booking platform, availability, and timing.',
    options: []
  };

  // Metro — only for city routes in Delhi/major metro cities
  if (!intercity && isDelhiRoute) {
    context.options.push({
      mode: 'metro',
      icon: '🚇',
      label: 'Metro',
      provider: 'DMRC (Delhi Metro)',
      fare: metroFare(distKm),
      fareDisplay: `₹${metroFare(distKm)}`,
      fareNote: 'DMRC slab fare (official 2024 structure)',
      dataStatus: 'estimated',
      available: true
    });
  } else if (!intercity) {
    // Generic metro for other cities — slab estimate
    context.options.push({
      mode: 'metro',
      icon: '🚇',
      label: 'Metro',
      provider: 'City Metro Rail',
      fare: metroFare(distKm),
      fareDisplay: `₹${metroFare(distKm)}`,
      fareNote: 'Standard city metro slab estimate',
      dataStatus: 'estimated',
      available: true
    });
  } else {
    // Metro not available for intercity
    context.options.push({
      mode: 'metro',
      icon: '🚇',
      label: 'Metro',
      provider: 'N/A',
      fare: null,
      fareDisplay: 'Not available',
      fareNote: 'Metro only operates within city limits',
      dataStatus: 'estimated',
      available: false
    });
  }

  // Train
  const trains = trainFares(distKm);
  context.options.push({
    mode: 'train',
    icon: '🚆',
    label: 'Train',
    provider: 'Indian Railways (IRCTC)',
    fare: trains.sleeper,
    fareDisplay: `₹${trains.sleeper}–₹${trains.twoAC}`,
    fareBreakdown: {
      sleeper: `₹${trains.sleeper}`,
      threeAC: `₹${trains.threeAC}`,
      twoAC: `₹${trains.twoAC}`
    },
    fareNote: 'Formula-based estimate. Actual fares vary by train, quota & booking date.',
    dataStatus: 'estimated',
    available: true
  });

  // Bus
  const buses = busFares(distKm);
  context.options.push({
    mode: 'bus',
    icon: '🚌',
    label: 'Bus',
    provider: 'State Bus / Private Operators',
    fare: buses.nonAC,
    fareDisplay: `₹${buses.nonAC}–₹${buses.volvo}`,
    fareBreakdown: {
      nonAC:  `₹${buses.nonAC}`,
      ac:     `₹${buses.ac}`,
      volvo:  `₹${buses.volvo}`
    },
    fareNote: 'Standard bus fare estimate.',
    dataStatus: 'estimated',
    available: true
  });

  // Cab
  const cabs = cabFares(distKm);
  context.options.push({
    mode: 'cab',
    icon: '🚕',
    label: 'Cab',
    provider: 'Ola / Uber / Rapido / InDrive',
    fare: cabs.economy,
    fareDisplay: `₹${cabs.economy}–₹${cabs.sedan}`,
    fareBreakdown: {
      economy: `₹${cabs.economy}`,
      sedan:   `₹${cabs.sedan}`
    },
    fareNote: 'App-based cab estimate. Surge pricing may apply.',
    dataStatus: 'estimated',
    available: true
  });

  // Bike taxi — not practical for intercity
  if (!intercity) {
    context.options.push({
      mode: 'bike',
      icon: '🏍️',
      label: 'Bike Taxi',
      provider: 'Rapido / Ola Bike / Uber Moto',
      fare: bikeFare(distKm),
      fareDisplay: `₹${bikeFare(distKm)}`,
      fareNote: 'Bike taxi estimate for city routes.',
      dataStatus: 'estimated',
      available: true
    });
  }

  // Auto — practical for city routes
  if (!intercity) {
    context.options.push({
      mode: 'auto',
      icon: '🛺',
      label: 'Auto Rickshaw',
      provider: 'Rapido Auto / Ola Auto / Metered',
      fare: autoFare(distKm),
      fareDisplay: `₹${autoFare(distKm)}`,
      fareNote: 'Metered auto estimate.',
      dataStatus: 'estimated',
      available: true
    });
  }

  // Walk — only for very short distances
  if (distKm <= 3) {
    context.options.push({
      mode: 'walk',
      icon: '🚶',
      label: 'Walk',
      provider: 'Self',
      fare: 0,
      fareDisplay: 'Free',
      fareNote: 'Walking route available.',
      dataStatus: 'estimated',
      available: true
    });
  }

  return context;
}

module.exports = { buildFareContext, trainFares, cabFares, busFares, autoFare, bikeFare, metroFare, isIntercity };
