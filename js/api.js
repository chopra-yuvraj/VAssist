/* ============================================
   VAssist — Firestore API Service
   Real-time sync via onSnapshot listeners
   ============================================ */

const API = {
    // ── Create a new delivery request ──
    createRequest: async (data) => {
        try {
            await db.collection('requests').doc(data.id).set({
                ...data,
                status: 'PENDING',
                created_at: firebase.firestore.FieldValue.serverTimestamp(),
                updated_at: firebase.firestore.FieldValue.serverTimestamp()
            });
            return { success: true, id: data.id };
        } catch (err) {
            console.error('API.createRequest error:', err);
            throw err;
        }
    },

    // ── Accept a request (partner side) ──
    acceptRequest: async (id, partnerName) => {
        try {
            const doc = await db.collection('requests').doc(id).get();
            if (!doc.exists || doc.data().status !== 'PENDING') {
                throw new Error('Already accepted');
            }
            await db.collection('requests').doc(id).update({
                status: 'ACCEPTED',
                partner_name: partnerName,
                updated_at: firebase.firestore.FieldValue.serverTimestamp()
            });
            return { success: true };
        } catch (err) {
            console.error('API.acceptRequest error:', err);
            throw err;
        }
    },

    // ── Verify OTP → mark as delivered ──
    verifyOTP: async (id, otp) => {
        try {
            const doc = await db.collection('requests').doc(id).get();
            if (!doc.exists) return { ok: false, error: 'Not found' };
            const req = doc.data();
            if (req.status === 'DELIVERED') return { ok: false, error: 'Already delivered' };
            if (String(req.otp) !== String(otp)) return { ok: false, success: false, error: 'Invalid OTP' };
            await db.collection('requests').doc(id).update({
                status: 'DELIVERED',
                updated_at: firebase.firestore.FieldValue.serverTimestamp()
            });
            return { ok: true, success: true };
        } catch (err) {
            console.error('API.verifyOTP error:', err);
            return { ok: false, error: 'Network error' };
        }
    },

    // ── Update request status ──
    updateStatus: async (id, status) => {
        try {
            await db.collection('requests').doc(id).update({
                status,
                updated_at: firebase.firestore.FieldValue.serverTimestamp()
            });
            return { success: true };
        } catch (err) {
            console.error('API.updateStatus error:', err);
            return null;
        }
    },

    // ═══ REAL-TIME LISTENERS (Firestore onSnapshot) ═══
    _unsubs: {},

    // Listen for a specific request (user tracking their order)
    onRequestUpdate: (id, callback) => {
        API.stopListener('req_' + id);
        const unsub = db.collection('requests').doc(id).onSnapshot((doc) => {
            callback(doc.exists ? { id: doc.id, ...doc.data() } : null);
        });
        API._unsubs['req_' + id] = unsub;
        return () => { unsub(); delete API._unsubs['req_' + id]; };
    },

    // Listen for all pending requests (partner dashboard)
    onPendingRequests: (callback) => {
        API.stopListener('pending');
        const unsub = db.collection('requests')
            .where('status', '==', 'PENDING')
            .orderBy('created_at', 'desc')
            .onSnapshot((snapshot) => {
                const requests = [];
                snapshot.forEach(doc => requests.push({ id: doc.id, ...doc.data() }));
                callback(requests);
            });
        API._unsubs['pending'] = unsub;
        return () => { unsub(); delete API._unsubs['pending']; };
    },

    stopListener: (name) => {
        if (API._unsubs[name]) { API._unsubs[name](); delete API._unsubs[name]; }
    },

    stopAllListeners: () => {
        Object.values(API._unsubs).forEach(unsub => unsub());
        API._unsubs = {};
    }
};
