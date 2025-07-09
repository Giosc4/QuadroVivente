// ============================================================================
// QUADRO FULLSCREEN - VISUALIZZAZIONE IMMERSIVA
// Sistema per visualizzare i quadri a schermo intero con animazioni real-time
// ============================================================================

class QuadroViewer {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.socket = null;
        this.quadroData = window.quadroData || {};
        this.sensorData = { t: 20, h: 50, l: 2000, a: 500 };
        this.sensorHistory = {
            temperature: [],
            humidity: [],
            light: [],
            audio: []
        };
        this.isFullscreen = false;
        this.showOverlay = true;
        this.showSensors = true;
        this.showFPS = false;
        this.autoHide = true;
        this.autoHideTimer = null;
        this.animationSpeed = 1.0;
        this.renderQuality = 'medium';
        this.isConnected = false;
        this.lastUpdate = null;
        this.dataCount = 0;
        this.animationId = null;
        this.fpsCounter = { frames: 0, lastTime: 0, fps: 0 };
        this.lastMouseMove = Date.now();
        this.trendCanvases = {};

        this.init();
    }

    init() {
        this.setupCanvas();
        this.setupSocket();
        this.setupEventListeners();
        this.setupTrendCanvases();
        this.loadQuadroData();
        this.startAnimation();
        this.startAutoHide();
        this.hideLoadingOverlay();
    }

    setupCanvas() {
        this.canvas = document.getElementById('quadro-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.resizeCanvas();

        // Ottimizzazioni per il rendering
        this.ctx.imageSmoothingEnabled = this.renderQuality !== 'low';
        this.ctx.textBaseline = 'middle';
    }

    resizeCanvas() {
        const dpr = window.devicePixelRatio || 1;
        const rect = this.canvas.getBoundingClientRect();

        this.canvas.width = rect.width * dpr;
        this.canvas.height = rect.height * dpr;

        this.ctx.scale(dpr, dpr);
        this.canvas.style.width = rect.width + 'px';
        this.canvas.style.height = rect.height + 'px';
    }

    setupSocket() {
        this.socket = io();

        this.socket.on('connect', () => {
            this.isConnected = true;
            this.updateConnectionStatus();
            console.log('Connesso al server');
        });

        this.socket.on('disconnect', () => {
            this.isConnected = false;
            this.updateConnectionStatus();
            console.log('Disconnesso dal server');
        });

        this.socket.on('device_data_update', (data) => {
            if (data.device_id === this.quadroData.deviceId) {
                this.handleSensorUpdate(data);
            }
        });

        this.socket.on('quadro_config_update', (data) => {
            if (data.quadro_id === this.quadroData.id) {
                this.updateQuadroConfig(data);
            }
        });
    }

    setupEventListeners() {
        // Resize handler
        window.addEventListener('resize', () => {
            this.resizeCanvas();
        });

        // Mouse movement for auto-hide
        document.addEventListener('mousemove', (e) => {
            this.lastMouseMove = Date.now();
            this.showOverlay = true;
            this.updateOverlayVisibility();
            this.resetAutoHideTimer();
        });

        // Touch events for mobile
        document.addEventListener('touchstart', (e) => {
            this.lastMouseMove = Date.now();
            this.showOverlay = !this.showOverlay;
            this.updateOverlayVisibility();
            this.resetAutoHideTimer();
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            this.handleKeyPress(e);
        });

        // Fullscreen change
        document.addEventListener('fullscreenchange', () => {
            this.isFullscreen = document.fullscreenElement !== null;
            this.updateFullscreenButton();
        });

        // Visibility change
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                this.startAnimation();
            } else {
                this.stopAnimation();
            }
        });
    }

    setupTrendCanvases() {
        const sensors = ['temp', 'humidity', 'light', 'audio'];
        sensors.forEach(sensor => {
            const trendElement = document.getElementById(`${sensor}-trend`);
            if (trendElement) {
                const canvas = trendElement.querySelector('canvas');
                if (canvas) {
                    this.trendCanvases[sensor] = canvas.getContext('2d');
                }
            }
        });
    }

    async loadQuadroData() {
        try {
            const response = await fetch(`/api/quadri/${this.quadroData.id}`);
            if (response.ok) {
                const data = await response.json();
                this.quadroData = { ...this.quadroData, ...data };
                this.updateQuadroInfo();
            }
        } catch (error) {
            console.error('Errore nel caricamento dati quadro:', error);
        }
    }

    updateQuadroInfo() {
        const templateName = this.getTemplateName(this.quadroData.template);
        document.getElementById('template-name').textContent = templateName;
        document.getElementById('data-count').textContent = this.dataCount;

        if (this.lastUpdate) {
            document.getElementById('last-update').textContent =
                new Date(this.lastUpdate).toLocaleTimeString();
        }
    }

    getTemplateName(template) {
        const templates = {
            'naturale': 'Paesaggio Naturale',
            'geometrico': 'Forme Geometriche',
            'minimalista': 'Stile Minimalista',
            'acquatico': 'Mondo Acquatico'
        };
        return templates[template] || 'Personalizzato';
    }

    handleSensorUpdate(data) {
        this.sensorData = {
            t: data.data.temperature,
            h: data.data.humidity,
            l: data.data.light,
            a: data.data.audio
        };

        this.lastUpdate = new Date();
        this.dataCount++;

        // Aggiorna cronologia per i grafici di tendenza
        this.updateSensorHistory();

        // Aggiorna UI
        this.updateSensorDisplay();
        this.updateTrendGraphs();
        this.updateQuadroInfo();

        console.log('Dati sensori aggiornati:', this.sensorData);
    }

    updateSensorHistory() {
        const maxHistory = 50; // Mantieni ultimi 50 valori
        const timestamp = Date.now();

        this.sensorHistory.temperature.push({ value: this.sensorData.t, time: timestamp });
        this.sensorHistory.humidity.push({ value: this.sensorData.h, time: timestamp });
        this.sensorHistory.light.push({ value: this.sensorData.l, time: timestamp });
        this.sensorHistory.audio.push({ value: this.sensorData.a, time: timestamp });

        // Mantieni solo gli ultimi valori
        Object.keys(this.sensorHistory).forEach(key => {
            if (this.sensorHistory[key].length > maxHistory) {
                this.sensorHistory[key] = this.sensorHistory[key].slice(-maxHistory);
            }
        });
    }

    updateSensorDisplay() {
        // Aggiorna i valori visualizzati
        document.getElementById('temp-value').textContent = `${this.sensorData.t.toFixed(1)}°C`;
        document.getElementById('humidity-value').textContent = `${this.sensorData.h.toFixed(1)}%`;
        document.getElementById('light-value').textContent = this.sensorData.l.toString();
        document.getElementById('audio-value').textContent = this.sensorData.a.toString();

        // Aggiungi classi per i colori basati sui valori
        this.updateSensorColors();
    }

    updateSensorColors() {
        const tempElement = document.getElementById('temp-value');
        const humidityElement = document.getElementById('humidity-value');
        const lightElement = document.getElementById('light-value');
        const audioElement = document.getElementById('audio-value');

        // Temperatura
        tempElement.className = 'sensor-value';
        if (this.sensorData.t < 10 || this.sensorData.t > 35) {
            tempElement.classList.add('warning');
        } else if (this.sensorData.t < 5 || this.sensorData.t > 40) {
            tempElement.classList.add('critical');
        } else {
            tempElement.classList.add('good');
        }

        // Umidità
        humidityElement.className = 'sensor-value';
        if (this.sensorData.h < 30 || this.sensorData.h > 80) {
            humidityElement.classList.add('warning');
        } else if (this.sensorData.h < 20 || this.sensorData.h > 90) {
            humidityElement.classList.add('critical');
        } else {
            humidityElement.classList.add('good');
        }

        // Luce
        lightElement.className = 'sensor-value';
        if (this.sensorData.l < 500) {
            lightElement.classList.add('warning');
        } else {
            lightElement.classList.add('good');
        }

        // Audio
        audioElement.className = 'sensor-value';
        if (this.sensorData.a > 3000) {
            audioElement.classList.add('warning');
        } else if (this.sensorData.a > 3500) {
            audioElement.classList.add('critical');
        } else {
            audioElement.classList.add('good');
        }
    }

    updateTrendGraphs() {
        const sensors = ['temp', 'humidity', 'light', 'audio'];

        sensors.forEach(sensor => {
            const ctx = this.trendCanvases[sensor];
            if (!ctx) return;

            const sensorKey = this.getSensorKey(sensor);
            const history = this.sensorHistory[sensorKey];

            if (history.length < 2) return;

            // Pulisci canvas
            ctx.clearRect(0, 0, 60, 30);

            // Trova min e max per la scala
            const values = history.map(h => h.value);
            const min = Math.min(...values);
            const max = Math.max(...values);
            const range = max - min || 1;

            // Disegna la linea di tendenza
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

            // Aggiungi indicatore di tendenza
            this.updateTrendIndicator(sensor, history);
        });
    }

    updateTrendIndicator(sensor, history) {
        if (history.length < 5) return;

        const recent = history.slice(-5);
        const trend = recent[recent.length - 1].value - recent[0].value;

        const trendElement = document.getElementById(`${sensor}-trend`);
        trendElement.className = 'sensor-trend';

        if (Math.abs(trend) < 0.5) {
            trendElement.classList.add('stable');
        } else if (trend > 0) {
            trendElement.classList.add('trending-up');
        } else {
            trendElement.classList.add('trending-down');
        }
    }

    getSensorKey(sensor) {
        const mapping = {
            'temp': 'temperature',
            'humidity': 'humidity',
            'light': 'light',
            'audio': 'audio'
        };
        return mapping[sensor] || sensor;
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

    updateConnectionStatus() {
        const indicator = document.getElementById('connection-indicator');
        const dot = indicator.querySelector('.connection-dot');
        const text = indicator.querySelector('span');

        if (this.isConnected) {
            dot.className = 'connection-dot connected';
            text.textContent = 'Connesso';
        } else {
            dot.className = 'connection-dot';
            text.textContent = 'Disconnesso';
        }

        document.getElementById('connection-status').textContent =
            this.isConnected ? 'Connesso' : 'Disconnesso';
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
                document.getElementById('fps-value').textContent = this.fpsCounter.fps;
            }
        }
    }

    render() {
        const ctx = this.ctx;
        const canvas = this.canvas;
        const rect = canvas.getBoundingClientRect();

        // Pulisci canvas
        ctx.clearRect(0, 0, rect.width, rect.height);

        // Disegna il quadro basato sul template
        this.renderQuadro(ctx, rect.width, rect.height);
    }

    renderQuadro(ctx, width, height) {
        const template = this.quadroData.template || 'naturale';

        // Disegna lo sfondo
        this.renderBackground(ctx, width, height, template);

        // Disegna le animazioni basate sui sensori
        this.renderAnimations(ctx, width, height, template);

        // Disegna elementi decorativi
        this.renderDecorations(ctx, width, height, template);
    }

    renderBackground(ctx, width, height, template) {
        switch (template) {
            case 'naturale':
                this.renderNaturalBackground(ctx, width, height);
                break;
            case 'geometrico':
                this.renderGeometricBackground(ctx, width, height);
                break;
            case 'minimalista':
                this.renderMinimalistBackground(ctx, width, height);
                break;
            case 'acquatico':
                this.renderAquaticBackground(ctx, width, height);
                break;
            default:
                this.renderDefaultBackground(ctx, width, height);
        }
    }

    renderNaturalBackground(ctx, width, height) {
        // Cielo che cambia colore con la temperatura
        const tempNormalized = Math.max(0, Math.min(1, (this.sensorData.t - 0) / 40));
        const skyColor1 = this.interpolateColor([135, 206, 235], [255, 200, 150], tempNormalized);
        const skyColor2 = this.interpolateColor([152, 251, 152], [255, 160, 122], tempNormalized);

        const skyGradient = ctx.createLinearGradient(0, 0, 0, height * 0.6);
        skyGradient.addColorStop(0, `rgb(${skyColor1.join(',')})`);
        skyGradient.addColorStop(1, `rgb(${skyColor2.join(',')})`);

        ctx.fillStyle = skyGradient;
        ctx.fillRect(0, 0, width, height * 0.6);

        // Sole che si muove con la luce
        const lightNormalized = Math.max(0, Math.min(1, this.sensorData.l / 4095));
        const sunX = width * 0.1 + (width * 0.8 * lightNormalized);
        const sunY = height * 0.1 + (height * 0.3 * (1 - lightNormalized));
        const sunSize = 30 + (20 * lightNormalized);

        ctx.fillStyle = `rgba(255, 223, 0, ${0.5 + 0.5 * lightNormalized})`;
        ctx.beginPath();
        ctx.arc(sunX, sunY, sunSize, 0, 2 * Math.PI);
        ctx.fill();

        // Montagne
        ctx.fillStyle = '#8B4513';
        ctx.beginPath();
        ctx.moveTo(0, height * 0.6);
        ctx.lineTo(width * 0.2, height * 0.4);
        ctx.lineTo(width * 0.5, height * 0.5);
        ctx.lineTo(width * 0.8, height * 0.35);
        ctx.lineTo(width, height * 0.45);
        ctx.lineTo(width, height * 0.6);
        ctx.closePath();
        ctx.fill();

        // Terreno
        ctx.fillStyle = '#228B22';
        ctx.fillRect(0, height * 0.6, width, height * 0.4);

        // Nuvole che si muovono con l'umidità
        const cloudCount = Math.floor(this.sensorData.h / 20);
        const time = Date.now() * 0.001 * this.animationSpeed;

        ctx.fillStyle = `rgba(255, 255, 255, ${0.3 + 0.4 * this.sensorData.h / 100})`;
        for (let i = 0; i < cloudCount; i++) {
            const x = (width * 0.2 * i + time * 20) % (width + 100) - 50;
            const y = height * 0.2 + Math.sin(time + i) * 30;
            this.drawCloud(ctx, x, y, 60 + i * 10);
        }
    }

    renderGeometricBackground(ctx, width, height) {
        // Sfondo scuro
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(0, 0, width, height);

        // Griglia che reagisce all'audio
        const audioNormalized = Math.max(0, Math.min(1, this.sensorData.a / 4095));
        const gridSize = 50 + (audioNormalized * 50);

        ctx.strokeStyle = `rgba(102, 126, 234, ${0.3 + 0.4 * audioNormalized})`;
        ctx.lineWidth = 1 + audioNormalized;

        for (let x = 0; x < width; x += gridSize) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
        }

        for (let y = 0; y < height; y += gridSize) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }

        // Forme geometriche animate
        const time = Date.now() * 0.001 * this.animationSpeed;
        const shapes = 5;

        for (let i = 0; i < shapes; i++) {
            const x = (width / shapes) * i + width / shapes / 2;
            const y = height / 2 + Math.sin(time + i) * 50;
            const size = 30 + this.sensorData.t * 2;
            const hue = (i * 60 + time * 30) % 360;

            ctx.fillStyle = `hsla(${hue}, 70%, 50%, ${0.7 + 0.3 * audioNormalized})`;

            if (i % 2 === 0) {
                ctx.fillRect(x - size / 2, y - size / 2, size, size);
            } else {
                ctx.beginPath();
                ctx.arc(x, y, size / 2, 0, 2 * Math.PI);
                ctx.fill();
            }
        }
    }

    renderMinimalistBackground(ctx, width, height) {
        // Sfondo che cambia con la luce
        const lightNormalized = Math.max(0, Math.min(1, this.sensorData.l / 4095));
        const bgColor = Math.floor(240 + (15 * lightNormalized));

        ctx.fillStyle = `rgb(${bgColor}, ${bgColor}, ${bgColor})`;
        ctx.fillRect(0, 0, width, height);

        // Linee minimaliste
        ctx.strokeStyle = `rgba(51, 51, 51, ${0.5 + 0.5 * lightNormalized})`;
        ctx.lineWidth = 2;

        // Linea centrale verticale
        ctx.beginPath();
        ctx.moveTo(width / 2, 0);
        ctx.lineTo(width / 2, height);
        ctx.stroke();

        // Linea centrale orizzontale
        ctx.beginPath();
        ctx.moveTo(0, height / 2);
        ctx.lineTo(width, height / 2);
        ctx.stroke();

        // Elemento centrale che pulsa con l'audio
        const audioNormalized = Math.max(0, Math.min(1, this.sensorData.a / 4095));
        const centerSize = 30 + (audioNormalized * 20);

        ctx.fillStyle = `rgba(102, 126, 234, ${0.5 + 0.5 * audioNormalized})`;
        ctx.beginPath();
        ctx.arc(width / 2, height / 2, centerSize, 0, 2 * Math.PI);
        ctx.fill();
    }

    renderAquaticBackground(ctx, width, height) {
        // Acqua con sfumatura di profondità
        const humidityNormalized = Math.max(0, Math.min(1, this.sensorData.h / 100));
        const waterColor1 = this.interpolateColor([135, 206, 235], [0, 0, 139], humidityNormalized);
        const waterColor2 = this.interpolateColor([0, 0, 139], [25, 25, 112], humidityNormalized);

        const waterGradient = ctx.createLinearGradient(0, 0, 0, height);
        waterGradient.addColorStop(0, `rgb(${waterColor1.join(',')})`);
        waterGradient.addColorStop(1, `rgb(${waterColor2.join(',')})`);

        ctx.fillStyle = waterGradient;
        ctx.fillRect(0, 0, width, height);

        // Onde che si muovono con l'audio
        const time = Date.now() * 0.001 * this.animationSpeed;
        const audioNormalized = Math.max(0, Math.min(1, this.sensorData.a / 4095));
        const waveCount = 3 + Math.floor(audioNormalized * 3);

        ctx.strokeStyle = `rgba(255, 255, 255, ${0.2 + 0.3 * audioNormalized})`;
        ctx.lineWidth = 2;

        for (let i = 0; i < waveCount; i++) {
            ctx.beginPath();
            for (let x = 0; x < width; x++) {
                const y = height * 0.2 + i * height * 0.15 +
                    Math.sin(x * 0.01 + time + i) * (10 + audioNormalized * 20);
                if (x === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
            }
            ctx.stroke();
        }

        // Bolle che salgono con l'umidità
        const bubbleCount = Math.floor(humidityNormalized * 15);
        ctx.fillStyle = `rgba(255, 255, 255, ${0.3 + 0.4 * humidityNormalized})`;

        for (let i = 0; i < bubbleCount; i++) {
            const x = (width / bubbleCount) * i + Math.sin(time + i) * 50;
            const y = height - ((time * 50 + i * 100) % (height + 50));
            const size = 5 + Math.sin(time + i) * 3;

            ctx.beginPath();
            ctx.arc(x, y, size, 0, 2 * Math.PI);
            ctx.fill();
        }
    }

    renderDefaultBackground(ctx, width, height) {
        // Sfondo gradiente semplice
        const gradient = ctx.createLinearGradient(0, 0, 0, height);
        gradient.addColorStop(0, '#2a2a2a');
        gradient.addColorStop(1, '#1a1a1a');

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);

        // Elemento centrale
        ctx.fillStyle = '#667eea';
        ctx.font = '48px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Quadro Vivente', width / 2, height / 2);
    }

    renderAnimations(ctx, width, height, template) {
        // Implementa animazioni specifiche per ogni template
        // Questa è una versione semplificata
    }

    renderDecorations(ctx, width, height, template) {
        // Aggiungi elementi decorativi se necessario
    }

    drawCloud(ctx, x, y, size) {
        ctx.save();
        ctx.translate(x, y);
        ctx.beginPath();
        ctx.arc(0, 0, size * 0.5, 0, 2 * Math.PI);
        ctx.arc(size * 0.3, 0, size * 0.4, 0, 2 * Math.PI);
        ctx.arc(size * 0.6, 0, size * 0.3, 0, 2 * Math.PI);
        ctx.arc(size * 0.15, -size * 0.3, size * 0.35, 0, 2 * Math.PI);
        ctx.arc(size * 0.45, -size * 0.3, size * 0.4, 0, 2 * Math.PI);
        ctx.fill();
        ctx.restore();
    }

    interpolateColor(color1, color2, factor) {
        return color1.map((c, i) => Math.round(c + factor * (color2[i] - c)));
    }

    handleKeyPress(event) {
        switch (event.key) {
            case 'f':
            case 'F':
                this.toggleFullscreen();
                break;
            case 'h':
            case 'H':
                this.toggleOverlay();
                break;
            case 's':
            case 'S':
                this.toggleSensorsPanel();
                break;
            case 'i':
            case 'I':
                this.toggleInfo();
                break;
            case 'Escape':
                if (this.isFullscreen) {
                    this.exitFullscreen();
                }
                break;
        }
    }

    startAutoHide() {
        this.resetAutoHideTimer();
    }

    resetAutoHideTimer() {
        if (this.autoHideTimer) {
            clearTimeout(this.autoHideTimer);
        }

        if (this.autoHide) {
            this.autoHideTimer = setTimeout(() => {
                if (Date.now() - this.lastMouseMove > 3000) {
                    this.showOverlay = false;
                    this.updateOverlayVisibility();
                }
            }, 3000);
        }
    }

    updateOverlayVisibility() {
        const overlay = document.getElementById('quadro-overlay');
        const body = document.body;

        if (this.showOverlay) {
            overlay.classList.add('visible');
            body.classList.add('show-cursor');
        } else {
            overlay.classList.remove('visible');
            body.classList.remove('show-cursor');
        }
    }

    updateFullscreenButton() {
        const button = document.getElementById('fullscreen-btn');
        button.textContent = this.isFullscreen ? '🔳 Esci Fullscreen' : '🔲 Fullscreen';
    }

    hideLoadingOverlay() {
        const overlay = document.getElementById('loading-overlay');
        overlay.classList.add('hidden');
    }

    // Metodi di controllo pubblici
    toggleFullscreen() {
        if (this.isFullscreen) {
            this.exitFullscreen();
        } else {
            this.enterFullscreen();
        }
    }

    enterFullscreen() {
        const element = document.documentElement;
        if (element.requestFullscreen) {
            element.requestFullscreen();
        } else if (element.webkitRequestFullscreen) {
            element.webkitRequestFullscreen();
        } else if (element.msRequestFullscreen) {
            element.msRequestFullscreen();
        }
    }

    exitFullscreen() {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
        } else if (document.msExitFullscreen) {
            document.msExitFullscreen();
        }
    }

    toggleOverlay() {
        this.showOverlay = !this.showOverlay;
        this.updateOverlayVisibility();
        this.resetAutoHideTimer();
    }

    toggleSensorsPanel() {
        this.showSensors = !this.showSensors;
        const panel = document.getElementById('sensors-panel');
        panel.style.display = this.showSensors ? 'block' : 'none';
        document.getElementById('show-sensors').checked = this.showSensors;
    }

    toggleInfo() {
        const infoPanel = document.getElementById('info-panel');
        const settingsPanel = document.getElementById('settings-panel');

        if (infoPanel.style.display === 'none') {
            infoPanel.style.display = 'block';
            settingsPanel.style.display = 'none';
        } else {
            infoPanel.style.display = 'none';
        }
    }

    toggleSettings() {
        const settingsPanel = document.getElementById('settings-panel');
        const infoPanel = document.getElementById('info-panel');

        if (settingsPanel.style.display === 'none') {
            settingsPanel.style.display = 'block';
            infoPanel.style.display = 'none';
        } else {
            settingsPanel.style.display = 'none';
        }
    }

    toggleFPS() {
        this.showFPS = !this.showFPS;
        const fpsCounter = document.getElementById('fps-counter');
        fpsCounter.style.display = this.showFPS ? 'block' : 'none';
    }

    setAnimationSpeed(speed) {
        this.animationSpeed = parseFloat(speed);
        document.getElementById('speed-value').textContent = `${speed}x`;
    }

    setRenderQuality(quality) {
        this.renderQuality = quality;
        this.ctx.imageSmoothingEnabled = quality !== 'low';

        // Aggiorna la risoluzione del canvas
        this.resizeCanvas();
    }

    toggleAutoHide() {
        this.autoHide = !this.autoHide;

        if (this.autoHide) {
            this.resetAutoHideTimer();
        } else {
            if (this.autoHideTimer) {
                clearTimeout(this.autoHideTimer);
            }
        }
    }

    goBack() {
        window.history.back();
    }
}

