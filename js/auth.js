/* ════════════════════════════════════════════════════════════════
   LOCAL LENZ — auth.js
   Real Supabase Authentication + Database integration.
   Replaces the simulated localStorage auth in app.js.

   Depends on:
     - supabase-config.js  (SUPABASE_URL, SUPABASE_ANON_KEY globals)
     - Supabase CDN UMD    (supabase global)

   Exposes globals used by app.js:
     - initSupabase()
     - authSignIn(email, pw)
     - authSignUp(name, email, phone, pw)
     - authSignOut()
     - saveJourneyToDB(trip)
     - loadSavedJourneys()
   ════════════════════════════════════════════════════════════════ */

'use strict';

let supabaseClient = null;

/* ─── INIT ──────────────────────────────────────────────────────── */
function initSupabase() {
  if (!window.supabase) {
    console.error('Local Lenz: Supabase CDN not loaded.');
    return;
  }

  supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,          // stores session in localStorage automatically
      autoRefreshToken: true,
      detectSessionInUrl: true       // handles email confirmation redirect links
    }
  });

  // ── Session restore on page load + real-time auth state listener ──
  supabaseClient.auth.onAuthStateChange(async (event, session) => {
    if (session && session.user) {
      // Load user profile from our profiles table
      const { data: profile, error: profErr } = await supabaseClient
        .from('profiles')
        .select('name, phone')
        .eq('id', session.user.id)
        .single();

      if (profErr && profErr.code !== 'PGRST116') {
        console.warn('Profile fetch warning:', profErr.message);
      }

      // Populate app state
      state.user = {
        id: session.user.id,
        email: session.user.email,
        name: profile?.name || session.user.user_metadata?.name || session.user.email.split('@')[0]
      };

      // Load this user's saved journeys from the database
      await loadSavedJourneys();

      // Update the navbar to show user's name
      if (typeof updateNavForUser === 'function') updateNavForUser();

      // If the auth modal is open and login just succeeded, show dashboard
      const modal = document.getElementById('auth-modal');
      if (modal && modal.style.display !== 'none' && event === 'SIGNED_IN') {
        if (typeof showDashboard === 'function') showDashboard();
      }

    } else {
      // Signed out or no session
      state.user = null;
      state.savedJourneys = [];
      if (typeof updateNavForUser === 'function') updateNavForUser();
      if (typeof renderDashboardLists === 'function') renderDashboardLists();
    }
  });
}

/* ─── SIGN UP ───────────────────────────────────────────────────── */
async function authSignUp(name, email, phone, password) {
  if (!supabaseClient) { showToast('Auth not initialized', 'error'); return; }

  const btn = document.querySelector('#signup-form-el .btn-auth-submit');
  setButtonLoading(btn, 'Creating account…');

  try {
    // Create the auth user
    const { data, error } = await supabaseClient.auth.signUp({
      email,
      password,
      options: {
        data: { name }                 // stored in auth.users user_metadata
      }
    });

    if (error) throw error;

    if (data.user) {
      // Insert the user's profile row (ignores duplicate on re-verify)
      const { error: profileError } = await supabaseClient
        .from('profiles')
        .upsert({
          id: data.user.id,
          name: name.trim(),
          phone: phone || null
        }, { onConflict: 'id' });

      if (profileError) console.warn('Profile upsert warning:', profileError.message);
    }

    // Check if email confirmation is required
    if (data.user && !data.session) {
      // Email confirmation is ON in Supabase dashboard
      showToast('📧 Check your inbox to confirm your account, then log in!', 'info', 6000);
    }
    // If session exists → onAuthStateChange fires → showDashboard automatically
  } catch (err) {
    const msg = err.message || 'Sign up failed';
    if (msg.includes('already registered')) {
      showToast('This email is already registered. Please log in instead.', 'error', 4000);
    } else {
      showToast(`Sign up failed: ${msg}`, 'error', 4000);
    }
  } finally {
    resetButton(btn, 'Create Account');
  }
}

/* ─── SIGN IN ───────────────────────────────────────────────────── */
async function authSignIn(email, password) {
  if (!supabaseClient) { showToast('Auth not initialized', 'error'); return; }

  const btn = document.querySelector('#login-form-el .btn-auth-submit');
  setButtonLoading(btn, 'Signing in…');

  try {
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) throw error;
    // Success → onAuthStateChange fires → state.user set → showDashboard called
  } catch (err) {
    const msg = err.message || 'Login failed';
    if (msg.includes('Invalid login credentials')) {
      showToast('Incorrect email or password. Please try again.', 'error', 4000);
    } else if (msg.includes('Email not confirmed')) {
      showToast('📧 Please confirm your email first. Check your inbox.', 'error', 5000);
    } else {
      showToast(`Login failed: ${msg}`, 'error', 4000);
    }
  } finally {
    resetButton(btn, 'Login to Local Lenz');
  }
}

