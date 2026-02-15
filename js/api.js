/* ============================================
   VAssist v5.0 — Supabase API Service
   Social graph + friend-scoped delivery requests
   ============================================ */

const db = window.sb;
if (!db) console.error('🚨 Supabase client missing! Ensure supabase-init.js is loaded.');

const API = {

    // ══════════════════════════════════════════
    // 👤 PROFILES
    // ══════════════════════════════════════════

    getProfile: async (userId) => {
        const { data, error } = await db
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();
        if (error) { console.error('getProfile error:', error); return null; }
        return data;
    },

    updateProfile: async (userId, updates) => {
        const { data, error } = await db
            .from('profiles')
            .update(updates)
            .eq('id', userId)
            .select()
            .single();
        if (error) throw new Error(error.message);
        return data;
    },

    searchProfiles: async (query) => {
        if (!query || query.trim().length < 2) return [];
        const q = query.trim().toLowerCase();

        const { data, error } = await db
            .from('profiles')
            .select('id, username, full_name, avatar_url, trust_score')
            .or(`username.ilike.%${q}%,full_name.ilike.%${q}%`)
            .limit(20);

        if (error) { console.error('searchProfiles error:', error); return []; }
        return data || [];
    },

    // ══════════════════════════════════════════
    // 🤝 FRIENDSHIPS (Social Trust Graph)
    // ══════════════════════════════════════════

    sendFriendRequest: async (receiverId) => {
        const { data: { session } } = await db.auth.getSession();
        if (!session) throw new Error('Not authenticated');

        const { data, error } = await db
            .from('friendships')
            .insert([{
                requester_id: session.user.id,
                receiver_id: receiverId,
                status: 'PENDING'
            }])
            .select()
            .single();

        if (error) {
            if (error.code === '23505') throw new Error('Friend request already sent');
            throw new Error(error.message);
        }
        return data;
    },

    respondFriendRequest: async (friendshipId, accept) => {
        const { error } = await db
            .from('friendships')
            .update({ status: accept ? 'ACCEPTED' : 'REJECTED' })
            .eq('id', friendshipId);

        if (error) throw new Error(error.message);
        return { success: true };
    },

    removeFriend: async (friendshipId) => {
        const { error } = await db
            .from('friendships')
            .delete()
            .eq('id', friendshipId);

        if (error) throw new Error(error.message);
        return { success: true };
    },

    getFriends: async () => {
        const { data: { session } } = await db.auth.getSession();
        if (!session) return [];
        const uid = session.user.id;

        const { data, error } = await db
            .from('friendships')
            .select(`
                id,
                status,
                requester_id,
                receiver_id,
                created_at,
                requester:profiles!friendships_requester_id_fkey(id, username, full_name, avatar_url, trust_score),
                receiver:profiles!friendships_receiver_id_fkey(id, username, full_name, avatar_url, trust_score)
            `)
            .or(`requester_id.eq.${uid},receiver_id.eq.${uid}`)
            .order('created_at', { ascending: false });

        if (error) { console.error('getFriends error:', error); return []; }
        return (data || []).map(f => {
            const isRequester = f.requester_id === uid;
            return {
                friendshipId: f.id,
                status: f.status,
                direction: isRequester ? 'sent' : 'received',
                friend: isRequester ? f.receiver : f.requester,
                created_at: f.created_at
            };
        });
    },

    getAcceptedFriends: async () => {
        const all = await API.getFriends();
        return all.filter(f => f.status === 'ACCEPTED');
    },

    getPendingReceived: async () => {
        const all = await API.getFriends();
        return all.filter(f => f.status === 'PENDING' && f.direction === 'received');
    },

    // ══════════════════════════════════════════
    // 📦 DELIVERY REQUESTS
    // ══════════════════════════════════════════

    createRequest: async (data) => {
        const { data: { session } } = await db.auth.getSession();
        if (!session) throw new Error('You must be logged in to make a request.');

        const { data: row, error } = await db
            .from('requests')
            .insert([{
                id: data.id,
                user_id: session.user.id,
                item: data.item,
                courier_name: data.courier_name || null,
                external_tracking_id: data.external_tracking_id || null,
                weight_kg: data.weight_kg || 0.5,
                is_fragile: data.is_fragile || false,
                package_photo_url: data.package_photo_url || null,
                pickup: data.pickup,
                drop_location: data.drop_location,
                pickup_coords: data.pickup_coords || null,
                drop_coords: data.drop_coords || null,
                delivery_type: data.delivery_type || 'walker',
                fare: data.fare,
                otp: data.otp,
                broadcast_scope: data.broadcast_scope || 'all',
                status: 'PENDING'
            }])
            .select()
            .single();

        if (error) throw new Error(error.message);
        return { success: true, id: row.id };
    },

    // Get the carrier feed — RLS ensures only friend-scoped requests are returned
    getCarrierFeed: async () => {
        const { data: { session } } = await db.auth.getSession();
        if (!session) return [];

        const { data, error } = await db
            .from('requests')
            .select(`
                *,
                sender:profiles!requests_user_id_fkey(id, username, full_name, avatar_url, trust_score)
            `)
            .eq('status', 'PENDING')
            .neq('user_id', session.user.id)
            .order('created_at', { ascending: false });

        if (error) { console.error('getCarrierFeed error:', error); return []; }
        return data || [];
    },

    acceptRequest: async (id, partnerId, partnerName) => {
        const { error } = await db
            .from('requests')
            .update({
                status: 'ACCEPTED',
                partner_id: partnerId,
                partner_name: partnerName
            })
            .eq('id', id)
            .eq('status', 'PENDING');

        if (error) throw new Error(error.message);
        return { success: true };
    },

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

        // Increment trust scores for both sender and partner
        // (fire-and-forget, non-blocking)
        API._incrementTrust(id).catch(() => { });

        return { ok: true, success: true };
    },

    updateStatus: async (id, status) => {
        const { error } = await db
            .from('requests')
            .update({ status })
            .eq('id', id);

        if (error) return null;
        return { success: true };
    },

    getMyRequests: async () => {
        const { data: { session } } = await db.auth.getSession();
        if (!session) return [];

        const { data, error } = await db
            .from('requests')
            .select('*')
            .eq('user_id', session.user.id)
            .order('created_at', { ascending: false });

        if (error) { console.error('getMyRequests error:', error); return []; }
        return data || [];
    },

    // ══════════════════════════════════════════
    // 📡 REALTIME LISTENERS
    // ══════════════════════════════════════════

    _subscriptions: {},

    onRequestUpdate: (id, callback) => {
        API.stopListener('req_' + id);

        (async () => {
            const { data } = await db
                .from('requests')
                .select('*')
                .eq('id', id)
                .single();
            if (data) callback(data);
        })();

        const channel = db
            .channel('req_' + id)
            .on('postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'requests', filter: `id=eq.${id}` },
                (payload) => callback(payload.new)
            )
            .subscribe();

        API._subscriptions['req_' + id] = channel;
        return () => { db.removeChannel(channel); delete API._subscriptions['req_' + id]; };
    },

    onCarrierFeed: (callback) => {
        API.stopListener('carrier_feed');

        // Initial fetch
        API.getCarrierFeed().then(callback);

        // Subscribe to all request changes (re-fetch on any change)
        const channel = db
            .channel('carrier_feed')
            .on('postgres_changes',
                { event: '*', schema: 'public', table: 'requests' },
                async () => {
                    const data = await API.getCarrierFeed();
                    callback(data);
                }
            )
            .subscribe();

        API._subscriptions['carrier_feed'] = channel;
        return () => { db.removeChannel(channel); delete API._subscriptions['carrier_feed']; };
    },

    onFriendshipChanges: (callback) => {
        API.stopListener('friendships');

        // Initial fetch
        API.getFriends().then(callback);

        const channel = db
            .channel('friendships')
            .on('postgres_changes',
                { event: '*', schema: 'public', table: 'friendships' },
                async () => {
                    const data = await API.getFriends();
                    callback(data);
                }
            )
            .subscribe();

        API._subscriptions['friendships'] = channel;
        return () => { db.removeChannel(channel); delete API._subscriptions['friendships']; };
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
    },

    // ══════════════════════════════════════════
    // 🔧 INTERNAL HELPERS
    // ══════════════════════════════════════════

    _incrementTrust: async (requestId) => {
        try {
            const { data: req } = await db
                .from('requests')
                .select('user_id, partner_id')
                .eq('id', requestId)
                .single();

            if (!req) return;

            // Increment sender trust
            if (req.user_id) {
                const { data: sender } = await db.from('profiles').select('trust_score').eq('id', req.user_id).single();
                if (sender) await db.from('profiles').update({ trust_score: (sender.trust_score || 0) + 1 }).eq('id', req.user_id);
            }
            // Increment partner trust
            if (req.partner_id) {
                const { data: partner } = await db.from('profiles').select('trust_score').eq('id', req.partner_id).single();
                if (partner) await db.from('profiles').update({ trust_score: (partner.trust_score || 0) + 1 }).eq('id', req.partner_id);
            }
        } catch (e) {
            console.warn('Trust increment failed:', e);
        }
    },

    // Count mutual successful deliveries between two users
    getMutualDeliveryCount: async (friendId) => {
        const { data: { session } } = await db.auth.getSession();
        if (!session) return 0;
        const uid = session.user.id;

        try {
            // Count deliveries where one was sender and other was partner
            const { count: c1 } = await db
                .from('requests')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', uid)
                .eq('partner_id', friendId)
                .eq('status', 'DELIVERED');

            const { count: c2 } = await db
                .from('requests')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', friendId)
                .eq('partner_id', uid)
                .eq('status', 'DELIVERED');

            return (c1 || 0) + (c2 || 0);
        } catch {
            return 0;
        }
    }
};
