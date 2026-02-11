/* ============================================
   VAssist — Firebase Realtime DB API Service
   True real-time sync — no polling needed!
   ============================================ */

const API = {
    createRequest: async (data) => {
        try {
            await db.ref('requests/' + data.id).set({
                ...data,
                status: 'PENDING',
                created_at: firebase.database.ServerValue.TIMESTAMP,
                updated_at: firebase.database.ServerValue.TIMESTAMP
            });
            return { success: true, id: data.id };
        } catch (err) {
            console.error('API.createRequest error:', err);
            throw err;
        }
    },

    acceptRequest: async (id, partnerName) => {
        try {
            const snap = await db.ref('requests/' + id + '/status').once('value');
            if (snap.val() !== 'PENDING') throw new Error('Already accepted');
            await db.ref('requests/' + id).update({
                status: 'ACCEPTED',
                partner_name: partnerName,
                updated_at: firebase.database.ServerValue.TIMESTAMP
            });
            return { success: true };
        } catch (err) {
            console.error('API.acceptRequest error:', err);
            throw err;
        }
    },

    verifyOTP: async (id, otp) => {
        try {
            const snap = await db.ref('requests/' + id).once('value');
            const req = snap.val();
            if (!req) return { ok: false, error: 'Not found' };
            if (req.status === 'DELIVERED') return { ok: false, error: 'Already delivered' };
            if (String(req.otp) !== String(otp)) return { ok: false, success: false, error: 'Invalid OTP' };
            await db.ref('requests/' + id).update({
                status: 'DELIVERED',
                updated_at: firebase.database.ServerValue.TIMESTAMP
            });
            return { ok: true, success: true };
        } catch (err) {
            console.error('API.verifyOTP error:', err);
            return { ok: false, error: 'Network error' };
        }
    },

    updateStatus: async (id, status) => {
        try {
            await db.ref('requests/' + id).update({
                status,
                updated_at: firebase.database.ServerValue.TIMESTAMP
            });
            return { success: true };
        } catch (err) {
            console.error('API.updateStatus error:', err);
            return null;
        }
    },

    // ═══ REAL-TIME LISTENERS ═══
    _listeners: {},

    onRequestUpdate: (id, callback) => {
        API.stopListener('req_' + id);
        const ref = db.ref('requests/' + id);
        ref.on('value', snap => callback(snap.val()));
        API._listeners['req_' + id] = ref;
        return () => { ref.off(); delete API._listeners['req_' + id]; };
    },

    onPendingRequests: (callback) => {
        API.stopListener('pending');
        const ref = db.ref('requests').orderByChild('status').equalTo('PENDING');
        ref.on('value', snap => {
            const arr = [];
            snap.forEach(c => arr.push(c.val()));
            arr.sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
            callback(arr);
        });
        API._listeners['pending'] = ref;
        return () => { ref.off(); delete API._listeners['pending']; };
    },

    stopListener: (name) => {
        if (API._listeners[name]) { API._listeners[name].off(); delete API._listeners[name]; }
    },

    stopAllListeners: () => {
        Object.keys(API._listeners).forEach(n => { if (API._listeners[n]) API._listeners[n].off(); });
        API._listeners = {};
    }
};
