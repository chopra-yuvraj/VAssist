/* ============================================
   VAssist — Supabase Auth Manager
   Handles login state, profile UI, floating orbs
   ============================================ */

(function () {
    const ALLOWED_DOMAIN = '@vitstudent.ac.in';

    function getUser() {
        try {
            return JSON.parse(localStorage.getItem('vassist_user'));
        } catch { return null; }
    }

    async function logout() {
        localStorage.removeItem('vassist_user');
        try {
            await window.sb.auth.signOut();
        } catch (e) { /* ignore */ }
        window.location.href = 'login.html';
    }

    // ── Update profile button in header ──
    function updateProfileUI() {
        const profileBtn = document.getElementById('nav-profile');
        if (!profileBtn) return;

        const user = getUser();
        if (user) {
            profileBtn.textContent = user.name ? user.name.charAt(0).toUpperCase() : '👤';
            profileBtn.title = `${user.name || 'User'} (${user.email})`;
            profileBtn.style.background = 'var(--primary-gradient)';
            profileBtn.style.color = 'white';
            profileBtn.style.fontWeight = '700';
            profileBtn.style.fontSize = '0.85rem';

            profileBtn.onclick = () => {
                if (confirm('Log out of VAssist?')) logout();
            };
        } else {
            profileBtn.textContent = '👤';
            profileBtn.title = 'Login';
            profileBtn.onclick = () => { window.location.href = 'login.html'; };
        }
    }

    // Add floating orbs to main app
    function addFloatingOrbs() {
        if (document.querySelector('.floating-orbs')) return;
        const el = document.createElement('div');
        el.className = 'floating-orbs';
        el.innerHTML = '<div class="orb orb-1"></div><div class="orb orb-2"></div><div class="orb orb-3"></div>';
        document.body.insertBefore(el, document.body.firstChild);
    }

    // Add aurora background
    function addAuroraBackground() {
        if (document.querySelector('.aurora-bg')) return;
        const el = document.createElement('div');
        el.className = 'aurora-bg';
        document.body.insertBefore(el, document.body.firstChild);
    }

    function init() {
        updateProfileUI();
        addFloatingOrbs();
        addAuroraBackground();

        // ── Auth Persistence Listener ──
        // Keeps localStorage in sync with actual Supabase session
        if (window.sb) {
            window.sb.auth.onAuthStateChange((event, session) => {
                if (event === 'SIGNED_IN' && session) {
                    const user = session.user;
                    localStorage.setItem('vassist_user', JSON.stringify({
                        uid: user.id || user.uid,
                        email: user.email,
                        name: user.user_metadata?.full_name || user.email.split('@')[0],
                        photoURL: user.user_metadata?.avatar_url || null
                    }));
                    updateProfileUI();
                } else if (event === 'SIGNED_OUT') {
                    localStorage.removeItem('vassist_user');
                    window.location.href = 'login.html';
                }
            });

            // Check session on load
            /* 
               If we have no session but have vassist_user, it means session expired/cleared.
               We should clear vassist_user to avoid UI mismatch.
            */
            window.sb.auth.getSession().then(({ data: { session } }) => {
                if (!session && localStorage.getItem('vassist_user')) {
                    console.log('Session expired, clearing local state');
                    localStorage.removeItem('vassist_user');
                    updateProfileUI();
                }
            });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    window.VAssistAuth = { getUser, logout };
})();
