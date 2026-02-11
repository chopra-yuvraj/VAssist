/* ═══════════════════════════════════════════════
   🔥 FIREBASE CONFIG — EXAMPLE FILE
   ═══════════════════════════════════════════════
   Copy this to firebase-config.js and fill in
   your real values for local development.
   
   For Netlify deployment, set these as environment
   variables in Netlify Dashboard (see README).
   ═══════════════════════════════════════════════ */

const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT.firebasestorage.app",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
console.log('🔥 Firebase Firestore Connected');
