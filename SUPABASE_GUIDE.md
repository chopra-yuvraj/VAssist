# VAssist — Supabase Integration Guide

> Step-by-step instructions to connect VAssist to Supabase (Database + Auth + Realtime).

---

## Step 1: Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) → **Start your project** (free tier).
2. Sign in with GitHub.
3. Click **New Project**.
4. Fill in:
   - **Name**: `vassist`
   - **Database Password**: generate a strong one (save it).
   - **Region**: closest to you (e.g., Mumbai for India).
5. Click **Create new project**. Wait ~2 minutes for provisioning.

---

## Step 2: Get Your API Credentials

1. In your Supabase project dashboard, go to **Settings → API**.
2. Copy these two values:
   - **Project URL** — looks like `https://xyzcompany.supabase.co`
   - **anon public** key — a long `eyJ...` JWT string
3. Open `js/config.js` in VAssist and paste them:

```javascript
SUPABASE_URL: 'https://YOUR-PROJECT-ID.supabase.co',
SUPABASE_ANON_KEY: 'eyJhbGciOi...',
```

---

## Step 3: Create the `requests` Table

1. In Supabase dashboard, go to **SQL Editor**.
2. Click **New query** and paste this SQL:

```sql
CREATE TABLE requests (
    id TEXT PRIMARY KEY,
    item TEXT NOT NULL,
    pickup TEXT NOT NULL,
    drop_location TEXT NOT NULL,
    pickup_coords TEXT,
    drop_coords TEXT,
    delivery_type TEXT DEFAULT 'walker',
    fare REAL DEFAULT 0,
    otp TEXT,
    status TEXT DEFAULT 'PENDING',
    partner_name TEXT,
    user_id UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable Row Level Security (required for Supabase)
ALTER TABLE requests ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read all requests (needed for partner dashboard)
CREATE POLICY "Allow public read" ON requests
    FOR SELECT USING (true);

-- Policy: Authenticated users can insert requests
CREATE POLICY "Allow authenticated insert" ON requests
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Policy: Authenticated users can update any request (for partner accepting)
CREATE POLICY "Allow authenticated update" ON requests
    FOR UPDATE USING (auth.uid() IS NOT NULL);
```

3. Click **Run** (Ctrl+Enter). You should see "Success. No rows returned."

---

## Step 4: Enable Realtime on `requests`

VAssist uses Supabase Realtime to push live order updates (no polling needed).

1. Go to **Database → Tables → requests**.
2. Click the **three dots (⋯)** next to the table name.
3. Click **Enable Realtime**.

