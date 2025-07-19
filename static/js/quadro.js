// ============================================================================
// QUADRO VIVENTE - SISTEMA DI VISUALIZZAZIONE
// JavaScript per la visualizzazione e controllo del quadro vivente
// ============================================================================

class QuadroViewer {
    constructor(quadroId) {
        this.quadroId = quadroId;
        this.socket = null;
        this.canvas = null;
        this.ctx = null;
        this.animationId = null;
        this.isPlaying = true;
        this.isFullscreen = false;
        this.showInfo = false;
        
        // Dati del quadro
        this.quadroData = null;
        this.deviceId = null;
        
        // Valori sensori attuali
        this.sensorValues = {
            temperature: 20.5,
            humidity: 65,
            light: 1250,
            audio: 850
        };
        
        // Stato connessione
        this.isConnected = false;
        this.lastUpdate = null;
        
        // Performance tracking
        this.frameCount = 0;
        this.lastFpsUpdate = Date.now();
        this.currentFps = 60;
        
        // Controlli fullscreen
        this.mouseTimeout = null;
        this.showControls = false;
        
        // Background layers per effetti complessi
        this.backgroundLayers = [];
        this.animationLayers = [];
        
        // Cache per SVG e immagini
        this.imageCache = new Map();
        this.svgCache = new Map();
        
        this.init();
    }

    async init() {
        try {
            this.setupCanvas();
            this.setupEventListeners();
            await this.loadQuadroData();
            this.setupSocket();
            this.startAnimation();
            this.hideLoading();
        } catch (error) {
            console.error('Errore inizializzazione:', error);
            this.showError('Errore nel caricamento del quadro: ' + error.message);
        }
    }

    setupCanvas() {
        this.canvas = document.getElementById('quadro-canvas');
        this.ctx = this.canvas.getContext('2d');
        
        // Ottimizzazioni per performance
        this.ctx.imageSmoothingEnabled = true;
        this.ctx.imageSmoothingQuality = 'high';
        
        this.resizeCanvas();
    }

    resizeCanvas() {
        const container = document.querySelector('.quadro-main');
        const rect = container.getBoundingClientRect();
        
        if (this.isFullscreen) {
            this.canvas.width = window.screen.width;
            this.canvas.height = window.screen.height;
        } else {
            // Mantieni aspect ratio 16:9 o usa quello del container
            const aspectRatio = 16 / 9;
            let width = rect.width - 40; // margini
            let height = width / aspectRatio;
            
            if (height > rect.height - 40) {
                height = rect.height - 40;
                width = height * aspectRatio;
            }
            
            this.canvas.width = Math.floor(width);
            this.canvas.height = Math.floor(height);
        }
    }

