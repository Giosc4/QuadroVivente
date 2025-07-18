// ============================================================================
// QUADRO VIEWER v3.0 - VERSIONE SEMPLIFICATA
// ============================================================================

class QuadroViewer {
    constructor(raw = window.quadroRaw || {}) {
        // 1) Inietto il raw data
        this.quadroData = {
            id: raw.id,
            name: raw.name,
            deviceId: raw.device_id,
            deviceLocation: raw.device_location || '',
            template: raw.template || 'natura',
            sensorsConfig: raw.sensors_config || {},
            customConfig: raw.custom_config || {},
            createdAt: raw.created_at,
            version: raw.version || '3.0'
        };

        // 2) Garantisco struttura base per sensorsConfig
        ['temperature', 'humidity', 'light', 'audio'].forEach(sensor => {
            if (!this.quadroData.sensorsConfig[sensor]) {
                this.quadroData.sensorsConfig[sensor] = { animations: {} };
            }
        });

        // 3) Applico animazioni di default se non presenti



        // Inizializzo le proprietà interne
        this.canvas = null;
        this.ctx = null;
        this.socket = null;

        // Valori iniziali dei sensori (fallback)
        this.sensorData = {
            temperature: 20,
            humidity: 50,
            light: 1000,
            audio: 500
        };

        this.sensorHistory = {
            temperature: [],
            humidity: [],
            light: [],
            audio: []
        };

        // Stato UI
        this.isFullscreen = false;
        this.showOverlay = true;
        this.showSensors = true;
        this.showFPS = false;
        this.autoHide = true;
        this.autoHideTimer = null;
        this.lastMouseMove = Date.now();

        // Animazione
        this.animationId = null;
        this.animationSpeed = 1.0;
        this.effectIntensity = 1.0;
        this.renderQuality = 'medium';
        this.performanceMode = 'balanced';
        this.colorTheme = 'default';

        // Connessione
        this.isConnected = false;
        this.lastUpdate = null;
        this.dataCount = 0;

        // Effetti
        this.effects = [];
        this.effectsCache = {};

        // Performance/debug
        this.fpsCounter = { frames: 0, lastTime: 0, fps: 0 };
        this.renderTime = 0;
        this.debugMode = false;

        // Contesti per i mini‐grafici delle tendenze
        this.trendCanvases = {};

        this.templates = {
            natura: { temperature: { below: 15, above: 25 }, humidity: { below: 30, above: 70 }, light: { below: 500, above: 1500 }, audio: { any: true } },
            spazio: { temperature: { below: 15, above: 25 }, humidity: { any: true }, light: { below: 500, above: 1500 }, audio: { any: true } },
            oceano: { temperature: { below: 15, above: 25 }, humidity: { any: true }, light: { below: 500, above: 1500 }, audio: { any: true } },
            // alias per correre in soccorso del valore "naturale"
            naturale: null
        };
        // creo alias puntando a natura
        this.templates.naturale = this.templates.natura;
        this._applyDefaultTemplateAnimations();

        // Parto con l’inizializzazione
        this.init();
    }


    init() {
        console.log('🚀 Inizializzazione QuadroViewer...');

        this.setupCanvas();
        this.setupSocket();
        this.setupEvents();
        this.setupTrends();
        this.setupEffects();

        this.showOverlay = true;
        this.updateOverlay();

        this.startAnimation();
        this.startAutoHide();
        this.hideLoading();
        this.updateConnection();

        this.render();  // <-- Rendering iniziale aggiunto qui

        console.log('✅ QuadroViewer inizializzato');
    }

    _normalizeSensorsConfig(raw) {
        const out = {};
        Object.entries(raw).forEach(([sensor, entry]) => {
            if (entry.config && Array.isArray(entry.config.effects)) {
                const anims = {};
                entry.config.effects.forEach(eff => {
                    // Mappa threshold in min/max
                    const tmin = eff.threshold ?? eff.threshold_min ?? 0;
                    const tmax = eff.threshold ?? eff.threshold_max ?? 100;
                    anims[eff.effect] = {
                        condition: eff.condition,
                        threshold_min: tmin,
                        threshold_max: tmax,
                        intensity: eff.intensity
                    };
                });
                out[sensor] = { animations: anims };
            }
        });
        return out;
    }

    _applyDefaultTemplateAnimations() {
        const cfg = this.quadroData.sensorsConfig;
        // protezione per cfg
        if (!cfg || typeof cfg !== 'object') return;
        // verifico se tutte le animazioni sono vuote
        const allEmpty = Object.values(cfg).every(conf => {
            return !conf.animations || Object.keys(conf.animations).length === 0;
        });
        if (!allEmpty) return;

        // carico configurazione default dal template
        const template = this.quadroData.template;
        const tmplCfg = this.templates[template] || this.templates['natura'];
        Object.keys(tmplCfg).forEach(sensor => {
            cfg[sensor].animations = { any: { condition: 'any' } };
        });
    }