// ============================================================================
// FUNZIONI GLOBALI
// ============================================================================

let quadroViewer;

// Inizializzazione quando il DOM è pronto
document.addEventListener('DOMContentLoaded', function () {
    quadroViewer = new QuadroViewer();
});

// Funzioni di controllo globali
function toggleFullscreen() {
    quadroViewer.toggleFullscreen();
}

function toggleOverlay() {
    quadroViewer.toggleOverlay();
}

function toggleSettings() {
    quadroViewer.toggleSettings();
}

function toggleInfo() {
    quadroViewer.toggleInfo();
}

function toggleSensorsPanel() {
    quadroViewer.toggleSensorsPanel();
}

function toggleFPS() {
    quadroViewer.toggleFPS();
}

function setAnimationSpeed(speed) {
    quadroViewer.setAnimationSpeed(speed);
}

function setRenderQuality(quality) {
    quadroViewer.setRenderQuality(quality);
}

function toggleAutoHide() {
    quadroViewer.toggleAutoHide();
}

function goBack() {
    quadroViewer.goBack();
}

// Gestione eventi touch per mobile
let touchStartY = 0;
let touchEndY = 0;

document.addEventListener('touchstart', function (e) {
    touchStartY = e.changedTouches[0].screenY;
});

document.addEventListener('touchend', function (e) {
    touchEndY = e.changedTouches[0].screenY;
    handleSwipe();
});

function handleSwipe() {
    const swipeThreshold = 50;
    const diff = touchStartY - touchEndY;

    if (Math.abs(diff) > swipeThreshold) {
        if (diff > 0) {
            // Swipe up - show controls
            quadroViewer.showOverlay = true;
            quadroViewer.updateOverlayVisibility();
        } else {
            // Swipe down - hide controls
            quadroViewer.showOverlay = false;
            quadroViewer.updateOverlayVisibility();
        }
    }
}

// Performance monitoring
if (typeof performance !== 'undefined' && performance.mark) {
    performance.mark('quadro-viewer-start');

    window.addEventListener('load', function () {
        performance.mark('quadro-viewer-loaded');
        performance.measure('quadro-viewer-load-time', 'quadro-viewer-start', 'quadro-viewer-loaded');

        const measures = performance.getEntriesByType('measure');
        measures.forEach(measure => {
            console.log(`${measure.name}: ${measure.duration}ms`);
        });
    });
}