    setupEventListeners() {
        // Resize
        window.addEventListener('resize', () => this.resizeCanvas());
        
        // Fullscreen events
        document.addEventListener('fullscreenchange', () => this.handleFullscreenChange());
        document.addEventListener('webkitfullscreenchange', () => this.handleFullscreenChange());
        document.addEventListener('mozfullscreenchange', () => this.handleFullscreenChange());
        document.addEventListener('MSFullscreenChange', () => this.handleFullscreenChange());
        
        // Mouse movement in fullscreen
        document.addEventListener('mousemove', () => this.handleMouseMove());
        document.addEventListener('keydown', (e) => this.handleKeyDown(e));
        
        // Canvas click per toggle info
        this.canvas.addEventListener('click', () => {
            if (!this.isFullscreen) {
                this.toggleInfo();
            }
        });
        
        // Prevent context menu
        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    async loadQuadroData() {
        try {
            const response = await fetch(`/api/quadri/${this.quadroId}`);
            if (!response.ok) {
                throw new Error(`Quadro non trovato (${response.status})`);
            }
            
            this.quadroData = await response.json();
            this.deviceId = this.quadroData.device_id;
            
            // Aggiorna UI
            document.getElementById('quadro-title').textContent = `🎨 ${this.quadroData.name}`;
            document.getElementById('info-name').textContent = this.quadroData.name;
            document.getElementById('info-device').textContent = this.deviceId || 'N/A';
            
            // Conta triggers
            const triggerCount = Object.values(this.quadroData.triggers || {})
                .reduce((total, triggers) => total + triggers.length, 0);
            document.getElementById('info-triggers').textContent = triggerCount.toString();
            
            // Precarica risorse
            await this.preloadResources();
            
        } catch (error) {
            throw new Error('Impossibile caricare i dati del quadro: ' + error.message);
        }
    }

    async preloadResources() {
        if (!this.quadroData.uploaded_files) return;
        
        // Precarica immagini e SVG
        for (const file of this.quadroData.uploaded_files) {
            try {
                const url = `/uploads/${file.id}`;
                if (file.type.startsWith('image/') || file.name.endsWith('.svg')) {
                    const img = new Image();
                    img.crossOrigin = 'anonymous';
                    img.src = url;
                    await new Promise((resolve, reject) => {
                        img.onload = resolve;
                        img.onerror = reject;
                    });
                    this.imageCache.set(file.id, img);
                }
            } catch (error) {
                console.warn(`Impossibile caricare ${file.name}:`, error);
            }
        }
    }

    setupSocket() {
        if (typeof io === 'undefined') {
            console.warn('Socket.IO non disponibile, modalità offline');
            this.updateConnectionStatus(false);
            return;
        }

        this.socket = io();

        this.socket.on('connect', () => {
            console.log('Connesso al server');
            this.isConnected = true;
            this.updateConnectionStatus(true);
            
            // Iscriviti agli aggiornamenti del device specifico
            if (this.deviceId) {
                this.socket.emit('subscribe_device', this.deviceId);
            }
        });

        this.socket.on('device_data_update', (data) => {
            if (data.device_id === this.deviceId) {
                this.handleSensorUpdate(data.data);
            }
        });

        this.socket.on('disconnect', () => {
            console.log('Disconnesso dal server');
            this.isConnected = false;
            this.updateConnectionStatus(false);
        });

        this.socket.on('connect_error', (error) => {
            console.error('Errore connessione:', error);
            this.updateConnectionStatus(false);
        });
    }

    handleSensorUpdate(data) {
        // Aggiorna valori sensori
        if (data.temperature !== undefined) this.sensorValues.temperature = data.temperature;
        if (data.humidity !== undefined) this.sensorValues.humidity = data.humidity;
        if (data.light !== undefined) this.sensorValues.light = data.light;
        if (data.audio !== undefined) this.sensorValues.audio = data.audio;
        
        this.lastUpdate = new Date();
        this.updateSensorDisplay();
        this.updateInfoDisplay();
    }

    updateSensorDisplay() {
        document.getElementById('temp-value').textContent = `${this.sensorValues.temperature.toFixed(1)}°C`;
        document.getElementById('humidity-value').textContent = `${this.sensorValues.humidity.toFixed(0)}%`;
        document.getElementById('light-value').textContent = this.sensorValues.light.toFixed(0);
        document.getElementById('audio-value').textContent = this.sensorValues.audio.toFixed(0);
    }

    updateConnectionStatus(connected) {
        const indicator = document.getElementById('status-indicator');
        const text = document.getElementById('status-text');
        const subtitle = document.getElementById('quadro-subtitle');
        
        if (connected) {
            indicator.className = 'status-indicator connected';
            text.textContent = 'Connesso';
            subtitle.textContent = 'Live dal dispositivo ESP32';
        } else {
            indicator.className = 'status-indicator';
            text.textContent = 'Disconnesso';
            subtitle.textContent = 'Modalità offline';
        }
    }

    updateInfoDisplay() {
        document.getElementById('info-status').textContent = this.isConnected ? 'Online' : 'Offline';
        document.getElementById('info-fps').textContent = `${this.currentFps.toFixed(1)} FPS`;
        
        if (this.lastUpdate) {
            const timeAgo = Math.floor((Date.now() - this.lastUpdate.getTime()) / 1000);
            document.getElementById('info-update').textContent = 
                timeAgo < 60 ? `${timeAgo}s fa` : `${Math.floor(timeAgo/60)}m fa`;
        }
        
        // Aggiorna triggers attivi
        this.updateActiveTriggers();
    }

    updateActiveTriggers() {
        const container = document.getElementById('active-triggers');
        if (!this.quadroData || !this.quadroData.triggers) return;
        
        const activeTriggers = [];
        
        Object.entries(this.quadroData.triggers).forEach(([sensor, triggers]) => {
            const sensorValue = this.sensorValues[sensor];
            triggers.forEach((trigger, index) => {
                if (this.isTriggerActive(trigger, sensorValue)) {
                    activeTriggers.push({
                        sensor: sensor,
                        trigger: trigger,
                        index: index
                    });
                }
            });
        });
        
        container.innerHTML = activeTriggers.map(({sensor, trigger, index}) => `
            <div class="active-trigger">
                <div class="trigger-sensor">${this.getSensorIcon(sensor)} ${this.formatSensorName(sensor)} #${index + 1}</div>
                <div class="trigger-condition">${this.getTriggerConditionText(trigger)}</div>
            </div>
        `).join('') || '<div style="color: rgba(255,255,255,0.5); font-style: italic;">Nessun trigger attivo</div>';
    }

    startAnimation() {
        const animate = (timestamp) => {
            if (this.isPlaying) {
                this.render();
                this.updateFPS();
            }
            this.animationId = requestAnimationFrame(animate);
        };
        animate();
    }

    render() {
        if (!this.ctx || !this.quadroData) return;
        
        const { width, height } = this.canvas;
        
        // Pulisci canvas
        this.ctx.fillStyle = '#000000';
        this.ctx.fillRect(0, 0, width, height);
        
        // Applica triggers attivi
        this.applyActiveTriggers();
    }

    applyActiveTriggers() {
        if (!this.quadroData.triggers) return;
        
        const { width, height } = this.canvas;
        
        // Ordina trigger per priorità (background per primi)
        const allActions = [];
        
        Object.entries(this.quadroData.triggers).forEach(([sensor, triggers]) => {
            const sensorValue = this.sensorValues[sensor];
            triggers.forEach(trigger => {
                if (this.isTriggerActive(trigger, sensorValue)) {
                    trigger.actions.forEach(action => {
                        allActions.push({...action, sensorValue, sensor});
                    });
                }
            });
        });
        
        // Ordina: background, immagini, SVG, animazioni, filtri
        const actionOrder = ['change-background', 'load-image', 'add-svg', 'add-animation', 'add-filter'];
        allActions.sort((a, b) => {
            const aIndex = actionOrder.indexOf(a.type);
            const bIndex = actionOrder.indexOf(b.type);
            return aIndex - bIndex;
        });
        
        // Esegui azioni
        allActions.forEach(action => {
            this.executeAction(action, width, height);
        });
    }

    isTriggerActive(trigger, value) {
        switch (trigger.condition) {
            case 'range':
                return value >= (trigger.params.min || 0) && value <= (trigger.params.max || 100);
            case 'above':
                return value > (trigger.params.threshold || 50);
            case 'below':
                return value < (trigger.params.threshold || 50);
            case 'change':
                // Implementazione semplificata - in produzione tracciare valori storici
                return Math.random() > 0.8;
            case 'duration':
                // Implementazione semplificata
                return Math.abs(value - (trigger.params.target || 50)) < 5;
            default:
                return false;
        }
    }

    executeAction(action, width, height) {
        switch (action.type) {
            case 'load-image':
                this.renderLoadImageAction(action, width, height);
                break;
            case 'change-background':
                this.renderChangeBackgroundAction(action, width, height);
                break;
            case 'add-svg':
                this.renderAddSVGAction(action, width, height);
                break;
            case 'add-animation':
                this.renderAddAnimationAction(action, width, height);
                break;
            case 'add-filter':
                this.renderAddFilterAction(action, width, height);
                break;
        }
    }

    renderLoadImageAction(action, width, height) {
        const quantity = action.quantity || 1;
        const baseSize = (action.size || 100) / 100 * Math.min(width, height) * 0.2;
        const opacity = (action.opacity || 100) / 100;
        
        this.ctx.save();
        this.ctx.globalAlpha = opacity;
        
        for (let i = 0; i < quantity; i++) {
            const x = ((action.x || 50) / 100 * width) + (i * (width / quantity)) % width;
            const y = ((action.y || 50) / 100 * height) + Math.sin(Date.now() * 0.001 + i) * 20;
            const size = baseSize * (0.8 + 0.4 * Math.sin(Date.now() * 0.002 + i));
            
            this.ctx.save();
            this.ctx.translate(x, y);
            this.ctx.rotate((action.rotation || 0) * Math.PI / 180);
            
            // Carica immagine dal cache o disegna placeholder
            const img = this.imageCache.get(action.fileId);
            if (img) {
                this.ctx.drawImage(img, -size/2, -size/2, size, size);
            } else {
                // Placeholder
                this.ctx.fillStyle = '#4ecdc4';
                this.ctx.fillRect(-size/2, -size/2, size, size);
            }
            
            this.ctx.restore();
        }
        
        this.ctx.restore();
    }

    renderChangeBackgroundAction(action, width, height) {
        this.ctx.save();
        
        switch (action.backgroundType || 'solid') {
            case 'solid':
                this.ctx.fillStyle = action.color || '#ffffff';
                this.ctx.fillRect(0, 0, width, height);
                break;
                
            case 'gradient':
                const gradient = this.createGradient(action, width, height);
                this.ctx.fillStyle = gradient;
                this.ctx.fillRect(0, 0, width, height);
                break;
                
            case 'overlay':
                this.ctx.fillStyle = action.color || '#ffffff';
                this.ctx.globalAlpha = 0.5;
                this.ctx.fillRect(0, 0, width, height);
                break;
                
            case 'blend':
                this.ctx.globalCompositeOperation = action.blendMode || 'multiply';
                this.ctx.fillStyle = action.color || '#ffffff';
                this.ctx.fillRect(0, 0, width, height);
                this.ctx.globalCompositeOperation = 'source-over';
                break;
        }
        
        this.ctx.restore();
    }

    createGradient(action, width, height) {
        let gradient;
        
        switch (action.direction || 'vertical') {
            case 'horizontal':
                gradient = this.ctx.createLinearGradient(0, 0, width, 0);
                break;
            case 'diagonal':
                gradient = this.ctx.createLinearGradient(0, 0, width, height);
                break;
            case 'radial':
                gradient = this.ctx.createRadialGradient(
                    width/2, height/2, 0, 
                    width/2, height/2, Math.max(width, height)/2
                );
                break;
            default: // vertical
                gradient = this.ctx.createLinearGradient(0, 0, 0, height);
        }
        
        gradient.addColorStop(0, action.color1 || '#667eea');
        gradient.addColorStop(1, action.color2 || '#764ba2');
        
        return gradient;
    }

    renderAddSVGAction(action, width, height) {
        const quantity = action.quantity || 5;
        const baseSize = (action.size || 100) / 100 * 30;
        const opacity = (action.opacity || 100) / 100;
        const speed = action.animationSpeed || 1;
        const time = Date.now() * 0.001 * speed;
        
        this.ctx.save();
        this.ctx.globalAlpha = opacity;
        
        for (let i = 0; i < quantity; i++) {
            let x = (width / quantity) * i + (width / quantity) * 0.5;
            let y = height * 0.5;
            let size = baseSize;
            let rotation = 0;
            
            // Modifica in base al valore del sensore
            const intensity = Math.max(0, Math.min(1, action.sensorValue / 100));
            size *= (0.5 + intensity * 0.5);
            
            // Applica animazione
            this.applyAnimation(action.svgAnimation, { x, y, size, rotation, time, i, width, height }, (result) => {
                x = result.x;
                y = result.y;
                size = result.size;
                rotation = result.rotation;
            });
            
            this.ctx.save();
            this.ctx.translate(x, y);
            this.ctx.rotate(rotation);
            
            this.drawSVGObject(action.svgObject || 'star.svg', size);
            
            this.ctx.restore();
        }
        
        this.ctx.restore();
    }

    applyAnimation(animationType, params, callback) {
        const { time, i, width, height } = params;
        let { x, y, size, rotation } = params;
        
        switch (animationType) {
            case 'float':
                y += Math.sin(time + i) * 30;
                break;
            case 'rotate':
                rotation = time + i;
                break;
            case 'pulse':
                size *= (0.8 + 0.4 * Math.sin(time * 2 + i));
                break;
            case 'bounce':
                y += Math.abs(Math.sin(time + i)) * 40;
                break;
            case 'wave':
                x += Math.sin(time + i * 0.5) * 20;
                y += Math.cos(time + i * 0.5) * 10;
                break;
            case 'spiral':
                const angle = time + i * 0.5;
                const radius = 30 + Math.sin(time) * 20;
                x += Math.cos(angle) * radius;
                y += Math.sin(angle) * radius;
                break;
            case 'scale':
                size *= (0.5 + 0.5 * Math.sin(time + i));
                break;
            case 'slide':
                x = ((x + time * 50) % (width + 100)) - 50;
                break;
            case 'morph':
                size *= (0.7 + 0.6 * Math.sin(time * 0.5 + i));
                rotation = Math.sin(time * 0.3 + i) * 0.5;
                break;
            case 'sparkle':
                if (Math.sin(time * 3 + i) > 0.5) {
                    size *= 1.5;
                    this.ctx.globalAlpha *= Math.random();
                }
                break;
        }
        
        callback({ x, y, size, rotation });
    }

    drawSVGObject(svgFile, size) {
        // Implementa il disegno degli oggetti SVG
        // Per semplicità, usiamo le stesse funzioni del creator
        switch (svgFile) {
            case 'star.svg':
                this.drawStar(size);
                break;
            case 'sun.svg':
                this.drawSun(size);
                break;
            case 'snowflake.svg':
                this.drawSnowflake(size);
                break;
            case 'bubble.svg':
                this.drawBubble(size);
                break;
            case 'leaf.svg':
                this.drawLeaf(size);
                break;
            case 'fish.svg':
                this.drawFish(size);
                break;
            case 'cloud.svg':
                this.drawCloud(size);
                break;
            case 'wave.svg':
            case 'waves.svg':
                this.drawWave(size);
                break;
            default:
                this.drawDefault(size);
        }
    }

    // Funzioni di disegno SVG (semplificate)
    drawStar(size) {
        this.ctx.fillStyle = '#ffd700';
        this.ctx.beginPath();
        for (let i = 0; i < 5; i++) {
            const angle = (i * Math.PI * 2) / 5 - Math.PI / 2;
            const x = Math.cos(angle) * size;
            const y = Math.sin(angle) * size;
            if (i === 0) {
                this.ctx.moveTo(x, y);
            } else {
                this.ctx.lineTo(x, y);
            }
            const innerAngle = ((i + 0.5) * Math.PI * 2) / 5 - Math.PI / 2;
            const innerX = Math.cos(innerAngle) * size * 0.5;
            const innerY = Math.sin(innerAngle) * size * 0.5;
            this.ctx.lineTo(innerX, innerY);
        }
        this.ctx.closePath();
        this.ctx.fill();
    }

    drawSun(size) {
        this.ctx.fillStyle = '#ffd700';
        this.ctx.beginPath();
        this.ctx.arc(0, 0, size * 0.6, 0, 2 * Math.PI);
        this.ctx.fill();
        
        this.ctx.strokeStyle = '#ffd700';
        this.ctx.lineWidth = 3;
        for (let i = 0; i < 8; i++) {
            const angle = (i * Math.PI * 2) / 8;
            this.ctx.beginPath();
            this.ctx.moveTo(Math.cos(angle) * size * 0.7, Math.sin(angle) * size * 0.7);
            this.ctx.lineTo(Math.cos(angle) * size, Math.sin(angle) * size);
            this.ctx.stroke();
        }
    }

    drawSnowflake(size) {
        this.ctx.strokeStyle = '#ffffff';
        this.ctx.lineWidth = 2;
        
        for (let i = 0; i < 6; i++) {
            this.ctx.save();
            this.ctx.rotate((i * Math.PI) / 3);
            
            this.ctx.beginPath();
            this.ctx.moveTo(0, -size);
            this.ctx.lineTo(0, size);
            this.ctx.stroke();
            
            this.ctx.beginPath();
            this.ctx.moveTo(0, -size * 0.7);
            this.ctx.lineTo(-size * 0.3, -size * 0.4);
            this.ctx.moveTo(0, -size * 0.7);
            this.ctx.lineTo(size * 0.3, -size * 0.4);
            this.ctx.stroke();
            
            this.ctx.restore();
        }
    }

    drawBubble(size) {
        this.ctx.fillStyle = 'rgba(173, 216, 230, 0.6)';
        this.ctx.strokeStyle = 'rgba(100, 149, 237, 0.8)';
        this.ctx.lineWidth = 2;
        
        this.ctx.beginPath();
        this.ctx.arc(0, 0, size, 0, 2 * Math.PI);
        this.ctx.fill();
        this.ctx.stroke();
        
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        this.ctx.beginPath();
        this.ctx.arc(-size * 0.3, -size * 0.3, size * 0.3, 0, 2 * Math.PI);
        this.ctx.fill();
    }

    drawLeaf(size) {
        this.ctx.fillStyle = '#90ee90';
        this.ctx.beginPath();
        this.ctx.ellipse(0, 0, size * 0.6, size, 0, 0, 2 * Math.PI);
        this.ctx.fill();
        
        this.ctx.strokeStyle = '#228b22';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.moveTo(0, -size);
        this.ctx.lineTo(0, size);
        this.ctx.stroke();
    }

    drawFish(size) {
        this.ctx.fillStyle = '#4169e1';
        
        this.ctx.beginPath();
        this.ctx.ellipse(0, 0, size * 0.8, size * 0.5, 0, 0, 2 * Math.PI);
        this.ctx.fill();
        
        this.ctx.beginPath();
        this.ctx.moveTo(size * 0.6, 0);
        this.ctx.lineTo(size * 1.2, -size * 0.4);
        this.ctx.lineTo(size * 1.2, size * 0.4);
        this.ctx.closePath();
        this.ctx.fill();
        
        this.ctx.fillStyle = '#ffffff';
        this.ctx.beginPath();
        this.ctx.arc(-size * 0.3, -size * 0.1, size * 0.2, 0, 2 * Math.PI);
        this.ctx.fill();
        
        this.ctx.fillStyle = '#000000';
        this.ctx.beginPath();
        this.ctx.arc(-size * 0.3, -size * 0.1, size * 0.1, 0, 2 * Math.PI);
        this.ctx.fill();
    }

    drawCloud(size) {
        this.ctx.fillStyle = 'rgba(220, 220, 220, 0.9)';
        this.ctx.beginPath();
        this.ctx.arc(-size * 0.5, 0, size * 0.4, 0, 2 * Math.PI);
        this.ctx.arc(0, 0, size * 0.5, 0, 2 * Math.PI);
        this.ctx.arc(size * 0.5, 0, size * 0.4, 0, 2 * Math.PI);
        this.ctx.arc(size * 0.2, -size * 0.3, size * 0.35, 0, 2 * Math.PI);
        this.ctx.fill();
    }

    drawWave(size) {
        this.ctx.strokeStyle = '#4169E1';
        this.ctx.lineWidth = 4;
        this.ctx.beginPath();
        for (let x = -size; x <= size; x += 5) {
            const y = Math.sin(x * 0.1) * size * 0.3;
            if (x === -size) {
                this.ctx.moveTo(x, y);
            } else {
                this.ctx.lineTo(x, y);
            }
        }
        this.ctx.stroke();
    }

    drawDefault(size) {
        this.ctx.fillStyle = '#667eea';
        this.ctx.beginPath();
        this.ctx.arc(0, 0, size, 0, 2 * Math.PI);
        this.ctx.fill();
    }

    renderAddAnimationAction(action, width, height) {
        // Le animazioni globali sono gestite a livello di canvas
        const time = Date.now() * 0.001;
        
        switch (action.animation) {
            case 'pulse':
                const scale = 0.8 + 0.4 * Math.sin(time * 2);
                this.ctx.save();
                this.ctx.translate(width/2, height/2);
                this.ctx.scale(scale, scale);
                this.ctx.translate(-width/2, -height/2);
                break;
            case 'rotate':
                this.ctx.save();
                this.ctx.translate(width/2, height/2);
                this.ctx.rotate(time);
                this.ctx.translate(-width/2, -height/2);
                break;
        }
    }

    renderAddFilterAction(action, width, height) {
        const intensity = (action.intensity || 100) / 100;
        
        switch (action.filter) {
            case 'blur':
                this.ctx.filter = `blur(${intensity * 5}px)`;
                break;
            case 'brightness':
                this.ctx.filter = `brightness(${intensity})`;
                break;
            case 'contrast':
                this.ctx.filter = `contrast(${intensity})`;
                break;
            case 'saturation':
                this.ctx.filter = `saturate(${intensity})`;
                break;
            case 'grayscale':
                this.ctx.filter = `grayscale(${intensity})`;
                break;
            case 'sepia':
                this.ctx.filter = `sepia(${intensity})`;
                break;
            default:
                this.ctx.filter = 'none';
        }
    }

    updateFPS() {
        this.frameCount++;
        const now = Date.now();
        
        if (now - this.lastFpsUpdate >= 1000) {
            this.currentFps = this.frameCount;
            this.frameCount = 0;
            this.lastFpsUpdate = now;
        }
    }

    // ============================================================================
    // CONTROLLI FULLSCREEN E UI
    // ============================================================================

    toggleFullscreen() {
        if (!this.isFullscreen) {
            this.enterFullscreen();
        } else {
            this.exitFullscreen();
        }
    }

    enterFullscreen() {
        const element = document.documentElement;
        
        if (element.requestFullscreen) {
            element.requestFullscreen();
        } else if (element.webkitRequestFullscreen) {
            element.webkitRequestFullscreen();
        } else if (element.mozRequestFullScreen) {
            element.mozRequestFullScreen();
        } else if (element.msRequestFullscreen) {
            element.msRequestFullscreen();
        }
    }

    exitFullscreen() {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
        } else if (document.mozCancelFullScreen) {
            document.mozCancelFullScreen();
        } else if (document.msExitFullscreen) {
            document.msExitFullscreen();
        }
    }

