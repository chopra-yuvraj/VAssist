/* ============================================
   VAssist — Configuration TEMPLATE
   ============================================
   Copy this file as config.js and fill in your Supabase credentials:
   cp js/config.example.js js/config.js
   ============================================ */
const CONFIG = {
    // Supabase Project Credentials (get from supabase.com → Settings → API)
    SUPABASE_URL: 'YOUR_SUPABASE_URL',
    SUPABASE_ANON_KEY: 'YOUR_SUPABASE_ANON_KEY',

    VIT_CENTER: [12.9716, 79.1594],

    API: {
        OSRM: 'https://router.project-osrm.org/route/v1/walking/'
    },

    PRICING: {
        WALKER: { BASE: 10, PER_KM: 5 },
        CYCLIST: { BASE: 15, PER_KM: 8 }
    },

    KEYS: {
        HISTORY: 'vassist_history',
        ACTIVE_REQ: 'vassist_active_request',
        SETTINGS: 'vassist_settings'
    },

    APP: {
        NAME: 'VAssist',
        VERSION: '4.0.0',
        AUTHOR: 'Yuvraj Chopra'
    }
};
