/* ============================================
   VAssist v5.0 — Auth Manager
   Open signups, profile sync, trusted circle
   ============================================ */

(function () {
    const sb = window.sb;

    function getUser() {
        try { return JSON.parse(localStorage.getItem(CONFIG.KEYS.USER)); }
        catch { return null; }
    }

    async function logout() {
        localStorage.removeItem(CONFIG.KEYS.USER);
        try { await sb.auth.signOut(); } catch (e) { /* ignore */ }
        window.location.href = 'login.html';
    }

    // Sync profile from Supabase profiles table
    async function syncProfile() {
        if (!sb) return null;
        const { data: { session } } = await sb.auth.getSession();
        if (!session) return null;

        const profile = await API.getProfile(session.user.id);
        if (profile) {
            const userData = {
                uid: session.user.id,
                email: session.user.email,
                username: profile.username,
                name: profile.full_name || session.user.email.split('@')[0],
                avatar_url: profile.avatar_url,
                trust_score: profile.trust_score || 0
            };
            localStorage.setItem(CONFIG.KEYS.USER, JSON.stringify(userData));
            return userData;
        }
        return null;
    }

    // Update profile UI in header
    function updateProfileUI() {
        const profileBtn = document.getElementById('nav-profile');
        if (!profileBtn) return;

        const user = getUser();
        if (user) {
            const initial = (user.name || user.username || 'U').charAt(0).toUpperCase();
            profileBtn.textContent = initial;
            profileBtn.title = `${user.name || user.username} (${user.email})`;
            profileBtn.style.background = 'var(--primary-gradient)';
            profileBtn.style.color = 'white';
            profileBtn.style.fontWeight = '700';
            profileBtn.style.fontSize = '0.85rem';
            profileBtn.style.borderRadius = '50%';
            profileBtn.style.width = '34px';
            profileBtn.style.height = '34px';
            profileBtn.style.display = 'flex';
            profileBtn.style.alignItems = 'center';
            profileBtn.style.justifyContent = 'center';

            profileBtn.onclick = () => {
                if (confirm('Log out of VAssist?')) logout();
            };
        } else {
            profileBtn.textContent = '👤';
            profileBtn.title = 'Login';
            profileBtn.onclick = () => { window.location.href = 'login.html'; };
        }
    }

    function init() {
        updateProfileUI();

        if (!sb) return;

        // Auth state listener
        sb.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_IN' && session) {
                const user = session.user;
                localStorage.setItem(CONFIG.KEYS.USER, JSON.stringify({
                    uid: user.id,
                    email: user.email,
                    username: user.user_metadata?.username || user.email.split('@')[0],
                    name: user.user_metadata?.full_name || user.email.split('@')[0],
                    avatar_url: user.user_metadata?.avatar_url || null,
                    trust_score: 0
                }));
                updateProfileUI();
                // Sync with profiles table in background
                syncProfile();
            } else if (event === 'SIGNED_OUT') {
                localStorage.removeItem(CONFIG.KEYS.USER);
                window.location.href = 'login.html';
            }
        });

        // Check session validity on load
        sb.auth.getSession().then(({ data: { session } }) => {
            if (!session && localStorage.getItem(CONFIG.KEYS.USER)) {
                localStorage.removeItem(CONFIG.KEYS.USER);
                updateProfileUI();
            } else if (session) {
                syncProfile();
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    window.VAssistAuth = { getUser, logout, syncProfile, updateProfileUI };
})();