    handleFullscreenChange() {
        this.isFullscreen = !!(document.fullscreenElement || 
                             document.webkitFullscreenElement || 
                             document.mozFullScreenElement || 
                             document.msFullscreenElement);
        
        const container = document.getElementById('quadro-container');
        const fullscreenBtn = document.getElementById('fullscreen-btn');
        
        if (this.isFullscreen) {
            container.classList.add('fullscreen');
            fullscreenBtn.textContent = '⛉';
            document.body.classList.remove('show-cursor');
        } else {
            container.classList.remove('fullscreen', 'show-controls');
            fullscreenBtn.textContent = '⛶';
            document.body.classList.add('show-cursor');
            this.showControls = false;
        }
        
        this.resizeCanvas();
    }

    handleMouseMove() {
        if (!this.isFullscreen) return;
        
        const container = document.getElementById('quadro-container');
        
        // Mostra controlli
        container.classList.add('show-controls');
        document.body.classList.add('show-cursor');
        this.showControls = true;
        
        // Reset timer
        clearTimeout(this.mouseTimeout);
        this.mouseTimeout = setTimeout(() => {
            if (this.isFullscreen) {
                container.classList.remove('show-controls');
                document.body.classList.remove('show-cursor');
                this.showControls = false;
            }
        }, 3000);
    }

