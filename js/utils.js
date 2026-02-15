/* ============================================
   VAssist v5.0 — Utilities & Helpers
   Pricing, animations, toast, formatters
   ============================================ */

// ── Pricing Engine (weight-based) ──
const Pricing = {
    estimate: (distKm, type, weightKg = 0.5) => {
        const p = type === 'cyclist' ? CONFIG.PRICING.CYCLIST : CONFIG.PRICING.WALKER;
        const raw = p.BASE + (distKm * p.PER_KM) + (weightKg * p.PER_KG);
        return Math.round(raw);
    }
};

// ── Core Utilities ──
const Utils = {
    formatCurrency: (amt) => `₹${Math.round(amt)}`,

    generateId: () => 'REQ_' + Date.now().toString(36).toUpperCase() + '_' + Math.random().toString(36).substr(2, 4).toUpperCase(),

    generateOTP: () => Math.floor(1000 + Math.random() * 9000),

    getSettings: () => JSON.parse(localStorage.getItem(CONFIG.KEYS.SETTINGS)) || {},

    // ── Toast Notification ──
    showToast: (msg, duration = 3000) => {
        const t = document.getElementById('toast');
        if (!t) return;
        t.innerText = msg;
        t.classList.add('show');
        t.classList.remove('hidden');

        if (Utils._toastTimer) clearTimeout(Utils._toastTimer);
        Utils._toastTimer = setTimeout(() => {
            t.classList.remove('show');
            setTimeout(() => t.classList.add('hidden'), 400);
        }, duration);
    },
    _toastTimer: null,

    // ── Debounce ──
    debounce: (fn, ms = 300) => {
        let timer;
        return (...args) => {
            clearTimeout(timer);
            timer = setTimeout(() => fn.apply(null, args), ms);
        };
    },

    // ── Throttle ──
    throttle: (fn, limit = 100) => {
        let waiting = false;
        return (...args) => {
            if (!waiting) {
                fn.apply(null, args);
                waiting = true;
                setTimeout(() => { waiting = false; }, limit);
            }
        };
    },

    // ── Smooth Number Counter ──
    animateNumber: (element, target, duration = 600) => {
        if (!element) return;
        const start = parseInt(element.innerText) || 0;
        const diff = target - start;
        const startTime = performance.now();

        const step = (now) => {
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            element.innerText = Math.round(start + diff * eased);
            if (progress < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
    },

    // ── Ripple Effect ──
    createRipple: (event, element) => {
        if (!element) return;
        const circle = document.createElement('span');
        const diameter = Math.max(element.clientWidth, element.clientHeight);
        const radius = diameter / 2;
        const rect = element.getBoundingClientRect();

        circle.style.width = circle.style.height = `${diameter}px`;
        circle.style.left = `${event.clientX - rect.left - radius}px`;
        circle.style.top = `${event.clientY - rect.top - radius}px`;
        circle.classList.add('ripple');

        const existing = element.querySelector('.ripple');
        if (existing) existing.remove();

        element.appendChild(circle);
        setTimeout(() => circle.remove(), 600);
    },

    // ── Confetti ──
    launchConfetti: (count = 40) => {
        const container = document.createElement('div');
        container.className = 'confetti-container';
        document.body.appendChild(container);

        const colors = ['#4A4BAF', '#6566C9', '#ECA526', '#E5546B', '#2ED573', '#18DCFF', '#FFA502'];

        for (let i = 0; i < count; i++) {
            const piece = document.createElement('div');
            piece.className = 'confetti-piece';
            piece.style.left = Math.random() * 100 + '%';
            piece.style.background = colors[Math.floor(Math.random() * colors.length)];
            piece.style.animationDuration = (2 + Math.random() * 2) + 's';
            piece.style.animationDelay = Math.random() * 0.5 + 's';
            piece.style.width = (6 + Math.random() * 8) + 'px';
            piece.style.height = (6 + Math.random() * 8) + 'px';
            piece.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
            container.appendChild(piece);
        }
        setTimeout(() => container.remove(), 4000);
    },

    // ── Handshake Animation ──
    showHandshake: () => {
        const overlay = document.createElement('div');
        overlay.className = 'handshake-overlay';
        overlay.innerHTML = `
            <div class="handshake-animation">
                <span class="handshake-emoji">🤝</span>
                <p class="handshake-text">Connection Made!</p>
            </div>
        `;
        document.body.appendChild(overlay);
        requestAnimationFrame(() => overlay.classList.add('show'));
        setTimeout(() => {
            overlay.classList.remove('show');
            setTimeout(() => overlay.remove(), 500);
        }, 2000);
    },

    // ── Math Helpers ──
    lerp: (a, b, t) => a + (b - a) * t,
    easeOutCubic: (t) => 1 - Math.pow(1 - t, 3),
    easeInOutQuad: (t) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2,
    randomBetween: (min, max) => Math.random() * (max - min) + min,

    // ── Haptic Feedback ──
    vibrate: (pattern = 50) => {
        if ('vibrate' in navigator) navigator.vibrate(pattern);
    },

    // ── Time Ago ──
    timeAgo: (val) => {
        const now = Date.now();
        let then;
        if (typeof val === 'number') then = val;
        else then = new Date(val).getTime();
        const diff = Math.max(0, now - then);
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return 'Just now';
        if (mins < 60) return `${mins}m ago`;
        const hrs = Math.floor(mins / 60);
        if (hrs < 24) return `${hrs}h ago`;
        const days = Math.floor(hrs / 24);
        return `${days}d ago`;
    },

    // ── Escape HTML ──
    escapeHtml: (str) => {
        const div = document.createElement('div');
        div.appendChild(document.createTextNode(str));
        return div.innerHTML;
    }
};