    setupCanvas() {
        this.canvas = document.getElementById('quadro-canvas');
        if (!this.canvas) {
            console.error("❌ Canvas non trovato!");
            return;
        }
        this.ctx = this.canvas.getContext('2d');
        this.resizeCanvas();

        window.addEventListener('resize', () => this.resizeCanvas());
    }


    resizeCanvas() {
        const rect = this.canvas.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
    }

    setupSocket() {
        if (typeof io === 'undefined') return;
        this.socket = io();

        this.socket.on('connect', () => {
            this.isConnected = true;
            this.updateConnection();
        });

        this.socket.on('disconnect', () => {
            this.isConnected = false;
            this.updateConnection();
        });

        // Ricevo i dati combinati dal server
        this.socket.on('device_data_update', (msg) => {
            if (msg.device_id === this.quadroData.deviceId) {
                this.updateSensors({ device_id: msg.device_id, data: msg.data });
            }
        });
    }


    setupEvents() {
        // Mouse per auto-hide
        document.addEventListener('mousemove', () => {
            this.lastMouseMove = Date.now();
            this.showOverlay = true;
            this.updateOverlay();
            this.resetAutoHide();
        });

        // Keyboard
        document.addEventListener('keydown', (e) => {
            switch (e.key) {
                case 'f': case 'F': this.toggleFullscreen(); break;
                case 'h': case 'H': this.toggleInfo(); break;
                case 's': case 'S': this.toggleSettings(); break;
                case 'd': case 'D': this.toggleDebug(); break;
                case 'Escape': this.hideAllPanels(); break;
                case ' ': e.preventDefault(); this.toggleOverlay(); break;
            }
        });

        // Fullscreen
        document.addEventListener('fullscreenchange', () => {
            this.isFullscreen = document.fullscreenElement !== null;
            this.updateFullscreenBtn();
        });

        // Visibility
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                this.startAnimation();
            } else {
                this.stopAnimation();
            }
        });
    }

    setupTrends() {
        ['temp', 'humidity', 'light', 'audio'].forEach(sensor => {
            const element = document.getElementById(`${sensor}-trend`);
            if (element) {
                const canvas = element.querySelector('canvas');
                if (canvas) {
                    this.trendCanvases[sensor] = canvas.getContext('2d');
                }
            }
        });
    }

    setupEffects() {
        const template = this.quadroData.template || 'personalizzato';

        // Gestisci correttamente sensorsConfig
        if (typeof this.quadroData.sensorsConfig === 'object') {
            this.effectsCache = {};

            Object.entries(this.quadroData.sensorsConfig).forEach(([sensor, sensorConfig]) => {
                if (sensorConfig.animations) {
                    this.effectsCache[sensor] = sensorConfig;
                }
            });
        }

        // Carica customConfig per quadri personalizzati
        if (template === 'personalizzato' && this.quadroData.customConfig) {
            this.customConfig = this.quadroData.customConfig;
        }

        // Usa templates predefiniti solo se non ci sono effetti personalizzati
        if (Object.keys(this.effectsCache).length === 0 && !this.customConfig) {
            this.effectsCache = this.templates[template] || this.templates['natura'];
        }

        console.log('🎨 Effetti caricati:', this.effectsCache, 'Config personalizzata:', this.customConfig);
        this.updateEffects();
    }


    renderCustomConfig(ctx, width, height, time) {
        if (!this.customConfig) return;

        this.renderCustomBackground(ctx, width, height);
        this.renderCustomElements(ctx, width, height, time);
    }

    renderCustomBackground(ctx, width, height) {
        const bg = this.customConfig.background;

        switch (bg) {
            case 'gradient':
                const gradient = ctx.createLinearGradient(0, 0, 0, height);
                gradient.addColorStop(0, bg.color1 || '#667eea');
                gradient.addColorStop(1, bg.color2 || '#764ba2');
                ctx.fillStyle = gradient;
                ctx.fillRect(0, 0, width, height);
                break;

            case 'solid':
                ctx.fillStyle = bg.color || '#667eea';
                ctx.fillRect(0, 0, width, height);
                break;

            default:
                ctx.fillStyle = '#000';
                ctx.fillRect(0, 0, width, height);
                break;
        }
    }

    renderCustomElements(ctx, width, height, time) {
        this.customConfig.elements.forEach(el => {
            const x = (el.x / 100) * width;
            const y = (el.y / 100) * height;
            let size = el.size;
            const sensorValue = this.sensorData[el.sensor] || 0;
            const normalized = Math.min(Math.max(sensorValue / 100, 0), 1);

            ctx.save();
            ctx.translate(x, y);

            switch (el.animation) {
                case 'pulse':
                    size *= (0.8 + 0.4 * Math.sin(time * 2 + normalized * 10));
                    break;
                case 'rotate':
                    ctx.rotate(time + normalized * Math.PI * 2);
                    break;
                case 'scale':
                    const scale = 0.5 + normalized * 0.5;
                    ctx.scale(scale, scale);
                    break;
            }

            ctx.fillStyle = el.color;

            switch (el.shape) {
                case 'circle':
                    ctx.beginPath();
                    ctx.arc(0, 0, size / 2, 0, 2 * Math.PI);
                    ctx.fill();
                    break;
                case 'square':
                    ctx.fillRect(-size / 2, -size / 2, size, size);
                    break;
                case 'triangle':
                    ctx.beginPath();
                    ctx.moveTo(0, -size / 2);
                    ctx.lineTo(-size / 2, size / 2);
                    ctx.lineTo(size / 2, size / 2);
                    ctx.closePath();
                    ctx.fill();
                    break;
            }

            ctx.restore();
        });
    }

    updateSensors(data) {
        this.sensorData = {
            temperature: data.data.temperature || 20,
            humidity: data.data.humidity || 50,
            light: data.data.light || 1000,
            audio: data.data.audio || 500
        };

        this.lastUpdate = new Date();
        this.dataCount++;

        this.updateSensorDisplay();
        this.updateHistory();
        this.updateTrends();
        this.updateEffects();
        this.updateInfo();
    }

    updateSensorDisplay() {
        const updates = {
            'temp-value': `${this.sensorData.temperature?.toFixed(1) || '--'}°C`,
            'humidity-value': `${this.sensorData.humidity?.toFixed(1) || '--'}%`,
            'light-value': this.sensorData.light ?? '--',
            'audio-value': this.sensorData.audio ?? '--'
        };

        Object.entries(updates).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) element.textContent = value;
        });

        this.updateSensorStatus();
    }


    updateSensorStatus() {
        ['temp', 'humidity', 'light', 'audio'].forEach(sensor => {
            const sensorKey = sensor === 'temp' ? 'temperature' : sensor;
            const card = document.getElementById(`${sensor}-sensor`);
            const status = document.getElementById(`${sensor}-status`);

            if (card && status) {
                card.classList.remove('active', 'inactive');

                // Forza sempre come attivo per visualizzare gli effetti
                card.classList.add('active');
                status.textContent = 'Attivo';
            }
        });
    }

    updateHistory() {
        const maxHistory = 50;
        const timestamp = Date.now();

        Object.keys(this.sensorHistory).forEach(sensor => {
            this.sensorHistory[sensor].push({
                value: this.sensorData[sensor],
                time: timestamp
            });

            if (this.sensorHistory[sensor].length > maxHistory) {
                this.sensorHistory[sensor] = this.sensorHistory[sensor].slice(-maxHistory);
            }
        });
    }

    updateTrends() {
        ['temp', 'humidity', 'light', 'audio'].forEach(sensor => {
            const ctx = this.trendCanvases[sensor];
            if (!ctx) return;

            const sensorKey = sensor === 'temp' ? 'temperature' : sensor;
            const history = this.sensorHistory[sensorKey];

            if (history.length < 2) return;

            ctx.clearRect(0, 0, 60, 30);

            const values = history.map(h => h.value);
            const min = Math.min(...values);
            const max = Math.max(...values);
            const range = max - min || 1;

            ctx.strokeStyle = this.getSensorColor(sensor);
            ctx.lineWidth = 2;
            ctx.beginPath();

            history.forEach((point, index) => {
                const x = (index / (history.length - 1)) * 60;
                const y = 30 - ((point.value - min) / range) * 30;

                if (index === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
            });

            ctx.stroke();
        });
    }

    getSensorColor(sensor) {
        const colors = {
            'temp': '#ff6b6b',
            'humidity': '#4ecdc4',
            'light': '#ffd93d',
            'audio': '#a8e6cf'
        };
        return colors[sensor] || '#ffffff';
    }

    updateEffects() {
        this.effects = [];

        // Forza la creazione di effetti anche senza configurazione
        Object.keys(this.sensorData).forEach(sensor => {
            const value = this.sensorData[sensor];
            if (value === undefined) return;

            const config = this.effectsCache[sensor] || this.templates['natura'][sensor];
            if (!config) return;

            let intensity = 0;
            let effectType = '';

            // Calcola effetto basato su template
            if (config.below && value < config.below) {
                intensity = (config.below - value) / config.below;
                effectType = this.getEffectType(sensor, 'below');
            } else if (config.above && value > config.above) {
                intensity = (value - config.above) / (2000 - config.above);
                effectType = this.getEffectType(sensor, 'above');
            } else if (config.any) {
                intensity = Math.max(0.3, value / 2000); // Minimo 30% intensità
                effectType = this.getEffectType(sensor, 'any');
            }

            // Assicura sempre un minimo di intensità per vedere gli effetti
            if (intensity > 0 && effectType) {
                this.effects.push({
                    type: effectType,
                    intensity: Math.max(0.2, Math.min(1, intensity)) * this.effectIntensity,
                    sensor: sensor
                });
            }
        });

        // Se non ci sono effetti, aggiungi almeno un effetto di default
        if (this.effects.length === 0) {
            this.effects.push({
                type: 'snow',
                intensity: 0.5,
                sensor: 'temperature'
            });
        }

        this.updateCounters();
    }

    getEffectType(sensor, condition) {
        // Prima controlla se c'è un effetto personalizzato
        const config = this.effectsCache[sensor];
        if (config && config.effects) {
            for (const effect of config.effects) {
                if (effect.condition === condition) {
                    return effect.effect;
                }
            }
        }

        // Fallback alla mappa predefinita
        const effectMap = {
            natura: {
                temperature: { below: 'snow', above: 'sun_rays' },
                humidity: { below: 'dry_leaves', above: 'rain_drops' },
                light: { below: 'night_stars', above: 'sun_glow' },
                audio: { any: 'wind_waves' }
            },
            spazio: {
                temperature: { below: 'cold_nebula', above: 'solar_flare' },
                humidity: { any: 'cosmic_dust' },
                light: { below: 'deep_space', above: 'star_burst' },
                audio: { any: 'meteor_shower' }
            },
            oceano: {
                temperature: { below: 'ice_crystals', above: 'warm_currents' },
                humidity: { any: 'water_bubbles' },
                light: { below: 'deep_ocean', above: 'surface_rays' },
                audio: { any: 'swimming_fish' }
            }
        };

        const template = this.quadroData.template || 'natura';
        return effectMap[template]?.[sensor]?.[condition] || 'default';
    }
    updateCounters() {
        const activeEffects = document.getElementById('active-effects');
        const activeSensors = document.getElementById('active-sensors');

        if (activeEffects) activeEffects.textContent = this.effects.length;
        if (activeSensors) activeSensors.textContent = Object.keys(this.effectsCache).length;
    }

    renderDarkNebula(width, height, intensity, time) {
        const nebulae = Math.floor(intensity * 3) + 1;

        for (let i = 0; i < nebulae; i++) {
            const x = Math.random() * width;
            const y = Math.random() * height;
            const size = 80 + Math.random() * 120;

            const gradient = this.ctx.createRadialGradient(x, y, 0, x, y, size);
            gradient.addColorStop(0, `rgba(50, 0, 100, ${intensity * 0.4})`);
            gradient.addColorStop(0.5, `rgba(20, 0, 50, ${intensity * 0.2})`);
            gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

            this.ctx.fillStyle = gradient;
            this.ctx.beginPath();
            this.ctx.arc(x, y, size, 0, Math.PI * 2);
            this.ctx.fill();
        }
    }

    renderBrightGalaxy(width, height, intensity, time) {
        const centerX = width / 2;
        const centerY = height / 2;
        const radius = 50 + intensity * 80;

        const gradient = this.ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
        gradient.addColorStop(0, `rgba(255, 255, 255, ${intensity * 0.8})`);
        gradient.addColorStop(0.3, `rgba(200, 150, 255, ${intensity * 0.6})`);
        gradient.addColorStop(1, 'rgba(100, 50, 200, 0)');

        this.ctx.fillStyle = gradient;
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        this.ctx.fill();
    }

    renderShootingComets(width, height, intensity, time) {
        const comets = Math.floor(intensity * 2) + 1;

        for (let i = 0; i < comets; i++) {
            const speed = 3 + Math.random() * 2;
            const x = ((time * speed * 120 + i * 400) % (width + 500)) - 250;
            const y = 30 + Math.sin(time + i) * 80;
            const size = 4 + intensity * 6;

            // Scia
            const trailLength = 100 + intensity * 80;
            const gradient = this.ctx.createLinearGradient(x, y, x - trailLength, y + 40);
            gradient.addColorStop(0, `rgba(255, 200, 0, ${intensity})`);
            gradient.addColorStop(0.5, `rgba(255, 100, 0, ${intensity * 0.6})`);
            gradient.addColorStop(1, 'rgba(255, 0, 0, 0)');

            this.ctx.fillStyle = gradient;
            this.ctx.beginPath();
            this.ctx.ellipse(x - trailLength / 2, y + 20, trailLength / 2, 8, Math.PI * 0.15, 0, Math.PI * 2);
            this.ctx.fill();

            // Testa cometa
            this.ctx.fillStyle = `rgba(255, 255, 200, ${intensity})`;
            this.ctx.beginPath();
            this.ctx.arc(x, y, size, 0, Math.PI * 2);
            this.ctx.fill();
        }
    }
    startAnimation() {
        if (this.animationId) return;

        const animate = (timestamp) => {
            this.updateFPS(timestamp);
            this.render();
            this.animationId = requestAnimationFrame(animate);
        };

        this.animationId = requestAnimationFrame(animate);
    }

    stopAnimation() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }

    updateFPS(timestamp) {
        this.fpsCounter.frames++;

        if (timestamp - this.fpsCounter.lastTime >= 1000) {
            this.fpsCounter.fps = this.fpsCounter.frames;
            this.fpsCounter.frames = 0;
            this.fpsCounter.lastTime = timestamp;

            if (this.showFPS) {
                const fpsElement = document.getElementById('fps-value');
                if (fpsElement) {
                    fpsElement.textContent = this.fpsCounter.fps;
                }
            }
        }
    }

    render() {
        const startTime = performance.now();
        const width = this.canvas.width;
        const height = this.canvas.height;
        const time = Date.now() * 0.001 * this.animationSpeed;

        this.ctx.clearRect(0, 0, width, height);

        if (this.quadroData.template === 'personalizzato' && this.customConfig) {
            this.renderCustomConfig(this.ctx, width, height, time);
        } else {
            this.drawBackground(width, height);
        }

        // Applica eventuali effetti
        this.effects.forEach(effect => {
            this.renderEffect(width, height, effect, time);
        });

        this.renderTime = performance.now() - startTime;

        if (this.debugMode) {
            this.updateDebugInfo();
        }
    }

    drawBackground(width, height) {
        const template = this.quadroData.template || 'personalizzato';
        const ctx = this.ctx;

        switch (template) {
            case 'natura':
                const gradient1 = ctx.createLinearGradient(0, 0, 0, height);
                gradient1.addColorStop(0, '#87CEEB');
                gradient1.addColorStop(1, '#98FB98');
                ctx.fillStyle = gradient1;
                ctx.fillRect(0, 0, width, height);

                ctx.fillStyle = '#228B22';
                ctx.fillRect(0, height * 0.7, width, height * 0.3);
                break;

            case 'spazio':
                const gradient2 = ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, Math.max(width, height) / 2);
                gradient2.addColorStop(0, '#1e3c72');
                gradient2.addColorStop(1, '#0F0F23');
                ctx.fillStyle = gradient2;
                ctx.fillRect(0, 0, width, height);

                ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
                for (let i = 0; i < 50; i++) {
                    const x = Math.random() * width;
                    const y = Math.random() * height;
                    const size = Math.random() * 2;
                    ctx.beginPath();
                    ctx.arc(x, y, size, 0, Math.PI * 2);
                    ctx.fill();
                }
                break;

            case 'oceano':
                const gradient3 = ctx.createLinearGradient(0, 0, 0, height);
                gradient3.addColorStop(0, '#2E86AB');
                gradient3.addColorStop(1, '#A23B72');
                ctx.fillStyle = gradient3;
                ctx.fillRect(0, 0, width, height);

                ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
                ctx.lineWidth = 2;
                for (let i = 0; i < 3; i++) {
                    ctx.beginPath();
                    for (let x = 0; x < width; x += 5) {
                        const y = height * (0.3 + i * 0.2) + Math.sin(x * 0.02 + Date.now() * 0.001) * 10;
                        if (x === 0) {
                            ctx.moveTo(x, y);
                        } else {
                            ctx.lineTo(x, y);
                        }
                    }
                    ctx.stroke();
                }
                break;

            default:
                const gradient4 = ctx.createLinearGradient(0, 0, 0, height);
                gradient4.addColorStop(0, '#667eea');
                gradient4.addColorStop(1, '#764ba2');
                ctx.fillStyle = gradient4;
                ctx.fillRect(0, 0, width, height);
        }
    }

    renderEffect(width, height, effect) {
        const intensity = effect.intensity;
        const time = Date.now() * 0.001 * this.animationSpeed;

        switch (effect.type) {
            case 'snow':
                this.renderSnow(width, height, intensity, time);
                break;
            case 'rain_drops':
                this.renderRain(width, height, intensity, time);
                break;
            case 'sun_rays':
                this.renderSunRays(width, height, intensity, time);
                break;
            case 'night_stars':
                this.renderStars(width, height, intensity, time);
                break;
            case 'cosmic_dust':
                this.renderCosmicDust(width, height, intensity, time);
                break;
            case 'water_bubbles':
                this.renderBubbles(width, height, intensity, time);
                break;
            case 'swimming_fish':
                this.renderFish(width, height, intensity, time);
                break;
            default:
                this.renderDefault(width, height, intensity, time);
        }
    }

    renderSnow(width, height, intensity, time) {
        const flakes = Math.floor(intensity * 30);
        this.ctx.fillStyle = `rgba(255, 255, 255, ${0.8 + intensity * 0.2})`;

        for (let i = 0; i < flakes; i++) {
            const x = (Math.random() * width + time * 10 + i * 50) % width;
            const y = (Math.random() * height + time * 30 + i * 30) % height;
            const size = 2 + Math.random() * 4;

            this.ctx.beginPath();
            this.ctx.arc(x, y, size, 0, Math.PI * 2);
            this.ctx.fill();
        }
    }

    renderRain(width, height, intensity, time) {
        const drops = Math.floor(intensity * 50);
        this.ctx.strokeStyle = `rgba(100, 149, 237, ${intensity * 0.8})`;
        this.ctx.lineWidth = 2;

        for (let i = 0; i < drops; i++) {
            const x = Math.random() * width;
            const y = (Math.random() * height + time * 100 + i * 10) % height;
            const length = 10 + Math.random() * 15;

            this.ctx.beginPath();
            this.ctx.moveTo(x, y);
            this.ctx.lineTo(x - 3, y + length);
            this.ctx.stroke();
        }
    }

    renderSunRays(width, height, intensity, time) {
        const centerX = width * 0.8;
        const centerY = height * 0.2;
        const rayCount = 12;

        this.ctx.strokeStyle = `rgba(255, 255, 0, ${intensity * 0.6})`;
        this.ctx.lineWidth = 3;

        for (let i = 0; i < rayCount; i++) {
            const angle = (i / rayCount) * Math.PI * 2 + time * 0.5;
            const rayLength = 30 + intensity * 40;

            this.ctx.beginPath();
            this.ctx.moveTo(centerX, centerY);
            this.ctx.lineTo(
                centerX + Math.cos(angle) * rayLength,
                centerY + Math.sin(angle) * rayLength
            );
            this.ctx.stroke();
        }
    }

    renderStars(width, height, intensity, time) {
        const stars = Math.floor(intensity * 40);

        for (let i = 0; i < stars; i++) {
            const x = Math.random() * width;
            const y = Math.random() * height * 0.7;
            const size = 1 + Math.random() * 3;
            const twinkle = Math.sin(time * 2 + i) * 0.3 + 0.7;

            this.ctx.fillStyle = `rgba(255, 255, 255, ${intensity * twinkle})`;
            this.ctx.beginPath();
            this.ctx.arc(x, y, size, 0, Math.PI * 2);
            this.ctx.fill();
        }
    }

    renderCosmicDust(width, height, intensity, time) {
        const particles = Math.floor(intensity * 60);

        for (let i = 0; i < particles; i++) {
            const x = Math.random() * width;
            const y = Math.random() * height;
            const size = Math.random() * 2 + 0.5;
            const drift = Math.sin(time + i) * 2;

            this.ctx.fillStyle = `rgba(${150 + Math.random() * 100}, ${100 + Math.random() * 100}, 255, ${intensity * 0.6})`;
            this.ctx.beginPath();
            this.ctx.arc(x + drift, y, size, 0, Math.PI * 2);
            this.ctx.fill();
        }
    }

    renderBubbles(width, height, intensity, time) {
        const bubbles = Math.floor(intensity * 25);

        for (let i = 0; i < bubbles; i++) {
            const x = Math.random() * width;
            const y = ((height + Math.random() * 50) - (time * 40 + i * 15)) % (height + 100);
            const size = 2 + Math.random() * 6;
            const alpha = Math.random() * intensity * 0.7;

            this.ctx.fillStyle = `rgba(173, 216, 230, ${alpha})`;
            this.ctx.strokeStyle = `rgba(100, 149, 237, ${alpha})`;
            this.ctx.lineWidth = 1;

            this.ctx.beginPath();
            this.ctx.arc(x, y, size, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.stroke();
        }
    }

    renderFish(width, height, intensity, time) {
        const fishCount = Math.floor(intensity * 6) + 2;

        for (let i = 0; i < fishCount; i++) {
            const speed = 0.5 + Math.random() * 1;
            const x = ((time * speed * 80 + i * 100) % (width + 150)) - 75;
            const y = 120 + Math.sin(time * 2 + i) * 60;
            const size = 10 + Math.random() * 12;
            const hue = Math.random() * 360;

            this.ctx.fillStyle = `hsla(${hue}, 70%, 60%, ${intensity * 0.8})`;

            this.ctx.beginPath();
            this.ctx.ellipse(x, y, size, size * 0.6, 0, 0, Math.PI * 2);
            this.ctx.fill();

            this.ctx.beginPath();
            this.ctx.ellipse(x - size * 0.8, y, size * 0.4, size * 0.3, 0, 0, Math.PI * 2);
            this.ctx.fill();
        }
    }

    renderDefault(width, height, intensity, time) {
        const particles = Math.floor(intensity * 20);

        for (let i = 0; i < particles; i++) {
            const x = Math.random() * width;
            const y = Math.random() * height;
            const size = 2 + Math.random() * 4;
            const alpha = intensity * 0.7;

            this.ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
            this.ctx.beginPath();
            this.ctx.arc(x, y, size, 0, Math.PI * 2);
            this.ctx.fill();
        }
    }

    updateOverlay() {
        const overlay = document.getElementById('quadro-overlay');
        if (overlay) {
            overlay.classList.toggle('visible', this.showOverlay);
        }
    }

    updateConnection() {
        const indicator = document.getElementById('connection-indicator');
        const dot = indicator?.querySelector('.connection-dot');
        const text = document.getElementById('connection-text');

        if (dot && text) {
            if (this.isConnected) {
                dot.classList.add('connected');
                text.textContent = 'Connesso';
            } else {
                dot.classList.remove('connected');
                text.textContent = 'Disconnesso';
            }
        }
    }

    updateInfo() {
        const updates = {
            'connection-status': this.isConnected ? 'Connesso' : 'Disconnesso',
            'last-update': this.lastUpdate ? this.lastUpdate.toLocaleTimeString() : '--',
            'data-count': this.dataCount.toString()
        };

        Object.entries(updates).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = value;
            }
        });
    }

    updateDebugInfo() {
        if (!this.debugMode) return;

        const updates = {
            'debug-template': this.quadroData.template || 'personalizzato',
            'debug-effects': this.effects.length,
            'debug-sensors': Object.keys(this.effectsCache).length,
            'debug-render-time': `${this.renderTime.toFixed(2)}ms`,
            'debug-fps': this.fpsCounter.fps,
            'debug-canvas-size': `${this.canvas.width}x${this.canvas.height}`,
            'debug-memory': '0MB'
        };

        Object.entries(updates).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = value;
            }
        });
    }

    startAutoHide() {
        if (!this.autoHide) return;

        // Ritarda l'auto-hide per dare tempo di vedere il quadro
        setTimeout(() => {
            this.resetAutoHide();
        }, 5000); // 5 secondi invece di immediato
    }

    resetAutoHide() {
        if (this.autoHideTimer) {
            clearTimeout(this.autoHideTimer);
        }

        this.autoHideTimer = setTimeout(() => {
            if (Date.now() - this.lastMouseMove > 5000) { // 5 secondi invece di 3
                this.showOverlay = false;
                this.updateOverlay();
            }
        }, 5000);
    }

    hideLoading() {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) {
            overlay.classList.add('hidden');
        }
    }

    toggleFullscreen() {
        if (document.fullscreenElement) {
            document.exitFullscreen();
        } else {
            document.documentElement.requestFullscreen();
        }
    }

    updateFullscreenBtn() {
        const btn = document.getElementById('fullscreen-btn');
        if (btn) {
            btn.textContent = this.isFullscreen ? '🔳 Esci Fullscreen' : '🔲 Fullscreen';
        }
    }

    toggleInfo() {
        const panel = document.getElementById('info-panel');
        if (panel) {
            const isVisible = panel.style.display !== 'none';
            panel.style.display = isVisible ? 'none' : 'block';
            if (!isVisible) {
                document.getElementById('settings-panel').style.display = 'none';
            }
        }
    }

    toggleSettings() {
        const panel = document.getElementById('settings-panel');
        if (panel) {
            const isVisible = panel.style.display !== 'none';
            panel.style.display = isVisible ? 'none' : 'block';
            if (!isVisible) {
                document.getElementById('info-panel').style.display = 'none';
            }
        }
    }

    toggleDebug() {
        this.debugMode = !this.debugMode;
        const panel = document.getElementById('debug-panel');
        if (panel) {
            panel.style.display = this.debugMode ? 'block' : 'none';
        }
    }

    toggleOverlay() {
        this.showOverlay = !this.showOverlay;
        this.updateOverlay();
    }

    hideAllPanels() {
        document.getElementById('settings-panel').style.display = 'none';
        document.getElementById('info-panel').style.display = 'none';
        document.getElementById('debug-panel').style.display = 'none';
    }

    setAnimationSpeed(speed) {
        this.animationSpeed = parseFloat(speed);
        const speedValue = document.getElementById('speed-value');
        if (speedValue) {
            speedValue.textContent = `${speed}x`;
        }
    }

    setEffectIntensity(intensity) {
        this.effectIntensity = parseFloat(intensity);
        const intensityValue = document.getElementById('intensity-value');
        if (intensityValue) {
            intensityValue.textContent = `${intensity}x`;
        }
    }

    setRenderQuality(quality) {
        this.renderQuality = quality;
        if (this.ctx) {
            this.ctx.imageSmoothingEnabled = quality !== 'low';
        }
    }

    setPerformanceMode(mode) {
        this.performanceMode = mode;
        switch (mode) {
            case 'performance':
                this.setRenderQuality('low');
                this.setEffectIntensity(0.7);
                break;
            case 'quality':
                this.setRenderQuality('high');
                this.setEffectIntensity(1.2);
                break;
            case 'balanced':
            default:
                this.setRenderQuality('medium');
                this.setEffectIntensity(1.0);
                break;
        }
    }

    setColorTheme(theme) {
        this.colorTheme = theme;
        const container = document.querySelector('.quadro-container');
        if (container) {
            container.classList.remove('theme-warm', 'theme-cool', 'theme-monochrome');
            if (theme !== 'default') {
                container.classList.add(`theme-${theme}`);
            }
        }
    }

    destroy() {
        this.stopAnimation();
        if (this.socket) {
            this.socket.disconnect();
        }
        if (this.autoHideTimer) {
            clearTimeout(this.autoHideTimer);
        }
    }
}

