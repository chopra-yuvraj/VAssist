#!/bin/bash
# Render Build Script — generates js/config.js from environment variables
# Uses js/config.example.js as a template

echo "🔧 Generating js/config.js from config.example.js..."

if [ ! -f "js/config.example.js" ]; then
  echo "❌ Error: js/config.example.js not found!"
  exit 1
fi

# Copy template to actual config
cp js/config.example.js js/config.js

# Replace placeholders with Environment Variables
# Using | as delimiter to avoid issues with / in URLs or keys
sed -i "s|YOUR_SUPABASE_URL_HERE|${SUPABASE_URL}|g" js/config.js
sed -i "s|YOUR_SUPABASE_ANON_KEY_HERE|${SUPABASE_ANON_KEY}|g" js/config.js

echo "✅ config.js generated successfully from template"
