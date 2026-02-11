/* ============================================
   VAssist — Supabase Initializer
   Centralizes client creation to avoid duplicates
   ============================================ */

(function () {
    // Check if duplicate
    if (window.sb) {
        console.warn('Supabase client already initialized');
        return;
    }

    if (!window.supabase) {
        console.error('Supabase SDK not loaded. Check script tags.');
        return;
    }

    if (!CONFIG || !CONFIG.SUPABASE_URL) {
        console.error('CONFIG not loaded. Check config.js.');
        return;
    }

    // Initialize Global Supabase Client
    window.sb = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
    console.log('🚀 Supabase Connected (Global)');

})();
