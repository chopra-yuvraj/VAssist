#!/bin/bash
# Render Build Script — generates js/config.js from environment variables
# Set SUPABASE_URL and SUPABASE_ANON_KEY in Render Dashboard → Environment

echo "🔧 Generating js/config.js from environment variables..."

cat > js/config.js << EOF
const CONFIG = {
    SUPABASE_URL: '${SUPABASE_URL}',
    SUPABASE_ANON_KEY: '${SUPABASE_ANON_KEY}',
    VIT_CENTER: [12.9716, 79.1594],
    API: { OSRM: 'https://router.project-osrm.org/route/v1/walking/' },
    PRICING: { WALKER: { BASE: 10, PER_KM: 5 }, CYCLIST: { BASE: 15, PER_KM: 8 } },
    KEYS: { HISTORY: 'vassist_history', ACTIVE_REQ: 'vassist_active_request', SETTINGS: 'vassist_settings' },
    APP: { NAME: 'VAssist', VERSION: '4.0.0', AUTHOR: 'Yuvraj Chopra' }
};
EOF

echo "✅ config.js generated successfully"