Or run this SQL:

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE requests;
```

---

## Step 5: Enable Authentication Providers

### Email/Password Auth (required)

1. Go to **Authentication → Providers**.
2. **Email** should be enabled by default. If not, toggle it ON.
3. (Optional) Under **Email → Settings**, you can disable "Confirm email" for testing.

### Google OAuth (optional but recommended)

1. Go to [Google Cloud Console](https://console.cloud.google.com/).
2. Create a project (or use existing).
3. Go to **APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID**.
4. Set **Application type** to "Web application".
5. Add **Authorized redirect URI**:
   ```
   https://YOUR-PROJECT-ID.supabase.co/auth/v1/callback
   ```
6. Copy the **Client ID** and **Client Secret**.
7. Back in Supabase → **Authentication → Providers → Google**:
   - Toggle ON.
   - Paste **Client ID** and **Client Secret**.
   - Save.

---

## Step 6: Update Netlify Environment (for deployment)

If deploying on Netlify:

1. Go to **Netlify Dashboard → Site → Site settings → Environment variables**.
2. You don't need any build-time env vars anymore — the credentials are in `js/config.js`.
3. **IMPORTANT**: For production, avoid hardcoding credentials in `config.js`. Instead use Netlify's build env + a build step, or accept the trade-off since the Supabase anon key is designed to be public (RLS protects the data).

---

## File Structure Explanation

After cleanup, VAssist has this structure:

```
VAssist/
├── index.html          ← Main app page (map, order, tracking)
├── login.html          ← Login/Register page (Supabase Auth)
├── history.html        ← Order history page (reads localStorage)
├── netlify.toml        ← Netlify deployment config (static site headers)
├── package.json        ← Project metadata
├── css/
│   └── style.css       ← All styles + 480 lines of animations
├── js/
│   ├── config.js       ← Supabase URL + anon key + app constants
│   ├── api.js          ← Supabase DB queries + Realtime listeners
│   ├── auth.js         ← Auth state manager (profile button, logout)
│   ├── app.js          ← Main app controller (splash, map, orders, tracking)
│   ├── map.js          ← Leaflet map service (markers, routes, geocoding)
│   ├── location.js     ← VIT campus location coordinates
│   └── utils.js        ← Pricing, OTP generation, toasts, confetti, storage
├── assets/
│   └── logo.png        ← VAssist logo
├── .gitignore
├── LICENSE
└── README.md
```

### Frontend (What the user sees)

| File | Purpose |
|------|---------|
| `index.html` | Main SPA — splash screen, map view, order form, mode toggle (user/partner), OTP modal, live tracking |
| `login.html` | Auth page — tabbed login/register with Google OAuth, `@vitstudent.ac.in` domain restriction |
| `history.html` | Past orders — reads from `localStorage['vassist_history']`, animated card list |
| `css/style.css` | Complete design system — CSS variables, glassmorphism, 18 animation systems, responsive |

### JavaScript (Application logic)

| File | Purpose |
|------|---------|
| `js/config.js` | Central config — Supabase credentials, map center, pricing rules, localStorage keys |
| `js/api.js` | **ALL Supabase database operations** — CRUD on `requests` table + Realtime channel subscriptions for live updates |
| `js/auth.js` | Manages logged-in state — shows user initial in header, handles logout via `supabase.auth.signOut()`, injects floating orb/aurora background animations |
| `js/app.js` | Main controller — splash screen animation, map init, location detection, order submission (calls `API.createRequest`), partner mode (calls `API.onPendingRequests`), tracking (calls `API.onRequestUpdate`), OTP verify |
| `js/map.js` | Leaflet.js wrapper — initializes map, adds markers, draws routes via OSRM API, handles location search |
| `js/location.js` | Hardcoded VIT campus coordinates — buildings, hostels, canteens used for pickup/drop suggestions |
| `js/utils.js` | Utility belt — fare calculator, OTP generator, ID generator, toast notifications, confetti animation, localStorage helpers, time formatting |

### Backend (Supabase — no server code needed)

| Component | Purpose |
|-----------|---------|
| Supabase Database | PostgreSQL table `requests` — stores all delivery orders |
| Supabase Auth | Email/password + Google OAuth login — enforces `@vitstudent.ac.in` domain |
| Supabase Realtime | WebSocket-based live updates — partners see new orders instantly, users track delivery status live |
| Row Level Security | Controls who can read/write — public read, authenticated insert/update |

### Data Flow

```
User submits order → api.js → supabase.from('requests').insert()
                                    ↓
                         Supabase DB stores the row
                                    ↓
Partner dashboard ← api.js ← Supabase Realtime (postgres_changes event)
Partner accepts   → api.js → supabase.from('requests').update({ status: 'ACCEPTED' })
                                    ↓
User tracking     ← api.js ← Supabase Realtime (UPDATE event on that request ID)
OTP verification  → api.js → supabase query OTP, then update status to 'DELIVERED'
```

---

## Deleted Files (and why)

| File | Reason |
|------|--------|
| `server.py` | Local Python HTTP server — replaced by Supabase |
| `js/firebase-config.js` | Firebase init — replaced by Supabase SDK in `api.js` |
| `netlify/functions/*` | Netlify serverless functions — replaced by direct Supabase queries |
| `scripts/generate-config.sh` | Generated Firebase config from env vars — not needed |
| `_redirects` | **CAUSED THE REDIRECT LOOP** — routed all paths to `index.html`, breaking `login.html` and `history.html` |
| `node_modules/` | No npm dependencies needed — Supabase SDK loaded via CDN |
| `package-lock.json` | Artifact of old npm install |
| `.env` | Was empty |

---

## Testing Checklist

After completing Steps 1–5:

- [ ] Open `index.html` locally — splash screen → app loads (no redirect loop)
- [ ] Open `login.html` — register with `test@vitstudent.ac.in` + password
- [ ] After login, redirected to `index.html` with profile initial showing
- [ ] Submit a delivery request → check Supabase Table Editor to see the row
- [ ] Toggle to Partner mode → see the pending request appear (via Realtime)
- [ ] Accept the request → user tracking updates live
- [ ] Open `history.html` → see past orders (if saved to localStorage)
- [ ] Try registering with non-VIT email → shows error
- [ ] Google sign-in → redirects to Google → back to app (if Google OAuth configured)
