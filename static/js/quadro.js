// ============================================================================
// QUADRO VIEWER - VISUALIZZAZIONE FULLSCREEN QUADRI VIVENTI
// JavaScript per la visualizzazione immersiva dei quadri salvati
// ============================================================================

class QuadroViewer {
    constructor(quadroId) {
        this.quadroId = quadroId;
        this.socket = null;
        this.canvas = null;
        this.ctx = null;
        this.animationId = null;
        this.isPlaying = true;
        this.overlayVisible = true;

        // Dati del quadro
        this.quadroData = null;
        this.deviceData = null;
        this.triggers = {};

        // Valori sensori attuali
        this.sensorValues = {
            temperature: 20.5,
            humidity: 65,
            light: 1250,
            audio: 850
        };

        // Cache oggetti (identico a create_paint)
        this.objectCache = new Map();
        this.objectLoading = new Map();

        // Stato connessione
        this.connectionState = 'connecting'; // connecting, connected, disconnected, error

        // Controlli visibilità
        this.lastActivity = Date.now();
        this.hideControlsTimeout = null;

        this.init();
    }

    async init() {
        try {
            this.setupCanvas();
            this.setupSocket();
            await this.loadQuadro();
            await this.preloadObjects();
            this.startRendering();
            this.setupEventListeners();
            this.hideLoadingScreen();
        } catch (error) {
            console.error('Errore inizializzazione:', error);
            this.showError('Errore durante l\'inizializzazione del quadro');
        }
    }

    // ============================================================================
    // SETUP E CONFIGURAZIONE
    // ============================================================================

