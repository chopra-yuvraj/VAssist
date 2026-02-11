# VAssist — Complete Render Deployment Guide

> Deploy VAssist as a **Static Site** on Render with Supabase backend.  
> API keys stay safe — never pushed to GitHub.

---

## How It Works

```
GitHub Repo (no API keys)
        ↓ git push
Render detects push → runs build.sh
        ↓
build.sh reads SUPABASE_URL & SUPABASE_ANON_KEY from Render env vars
        ↓
Generates js/config.js with real credentials
        ↓
Render serves the static files at https://vassist.onrender.com
        ↓
Browser loads the site → js/config.js has real keys → Supabase works
```

**Key security setup:**
- `js/config.js` is in `.gitignore` → never pushed to GitHub
- `js/config.example.js` is pushed → shows the template
- `build.sh` generates the real `config.js` at deploy time from Render env vars

---

## Step 1: Prepare Your Repo

Make sure these files exist in your repo:

```
VAssist/
├── build.sh                ← Build script (generates config.js)
├── js/config.example.js    ← Template with placeholders (committed)
├── js/config.js            ← Real keys (gitignored, NOT committed)
├── .gitignore              ← Contains "js/config.js"
└── ... (all other files)
```

### 1.1 Remove config.js from Git tracking (if already committed)

If you previously committed `config.js` with real keys, run this to untrack it:

```bash
git rm --cached js/config.js
```

This removes it from Git but keeps the local file. Now `.gitignore` will prevent future commits.

### 1.2 Commit and push

```bash
git add .
git commit -m "VAssist v4 — Supabase, secure config"
git push origin main
```

Verify on GitHub: `js/config.js` should **NOT** appear in the repo. `js/config.example.js` should be there.

---

## Step 2: Create Render Account

