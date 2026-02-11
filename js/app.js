/* ============================================
   VAssist — Main Application Controller
   Enhanced with animations, transitions & effects
   ============================================ */

document.addEventListener('DOMContentLoaded', () => {

    // ==========================================
    // 🚀 CINEMATIC SPLASH SCREEN
    // ==========================================
    const splashEl = document.getElementById('splash-screen');

    const dismissSplash = () => {
        splashEl.classList.add('fade-out');
        setTimeout(() => {
            splashEl.remove();
            initApp();
        }, 800);
    };

    // Show splash for 2.5 seconds then fade out
    setTimeout(dismissSplash, 2500);

    // ==========================================
    // 🎬 APP INITIALIZATION
    // ==========================================
    function initApp() {
        const mapService = new MapService();
        let currentUserMode = 'user';
        let selectedDeliveryType = 'walker';

        // ==========================================
        // 📍 LOCATION & MAP LOGIC
        // ==========================================

        function locateUser() {
            const dropInput = document.getElementById('drop-input');
            dropInput.value = "🔍 Detecting GPS...";

            if (!navigator.geolocation) {
                fallbackLocation(dropInput);
                return;
            }

            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    const { latitude, longitude } = pos.coords;
                    STATE.drop = { lat: latitude, lng: longitude };
                    mapService.setUserLocation(latitude, longitude);
                    dropInput.value = "📍 My Current Location";
                    Utils.showToast("✅ GPS Location Found");
                    Utils.vibrate(50);
                    validateRequestForm();
                },
                (err) => {
                    console.warn("GPS failed:", err.message);
                    fallbackLocation(dropInput);
                },
                {
                    enableHighAccuracy: true,
                    timeout: 8000,
                    maximumAge: 60000
                }
            );
        }

        function fallbackLocation(dropInput) {
            const [lat, lng] = CONFIG.VIT_CENTER;
            STATE.drop = { lat, lng };
            mapService.setUserLocation(lat, lng);
            dropInput.value = "📍 VIT Campus (Default)";
            Utils.showToast("📍 Using Campus Center as default", 4000);
            validateRequestForm();
        }

        // Locate on init
        locateUser();

        // "Locate Me" FAB
        const locateBtn = document.getElementById('locate-btn');
        locateBtn.addEventListener('click', (e) => {
            Utils.createRipple(e, locateBtn);
            locateUser();
        });

        // ---- Map Click -> Pickup Selection ----
        mapService.map.on('click', (e) => {
            if (currentUserMode !== 'user') return;

            const { lat, lng } = e.latlng;
            STATE.pickup = { lat, lng };
            mapService.addMarker('store', lat, lng);
            document.getElementById('pickup-input').value = `📍 Custom Pin (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
            validateRequestForm();
            Utils.vibrate(20);
        });

        // ---- Campus Location Selection ----
        document.addEventListener('location-selected', (e) => {
            if (currentUserMode !== 'user') return;

            const loc = e.detail;
            if (loc.type === 'store' || loc.type === 'amenity' || loc.type === 'academic') {
                STATE.pickup = { lat: loc.lat, lng: loc.lng };
                document.getElementById('pickup-input').value = `🏪 ${loc.name}`;
                mapService.addMarker('store', loc.lat, loc.lng);
                Utils.showToast(`📍 Pickup: ${loc.name}`);
            } else {
                STATE.drop = { lat: loc.lat, lng: loc.lng };
                document.getElementById('drop-input').value = `🏠 ${loc.name}`;
                mapService.addMarker('user', loc.lat, loc.lng);
                Utils.showToast(`📍 Drop: ${loc.name}`);
            }
            validateRequestForm();
        });

        // ==========================================
        // 🔄 USER MODE — Request Flow
        // ==========================================

        const itemInput = document.getElementById('item-input');
        const findBtn = document.getElementById('find-assist-btn');

        itemInput.addEventListener('input', Utils.debounce(validateRequestForm, 150));

        function validateRequestForm() {
            const valid = STATE.pickup && itemInput.value.trim() !== '';
            findBtn.disabled = !valid;

            // Animate button state change
            if (valid && !findBtn.dataset.wasEnabled) {
                findBtn.dataset.wasEnabled = 'true';
                findBtn.style.animation = 'bounce-in 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55)';
                setTimeout(() => findBtn.style.animation = '', 400);
            } else if (!valid) {
                findBtn.dataset.wasEnabled = '';
            }
        }

        // ---- Find Assistant ----
        findBtn.addEventListener('click', async (e) => {
            if (!STATE.pickup || !STATE.drop) {
                Utils.showToast("⚠️ Select both locations first");
                findBtn.classList.add('animate-shake');
                setTimeout(() => findBtn.classList.remove('animate-shake'), 400);
                return;
            }

            Utils.createRipple(e, findBtn);
            Utils.vibrate(30);

            // Loading state
            findBtn.innerHTML = '<span class="btn-loader"></span> Calculating Route...';
            findBtn.disabled = true;

            const route = await mapService.drawRoute(STATE.pickup, STATE.drop);

            if (route) {
                STATE.route = route;

                // Animate price numbers
                const walkerPrice = Pricing.estimate(route.dist, 'walker');
                const cyclistPrice = Pricing.estimate(route.dist, 'cyclist');

                Utils.animateNumber(document.getElementById('price-walker'), walkerPrice);
                Utils.animateNumber(document.getElementById('price-cyclist'), cyclistPrice);

                UI.showPanel('mode');
                Utils.showToast(`📏 ${route.dist.toFixed(1)} km • ~${route.duration || Math.round(route.dist * 12)} min`);
            } else {
                Utils.showToast("⚠️ Couldn't find a route. Try different locations.");
            }

            findBtn.innerHTML = 'Find Assistant <span class="arrow">→</span>';
            findBtn.disabled = false;
            validateRequestForm();
        });

        // ---- Option Card Selection ----
        document.querySelectorAll('.option-card').forEach(card => {
            card.addEventListener('click', () => {
                document.querySelectorAll('.option-card').forEach(c => c.classList.remove('selected'));
                card.classList.add('selected');
                selectedDeliveryType = card.dataset.type;
                Utils.vibrate(15);
            });
        });

        // ---- Back Button ----
        document.getElementById('back-to-request').addEventListener('click', () => {
            UI.showPanel('request');
        });

        // ---- Confirm Request ----
        document.getElementById('confirm-btn').addEventListener('click', (e) => {
            Utils.createRipple(e, e.currentTarget);
            Utils.vibrate(50);

            const priceEl = selectedDeliveryType === 'cyclist'
                ? document.getElementById('price-cyclist')
                : document.getElementById('price-walker');

            const request = {
                id: Utils.generateId(),
                item: itemInput.value,
                pickup: document.getElementById('pickup-input').value,
                drop: document.getElementById('drop-input').value,
                fare: priceEl.innerText,
                type: selectedDeliveryType,
                otp: Utils.generateOTP(),
                status: 'PENDING',
                timestamp: Date.now()
            };

            // Save to localStorage DB
            localStorage.setItem(CONFIG.KEYS.ACTIVE_REQ, JSON.stringify(request));

            // UI Updates
            UI.showPanel('track');
            document.getElementById('track-status').innerText = "Broadcasting to nearby students...";
            document.getElementById('otp-display').innerText = request.otp;

            Utils.showToast("📡 Request Broadcasted!");
        });

        // ==========================================
        // 🎒 PARTNER MODE LOGIC
        // ==========================================

        // Listen for localStorage changes (cross-tab communication)
        window.addEventListener('storage', (e) => {
            if (e.key === CONFIG.KEYS.ACTIVE_REQ) {
                const req = JSON.parse(e.newValue);

                if (currentUserMode === 'user' && req && req.status === 'ACCEPTED') {
                    handleRequestAccepted(req);
                }

                if (currentUserMode === 'partner' && req && req.status === 'PENDING') {
                    renderPartnerRequests(req);
                }
            }
        });

        function renderPartnerRequests(req) {
            const container = document.getElementById('requests-list');
            container.innerHTML = `
                <div class="req-card animate-pop">
                    <div class="req-header">
                        <span>📦 ${req.item}</span>
                        <span style="color: var(--accent-green)">₹${req.fare}</span>
                    </div>
                    <div class="req-route">
                        <strong>From:</strong> ${req.pickup}<br>
                        <strong>To:</strong> ${req.drop}
                    </div>
                    <button class="accept-btn" id="accept-${req.id}">
                        🚀 Accept Order
                    </button>
                </div>
            `;

            // Attach click handler
            document.getElementById(`accept-${req.id}`).addEventListener('click', () => {
                acceptRequest(req.id);
            });

            Utils.showToast("🔔 New Order Alert!");
            Utils.vibrate([100, 50, 100]);
        }

        function acceptRequest(reqId) {
            const req = JSON.parse(localStorage.getItem(CONFIG.KEYS.ACTIVE_REQ));
            if (!req) return;

            req.status = 'ACCEPTED';
            req.partnerName = "Rahul (Partner)";
            req.acceptedAt = Date.now();

            localStorage.setItem(CONFIG.KEYS.ACTIVE_REQ, JSON.stringify(req));

            document.getElementById('requests-list').innerHTML = `
                <div class="empty-state" style="animation: bounce-in 0.5s var(--ease-spring) both;">
                    <p>✅ You accepted this order!</p>
                    <small>Head to the store to pick up: <strong>${req.item}</strong></small>
                </div>
            `;

            Utils.showToast("✅ Order Accepted! Head to store.");
            Utils.vibrate(100);
        }

        // Make accessible for inline onclick (backup)
        window.acceptRequest = acceptRequest;

        function handleRequestAccepted(req) {
            // Hide radar, show assigned info
            const radarSection = document.getElementById('radar-section');
            radarSection.classList.add('hidden');

            const assignedInfo = document.getElementById('assigned-info');
            assignedInfo.classList.remove('hidden');
            assignedInfo.style.animation = 'card-slide-up 0.5s var(--ease-spring) both';

            document.getElementById('ast-name').innerText = req.partnerName;
            document.getElementById('ast-status').innerText = "Accepted & Heading to store";
            document.getElementById('otp-display').innerText = req.otp || Utils.generateOTP();

            // Show delivery timeline
            const timeline = document.getElementById('delivery-timeline');
            timeline.classList.remove('hidden');
            timeline.style.animation = 'slide-in-up 0.5s var(--ease-spring) 0.3s both';

            Utils.showToast("🎉 Partner Found!");
            Utils.vibrate([50, 30, 50]);

            // Animate assistant on map
            if (STATE.route && STATE.route.coords) {
                mapService.animateAssistant(
                    STATE.route.coords,
                    10000,
                    (progress) => {
                        // Update timeline steps based on progress
                        if (progress > 0.3) {
                            updateTimelineStep(2, 'completed');
                            updateTimelineStep(3, 'active');
                            document.getElementById('ast-status').innerText = "Picked up item, heading to you!";
                        }
                        if (progress > 0.7) {
                            updateTimelineStep(3, 'completed');
                            updateTimelineStep(4, 'active');
                            document.getElementById('ast-status').innerText = "Almost there!";
                        }
                    },
                    () => {
                        // Delivery complete!
                        updateTimelineStep(4, 'completed');
                        document.getElementById('ast-status').innerText = "✅ Delivered!";
                        Utils.showToast("🎉 Order Delivered!");
                        Utils.launchConfetti(50);
                        Utils.vibrate([100, 50, 100, 50, 200]);

                        // Save to history
                        Utils.saveRide({
                            ...STATE,
                            completedAt: Date.now()
                        });
                    }
                );
            }
        }

        function updateTimelineStep(stepNum, status) {
            const step = document.getElementById(`step-${stepNum}`);
            if (!step) return;

            step.classList.remove('active', 'completed');
            step.classList.add(status);

            if (status === 'completed') {
                step.querySelector('.step-indicator').innerHTML = '✓';
            }
        }

        // ==========================================
        // 🔀 MODE SWITCHING — Smooth Transition
        // ==========================================
        const modeToggle = document.getElementById('mode-toggle');
        const labelUser = document.getElementById('label-user');
        const labelPartner = document.getElementById('label-partner');

        modeToggle.addEventListener('change', () => {
            Utils.vibrate(40);

            if (modeToggle.checked) {
                // → Partner Mode
                currentUserMode = 'partner';
                labelUser.style.color = 'var(--text-muted)';
                labelPartner.style.color = 'var(--primary)';

                const userUI = document.getElementById('user-ui');
                userUI.style.animation = 'slide-in-left 0.4s ease reverse forwards';
                setTimeout(() => {
                    userUI.classList.add('hidden-mode');
                    userUI.style.animation = '';

                    const partnerUI = document.getElementById('partner-ui');
                    partnerUI.classList.remove('hidden-mode');
                    partnerUI.style.animation = 'slide-in-right 0.4s var(--ease-spring) both';
                }, 350);

                // Check for existing pending requests
                const pending = JSON.parse(localStorage.getItem(CONFIG.KEYS.ACTIVE_REQ));
                if (pending && pending.status === 'PENDING') {
                    setTimeout(() => renderPartnerRequests(pending), 400);
                }

                Utils.showToast("🎒 Switched to Partner Mode");
            } else {
                // → User Mode
                currentUserMode = 'user';
                labelUser.style.color = 'var(--primary)';
                labelPartner.style.color = 'var(--text-muted)';

                const partnerUI = document.getElementById('partner-ui');
                partnerUI.style.animation = 'slide-in-right 0.4s ease reverse forwards';
                setTimeout(() => {
                    partnerUI.classList.add('hidden-mode');
                    partnerUI.style.animation = '';

                    const userUI = document.getElementById('user-ui');
                    userUI.classList.remove('hidden-mode');
                    userUI.style.animation = 'slide-in-left 0.4s var(--ease-spring) both';
                }, 350);

                Utils.showToast("👤 Switched to User Mode");
            }
        });

        // ==========================================
        // ✨ GLOBAL ENHANCEMENTS
        // ==========================================

        // Add ripple to all primary buttons
        document.querySelectorAll('.primary-btn, .accept-btn').forEach(btn => {
            btn.addEventListener('click', (e) => Utils.createRipple(e, btn));
        });

        // Input focus animation - subtle scale
        document.querySelectorAll('.input-wrapper input, .loc-row input').forEach(input => {
            input.addEventListener('focus', () => {
                const wrapper = input.closest('.input-wrapper') || input.closest('.loc-row');
                if (wrapper) wrapper.style.transform = 'scale(1.01)';
            });
            input.addEventListener('blur', () => {
                const wrapper = input.closest('.input-wrapper') || input.closest('.loc-row');
                if (wrapper) wrapper.style.transform = '';
            });
        });

        // Keyboard shortcut: Escape to go back
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const activePanel = document.querySelector('.panel.active');
                if (activePanel && activePanel.id !== 'request-panel') {
                    UI.showPanel('request');
                }
            }
        });

    } // end initApp()
});


// ==========================================
// 🔧 GLOBAL UI CONTROLLER
// ==========================================
const UI = {
    showPanel: (id) => {
        document.querySelectorAll('.panel').forEach(p => {
            p.classList.remove('active');
        });

        const target = document.getElementById(id + '-panel');
        if (target) {
            // Small delay for CSS transition to register
            requestAnimationFrame(() => {
                target.classList.add('active');
            });
        }
    }
};

// ==========================================
// 📦 GLOBAL STATE
// ==========================================
const STATE = {
    pickup: null,
    drop: null,
    route: null
};