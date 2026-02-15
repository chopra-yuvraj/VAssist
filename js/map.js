/* ============================================
   VAssist v5.0 — Map Service
   Global map, free location selection
   ============================================ */

class MapService {
    constructor(containerId = 'sender-map') {
        this.containerId = containerId;
        this.map = null;
        this.markers = {};
        this.routePolyline = null;
        this.trailPolyline = null;
        this.assistantMarker = null;
        this.clickMode = null; // 'pickup' or 'drop'
        this.onLocationSelect = null;
    }

    // Initialize map into a container
    init(center, zoom) {
        const c = center || CONFIG.DEFAULT_CENTER;
        const z = zoom || CONFIG.DEFAULT_ZOOM;

        this.map = L.map(this.containerId, {
            zoomControl: false,
            attributionControl: false,
            maxZoom: 19,
            minZoom: 3,
            zoomSnap: 0.5,
            zoomDelta: 0.5
        }).setView(c, z);

        L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
            attribution: '©OpenStreetMap ©CartoDB',
            maxZoom: 19,
            crossOrigin: true
        }).addTo(this.map);

        if (typeof L === 'undefined') {
            console.error('Leaflet (L) is not defined. Map cannot load.');
            return;
        }

        L.control.attribution({ position: 'bottomleft', prefix: false }).addTo(this.map);
        L.control.zoom({ position: 'bottomright' }).addTo(this.map);

        // Force resize calculation after animation finishes (fixes map loading in hidden/animated tabs)
        setTimeout(() => {
            this.map.invalidateSize();
        }, 400);

        // Click handler
        this.map.on('click', (e) => {
            if (!this.clickMode) return;
            const { lat, lng } = e.latlng;

            if (this.clickMode === 'pickup') {
                this.addMarker('pickup', lat, lng);
                if (this.onLocationSelect) {
                    this.onLocationSelect('pickup', lat, lng);
                }
            } else if (this.clickMode === 'drop') {
                this.addMarker('drop', lat, lng);
                if (this.onLocationSelect) {
                    this.onLocationSelect('drop', lat, lng);
                }
            }
        });

        return this;
    }

    // Invalidate size when container becomes visible
    refresh() {
        if (this.map) {
            setTimeout(() => this.map.invalidateSize(), 400);
        }
    }

    setClickMode(mode) {
        this.clickMode = mode; // 'pickup', 'drop', or null
    }

    flyTo(lat, lng, zoom = CONFIG.LOCATED_ZOOM) {
        if (!this.map) return;
        this.map.flyTo([lat, lng], zoom, { duration: 1.2, easeLinearity: 0.25 });
    }

    // ── Marker System ──
    addMarker(type, lat, lng) {
        const icons = {
            pickup: {
                html: `<div style="font-size:1.6rem;filter:drop-shadow(0 3px 6px rgba(0,0,0,0.3));animation:bounce-in 0.5s cubic-bezier(0.68,-0.55,0.265,1.55) both;">📍</div>`,
                iconSize: [30, 30], iconAnchor: [15, 30]
            },
            drop: {
                html: `<div style="font-size:1.6rem;filter:drop-shadow(0 3px 6px rgba(0,0,0,0.3));animation:bounce-in 0.5s cubic-bezier(0.68,-0.55,0.265,1.55) both;">🏠</div>`,
                iconSize: [30, 30], iconAnchor: [15, 30]
            },
            user: {
                html: `<div class="user-marker-dot"></div>`,
                iconSize: [22, 22], iconAnchor: [11, 11]
            },
            assistant: {
                html: `<div style="font-size:1.8rem;filter:drop-shadow(0 3px 8px rgba(0,0,0,0.35));animation:float 2s ease-in-out infinite;">🛵</div>`,
                iconSize: [34, 34], iconAnchor: [17, 17]
            }
        };

        const config = icons[type] || icons.user;

        if (this.markers[type]) {
            this.map.removeLayer(this.markers[type]);
        }

        const icon = L.divIcon({
            html: config.html,
            className: '',
            iconSize: config.iconSize,
            iconAnchor: config.iconAnchor
        });

        this.markers[type] = L.marker([lat, lng], { icon }).addTo(this.map);
    }

    // ── Route Drawing ──
    async drawRoute(start, end) {
        const url = `${CONFIG.API.OSRM}${start.lng},${start.lat};${end.lng},${end.lat}?overview=full&geometries=geojson`;

        try {
            const res = await fetch(url);
            const data = await res.json();
            if (!data.routes || !data.routes.length) return null;

            const route = data.routes[0];
            const coords = route.geometry.coordinates.map(c => [c[1], c[0]]);

            if (this.routePolyline) this.map.removeLayer(this.routePolyline);
            if (this.trailPolyline) this.map.removeLayer(this.trailPolyline);

            this.trailPolyline = L.polyline(coords, {
                color: '#6566C9', weight: 10, opacity: 0.15,
                lineCap: 'round', lineJoin: 'round'
            }).addTo(this.map);

            this.routePolyline = L.polyline(coords, {
                color: '#6566C9', weight: 5, opacity: 0.85,
                lineCap: 'round', lineJoin: 'round',
                dashArray: '12, 6', className: 'animated-route'
            }).addTo(this.map);

            this.map.fitBounds(this.routePolyline.getBounds(), {
                padding: [40, 40], maxZoom: 17, animate: true, duration: 0.8
            });

            return {
                dist: route.distance / 1000,
                duration: Math.round(route.duration / 60),
                coords: coords
            };
        } catch (e) {
            console.error('Route draw failed:', e);
            return null;
        }
    }

    // ── Animate Assistant ──
    animateAssistant(path, duration, onProgress, onComplete) {
        if (this.assistantMarker) this.map.removeLayer(this.assistantMarker);

        const icon = L.divIcon({
            html: `<div style="font-size:1.8rem;filter:drop-shadow(0 3px 8px rgba(0,0,0,0.35));animation:float 1.5s ease-in-out infinite;">🛵</div>`,
            className: '', iconSize: [34, 34], iconAnchor: [17, 17]
        });

        this.assistantMarker = L.marker(path[0], { icon, zIndexOffset: 1000 }).addTo(this.map);
        const totalPoints = path.length;
        let startTime = null;

        const step = (timestamp) => {
            if (!startTime) startTime = timestamp;
            const progress = Math.min((timestamp - startTime) / duration, 1);
            const eased = Utils.easeOutCubic(progress);
            const idx = Math.min(Math.floor(eased * totalPoints), totalPoints - 1);

            if (path[idx]) {
                this.assistantMarker.setLatLng(path[idx]);
                if (progress < 0.9) this.map.panTo(path[idx], { animate: true, duration: 0.3 });
            }

            if (typeof onProgress === 'function') onProgress(progress);

            if (progress < 1) {
                requestAnimationFrame(step);
            } else {
                this.assistantMarker.setLatLng(path[totalPoints - 1]);
                if (typeof onComplete === 'function') onComplete();
            }
        };
        requestAnimationFrame(step);
    }

    clearRoute() {
        if (this.routePolyline) { this.map.removeLayer(this.routePolyline); this.routePolyline = null; }
        if (this.trailPolyline) { this.map.removeLayer(this.trailPolyline); this.trailPolyline = null; }
        if (this.assistantMarker) { this.map.removeLayer(this.assistantMarker); this.assistantMarker = null; }
    }

    clearMarkers() {
        Object.values(this.markers).forEach(m => this.map.removeLayer(m));
        this.markers = {};
    }

    getCenter() {
        if (!this.map) return null;
        const c = this.map.getCenter();
        return { lat: c.lat, lng: c.lng };
    }
}