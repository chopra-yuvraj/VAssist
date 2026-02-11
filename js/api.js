/* ============================================
   VAssist — Supabase API Service
   All database operations via Supabase JS SDK
   ============================================ */

// Initialize Supabase client (loaded from CDN in HTML)
let supabase;
try {
    supabase = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
    console.log('✅ Supabase connected');
} catch (e) {
    console.warn('⚠️ Supabase SDK not loaded — check your internet or config.js credentials', e);
}

const API = {
    // ── Create a new delivery request ──
    createRequest: async (data) => {
        const { data: row, error } = await supabase
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
        const { error } = await supabase
            .from('requests')
            .update({ status: 'ACCEPTED', partner_name: partnerName })
            .eq('id', id)
            .eq('status', 'PENDING');

        if (error) throw new Error(error.message);
        return { success: true };
    },

    // ── Verify OTP → mark as delivered ──
    verifyOTP: async (id, otp) => {
        const { data: row, error } = await supabase
            .from('requests')
            .select('otp')
            .eq('id', id)
            .single();

        if (error) return { ok: false, error: 'Request not found' };
        if (String(row.otp) !== String(otp)) return { ok: false, error: 'Invalid OTP' };

        const { error: updateErr } = await supabase
            .from('requests')
            .update({ status: 'DELIVERED' })
            .eq('id', id);

        if (updateErr) return { ok: false, error: updateErr.message };
        return { ok: true, success: true };
    },

    // ── Update request status ──
    updateStatus: async (id, status) => {
        const { error } = await supabase
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
            const { data } = await supabase
                .from('requests')
                .select('*')
                .eq('id', id)
                .single();
            if (data) callback(data);
        })();

        // Subscribe to realtime changes
        const channel = supabase
            .channel('req_' + id)
            .on('postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'requests', filter: `id=eq.${id}` },
                (payload) => callback(payload.new)
            )
            .subscribe();

        API._subscriptions['req_' + id] = channel;

        return () => {
            supabase.removeChannel(channel);
            delete API._subscriptions['req_' + id];
        };
    },

    // Listen for all pending requests (partner dashboard)
    onPendingRequests: (callback) => {
        API.stopListener('pending');

        // Fetch initial list
        (async () => {
            const { data } = await supabase
                .from('requests')
                .select('*')
                .eq('status', 'PENDING')
                .order('created_at', { ascending: false });
            callback(data || []);
        })();

        // Subscribe to realtime inserts and updates
        const channel = supabase
            .channel('pending_requests')
            .on('postgres_changes',
                { event: '*', schema: 'public', table: 'requests' },
                async () => {
                    // Re-fetch all pending on any change
                    const { data } = await supabase
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
            supabase.removeChannel(channel);
            delete API._subscriptions['pending'];
        };
    },

    stopListener: (name) => {
        if (API._subscriptions[name]) {
            supabase.removeChannel(API._subscriptions[name]);
            delete API._subscriptions[name];
        }
    },

    stopAllListeners: () => {
        Object.values(API._subscriptions).forEach(ch => supabase.removeChannel(ch));
        API._subscriptions = {};
    }
};
