/* ═══════════════════════════════════════════════
   🔥 FIREBASE CONFIGURATION — VAssist
   ═══════════════════════════════════════════════

   SETUP INSTRUCTIONS:
   1. Go to https://console.firebase.google.com
   2. Click "Create a project" → name it "VAssist"
   3. Disable Google Analytics (optional) → Create
   4. In left sidebar → Build → Realtime Database
   5. Click "Create Database" → Choose region → Start in TEST mode
   6. Go to Project Settings (⚙️ gear icon) → General
   7. Scroll down → "Your apps" → Click web icon (</>)
   8. Register app name "VAssist" → Copy the config below
   9. Paste your values into the firebaseConfig object below
   10. Deploy! 🚀

   ═══════════════════════════════════════════════ */

const firebaseConfig = {
    apiKey: "PASTE_YOUR_API_KEY",
    authDomain: "PASTE_YOUR_PROJECT.firebaseapp.com",
    databaseURL: "https://PASTE_YOUR_PROJECT-default-rtdb.firebaseio.com",
    projectId: "PASTE_YOUR_PROJECT_ID",
    storageBucket: "PASTE_YOUR_PROJECT.appspot.com",
    messagingSenderId: "PASTE_YOUR_SENDER_ID",
    appId: "PASTE_YOUR_APP_ID"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

console.log('🔥 Firebase Connected');
