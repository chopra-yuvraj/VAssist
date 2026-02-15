/* ============================================
   VAssist v5.0 — Core App Controller
   Dashboard, Sender Wizard, Carrier Feed, Tracking
   ============================================ */

(function () {
    'use strict';

    // ══════════════════════════════════════════
    // STATE
    // ══════════════════════════════════════════
    const STATE = {
        currentView: 'dashboard',
        wizardStep: 1,
        sender: {
            item: '', courier_name: '', external_tracking_id: '',
            weight_kg: 1, is_fragile: false, package_photo_url: '',
            pickup: '', drop_location: '',
            pickup_coords: null, drop_coords: null,
            delivery_type: 'walker', fare: '0',
            broadcast_scope: 'all'
        },
        activeRequestId: null,
        map: null,
        routeData: null,
        carrierFeedUnsub: null,
        trackingUnsub: null,
        friendshipsUnsub: null,
        friends: [],
        pendingReceived: []
    };

    // ══════════════════════════════════════════
    // VIEW MANAGEMENT
    // ══════════════════════════════════════════
    function showView(name) {
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        const view = document.getElementById(name + '-view');
        if (view) {
            view.classList.add('active');
            STATE.currentView = name;
        }
    }

    // ══════════════════════════════════════════
    // SPLASH SCREEN
    // ══════════════════════════════════════════
    function hideSplash() {
        const splash = document.getElementById('splash-screen');
        if (!splash) return;
        setTimeout(() => {
            splash.classList.add('fade-out');
            setTimeout(() => splash.remove(), 500);
        }, 1400);
    }

    // ══════════════════════════════════════════
    // DASHBOARD
    // ══════════════════════════════════════════
    async function initDashboard() {
        const user = VAssistAuth.getUser();
        const greetEl = document.getElementById('greeting-text');
        if (greetEl && user) {
            const hr = new Date().getHours();
            const greeting = hr < 12 ? 'Good morning' : hr < 17 ? 'Good afternoon' : 'Good evening';
            greetEl.textContent = `${greeting}, ${user.name || user.username || 'friend'}`;
        }

        // Load stats
        try {
            const [friends, requests] = await Promise.all([
                API.getAcceptedFriends(),
                API.getMyRequests()
            ]);

            STATE.friends = friends;

            const trustEl = document.getElementById('stat-trust');
            const friendsEl = document.getElementById('stat-friends');
            const deliveriesEl = document.getElementById('stat-deliveries');

            if (trustEl) Utils.animateNumber(trustEl, user?.trust_score || 0);
            if (friendsEl) Utils.animateNumber(friendsEl, friends.length);
            if (deliveriesEl) Utils.animateNumber(deliveriesEl, requests.filter(r => r.status === 'DELIVERED').length);
        } catch (e) {
            console.warn('Dashboard stats failed:', e);
        }

        // Check for active request
        const activeId = localStorage.getItem(CONFIG.KEYS.ACTIVE_REQ);
        if (activeId) {
            openTracking(activeId);
        }
    }

    // ══════════════════════════════════════════
    // SENDER WIZARD
    // ══════════════════════════════════════════
    function openSenderWizard() {
        showView('sender');
        goToWizardStep(1);
        resetSenderState();
    }

    function resetSenderState() {
        STATE.sender = {
            item: '', courier_name: '', external_tracking_id: '',
            weight_kg: 1, is_fragile: false, package_photo_url: '',
            pickup: '', drop_location: '',
            pickup_coords: null, drop_coords: null,
            delivery_type: 'walker', fare: '0',
            broadcast_scope: 'all'
        };
        STATE.routeData = null;

        // Reset form inputs
        const fields = [
            'sender-item', 'sender-courier', 'sender-tracking',
            'sender-photo', 'sender-pickup', 'sender-drop'
        ];
        fields.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });

        const weightEl = document.getElementById('sender-weight');
        if (weightEl) weightEl.value = 1;
        const fragileEl = document.getElementById('sender-fragile');
        if (fragileEl) fragileEl.checked = false;
        const weightDisplay = document.getElementById('weight-value');
        if (weightDisplay) weightDisplay.textContent = '1.0';
    }

    function goToWizardStep(step) {
        STATE.wizardStep = step;

        // Update step indicators
        document.querySelectorAll('.wizard-step').forEach(s => {
            const n = parseInt(s.dataset.step);
            s.classList.toggle('active', n === step);
            s.classList.toggle('completed', n < step);
        });

        // Show correct panel
        document.querySelectorAll('.wizard-panel').forEach(p => p.classList.remove('active'));
        const panel = document.getElementById('wizard-step-' + step);
        if (panel) panel.classList.add('active');

        // Step-specific init
        if (step === 3) initSenderMap();
        if (step === 4) updateShippingLabel();
    }

    function validateWizardStep(step) {
        switch (step) {
            case 1: {
                const item = document.getElementById('sender-item').value.trim();
                if (!item) {
                    Utils.showToast('⚠️ Please enter an item description');
                    return false;
                }
                STATE.sender.item = item;
                STATE.sender.courier_name = document.getElementById('sender-courier').value.trim();
                STATE.sender.external_tracking_id = document.getElementById('sender-tracking').value.trim();
                return true;
            }
            case 2: {
                STATE.sender.weight_kg = parseFloat(document.getElementById('sender-weight').value);
                STATE.sender.is_fragile = document.getElementById('sender-fragile').checked;
                STATE.sender.package_photo_url = document.getElementById('sender-photo').value.trim();
                return true;
            }
            case 3: {
                if (!STATE.sender.pickup_coords || !STATE.sender.drop_coords) {
                    Utils.showToast('⚠️ Set both pickup and drop locations');
                    return false;
                }
                return true;
            }
            default: return true;
        }
    }

    // ── Sender Map ──
    function initSenderMap() {
        if (!STATE.map) {
            STATE.map = new MapService('sender-map');
            STATE.map.init();

            STATE.map.onLocationSelect = async (type, lat, lng) => {
                try {
                    const name = await reverseGeocode(lat, lng);
                    if (type === 'pickup') {
                        STATE.sender.pickup = name;
                        STATE.sender.pickup_coords = { lat, lng };
                        document.getElementById('sender-pickup').value = name;
                        // Now expect drop
                        STATE.map.setClickMode('drop');
                    } else {
                        STATE.sender.drop_location = name;
                        STATE.sender.drop_coords = { lat, lng };
                        document.getElementById('sender-drop').value = name;
                        STATE.map.setClickMode(null);
                    }

                    // If both set, draw route + show fare
                    if (STATE.sender.pickup_coords && STATE.sender.drop_coords) {
                        await calculateRoute();
                    }
                } catch (e) {
                    console.error('Location select error:', e);
                }
            };

            STATE.map.setClickMode('pickup');
        } else {
            STATE.map.refresh();
            STATE.map.setClickMode('pickup');
        }

        // Try locating user
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    const lat = pos.coords.latitude;
                    const lng = pos.coords.longitude;
                    STATE.map.flyTo(lat, lng);
                    STATE.map.addMarker('user', lat, lng);
                },
                () => { /* use default */ },
                { enableHighAccuracy: true, timeout: 8000 }
            );
        }
    }

    async function reverseGeocode(lat, lng) {
        try {
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`);
            const data = await res.json();
            if (data.display_name) {
                const parts = data.display_name.split(',');
                return parts.slice(0, 3).join(', ').trim();
            }
        } catch (e) { /* fallback */ }
        return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    }

    async function calculateRoute() {
        const { pickup_coords, drop_coords } = STATE.sender;
        if (!pickup_coords || !drop_coords) return;

        const routeData = await STATE.map.drawRoute(pickup_coords, drop_coords);
        STATE.routeData = routeData;

        if (routeData) {
            const fareWalker = Pricing.estimate(routeData.dist, 'walker', STATE.sender.weight_kg);
            const fareCyclist = Pricing.estimate(routeData.dist, 'cyclist', STATE.sender.weight_kg);

            document.getElementById('fare-walker').textContent = fareWalker;
            document.getElementById('fare-cyclist').textContent = fareCyclist;
            document.getElementById('fare-preview').style.display = '';
            document.getElementById('delivery-type-picker').style.display = '';

            STATE.sender.fare = STATE.sender.delivery_type === 'cyclist' ? String(fareCyclist) : String(fareWalker);

            document.getElementById('wizard-next-3').disabled = false;
        }
    }

    // ── Shipping Label Preview ──
    function updateShippingLabel() {
        const s = STATE.sender;
        document.getElementById('label-item').textContent = s.item || '—';
        document.getElementById('label-courier').textContent = s.courier_name || '—';
        document.getElementById('label-tracking').textContent = s.external_tracking_id || '—';
        document.getElementById('label-weight').textContent = s.weight_kg + ' kg';
        document.getElementById('label-fragile').textContent = s.is_fragile ? '⚠️ Yes' : 'No';
        document.getElementById('label-pickup').textContent = s.pickup || '—';
        document.getElementById('label-drop').textContent = s.drop_location || '—';
        document.getElementById('label-fare').textContent = '₹' + s.fare;
        document.getElementById('label-type').textContent = s.delivery_type.toUpperCase();
    }

    // ── Submit Request ──
    async function submitRequest() {
        const s = STATE.sender;
        const btn = document.getElementById('sender-confirm');
        btn.disabled = true;
        btn.textContent = 'Broadcasting...';

        try {
            const id = Utils.generateId();
            const otp = Utils.generateOTP();

            const result = await API.createRequest({
                id, otp,
                item: s.item,
                courier_name: s.courier_name,
                external_tracking_id: s.external_tracking_id,
                weight_kg: s.weight_kg,
                is_fragile: s.is_fragile,
                package_photo_url: s.package_photo_url,
                pickup: s.pickup,
                drop_location: s.drop_location,
                pickup_coords: s.pickup_coords,
                drop_coords: s.drop_coords,
                delivery_type: s.delivery_type,
                fare: s.fare,
                broadcast_scope: s.broadcast_scope
            });

            if (result && result.success) {
                Utils.showToast('✅ Request broadcasted to your trusted circle!');
                Utils.vibrate([50, 30, 50]);
                localStorage.setItem(CONFIG.KEYS.ACTIVE_REQ, id);
                STATE.activeRequestId = id;

                setTimeout(() => openTracking(id, otp), 600);
            }
        } catch (err) {
            Utils.showToast('⚠️ ' + err.message);
            btn.disabled = false;
            btn.textContent = '🚀 Broadcast Request';
        }
    }

    // ══════════════════════════════════════════
    // TRACKING VIEW
    // ══════════════════════════════════════════
    function openTracking(requestId, otp) {
        showView('tracking');
        STATE.activeRequestId = requestId;

        // Reset tracking UI
        const assignedInfo = document.getElementById('assigned-info');
        const timeline = document.getElementById('delivery-timeline');
        const radarSection = document.getElementById('radar-section');

        if (assignedInfo) assignedInfo.classList.add('hidden');
        if (timeline) timeline.classList.add('hidden');
        if (radarSection) radarSection.classList.remove('hidden');

        if (otp) {
            const otpDisplay = document.getElementById('otp-display');
            if (otpDisplay) otpDisplay.textContent = otp;
        }

        // Listen for status changes
        if (STATE.trackingUnsub) STATE.trackingUnsub();

        STATE.trackingUnsub = API.onRequestUpdate(requestId, (req) => {
            updateTrackingUI(req);
        });
    }

    function updateTrackingUI(req) {
        const assignedInfo = document.getElementById('assigned-info');
        const timeline = document.getElementById('delivery-timeline');
        const radarSection = document.getElementById('radar-section');
        const trackStatus = document.getElementById('track-status');

        if (req.otp) {
            const otpDisplay = document.getElementById('otp-display');
            if (otpDisplay) otpDisplay.textContent = req.otp;
        }

        switch (req.status) {
            case 'PENDING':
                if (trackStatus) trackStatus.textContent = 'Broadcasting to your trusted circle...';
                break;

            case 'ACCEPTED':
                if (radarSection) radarSection.classList.add('hidden');
                if (assignedInfo) assignedInfo.classList.remove('hidden');
                if (timeline) timeline.classList.remove('hidden');

                document.getElementById('ast-name').textContent = req.partner_name || 'Friend';
                document.getElementById('ast-status').textContent = 'Heading to pickup';

                // Update timeline
                setTimelineStep(1);
                break;

            case 'PICKED_UP':
                document.getElementById('ast-status').textContent = 'Package collected, delivering...';
                setTimelineStep(2);
                break;

            case 'DELIVERING':
                document.getElementById('ast-status').textContent = 'On the way to you!';
                setTimelineStep(3);
                break;

            case 'DELIVERED':
                document.getElementById('ast-status').textContent = '✅ Delivered!';
                setTimelineStep(4);
                localStorage.removeItem(CONFIG.KEYS.ACTIVE_REQ);
                Utils.launchConfetti(50);
                Utils.vibrate([100, 50, 100, 50, 200]);
                Utils.showToast('🎉 Package delivered successfully!');
                break;

            case 'CANCELLED':
                if (trackStatus) trackStatus.textContent = 'Request was cancelled.';
                localStorage.removeItem(CONFIG.KEYS.ACTIVE_REQ);
                break;
        }
    }

    function setTimelineStep(n) {
        for (let i = 1; i <= 4; i++) {
            const step = document.getElementById('step-' + i);
            if (!step) continue;
            step.classList.remove('active', 'completed');
            if (i < n) step.classList.add('completed');
            else if (i === n) step.classList.add('active');
        }
    }

    // ══════════════════════════════════════════
    // CARRIER FEED
    // ══════════════════════════════════════════
    function openCarrierFeed() {
        showView('carrier');

        if (STATE.carrierFeedUnsub) STATE.carrierFeedUnsub();

        STATE.carrierFeedUnsub = API.onCarrierFeed((requests) => {
            renderCarrierFeed(requests);
        });
    }

    function renderCarrierFeed(requests) {
        const container = document.getElementById('carrier-feed');
        if (!container) return;

        if (!requests || requests.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <span class="empty-icon">📭</span>
                    <p>No requests from friends yet.</p>
                    <small>When friends broadcast delivery requests, they'll appear here.</small>
                </div>`;
            return;
        }

        container.innerHTML = requests.map(req => {
            const sender = req.sender || {};
            const name = Utils.escapeHtml(sender.full_name || sender.username || 'A friend');
            const weight = req.weight_kg || 0.5;
            const item = Utils.escapeHtml(req.item || 'Package');
            const fragile = req.is_fragile ? '<span class="fragile-badge">⚠️ Fragile</span>' : '';
            const tracking = req.external_tracking_id
                ? `<div class="feed-tracking">Tracking: <code>${Utils.escapeHtml(req.external_tracking_id)}</code></div>`
                : '';
            const time = Utils.timeAgo(req.created_at);
            const trust = sender.trust_score || 0;

            return `
                <div class="feed-card" data-id="${req.id}">
                    <div class="feed-sender">
                        <div class="feed-avatar">${(name.charAt(0) || '?').toUpperCase()}</div>
                        <div class="feed-sender-info">
                            <strong>${name}</strong>
                            <span class="trust-chip">🛡️ ${trust}</span>
                        </div>
                        <span class="feed-time">${time}</span>
                    </div>
                    <div class="feed-body">
                        <p>Needs a <strong>${weight}kg</strong> package picked up ${fragile}</p>
                        <p class="feed-item">"${item}"</p>
                        ${tracking}
                    </div>
                    <div class="feed-locations">
                        <span><span class="dot green"></span> ${Utils.escapeHtml(req.pickup || '?')}</span>
                        <span class="feed-arrow">→</span>
                        <span><span class="dot red"></span> ${Utils.escapeHtml(req.drop_location || '?')}</span>
                    </div>
                    <div class="feed-footer">
                        <span class="feed-fare">₹${req.fare || '--'}</span>
                        <button class="accept-btn" data-id="${req.id}">Accept Delivery →</button>
                    </div>
                </div>`;
        }).join('');

        // Bind accept buttons
        container.querySelectorAll('.accept-btn').forEach(btn => {
            btn.addEventListener('click', () => acceptDelivery(btn.dataset.id));
        });
    }

    async function acceptDelivery(requestId) {
        const user = VAssistAuth.getUser();
        if (!user) return;

        try {
            await API.acceptRequest(requestId, user.uid, user.name || user.username);
            Utils.showToast('✅ You accepted the delivery!');
            Utils.vibrate(50);

            // Go to carrier active view
            openCarrierActive(requestId);
        } catch (e) {
            Utils.showToast('⚠️ ' + e.message);
        }
    }

    // ══════════════════════════════════════════
    // CARRIER ACTIVE ORDER
    // ══════════════════════════════════════════
    function openCarrierActive(requestId) {
        showView('carrier-active');

        const container = document.getElementById('carrier-active-content');
        container.innerHTML = `
            <div class="loading-state"><p>Loading order details...</p></div>
        `;

        // Listen for the order
        if (STATE.trackingUnsub) STATE.trackingUnsub();

        STATE.trackingUnsub = API.onRequestUpdate(requestId, (req) => {
            renderCarrierActiveUI(req, container);
        });
    }

    function renderCarrierActiveUI(req, container) {
        if (!container) return;

        const statusActions = {
            ACCEPTED: {
                label: 'I\'ve Picked Up the Package',
                nextStatus: 'PICKED_UP',
                icon: '📦'
            },
            PICKED_UP: {
                label: 'I\'m on My Way to Deliver',
                nextStatus: 'DELIVERING',
                icon: '🚶'
            },
            DELIVERING: {
                label: 'Enter OTP to Complete',
                action: 'otp',
                icon: '🔐'
            },
            DELIVERED: {
                label: 'Delivery Complete!',
                done: true,
                icon: '✅'
            }
        };

        const s = statusActions[req.status] || {};

        container.innerHTML = `
            <div class="shipping-label">
                <div class="label-header">
                    <span class="label-logo">🛡️ VAssist</span>
                    <span class="label-badge">${req.delivery_type?.toUpperCase() || 'WALKER'}</span>
                </div>
                <div class="label-body">
                    <div class="label-row"><small>ITEM</small><span>${Utils.escapeHtml(req.item || '—')}</span></div>
                    <div class="label-row"><small>COURIER</small><span>${Utils.escapeHtml(req.courier_name || '—')}</span></div>
                    <div class="label-row highlight"><small>TRACKING ID</small><span class="tracking-code">${Utils.escapeHtml(req.external_tracking_id || '—')}</span></div>
                    <div class="label-meta">
                        <div><small>WEIGHT</small><span>${req.weight_kg || '—'} kg</span></div>
                        <div><small>FRAGILE</small><span>${req.is_fragile ? '⚠️ Yes' : 'No'}</span></div>
                        <div><small>FARE</small><span>₹${req.fare || '--'}</span></div>
                    </div>
                    <div class="label-locations">
                        <div class="label-loc"><span class="dot green"></span><span>${Utils.escapeHtml(req.pickup || '—')}</span></div>
                        <div class="label-arrow">↓</div>
                        <div class="label-loc"><span class="dot red"></span><span>${Utils.escapeHtml(req.drop_location || '—')}</span></div>
                    </div>
                </div>
            </div>

            <div class="carrier-status-bar">
                <span class="status-icon">${s.icon || '📦'}</span>
                <span class="status-label">${req.status}</span>
            </div>

            ${s.done ? '<div class="delivery-complete"><p>🎉 Delivery completed successfully!</p></div>' :
                s.action === 'otp' ?
                    `<button class="primary-btn" id="carrier-otp-btn">🔐 Enter OTP to Complete</button>` :
                    `<button class="primary-btn" id="carrier-advance-btn">${s.label || 'Next'}</button>`
            }
        `;

        // Bind action
        const advanceBtn = document.getElementById('carrier-advance-btn');
        if (advanceBtn && s.nextStatus) {
            advanceBtn.addEventListener('click', async () => {
                advanceBtn.disabled = true;
                await API.updateStatus(req.id, s.nextStatus);
                Utils.vibrate(50);
            });
        }

        const otpBtn = document.getElementById('carrier-otp-btn');
        if (otpBtn) {
            otpBtn.addEventListener('click', () => {
                openOTPModal(req.id);
            });
        }

        if (s.done) {
            Utils.launchConfetti(40);
        }
    }

    // ══════════════════════════════════════════
    // OTP MODAL
    // ══════════════════════════════════════════
    function openOTPModal(requestId) {
        const modal = document.getElementById('otp-modal');
        if (!modal) return;
        modal.classList.add('active');

        const digits = modal.querySelectorAll('.otp-digit');
        digits.forEach(d => { d.value = ''; });
        digits[0].focus();

        const errorEl = document.getElementById('otp-error');
        if (errorEl) errorEl.textContent = '';

        // OTP input auto-advance
        digits.forEach((input, idx) => {
            input.oninput = () => {
                input.value = input.value.replace(/[^0-9]/g, '');
                if (input.value && idx < digits.length - 1) {
                    digits[idx + 1].focus();
                }
            };
            input.onkeydown = (e) => {
                if (e.key === 'Backspace' && !input.value && idx > 0) {
                    digits[idx - 1].focus();
                }
            };
        });

        // Verify button
        const verifyBtn = document.getElementById('otp-verify-btn');
        verifyBtn.onclick = async () => {
            const otp = Array.from(digits).map(d => d.value).join('');
            if (otp.length !== 4) {
                if (errorEl) errorEl.textContent = 'Enter all 4 digits';
                return;
            }

            verifyBtn.disabled = true;
            verifyBtn.textContent = 'Verifying...';

            const result = await API.verifyOTP(requestId, otp);

            if (result.ok) {
                Utils.showToast('✅ OTP Verified! Delivery complete!');
                Utils.launchConfetti(60);
                Utils.vibrate([100, 50, 100, 50, 200]);
                modal.classList.remove('active');
            } else {
                if (errorEl) errorEl.textContent = result.error || 'Invalid OTP';
                verifyBtn.disabled = false;
                verifyBtn.textContent = 'Verify OTP →';
                Utils.vibrate([50, 30, 50]);
            }
        };
    }

    function closeOTPModal() {
        const modal = document.getElementById('otp-modal');
        if (modal) modal.classList.remove('active');
    }

    // ══════════════════════════════════════════
    // MY REQUESTS (HISTORY)
    // ══════════════════════════════════════════
    async function openHistory() {
        showView('history');
        const container = document.getElementById('history-list');
        container.innerHTML = '<div class="loading-state"><p>Loading...</p></div>';

        try {
            const requests = await API.getMyRequests();
            if (!requests.length) {
                container.innerHTML = `
                    <div class="empty-state">
                        <span class="empty-icon">📋</span>
                        <p>No requests yet.</p>
                        <small>Your delivery requests will appear here.</small>
                    </div>`;
                return;
            }

            container.innerHTML = requests.map(req => {
                const statusColors = {
                    PENDING: '#ECA526', ACCEPTED: '#6566C9', PICKED_UP: '#2ED573',
                    DELIVERING: '#18DCFF', DELIVERED: '#2ED573', CANCELLED: '#ff6b6b'
                };
                const color = statusColors[req.status] || '#999';

                return `
                    <div class="history-card" data-id="${req.id}">
                        <div class="history-top">
                            <span class="history-item">${Utils.escapeHtml(req.item)}</span>
                            <span class="status-pill" style="background:${color}20;color:${color};border:1px solid ${color}40;">${req.status}</span>
                        </div>
                        <div class="history-meta">
                            <span>${Utils.timeAgo(req.created_at)}</span>
                            <span>₹${req.fare || '--'}</span>
                            <span>${req.weight_kg || '?'}kg</span>
                        </div>
                        ${req.status === 'PENDING' || req.status === 'ACCEPTED' || req.status === 'PICKED_UP' || req.status === 'DELIVERING'
                        ? `<button class="secondary-btn small track-btn" data-id="${req.id}">Track →</button>`
                        : ''}
                    </div>`;
            }).join('');

            // Bind track buttons
            container.querySelectorAll('.track-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    openTracking(btn.dataset.id);
                });
            });
        } catch (e) {
            container.innerHTML = `<div class="empty-state"><p>Error loading history.</p></div>`;
        }
    }

    // ══════════════════════════════════════════
    // FRIENDS MODAL (TRUSTED CIRCLE)
    // ══════════════════════════════════════════
    function openFriendsModal() {
        const modal = document.getElementById('friends-modal');
        if (modal) modal.classList.add('active');
        loadFriendsData();
    }

    function closeFriendsModal() {
        const modal = document.getElementById('friends-modal');
        if (modal) modal.classList.remove('active');
    }

    async function loadFriendsData() {
        try {
            const all = await API.getFriends();

            const accepted = all.filter(f => f.status === 'ACCEPTED');
            const pending = all.filter(f => f.status === 'PENDING' && f.direction === 'received');
            const sent = all.filter(f => f.status === 'PENDING' && f.direction === 'sent');

            STATE.friends = accepted;
            STATE.pendingReceived = pending;

            renderFriendsList(accepted);
            renderPendingList(pending, sent);

            const badge = document.getElementById('pending-count');
            if (badge) {
                badge.textContent = pending.length;
                badge.style.display = pending.length > 0 ? '' : 'none';
            }
        } catch (e) {
            console.error('loadFriends error:', e);
        }
    }

    function renderFriendsList(friends) {
        const container = document.getElementById('friends-list');
        if (!container) return;

        if (!friends.length) {
            container.innerHTML = '<div class="empty-state small"><p>No friends yet. Start by searching!</p></div>';
            return;
        }

        container.innerHTML = friends.map(f => `
            <div class="friend-row">
                <div class="friend-avatar">${(f.friend.full_name || f.friend.username || '?').charAt(0).toUpperCase()}</div>
                <div class="friend-info">
                    <strong>${Utils.escapeHtml(f.friend.full_name || f.friend.username)}</strong>
                    <small>@${Utils.escapeHtml(f.friend.username)} · 🛡️ ${f.friend.trust_score || 0}</small>
                </div>
                <button class="icon-btn danger" title="Remove" data-fid="${f.friendshipId}">✕</button>
            </div>
        `).join('');

        container.querySelectorAll('.icon-btn.danger').forEach(btn => {
            btn.addEventListener('click', async () => {
                if (confirm('Remove this friend?')) {
                    await API.removeFriend(btn.dataset.fid);
                    Utils.showToast('Friend removed');
                    loadFriendsData();
                }
            });
        });
    }

    function renderPendingList(received, sent) {
        const container = document.getElementById('pending-list');
        if (!container) return;

        if (!received.length && !sent.length) {
            container.innerHTML = '<div class="empty-state small"><p>No pending requests.</p></div>';
            return;
        }

        let html = '';

        if (received.length) {
            html += '<h4 class="section-label">Incoming</h4>';
            html += received.map(f => `
                <div class="friend-row">
                    <div class="friend-avatar">${(f.friend.full_name || f.friend.username || '?').charAt(0).toUpperCase()}</div>
                    <div class="friend-info">
                        <strong>${Utils.escapeHtml(f.friend.full_name || f.friend.username)}</strong>
                        <small>@${Utils.escapeHtml(f.friend.username)}</small>
                    </div>
                    <div class="friend-actions">
                        <button class="icon-btn accept" data-fid="${f.friendshipId}">✓</button>
                        <button class="icon-btn reject" data-fid="${f.friendshipId}">✕</button>
                    </div>
                </div>
            `).join('');
        }

        if (sent.length) {
            html += '<h4 class="section-label">Sent</h4>';
            html += sent.map(f => `
                <div class="friend-row dim">
                    <div class="friend-avatar">${(f.friend.full_name || f.friend.username || '?').charAt(0).toUpperCase()}</div>
                    <div class="friend-info">
                        <strong>${Utils.escapeHtml(f.friend.full_name || f.friend.username)}</strong>
                        <small>Pending...</small>
                    </div>
                </div>
            `).join('');
        }

        container.innerHTML = html;

        container.querySelectorAll('.icon-btn.accept').forEach(btn => {
            btn.addEventListener('click', async () => {
                await API.respondFriendRequest(btn.dataset.fid, true);
                Utils.showHandshake();
                Utils.showToast('🤝 Friend added!');
                loadFriendsData();
            });
        });

        container.querySelectorAll('.icon-btn.reject').forEach(btn => {
            btn.addEventListener('click', async () => {
                await API.respondFriendRequest(btn.dataset.fid, false);
                Utils.showToast('Request declined');
                loadFriendsData();
            });
        });
    }

    // Friend search
    async function searchFriends(query) {
        const container = document.getElementById('search-results');
        if (!container) return;

        if (!query || query.length < 2) {
            container.innerHTML = '<div class="empty-state small"><p>Search for users to add to your circle.</p></div>';
            return;
        }

        const results = await API.searchProfiles(query);
        const currentUser = VAssistAuth.getUser();
        const friendIds = STATE.friends.map(f => f.friend.id);

        const filtered = results.filter(u => u.id !== currentUser?.uid);

        if (!filtered.length) {
            container.innerHTML = '<div class="empty-state small"><p>No users found.</p></div>';
            return;
        }

        container.innerHTML = filtered.map(u => {
            const isFriend = friendIds.includes(u.id);
            return `
                <div class="friend-row">
                    <div class="friend-avatar">${(u.full_name || u.username || '?').charAt(0).toUpperCase()}</div>
                    <div class="friend-info">
                        <strong>${Utils.escapeHtml(u.full_name || u.username)}</strong>
                        <small>@${Utils.escapeHtml(u.username)} · 🛡️ ${u.trust_score || 0}</small>
                    </div>
                    ${isFriend
                    ? '<span class="already-friend">✓ Friends</span>'
                    : `<button class="add-friend-btn" data-uid="${u.id}">Add +</button>`}
                </div>`;
        }).join('');

        container.querySelectorAll('.add-friend-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                btn.disabled = true;
                btn.textContent = 'Sent';
                try {
                    await API.sendFriendRequest(btn.dataset.uid);
                    Utils.showToast('📨 Friend request sent!');
                } catch (e) {
                    Utils.showToast('⚠️ ' + e.message);
                    btn.disabled = false;
                    btn.textContent = 'Add +';
                }
            });
        });
    }

    // ══════════════════════════════════════════
    // EVENT BINDINGS
    // ══════════════════════════════════════════
    function bindEvents() {

        // ── Dashboard ──
        document.getElementById('btn-sender-mode')?.addEventListener('click', openSenderWizard);
        document.getElementById('btn-carrier-mode')?.addEventListener('click', openCarrierFeed);

        // ── Navigation ──
        document.getElementById('nav-friends')?.addEventListener('click', openFriendsModal);
        document.getElementById('nav-history')?.addEventListener('click', openHistory);

        // ── Sender Back ──
        document.getElementById('sender-back')?.addEventListener('click', () => {
            if (STATE.wizardStep > 1) {
                goToWizardStep(STATE.wizardStep - 1);
            } else {
                showView('dashboard');
            }
        });

        // ── Wizard Steps ──
        document.getElementById('wizard-next-1')?.addEventListener('click', () => {
            if (validateWizardStep(1)) goToWizardStep(2);
        });
        document.getElementById('wizard-next-2')?.addEventListener('click', () => {
            if (validateWizardStep(2)) goToWizardStep(3);
        });
        document.getElementById('wizard-next-3')?.addEventListener('click', () => {
            if (validateWizardStep(3)) goToWizardStep(4);
        });

        document.getElementById('wizard-prev-2')?.addEventListener('click', () => goToWizardStep(1));
        document.getElementById('wizard-prev-3')?.addEventListener('click', () => goToWizardStep(2));

        // ── Weight Slider ──
        document.getElementById('sender-weight')?.addEventListener('input', (e) => {
            document.getElementById('weight-value').textContent = parseFloat(e.target.value).toFixed(1);
            STATE.sender.weight_kg = parseFloat(e.target.value);
            if (STATE.routeData) calculateRoute();
        });

        // ── Delivery Type ──
        document.querySelectorAll('.type-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                document.querySelectorAll('.type-chip').forEach(c => c.classList.remove('selected'));
                chip.classList.add('selected');
                STATE.sender.delivery_type = chip.dataset.type;
                if (STATE.routeData) {
                    const fare = Pricing.estimate(STATE.routeData.dist, chip.dataset.type, STATE.sender.weight_kg);
                    STATE.sender.fare = String(fare);
                }
            });
        });

        // ── Use My Location ──
        document.getElementById('sender-locate')?.addEventListener('click', () => {
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(async (pos) => {
                    const lat = pos.coords.latitude;
                    const lng = pos.coords.longitude;
                    const name = await reverseGeocode(lat, lng);
                    STATE.sender.drop_location = name;
                    STATE.sender.drop_coords = { lat, lng };
                    document.getElementById('sender-drop').value = name;
                    if (STATE.map) {
                        STATE.map.addMarker('drop', lat, lng);
                        STATE.map.setClickMode(null);
                    }
                    if (STATE.sender.pickup_coords) calculateRoute();
                }, () => { Utils.showToast('⚠️ Location access denied'); });
            }
        });

        // ── Submit ──
        document.getElementById('sender-confirm')?.addEventListener('click', submitRequest);

        // ── Carrier Back ──
        document.getElementById('carrier-back')?.addEventListener('click', () => {
            if (STATE.carrierFeedUnsub) STATE.carrierFeedUnsub();
            showView('dashboard');
        });

        // ── Carrier Active Back ──
        document.getElementById('carrier-active-back')?.addEventListener('click', () => {
            if (STATE.trackingUnsub) STATE.trackingUnsub();
            openCarrierFeed();
        });

        // ── Tracking Back ──
        document.getElementById('tracking-back')?.addEventListener('click', () => {
            if (STATE.trackingUnsub) STATE.trackingUnsub();
            showView('dashboard');
        });

        // ── History Back ──
        document.getElementById('history-back')?.addEventListener('click', () => showView('dashboard'));

        // ── Friends Modal ──
        document.getElementById('friends-modal-close')?.addEventListener('click', closeFriendsModal);
        document.getElementById('friends-modal')?.addEventListener('click', (e) => {
            if (e.target.id === 'friends-modal') closeFriendsModal();
        });

        // Friends modal tabs
        document.querySelectorAll('#friends-modal .modal-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('#friends-modal .modal-tab').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('#friends-modal .modal-tab-content').forEach(c => c.classList.remove('active'));
                tab.classList.add('active');
                const panel = document.getElementById('friends-' + tab.dataset.tab + '-panel');
                if (panel) panel.classList.add('active');
            });
        });

        // Friend search
        const searchInput = document.getElementById('friend-search-input');
        if (searchInput) {
            searchInput.addEventListener('input', Utils.debounce((e) => {
                searchFriends(e.target.value.trim());
            }, 400));
        }

        // ── OTP Modal ──
        document.getElementById('otp-close-btn')?.addEventListener('click', closeOTPModal);
        document.getElementById('otp-modal')?.addEventListener('click', (e) => {
            if (e.target.id === 'otp-modal') closeOTPModal();
        });

        // ── Broadcast Scope ──
        document.querySelectorAll('.broadcast-option').forEach(opt => {
            opt.addEventListener('click', () => {
                document.querySelectorAll('.broadcast-option').forEach(o => o.classList.remove('selected'));
                opt.classList.add('selected');
                STATE.sender.broadcast_scope = opt.dataset.scope;
            });
        });
    }

    // ══════════════════════════════════════════
    // INIT
    // ══════════════════════════════════════════
    function init() {
        // Check auth
        const user = VAssistAuth.getUser();
        if (!user) {
            window.location.href = 'login.html';
            return;
        }

        hideSplash();
        bindEvents();
        initDashboard();

        // Start friendship listener for badge updates
        STATE.friendshipsUnsub = API.onFriendshipChanges((allFriends) => {
            const pending = allFriends.filter(f => f.status === 'PENDING' && f.direction === 'received');
            const badge = document.getElementById('pending-count');
            if (badge) {
                badge.textContent = pending.length;
                badge.style.display = pending.length > 0 ? '' : 'none';
            }
        });
    }

    // Boot
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();