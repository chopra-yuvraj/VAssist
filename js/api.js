/* ============================================
   VAssist — Supabase API Service
   All database operations via Supabase JS SDK
   ============================================ */

// Initialize Supabase client (loaded from js/supabase-init.js)
const db = window.sb;

if (!db) {
    console.error('🚨 Supabase client missing! Ensure supabase-init.js is loaded.');
}

const API = {
    // ── Create a new delivery request ──
    createRequest: async (data) => {
        // Ensure user is authenticated for RLS
        const { data: { session } } = await db.auth.getSession();
        if (!session) throw new Error("You must be logged in to make a request.");

        const { data: row, error } = await db
            .from('requests')
            .insert([{
                id: data.id,
                item: data.item,
                pickup: data.pickup,
                drop_location: data.drop_location,
                pickup_coords: data.pickup_coords,
                drop_coords: data.drop_coords,
                delivery_type: data.delivery_type,
                fare: data.fare,
                otp: data.otp,
                status: 'PENDING',
                user_id: data.user_id || null
            }])
            .select()
            .single();

        if (error) throw new Error(error.message);
        return { success: true, id: row.id };
    },

    // ── Accept a request (partner side) ──
    acceptRequest: async (id, partnerName) => {
        const { error } = await db
            .from('requests')
            .update({ status: 'ACCEPTED', partner_name: partnerName })
            .eq('id', id)
            .eq('status', 'PENDING');

        if (error) throw new Error(error.message);
        return { success: true };
    },

    // ── Verify OTP → mark as delivered ──
    verifyOTP: async (id, otp) => {
        const { data: row, error } = await db
            .from('requests')
            .select('otp')
            .eq('id', id)
            .single();

        if (error) return { ok: false, error: 'Request not found' };
        if (String(row.otp) !== String(otp)) return { ok: false, error: 'Invalid OTP' };

        const { error: updateErr } = await db
            .from('requests')
            .update({ status: 'DELIVERED' })
            .eq('id', id);

        if (updateErr) return { ok: false, error: updateErr.message };
        return { ok: true, success: true };
    },

    // ── Update request status ──
    updateStatus: async (id, status) => {
        const { error } = await db
            .from('requests')
            .update({ status })
            .eq('id', id);

        if (error) return null;
        return { success: true };
    },

    // ═══ REALTIME LISTENERS (Supabase Realtime) ═══
    _subscriptions: {},

    // Listen for updates on a specific request (user tracking their order)
    onRequestUpdate: (id, callback) => {
        API.stopListener('req_' + id);

        // Fetch initial state
        (async () => {
            const { data } = await db
                .from('requests')
                .select('*')
                .eq('id', id)
                .single();
            if (data) callback(data);
        })();

        // Subscribe to realtime changes
        const channel = db
            .channel('req_' + id)
            .on('postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'requests', filter: `id=eq.${id}` },
                (payload) => callback(payload.new)
            )
            .subscribe();

        API._subscriptions['req_' + id] = channel;

        return () => {
            db.removeChannel(channel);
            delete API._subscriptions['req_' + id];
        };
    },

    // Listen for all pending requests (partner dashboard)
    onPendingRequests: (callback) => {
        API.stopListener('pending');

        // Fetch initial list
        (async () => {
            const { data } = await db
                .from('requests')
                .select('*')
                .eq('status', 'PENDING')
                .order('created_at', { ascending: false });
            callback(data || []);
        })();

        // Subscribe to realtime inserts and updates
        const channel = db
            .channel('pending_requests')
            .on('postgres_changes',
                { event: '*', schema: 'public', table: 'requests' },
                async () => {
                    // Re-fetch all pending on any change
                    const { data } = await db
                        .from('requests')
                        .select('*')
                        .eq('status', 'PENDING')
                        .order('created_at', { ascending: false });
                    callback(data || []);
                }
            )
            .subscribe();

        API._subscriptions['pending'] = channel;

        return () => {
            db.removeChannel(channel);
            delete API._subscriptions['pending'];
        };
    },

    stopListener: (name) => {
        if (API._subscriptions[name]) {
            db.removeChannel(API._subscriptions[name]);
            delete API._subscriptions[name];
        }
    },

    stopAllListeners: () => {
        Object.values(API._subscriptions).forEach(ch => db.removeChannel(ch));
        API._subscriptions = {};
    }
};
