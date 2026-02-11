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
            await supabase.auth.signOut();
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
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    window.VAssistAuth = { getUser, logout };
})();
