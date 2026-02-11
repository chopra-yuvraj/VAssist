/* ============================================
   VAssist — Configuration TEMPLATE
   ============================================
   INSTRUCTIONS:
   1. Copy this file to "js/config.js"
   2. Replace the placeholders below with your actual Supabase keys
   3. js/config.js is ignored by git, so your keys remain safe!
   ============================================ */

const CONFIG = {
    // 🔴 REPLACE THESE WITH YOUR KEYS FROM SUPABASE DASHBOARD
    SUPABASE_URL: 'YOUR_SUPABASE_URL_HERE',
    SUPABASE_ANON_KEY: 'YOUR_SUPABASE_ANON_KEY_HERE',

    // 📍 Default Map Center (VIT Vellore)
    VIT_CENTER: [12.9716, 79.1594],

    // 🌐 External APIs
    API: {
        OSRM: 'https://router.project-osrm.org/route/v1/walking/'
    },

    // 💰 Pricing Configuration
    PRICING: {
        WALKER: { BASE: 10, PER_KM: 5 },
        CYCLIST: { BASE: 15, PER_KM: 8 }
    },

    // 🔑 LocalStorage Keys
    KEYS: {
        HISTORY: 'vassist_history',
        ACTIVE_REQ: 'vassist_active_request',
        SETTINGS: 'vassist_settings'
    },

    // 📱 App Metadata
    APP: {
        NAME: 'VAssist',
        VERSION: '4.0.0',
        AUTHOR: 'Yuvraj Chopra'
    }
};
