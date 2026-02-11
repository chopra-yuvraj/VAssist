/* ============================================
   VAssist — Client API Service
   Communicates with Netlify Functions backend
   Enables multi-device real-time sync via polling
   ============================================ */

const API = {
    // ── Create a new delivery request ──
    createRequest: async (data) => {
        try {
            const res = await fetch('/api/create-request', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            const result = await res.json();
            if (!res.ok) throw new Error(result.error || 'Failed to create request');
            return result;
        } catch (err) {
            console.error('API.createRequest error:', err);
            throw err;
        }
    },

    // ── Get all pending requests (for partner mode) ──
    getRequests: async (status = 'PENDING') => {
        try {
            const res = await fetch(`/api/get-requests?status=${status}`);
            const result = await res.json();
            if (!res.ok) throw new Error(result.error || 'Failed to get requests');
            return result;
        } catch (err) {
            console.error('API.getRequests error:', err);
            return [];
        }
    },

    // ── Get a specific request by ID (for user tracking) ──
    getMyRequest: async (id) => {
        try {
            const res = await fetch(`/api/get-requests?id=${id}`);
            if (!res.ok) return null;
            return await res.json();
        } catch (err) {
            console.error('API.getMyRequest error:', err);
            return null;
        }
    },

    // ── Accept a request (partner side) ──
    acceptRequest: async (id, partnerName) => {
        try {
            const res = await fetch('/api/accept-request', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, partner_name: partnerName })
            });
            const result = await res.json();
            if (!res.ok) throw new Error(result.error || 'Failed to accept');
            return result;
        } catch (err) {
            console.error('API.acceptRequest error:', err);
            throw err;
        }
    },

    // ── Verify OTP (partner side → delivery confirmation) ──
    verifyOTP: async (id, otp) => {
        try {
            const res = await fetch('/api/verify-otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, otp: String(otp) })
            });
            const result = await res.json();
            return { ok: res.ok, ...result };
        } catch (err) {
            console.error('API.verifyOTP error:', err);
            return { ok: false, error: 'Network error' };
        }
    },

    // ── Update request status ──
    updateStatus: async (id, status) => {
        try {
            const res = await fetch('/api/update-status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, status })
            });
            return await res.json();
        } catch (err) {
            console.error('API.updateStatus error:', err);
            return null;
        }
    },

    // ── Polling Engine ──
    _pollers: {},

    startPolling: (name, fetchFn, callback, interval) => {
        API.stopPolling(name); // Clear existing

        const poll = async () => {
            try {
                const data = await fetchFn();
                callback(data);
            } catch (err) {
                console.warn(`Polling [${name}] error:`, err);
            }
        };

        // Run immediately first, then on interval
        poll();
        API._pollers[name] = setInterval(poll, interval || CONFIG.POLLING_INTERVAL);
    },

    stopPolling: (name) => {
        if (API._pollers[name]) {
            clearInterval(API._pollers[name]);
            delete API._pollers[name];
        }
    },

    stopAllPolling: () => {
        Object.keys(API._pollers).forEach(name => API.stopPolling(name));
    }
};