// ============================================================================
// GLOBAL VARIABLES AND FUNCTIONS
// ============================================================================

let quadroViewer;


// Global functions for HTML buttons
function toggleFullscreen() {
    if (quadroViewer) {
        quadroViewer.toggleFullscreen();
    }
}

function toggleSettings() {
    if (quadroViewer) {
        quadroViewer.toggleSettings();
    }
}

function toggleInfo() {
    if (quadroViewer) {
        quadroViewer.toggleInfo();
    }
}

function toggleSensorsPanel() {
    if (quadroViewer) {
        quadroViewer.showSensors = !quadroViewer.showSensors;
        const panel = document.getElementById('sensors-panel');
        if (panel) {
            panel.classList.toggle('hidden', !quadroViewer.showSensors);
        }
    }
}

function toggleFPS() {
    if (quadroViewer) {
        quadroViewer.showFPS = !quadroViewer.showFPS;
        const counter = document.getElementById('fps-counter');
        if (counter) {
            counter.style.display = quadroViewer.showFPS ? 'block' : 'none';
        }
    }
}

function toggleDebugInfo() {
    if (quadroViewer) {
        quadroViewer.toggleDebug();
    }
}

function toggleAutoHide() {
    if (quadroViewer) {
        quadroViewer.autoHide = !quadroViewer.autoHide;
        if (quadroViewer.autoHide) {
            quadroViewer.startAutoHide();
        } else if (quadroViewer.autoHideTimer) {
            clearTimeout(quadroViewer.autoHideTimer);
        }
    }
}