    handleKeyDown(event) {
        switch (event.key) {
            case 'F11':
                event.preventDefault();
                this.toggleFullscreen();
                break;
            case 'Escape':
                if (this.isFullscreen) {
                    this.exitFullscreen();
                }
                break;
            case ' ':
                event.preventDefault();
                this.togglePlay();
                break;
            case 'i':
            case 'I':
                this.toggleInfo();
                break;
        }
    }

    togglePlay() {
        this.isPlaying = !this.isPlaying;
        const playBtn = document.getElementById('play-btn');
        playBtn.textContent = this.isPlaying ? '⏸️' : '▶️';
        playBtn.classList.toggle('active', !this.isPlaying);
    }

    toggleInfo() {
        this.showInfo = !this.showInfo;
        const infoOverlay = document.getElementById('info-overlay');
        const infoBtn = document.getElementById('info-btn');
        
        if (this.showInfo) {
            infoOverlay.classList.remove('hidden');
            infoBtn.classList.add('active');
            this.updateInfoDisplay();
        } else {
            infoOverlay.classList.add('hidden');
            infoBtn.classList.remove('active');
        }
    }

    // ============================================================================
    // UTILITY FUNCTIONS
    // ============================================================================

    getSensorIcon(sensor) {
        const icons = {
            temperature: '🌡️',
            humidity: '💧',
            light: '💡',
            audio: '🔊'
        };
        return icons[sensor] || '📊';
    }