    setupCanvas() {
        this.canvas = document.getElementById('quadro-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.ctx.imageSmoothingEnabled = true;
        this.ctx.textBaseline = 'middle';
        this.resizeCanvas();
    }

    resizeCanvas() {
        const devicePixelRatio = window.devicePixelRatio || 1;

        this.canvas.width = window.innerWidth * devicePixelRatio;
        this.canvas.height = window.innerHeight * devicePixelRatio;

        this.canvas.style.width = window.innerWidth + 'px';
        this.canvas.style.height = window.innerHeight + 'px';

        this.ctx.scale(devicePixelRatio, devicePixelRatio);

    }

    setupSocket() {
        if (typeof io === 'undefined') {
            console.error('Socket.IO non disponibile');
            this.connectionState = 'error';
            return;
        }

        this.socket = io();

        this.socket.on('connect', () => {
            console.log('WebSocket connesso');
            this.connectionState = 'connected';
            this.updateConnectionStatus();

            // Richiedi dati del dispositivo se disponibile
            if (this.quadroData && this.quadroData.device_id) {
                this.socket.emit('subscribe_device', this.quadroData.device_id);
            }
        });

        this.socket.on('device_data_update', (data) => {
            this.handleDeviceUpdate(data);
        });

        this.socket.on('disconnect', () => {
            console.log('WebSocket disconnesso');
            this.connectionState = 'disconnected';
            this.updateConnectionStatus();
        });

        this.socket.on('connect_error', () => {
            console.error('Errore connessione WebSocket');
            this.connectionState = 'error';
            this.updateConnectionStatus();
        });
    }

    setupEventListeners() {
        window.addEventListener('resize', () => this.handleResize());

        // Gestione fullscreen
        document.addEventListener('fullscreenchange', () => this.handleFullscreenChange());
        document.addEventListener('webkitfullscreenchange', () => this.handleFullscreenChange());
        document.addEventListener('mozfullscreenchange', () => this.handleFullscreenChange());

        // Nascondi cursore dopo inattività
        this.setupCursorHiding();
    }

    setupCursorHiding() {
        let hideCursorTimeout;

        const showCursor = () => {
            document.body.classList.remove('hide-cursor');
            clearTimeout(hideCursorTimeout);
            hideCursorTimeout = setTimeout(() => {
                document.body.classList.add('hide-cursor');
            }, 3000);
        };

        document.addEventListener('mousemove', showCursor);
        document.addEventListener('touchstart', showCursor);
        document.addEventListener('click', showCursor);

        // Nascondi subito all'inizio
        setTimeout(() => {
            document.body.classList.add('hide-cursor');
        }, 3000);
    }

    // ============================================================================
    // CARICAMENTO DATI
    // ============================================================================

    async loadQuadro() {
        try {
            const response = await fetch(`/api/quadri/${this.quadroId}`);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            this.quadroData = await response.json();
            console.log('Quadro caricato:', this.quadroData);

            // Ripristina valori sensori da anteprima se disponibili
            if (this.quadroData.preview_state && this.quadroData.preview_state.sensor_values) {
                console.log('🔄 Ripristino valori sensori da anteprima...');
                this.sensorValues = { ...this.quadroData.preview_state.sensor_values };
            }

            // Aggiorna UI con i dati del quadro
            this.updateQuadroInfo();

            // Carica dati del dispositivo
            if (this.quadroData.device_id) {
                await this.loadDeviceData();
            } else {
                // Se non c'è dispositivo, usa valori di anteprima o simula
                this.startSensorSimulation();
            }

            // Imposta i trigger
            this.triggers = this.quadroData.triggers || {};

        } catch (error) {
            console.error('Errore caricamento quadro:', error);
            throw new Error('Impossibile caricare i dati del quadro');
        }
    }

    async loadDeviceData() {
        try {
            const response = await fetch(`/api/device_data?device_id=${encodeURIComponent(this.quadroData.device_id)}`);

            if (response.ok) {
                this.deviceData = await response.json();
                this.sensorValues = {
                    temperature: this.deviceData.temperature || this.sensorValues.temperature,
                    humidity: this.deviceData.humidity || this.sensorValues.humidity,
                    light: this.deviceData.light || this.sensorValues.light,
                    audio: this.deviceData.audio || this.sensorValues.audio
                };
                this.updateSensorDisplay();
            } else {
                console.warn('Impossibile caricare dati dispositivo, uso valori salvati o simulati');
                this.startSensorSimulation();
            }
        } catch (error) {
            console.error('Errore caricamento dati dispositivo:', error);
            this.startSensorSimulation();
        }
    }

    // ============================================================================
    // GESTIONE OGGETTI (IDENTICO A CREATE_PAINT)
    // ============================================================================

    async loadObject(objectPath) {
        if (this.objectCache.has(objectPath)) {
            return this.objectCache.get(objectPath);
        }

        if (this.objectLoading.has(objectPath)) {
            return await this.objectLoading.get(objectPath);
        }

        const loadPromise = this._loadObjectFromFile(objectPath);
        this.objectLoading.set(objectPath, loadPromise);

        try {
            const image = await loadPromise;
            this.objectCache.set(objectPath, image);
            this.objectLoading.delete(objectPath);
            return image;
        } catch (error) {
            this.objectLoading.delete(objectPath);
            console.error(`Impossibile caricare oggetto ${objectPath}:`, error);
            return null;
        }
    }

    async _loadObjectFromFile(objectPath) {
        const response = await fetch(objectPath);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const svgText = await response.text();
        const blob = new Blob([svgText], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);

        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                URL.revokeObjectURL(url);
                resolve(img);
            };
            img.onerror = () => {
                URL.revokeObjectURL(url);
                reject(new Error(`Impossibile caricare oggetto: ${objectPath}`));
            };
            img.src = url;
        });
    }

    async preloadObjects() {
        if (!this.quadroData || !this.quadroData.triggers) {
            console.log('🎯 Nessun trigger trovato, skip precaricamento oggetti');
            return;
        }

        const objectsToLoad = new Set();

        // Raccoglie tutti gli oggetti usati nei trigger
        Object.values(this.quadroData.triggers).forEach(triggers => {
            triggers.forEach(trigger => {
                trigger.actions.forEach(action => {
                    if ((action.type === 'add-objects' || action.type === 'add-svg') &&
                        (action.objectFile || action.svgObject)) {
                        const objectFile = action.objectFile || action.svgObject;
                        objectsToLoad.add(`/static/images/${objectFile}`);
                    }
                });
            });
        });

        if (objectsToLoad.size === 0) {
            console.log('🎯 Nessun oggetto da precaricare');
            return;
        }


        const loadPromises = Array.from(objectsToLoad).map(async (path) => {
            try {
                const img = await this.loadObject(path);
                if (img) {
                    return { path, success: true, img };
                } else {
                    console.error(`❌ Immagine null per: ${path}`);
                    return { path, success: false, error: 'Immagine null' };
                }
            } catch (error) {
                console.error(`❌ Errore caricamento ${path}:`, error);
                return { path, success: false, error: error.message };
            }
        });

        const results = await Promise.allSettled(loadPromises);
        const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
        const failed = results.filter(r => r.status !== 'fulfilled' || !r.value.success);

        
        if (failed.length > 0) {
            console.warn('❌ Oggetti falliti:', failed);
        }

        // Verifica finale cache
    }

    drawRealObject(ctx, objectFile, size) {
        const objectPath = `/static/images/${objectFile}`;
        const objectImage = this.objectCache.get(objectPath);

        if (objectImage) {
            const originalWidth = objectImage.naturalWidth || objectImage.width || 100;
            const originalHeight = objectImage.naturalHeight || objectImage.height || 100;

            let drawWidth, drawHeight;

            if (originalWidth > originalHeight) {
                drawWidth = size * 2;
                drawHeight = (drawWidth * originalHeight) / originalWidth;
            } else {
                drawHeight = size * 2;
                drawWidth = (drawHeight * originalWidth) / originalHeight;
            }

            try {
                ctx.drawImage(
                    objectImage,
                    -drawWidth / 2,
                    -drawHeight / 2,
                    drawWidth,
                    drawHeight
                );
                return true;
            } catch (error) {
                console.error(`❌ Errore nel disegnare oggetto ${objectFile}:`, error);
                // Fallback a placeholder
                this.drawPlaceholder(ctx, size, objectFile);
                return false;
            }
        } else {
            // Placeholder quando oggetto non è caricato
            this.drawPlaceholder(ctx, size, objectFile);
            
            // Prova a caricare asincronamente per la prossima volta
            this.loadObject(objectPath).catch(error => {
                console.error(`❌ Errore nel caricare oggetto ${objectFile}:`, error);
            });

            return false;
        }
    }

    drawPlaceholder(ctx, size, objectFile) {
        // Placeholder più visibile per debug
        ctx.fillStyle = '#ff6b6b';
        ctx.beginPath();
        ctx.arc(0, 0, size, 0, 2 * Math.PI);
        ctx.fill();

        // Bordo bianco
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Testo placeholder
        ctx.fillStyle = '#ffffff';
        ctx.font = `${Math.max(8, size / 4)}px Arial`;
        ctx.textAlign = 'center';
        ctx.fillText('?', 0, 0);
        
        // Debug: log oggetto mancante
        console.warn(`📄 Placeholder per: ${objectFile}`);
    }

    // ============================================================================
    // RENDERING (IDENTICO A CREATE_PAINT)
    // ============================================================================

    startRendering() {
        const render = () => {
            if (this.isPlaying) {
                this.renderFrame();
            }
            this.animationId = requestAnimationFrame(render);
        };
        render();
    }

    renderFrame() {
        if (!this.ctx || !this.canvas) return;

        const width = window.innerWidth;
        const height = window.innerHeight;

        // Reset del filtro all'inizio di ogni frame
        this.ctx.filter = 'none';

        // Pulisce il canvas con sfondo nero
        this.ctx.fillStyle = '#000000';
        this.ctx.fillRect(0, 0, width, height);

        // DEBUG: Verifica se ci sono trigger configurati
        const hasTriggers = Object.keys(this.triggers).length > 0;
        if (!hasTriggers) {
            console.warn('⚠️ Nessun trigger configurato nel quadro');
        }

        // Applica i trigger attivi
        const activeCount = this.applyActiveTriggers(width, height);
        
        // DEBUG: Log se nessun trigger è attivo
        if (hasTriggers && activeCount === 0) {
            console.log('🔍 Nessun trigger attivo con valori:', this.sensorValues);
        }

        // Reset del filtro alla fine per evitare interferenze
        this.ctx.filter = 'none';

        // Aggiorna display sensori con evidenziazione
        this.updateSensorDisplay();
    }

    applyActiveTriggers(width, height) {
        if (!this.triggers) return 0;

        let activeTriggersCount = 0;
        let totalActionsExecuted = 0;

        Object.entries(this.triggers).forEach(([sensor, triggers]) => {
            const sensorValue = this.sensorValues[sensor];

            triggers.forEach((trigger, triggerIndex) => {
                if (this.isTriggerActive(trigger, sensorValue)) {
                    activeTriggersCount++;
                    
                    trigger.actions.forEach((action, actionIndex) => {
                        this.executeAction(action, width, height, sensorValue, trigger);
                        totalActionsExecuted++;
                    });
                }
            });
        });

 

        return activeTriggersCount;
    }

    isTriggerActive(trigger, value) {
        switch (trigger.condition) {
            case 'range':
                return value >= trigger.params.min && value <= trigger.params.max;
            case 'above':
                return value > trigger.params.threshold;
            case 'below':
                return value < trigger.params.threshold;
            case 'duration':
                return Math.abs(value - trigger.params.target) < 5;
            default:
                return false;
        }
    }

    executeAction(action, width, height, sensorValue, trigger = null) {
        switch (action.type) {
            case 'load-image':
                this.renderLoadImageAction(action, width, height);
                break;
            case 'change-background':
                this.renderChangeBackgroundAction(action, width, height);
                break;
            case 'add-objects':
            case 'add-svg': // Supporta entrambi i nomi per compatibilità
                this.renderAddObjectsAction(action, width, height, sensorValue, trigger);
                break;
            case 'add-filter':
                this.renderAddFilterAction(action, width, height);
                break;
        }
    }

    // METODI DI RENDERING IDENTICI A CREATE_PAINT

    renderLoadImageAction(action, width, height) {
        const quantity = action.quantity || 1;
        const size = (action.size || 100) / 100 * Math.min(width, height) * 0.2;
        const opacity = (action.opacity || 100) / 100;

        this.ctx.globalAlpha = opacity;

        for (let i = 0; i < quantity; i++) {
            const x = (action.x || 50) / 100 * width + (i * 30) % width;
            const y = (action.y || 50) / 100 * height + Math.sin(Date.now() * 0.001 + i) * 20;

            this.ctx.save();
            this.ctx.translate(x, y);
            this.ctx.rotate((action.rotation || 0) * Math.PI / 180);

            this.ctx.fillStyle = '#4ecdc4';
            this.ctx.fillRect(-size / 2, -size / 2, size, size);

            this.ctx.restore();
        }

        this.ctx.globalAlpha = 1;
    }

    renderChangeBackgroundAction(action, width, height) {
        const type = action.backgroundType || 'solid';

        switch (type) {
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
                this.ctx.globalAlpha = 1;
                break;

            case 'blend':
                this.ctx.globalCompositeOperation = action.blendMode || 'multiply';
                this.ctx.fillStyle = action.color || '#ffffff';
                this.ctx.fillRect(0, 0, width, height);
                this.ctx.globalCompositeOperation = 'source-over';
                break;
        }
    }

    createGradient(action, width, height) {
        const direction = action.direction || 'vertical';
        let gradient;

        switch (direction) {
            case 'horizontal':
                gradient = this.ctx.createLinearGradient(0, 0, width, 0);
                break;
            case 'diagonal':
                gradient = this.ctx.createLinearGradient(0, 0, width, height);
                break;
            case 'radial':
                gradient = this.ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, Math.max(width, height) / 2);
                break;
            default:
                gradient = this.ctx.createLinearGradient(0, 0, 0, height);
        }

        gradient.addColorStop(0, action.color1 || '#667eea');
        gradient.addColorStop(1, action.color2 || '#764ba2');

        return gradient;
    }

    renderAddObjectsAction(action, width, height, sensorValue, trigger = null) {
        const quantity = action.quantity || 5;
        const baseSize = (action.size || 100) / 100 * 30;
        const opacity = (action.opacity || 100) / 100;
        const baseSpeed = action.animationSpeed || 1;
        const objectFile = action.objectFile || action.svgObject || 'star.svg';


        const dynamicSpeed = this.calculateDynamicSpeed(trigger, sensorValue, baseSpeed);
        const time = Date.now() * 0.001 * dynamicSpeed;

        // Gestione coordinate del box (identico a create_paint)
        let boxX, boxY, boxWidth, boxHeight;

        if (action.boxX !== undefined && action.boxY !== undefined) {
            // Usa le coordinate salvate nell'azione
            boxX = action.boxX / 100 * width;
            boxY = action.boxY / 100 * height;
            boxWidth = action.boxWidth / 100 * width;
            boxHeight = action.boxHeight / 100 * height;
        } else {
            // Fallback: tutto lo schermo
            boxX = 0;
            boxY = 0;
            boxWidth = width;
            boxHeight = height;
        }

        const baseRotation = (action.rotation || 0) * Math.PI / 180;

        this.ctx.globalAlpha = opacity;

        const actionSeed = this.getActionSeed(action);
        let objectsRendered = 0;

        for (let i = 0; i < quantity; i++) {
            const seedX = this.seededRandom(actionSeed + i * 1000);
            const seedY = this.seededRandom(actionSeed + i * 2000);

            let x = boxX + (seedX * boxWidth);
            let y = boxY + (seedY * boxHeight);

            let size = baseSize;
            let rotation = baseRotation;

            // Calcolo intensità identico a create_paint
            const intensity = Math.max(0, Math.min(1, sensorValue / 100));
            size *= (0.5 + intensity * 0.5);

            // Applica animazioni IDENTICHE a create_paint
            switch (action.objectAnimation || action.svgAnimation) {
                case 'float':
                    y += Math.sin(time + i) * 30;
                    break;
                case 'rotate':
                    rotation += time + i;
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
                    const animAngle = time + i * 0.5;
                    const radius = 30 + Math.sin(time) * 20;
                    x += Math.cos(animAngle) * radius;
                    y += Math.sin(animAngle) * radius;
                    break;
                case 'scale':
                    size *= (0.5 + 0.5 * Math.sin(time + i));
                    break;
                case 'slide':
                    x = ((x - boxX + time * 50) % boxWidth) + boxX;
                    break;
                case 'fade':
                    this.ctx.globalAlpha = opacity * (0.3 + 0.7 * Math.sin(time + i));
                    break;
                case 'morph':
                    size *= (0.7 + 0.6 * Math.sin(time * 0.5 + i));
                    rotation += Math.sin(time * 0.3 + i) * 0.5;
                    break;
                case 'sparkle':
                    if (Math.sin(time * 3 + i) > 0.5) {
                        size *= 1.5;
                        this.ctx.globalAlpha = opacity * Math.random();
                    }
                    break;
            }

            // CONTENIMENTO dentro il box
            x = Math.max(boxX + size, Math.min(boxX + boxWidth - size, x));
            y = Math.max(boxY + size, Math.min(boxY + boxHeight - size, y));

            this.ctx.save();
            this.ctx.translate(x, y);
            this.ctx.rotate(rotation);

            const rendered = this.drawRealObject(this.ctx, objectFile, size);
            if (rendered) objectsRendered++;

            this.ctx.restore();
        }

        this.ctx.globalAlpha = 1;
        
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
            case 'hue-rotate':
                this.ctx.filter = `hue-rotate(${intensity * 360}deg)`;
                break;
            case 'sepia':
                this.ctx.filter = `sepia(${intensity})`;
                break;
            case 'grayscale':
                this.ctx.filter = `grayscale(${intensity})`;
                break;
            case 'invert':
                this.ctx.filter = `invert(${intensity})`;
                break;
            default:
                this.ctx.filter = 'none';
        }
    }

    calculateDynamicSpeed(trigger, sensorValue, baseSpeed) {
        if (!trigger) return baseSpeed;

        switch (trigger.condition) {
            case 'range':
                const min = trigger.params.min;
                const max = trigger.params.max;
                const center = (min + max) / 2;
                const range = max - min;

                // Calcola quanto il valore è lontano dal centro (0-1)
                const distanceFromCenter = Math.abs(sensorValue - center) / (range / 2);

                // Velocità: 1x al centro, 5x agli estremi
                const speedMultiplier = 1 + (distanceFromCenter * 4);
                return baseSpeed * speedMultiplier;

            case 'above':
            case 'below':
                // Velocità fissa a 2.5x per i trigger sopra/sotto soglia
                return baseSpeed * 2.5;

            case 'duration':
                // Per questo trigger, velocità moderata
                return baseSpeed * 1.8;

            default:
                return baseSpeed;
        }
    }

    getActionSeed(action) {
        // Genera un seed basato sulle proprietà dell'azione per avere posizioni consistenti
        const str = JSON.stringify({
            objectFile: action.objectFile || action.svgObject,
            boxX: action.boxX,
            boxY: action.boxY,
            boxWidth: action.boxWidth,
            boxHeight: action.boxHeight,
            quantity: action.quantity
        });

        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Converte a 32bit int
        }
        return Math.abs(hash);
    }

    seededRandom(seed) {
        const x = Math.sin(seed) * 10000;
        return x - Math.floor(x);
    }

    // ============================================================================
    // GESTIONE DATI E AGGIORNAMENTI
    // ============================================================================

    handleDeviceUpdate(data) {
        if (!this.quadroData || data.device_id !== this.quadroData.device_id) return;

        this.sensorValues = {
            temperature: data.data.temperature || this.sensorValues.temperature,
            humidity: data.data.humidity || this.sensorValues.humidity,
            light: data.data.light || this.sensorValues.light,
            audio: data.data.audio || this.sensorValues.audio
        };

        console.log('📡 Dati sensori aggiornati via WebSocket:', this.sensorValues);
    }

    startSensorSimulation() {

        // Aggiorna immediatamente i display
        this.updateSensorDisplay();

        // Simula variazioni realistiche
        setInterval(() => {
            this.sensorValues = {
                temperature: 20.5 + Math.sin(Date.now() * 0.001) * 10,
                humidity: 65 + Math.cos(Date.now() * 0.0015) * 20,
                light: 1250 + Math.sin(Date.now() * 0.002) * 1000,
                audio: 850 + Math.random() * 400
            };
        }, 2000);
    }

    updateSensorDisplay() {
        Object.entries(this.sensorValues).forEach(([sensor, value]) => {
            const element = document.getElementById(`${sensor}-value`);
            if (element) {
                let displayValue = Math.round(value * 10) / 10;
                const unit = sensor === 'temperature' ? '°C' : sensor === 'humidity' ? '%' : '';
                element.textContent = `${displayValue}${unit}`;

                // Evidenzia sensori con trigger attivi
                const sensorElement = element.closest('.sensor-value');
                const hasActiveTrigger = this.isSensorActive(sensor, value);
                sensorElement.setAttribute('data-active', hasActiveTrigger);
            }
        });
    }

    isSensorActive(sensor, value) {
        if (!this.triggers[sensor]) return false;

        return this.triggers[sensor].some(trigger =>
            this.isTriggerActive(trigger, value)
        );
    }

    updateQuadroInfo() {
        if (!this.quadroData) return;

        const titleElement = document.getElementById('quadro-title');
        const deviceElement = document.getElementById('device-name');

        if (titleElement) {
            titleElement.textContent = this.quadroData.name || 'Quadro Senza Nome';
        }

        if (deviceElement) {
            deviceElement.textContent = this.quadroData.device_name || this.quadroData.device_id || 'Dispositivo Non Specificato';
        }
    }

    updateConnectionStatus() {
        const indicator = document.getElementById('status-indicator');
        const text = document.getElementById('status-text');

        if (!indicator || !text) return;

        indicator.className = 'status-indicator';

        switch (this.connectionState) {
            case 'connected':
                indicator.classList.add('connected');
                text.textContent = 'Connesso';
                break;
            case 'connecting':
                indicator.classList.add('connecting');
                text.textContent = 'Connessione...';
                break;
            case 'disconnected':
                text.textContent = 'Disconnesso';
                break;
            case 'error':
                text.textContent = 'Errore Connessione';
                break;
        }
    }

    // ============================================================================
    // CONTROLLI E INTERAZIONI
    // ============================================================================

    toggleOverlay() {
        this.overlayVisible = !this.overlayVisible;
        const overlay = document.getElementById('quadro-overlay');
        if (overlay) {
            overlay.classList.toggle('hidden', !this.overlayVisible);
        }
    }

    toggleFullscreen() {
        if (!document.fullscreenElement) {
            const container = document.querySelector('.quadro-container');
            if (container.requestFullscreen) {
                container.requestFullscreen();
            } else if (container.webkitRequestFullscreen) {
                container.webkitRequestFullscreen();
            } else if (container.mozRequestFullScreen) {
                container.mozRequestFullScreen();
            }
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            } else if (document.webkitExitFullscreen) {
                document.webkitExitFullscreen();
            } else if (document.mozCancelFullScreen) {
                document.mozCancelFullScreen();
            }
        }
    }

    handleFullscreenChange() {
        const fullscreenBtn = document.getElementById('fullscreen-btn');
        if (fullscreenBtn) {
            fullscreenBtn.textContent = document.fullscreenElement ? '⛶' : '⛶';
        }

        // Ridimensiona canvas dopo cambio fullscreen
        setTimeout(() => this.handleResize(), 100);
        
    }

    handleResize() {
        this.resizeCanvas();
    }

    pauseRendering() {
        this.isPlaying = false;
    }

    resumeRendering() {
        this.isPlaying = true;
    }

    goBack() {
        if (window.history.length > 1) {
            window.history.back();
        } else {
            window.location.href = '/';
        }
    }

    // ============================================================================
    // GESTIONE ERRORI E STATI
    // ============================================================================

    showError(message) {
        const errorScreen = document.getElementById('error-screen');
        const errorMessage = document.getElementById('error-message');

        if (errorScreen && errorMessage) {
            errorMessage.textContent = message;
            errorScreen.classList.remove('hidden');
        }

        this.hideLoadingScreen();
        console.error('❌ Errore mostrato:', message);
    }

    hideLoadingScreen() {
        const loadingScreen = document.getElementById('loading-screen');
        if (loadingScreen) {
            loadingScreen.classList.add('hidden');
        }
    }

    // ============================================================================
    // CLEANUP
    // ============================================================================

    destroy() {
        
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }

        if (this.socket) {
            this.socket.disconnect();
        }

        // Pulisce le URL degli oggetti
        this.objectCache.forEach(img => {
            if (img.src && img.src.startsWith('blob:')) {
                URL.revokeObjectURL(img.src);
            }
        });

        this.objectCache.clear();
    }
}