function toggleOverlay() {
    if (quadroViewer) {
        quadroViewer.toggleOverlay();
    }
}

function setAnimationSpeed(speed) {
    if (quadroViewer) {
        quadroViewer.setAnimationSpeed(speed);
    }
}

function setEffectIntensity(intensity) {
    if (quadroViewer) {
        quadroViewer.setEffectIntensity(intensity);
    }
}

function setRenderQuality(quality) {
    if (quadroViewer) {
        quadroViewer.setRenderQuality(quality);
    }
}

function setPerformanceMode(mode) {
    if (quadroViewer) {
        quadroViewer.setPerformanceMode(mode);
    }
}

function setColorTheme(theme) {
    if (quadroViewer) {
        quadroViewer.setColorTheme(theme);
    }
}

function editQuadro() {
    if (quadroViewer && quadroViewer.quadroData.id) {
        window.location.href = `/templates/create_paint.html?edit=${quadroViewer.quadroData.id}`;
    }
}

function goBack() {
    window.history.back();
}

function hideAllPanels() {
    if (quadroViewer) {
        quadroViewer.hideAllPanels();
    }
}

// ============================================================================
// SIMPLE NOTIFICATION SYSTEM
// ============================================================================

function showNotification(message, type = 'info') {
    const container = document.getElementById('notification-container');
    if (!container) return;

    const notification = document.createElement('div');
    notification.className = `notification ${type}`;

    const icons = {
        'info': 'ℹ️',
        'success': '✅',
        'warning': '⚠️',
        'error': '❌'
    };

    notification.innerHTML = `
        <span>${icons[type] || icons.info}</span>
        <span>${message}</span>
        <button onclick="this.parentNode.remove()">×</button>
    `;

    container.appendChild(notification);

    // Auto remove after 3 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, 3000);
}