/* ─── SIGN OUT ──────────────────────────────────────────────────── */
async function authSignOut() {
  if (!supabaseClient) return;
  try {
    await supabaseClient.auth.signOut();
    // onAuthStateChange fires → state.user = null → updateNavForUser()
    showToast('Logged out successfully.', 'info');
  } catch (err) {
    console.error('Sign out error:', err);
  }
}

/* ─── LOAD SAVED JOURNEYS FROM DATABASE ─────────────────────────── */
async function loadSavedJourneys() {
  if (!supabaseClient || !state.user) return;
  try {
    const { data, error } = await supabaseClient
      .from('saved_journeys')
      .select('id, from_city, to_city, stops, saved_at')
      .eq('user_id', state.user.id)
      .order('saved_at', { ascending: false });

    if (error) throw error;

    state.savedJourneys = (data || []).map(row => ({
      dbId: row.id,
      from: row.from_city,
      to: row.to_city,
      stops: row.stops || [],
      date: new Date(row.saved_at).toLocaleDateString('en-IN')
    }));

    // Refresh dashboard lists if dashboard is visible
    if (typeof renderDashboardLists === 'function') renderDashboardLists();
  } catch (err) {
    console.error('Error loading saved journeys:', err);
  }
}

/* ─── SAVE JOURNEY TO DATABASE ──────────────────────────────────── */
async function saveJourneyToDB(trip) {
  // Require login
  if (!state.user) {
    showToast('Please log in to save journeys! 🔐', 'error');
    const loginBtn = document.getElementById('btn-open-login');
    if (loginBtn) loginBtn.click();
    return;
  }

  // Check for duplicate
  if (state.savedJourneys.some(s => s.from === trip.from && s.to === trip.to)) {
    showToast('Trip is already saved!', 'info');
    return;
  }

  if (!supabaseClient) { showToast('Database not connected', 'error'); return; }

  try {
    const { data, error } = await supabaseClient
      .from('saved_journeys')
      .insert({
        user_id: state.user.id,
        from_city: trip.from,
        to_city: trip.to,
        stops: trip.stops || []
      })
      .select('id, saved_at')
      .single();

    if (error) throw error;

    // Update local state immediately
    state.savedJourneys.unshift({
      dbId: data.id,
      from: trip.from,
      to: trip.to,
      stops: trip.stops,
      date: new Date(data.saved_at).toLocaleDateString('en-IN')
    });

    showToast('❤️ Trip saved to your account!', 'success');
    if (typeof renderDashboardLists === 'function') renderDashboardLists();

  } catch (err) {
    showToast(`Could not save trip: ${err.message}`, 'error', 4000);
    console.error('Save journey error:', err);
  }
}

/* ─── DELETE SAVED JOURNEY ──────────────────────────────────────── */
async function deleteJourneyFromDB(dbId) {
  if (!supabaseClient || !state.user) return;
  try {
    const { error } = await supabaseClient
      .from('saved_journeys')
      .delete()
      .eq('id', dbId)
      .eq('user_id', state.user.id);   // RLS ensures this, but belt+suspenders

    if (error) throw error;

    state.savedJourneys = state.savedJourneys.filter(s => s.dbId !== dbId);
    showToast('Journey removed.', 'info');
    if (typeof renderDashboardLists === 'function') renderDashboardLists();
  } catch (err) {
    showToast(`Could not remove journey: ${err.message}`, 'error');
  }
}

/* ─── BUTTON LOADING HELPERS ────────────────────────────────────── */
function setButtonLoading(btn, text) {
  if (!btn) return;
  btn.disabled = true;
  btn.dataset.origText = btn.textContent;
  btn.innerHTML = `<span style="display:inline-flex;align-items:center;gap:8px;">
    <span style="width:14px;height:14px;border:2px solid rgba(255,255,255,.4);border-top-color:white;border-radius:50%;display:inline-block;animation:spin 0.7s linear infinite;"></span>
    ${text}
  </span>`;
}

function resetButton(btn, fallbackText) {
  if (!btn) return;
  btn.disabled = false;
  btn.textContent = btn.dataset.origText || fallbackText;
}