// ============================================================================
// INIZIALIZZAZIONE E FUNZIONI GLOBALI
// ============================================================================

// Funzioni globali accessibili dall'HTML
window.toggleOverlay = function () {
    if (window.quadroViewer) {
        window.quadroViewer.toggleOverlay();
    }
};

window.toggleFullscreen = function () {
    if (window.quadroViewer) {
        window.quadroViewer.toggleFullscreen();
    }
};

window.goBack = function () {
    if (window.quadroViewer) {
        window.quadroViewer.goBack();
    }
};

// Cleanup quando la pagina viene chiusa
window.addEventListener('beforeunload', () => {
    if (window.quadroViewer) {
        window.quadroViewer.destroy();
    }
});

// Debug functions (solo in development)
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    window.debugQuadro = function () {
        console.log('=== DEBUG QUADRO VIEWER ===');
        if (window.quadroViewer) {
            
            // Analisi trigger attivi
            const activeTriggers = Object.entries(window.quadroViewer.triggers).map(([sensor, triggers]) => {
                const sensorValue = window.quadroViewer.sensorValues[sensor];
                const activeTriggersList = triggers.filter(trigger => 
                    window.quadroViewer.isTriggerActive(trigger, sensorValue)
                );
                return {
                    sensor,
                    value: sensorValue,
                    totalTriggers: triggers.length,
                    activeTriggers: activeTriggersList.length,
                    details: activeTriggersList.map((trigger, index) => ({
                        index,
                        condition: trigger.condition,
                        params: trigger.params,
                        actions: trigger.actions.length
                    }))
                };
            });

            // Verifica azioni add-objects
            const objectActions = [];
            Object.entries(window.quadroViewer.triggers).forEach(([sensor, triggers]) => {
                triggers.forEach((trigger, triggerIndex) => {
                    trigger.actions.forEach((action, actionIndex) => {
                        if (action.type === 'add-objects' || action.type === 'add-svg') {
                            objectActions.push({
                                sensor,
                                triggerIndex,
                                actionIndex,
                                objectFile: action.objectFile || action.svgObject,
                                quantity: action.quantity,
                                size: action.size,
                                isActive: window.quadroViewer.isTriggerActive(trigger, window.quadroViewer.sensorValues[sensor])
                            });
                        }
                    });
                });
            });
            
        }
    };

    window.forceActivateAllTriggers = function() {
        if (!window.quadroViewer) return;
        
        
        // Trova i range di tutti i trigger e imposta valori che li attivano
        Object.entries(window.quadroViewer.triggers).forEach(([sensor, triggers]) => {
            triggers.forEach(trigger => {
                let targetValue;
                switch (trigger.condition) {
                    case 'range':
                        targetValue = (trigger.params.min + trigger.params.max) / 2;
                        break;
                    case 'above':
                        targetValue = trigger.params.threshold + 10;
                        break;
                    case 'below':
                        targetValue = trigger.params.threshold - 10;
                        break;
                    case 'duration':
                        targetValue = trigger.params.target;
                        break;
                    default:
                        targetValue = window.quadroViewer.sensorValues[sensor];
                }
                window.quadroViewer.sensorValues[sensor] = targetValue;
            });
        });
        
    };

    window.testRenderObject = function(objectFile = 'star.svg', size = 50) {
        if (!window.quadroViewer) return;
        
        
        const ctx = window.quadroViewer.ctx;
        const width = window.innerWidth;
        const height = window.innerHeight;
        
        // Pulisce e disegna solo l'oggetto di test
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, width, height);
        
        ctx.save();
        ctx.translate(width / 2, height / 2);
        
        const rendered = window.quadroViewer.drawRealObject(ctx, objectFile, size);
        
        ctx.restore();
        
    };

    window.testScenarios = function() {
        if (!window.quadroViewer) return;
        
        const scenarios = [
            { temp: 35, hum: 80, light: 3000, audio: 2000, name: "Caldo e luminoso" },
            { temp: 5, hum: 30, light: 100, audio: 200, name: "Freddo e buio" },
            { temp: 22, hum: 55, light: 1500, audio: 1000, name: "Normale" }
        ];
        
        let index = 0;
        const interval = setInterval(() => {
            if (index < scenarios.length) {
                const scenario = scenarios[index];
                window.quadroViewer.sensorValues = {
                    temperature: scenario.temp,
                    humidity: scenario.hum,
                    light: scenario.light,
                    audio: scenario.audio
                };
                index++;
            } else {
                clearInterval(interval);
            }
        }, 3000);
    };
}