// ============================================================================
// MOBILE TOUCH SUPPORT
// ============================================================================

let touchStartTime = 0;
let touchCount = 0;

document.addEventListener('touchstart', function (e) {
    touchStartTime = Date.now();
    touchCount++;

    // Reset count after delay
    setTimeout(() => {
        touchCount = 0;
    }, 300);

    // Double tap for fullscreen
    if (touchCount === 2) {
        toggleFullscreen();
        touchCount = 0;
    }
});

document.addEventListener('touchend', function (e) {
    const touchDuration = Date.now() - touchStartTime;

    // Long press for settings
    if (touchDuration > 800) {
        toggleSettings();
    }
});

// ============================================================================
// CLEANUP ON PAGE UNLOAD
// ============================================================================

window.addEventListener('beforeunload', function () {
    if (quadroViewer) {
        quadroViewer.destroy();
    }
});

// ============================================================================
// BASIC STYLES FOR NOTIFICATIONS
// ============================================================================

// Add basic notification styles if not present
if (!document.getElementById('notification-styles')) {
    const style = document.createElement('style');
    style.id = 'notification-styles';
    style.textContent = `
        .notification {
            background: rgba(0, 0, 0, 0.9);
            color: white;
            padding: 12px 16px;
            border-radius: 8px;
            margin-bottom: 10px;
            display: flex;
            align-items: center;
            gap: 10px;
            border-left: 4px solid #667eea;
            font-size: 0.9em;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        }

        .notification.info {
            border-left-color: #4ecdc4;
        }

        .notification.success {
            border-left-color: #48bb78;
        }

        .notification.warning {
            border-left-color: #ffd93d;
        }

        .notification.error {
            border-left-color: #ff6b6b;
        }

        .notification button {
            background: none;
            border: none;
            color: white;
            font-size: 1.2em;
            cursor: pointer;
            padding: 0;
            margin-left: auto;
            opacity: 0.7;
        }

        .notification button:hover {
            opacity: 1;
        }

        @media (max-width: 480px) {
            .notification-container {
                left: 10px;
                right: 10px;
            }
        }
    `;
    document.head.appendChild(style);
}

// ============================================================================
// FINAL INITIALIZATION MESSAGE
// ============================================================================

console.log('🎨 QuadroViewer v3.0 - Versione Semplificata');
console.log('✅ Sistema pronto per la visualizzazione quadri viventi');
console.log('📱 Supporto completo per desktop e mobile');
console.log('🎯 Compatibile con tutti i template: Natura, Spazio, Oceano');

// Show success notification after initialization
document.addEventListener('DOMContentLoaded', function () {
    setTimeout(() => {
        showNotification('QuadroViewer v3.0 caricato con successo!', 'success');
    }, 1000);
});