1. Go to **[render.com](https://render.com)**
2. Click **Get Started for Free**
3. Sign up with **GitHub** (this lets Render access your repos directly)
4. Authorize Render to access your GitHub account

---

## Step 3: Create a Static Site on Render

1. In the Render Dashboard, click the **New +** button (top right)
2. Select **Static Site**
3. Click **Connect a repository**
4. Find and select your **VAssist** repo
5. Fill in the form **exactly** as follows:

| Field | Value | Why |
|-------|-------|-----|
| **Name** | `vassist` | Your site name (becomes `vassist.onrender.com`) |
| **Branch** | `main` | The branch to deploy from |
| **Root Directory** | _(leave empty)_ | Files are at repo root |
| **Build Command** | `bash build.sh` | Runs the script that generates `config.js` |
| **Publish Directory** | `.` | Serve everything from root |

6. **DO NOT click Create yet** — first add environment variables (Step 4)

---

## Step 4: Add Environment Variables

Scroll down on the same page to **Environment Variables** section, or go to **Environment** tab.

Click **Add Environment Variable** twice and add:

| Key | Value | Where to find it |
|-----|-------|-------------------|
| `SUPABASE_URL` | `https://jwxucudkzdhjpioyrmzt.supabase.co` | Supabase → Settings → API → Project URL |
| `SUPABASE_ANON_KEY` | `eyJhbGciOiJIUzI1NiIs...` (your full key) | Supabase → Settings → API → anon public |

> ⚠️ Copy the **full** anon key — it's a long JWT string starting with `eyJ...`

---

## Step 5: Deploy

1. Click **Create Static Site**
2. Render will:
   - Clone your repo
   - Run `bash build.sh` (generates `js/config.js` with your real Supabase keys)
   - Serve the files
3. Wait ~30-60 seconds
4. You'll see **"Your site is live"** with a URL like:
   ```
   https://vassist.onrender.com
   ```

---

## Step 6: Configure Supabase Auth Redirects

After deployment, you need to tell Supabase where to redirect after Google OAuth login.

1. Go to **Supabase Dashboard → Authentication → URL Configuration**
2. Set these:

| Setting | Value |
|---------|-------|
| **Site URL** | `https://vassist.onrender.com` |
| **Redirect URLs** | `https://vassist.onrender.com/index.html` |
| | `https://vassist.onrender.com/login.html` |

3. Click **Save**

> Without this, Google sign-in will fail with a redirect error.

---

## Step 7: Verify Everything Works

Open each URL in your browser and check:

| URL | What you should see |
|-----|---------------------|
| `https://vassist.onrender.com` | Splash screen with logo → Map loads → App works |
| `https://vassist.onrender.com/login.html` | Login/Register page with animated background |
| `https://vassist.onrender.com/history.html` | Order history (empty state if no orders yet) |

### Check the browser console (F12 → Console):

| Console message | Meaning |
|-----------------|---------|
| `✅ Supabase connected` | Everything is working |
| `⚠️ Supabase SDK not loaded` | Internet issue or CDN blocked |
| `Invalid API key` | Wrong `SUPABASE_ANON_KEY` in Render env vars |
| Red CORS errors | Need to add your Render URL to Supabase redirect URLs |

---

## Step 8: Test Core Features

| Test | Steps | Expected |
|------|-------|----------|
| **Register** | Go to `/login.html` → Register tab → enter `test@vitstudent.ac.in` + password | Account created, redirected to app |
| **Domain block** | Try registering with `test@gmail.com` | Error: "Only @vitstudent.ac.in emails" |
| **Login** | Login with the account you just registered | Redirected to app, profile initial shows |
| **Submit order** | Fill pickup/drop/item → Submit | Order saved to Supabase (check Table Editor) |
| **Partner mode** | Toggle to Partner → see pending request | Request card appears via Realtime |
| **Google login** | Click "Sign in with Google" | Redirects to Google → back to app (if OAuth configured) |

---

## Automatic Deploys

Render automatically redeploys every time you push to `main`:

```bash
git add .
git commit -m "update something"
git push origin main
# → Render auto-deploys in ~30 seconds
```

No manual action needed.

---

## Custom Domain (Optional)

1. Go to Render Dashboard → your site → **Settings → Custom Domains**
2. Click **Add Custom Domain**
3. Enter your domain: e.g. `vassist.yuvrajchopra.dev`
4. Render will give you a **CNAME record**:
   ```
   Type: CNAME
   Name: vassist (or @ for root)
   Value: vassist.onrender.com
   ```
5. Add this DNS record at your domain registrar (Namecheap, GoDaddy, Cloudflare, etc.)
6. Wait for DNS propagation (~5-30 minutes)
7. Render auto-provisions **HTTPS** via Let's Encrypt
8. **Update Supabase** → change Site URL and Redirect URLs to your custom domain

---

## Troubleshooting

| Problem | Cause | Fix |
|---------|-------|-----|
| Blank white page | `config.js` not generated | Check Render build logs — `build.sh` must print "✅ config.js generated" |
| Splash screen keeps looping | `_redirects` file still exists | Delete it from your repo and push |
| "Invalid API key" in console | Wrong env var value | Go to Render → Environment → verify `SUPABASE_ANON_KEY` is correct |
| Google login redirects to wrong URL | Supabase redirect URL not set | Add your Render URL to Supabase Auth → Redirect URLs |
| "Failed to fetch" errors | Supabase RLS blocking | Run the SQL from `SUPABASE_GUIDE.md` Step 3 to add RLS policies |
| Changes not showing after push | Browser cache | Hard refresh: `Ctrl + Shift + R` |
| Build fails on Render | `build.sh` not executable | Render runs it with `bash build.sh` so this shouldn't happen |
| Site shows old `config.js` | Cached deploy | Go to Render → Manual Deploy → Clear cache & deploy |

---

## File Reference

| File | Role | Committed to GitHub? |
|------|------|---------------------|
| `build.sh` | Generates `config.js` from env vars at deploy time | ✅ Yes |
| `js/config.example.js` | Template showing what config.js looks like | ✅ Yes |
| `js/config.js` | Real Supabase credentials | ❌ No (gitignored) |
| `.gitignore` | Prevents `config.js` from being committed | ✅ Yes |
| `SUPABASE_GUIDE.md` | Database + Auth setup instructions | ✅ Yes |
| `RENDER_DEPLOY.md` | This file — deployment guide | ✅ Yes |