    formatSensorName(sensor) {
        const names = {
            temperature: 'Temperatura',
            humidity: 'Umidità',
            light: 'Luce',
            audio: 'Audio'
        };
        return names[sensor] || sensor;
    }

    getTriggerConditionText(trigger) {
        switch (trigger.condition) {
            case 'range':
                return `Tra ${trigger.params.min} e ${trigger.params.max}`;
            case 'above':
                return `Sopra ${trigger.params.threshold}`;
            case 'below':
                return `Sotto ${trigger.params.threshold}`;
            case 'change':
                return `Variazione di ${trigger.params.change} in ${trigger.params.time}s`;
            case 'duration':
                return `Mantiene ${trigger.params.target} per ${trigger.params.duration}s`;
            default:
                return 'Condizione personalizzata';
        }
    }

    hideLoading() {
        const overlay = document.getElementById('loading-overlay');
        overlay.classList.add('hidden');
    }

    showError(message) {
        const overlay = document.getElementById('error-overlay');
        const messageEl = document.getElementById('error-message');
        messageEl.textContent = message;
        overlay.classList.remove('hidden');
        this.hideLoading();
    }

    destroy() {
        // Cleanup
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }
        
        if (this.socket) {
            this.socket.disconnect();
        }
        
        if (this.mouseTimeout) {
            clearTimeout(this.mouseTimeout);
        }
        
        // Clean image cache
        this.imageCache.clear();
        this.svgCache.clear();
    }
}

// ============================================================================
// GLOBAL FUNCTIONS AND INITIALIZATION
// ============================================================================

let quadroViewer;

// Inizializzazione
document.addEventListener('DOMContentLoaded', function() {
    if (typeof QUADRO_ID !== 'undefined' && QUADRO_ID) {
        quadroViewer = new QuadroViewer(QUADRO_ID);
    } else {
        console.error('ID Quadro non specificato');
        document.getElementById('error-overlay').classList.remove('hidden');
        document.getElementById('error-message').textContent = 'ID del quadro non specificato nell\'URL';
    }
});

// Cleanup on page unload
window.addEventListener('beforeunload', function() {
    if (quadroViewer) {
        quadroViewer.destroy();
    }
});

// Global control functions
function togglePlay() {
    if (quadroViewer) quadroViewer.togglePlay();
}

function toggleFullscreen() {
    if (quadroViewer) quadroViewer.toggleFullscreen();
}

function toggleInfo() {
    if (quadroViewer) quadroViewer.toggleInfo();
}

function goBack() {
    window.history.back();
}

// Gestione errori globali
window.addEventListener('error', function(e) {
    console.error('Errore JavaScript:', e.error);
});

// Performance monitoring
if ('performance' in window && 'mark' in window.performance) {
    window.performance.mark('quadro-viewer-start');
}