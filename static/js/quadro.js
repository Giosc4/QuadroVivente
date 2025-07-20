// ============================================================================
// QUADRO VIEWER - VISUALIZZAZIONE FULLSCREEN QUADRI VIVENTI 
// JavaScript per la visualizzazione immersiva dei quadri salvati
// ============================================================================

class QuadroViewer {
    constructor(quadroId) {
        this.quadroId = quadroId;
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

        // HTTP Polling per ESP32
        this.pollingInterval = null;
        this.isReceivingRealData = false;
        this.simulationInterval = null;
        this.lastDataUpdate = 0;
        this.pollingRate = 2000; // 2 secondi

        // Controllo log per evitare spam
        this.debugLogCount = 0;
        this.maxDebugLogs = 50;
        this.lastLogTime = 0;

        this.init();
    }

    async init() {
        try {
            this.setupCanvas();
            this.setupHTTPPolling(); 
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

        // Memorizza le dimensioni logiche
        this.logicalWidth = window.innerWidth;
        this.logicalHeight = window.innerHeight;
    }

    setupHTTPPolling() {
        console.log('🔄 Inizializzazione HTTP Polling');
        
        // Simula connessione immediata
        setTimeout(() => {
            this.connectionState = 'connected';
            this.updateConnectionStatus();
            
            // Avvia polling se c'è un dispositivo
            if (this.quadroData && this.quadroData.device_id) {
                this.startHTTPPolling(this.quadroData.device_id);
            }
        }, 100);
    }

    startHTTPPolling(deviceId) {
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
        }

        console.log(`📡 Avvio HTTP polling per dispositivo: ${deviceId}`);
        
        this.pollingInterval = setInterval(() => {
            this.pollDeviceData(deviceId);
        }, this.pollingRate);

        // Primo polling immediato
        this.pollDeviceData(deviceId);
    }

    async pollDeviceData(deviceId) {
        try {
            const response = await fetch(`/api/device_data?device_id=${encodeURIComponent(deviceId)}`, {
                method: 'GET',
                cache: 'no-cache',
                headers: {
                    'Cache-Control': 'no-cache'
                }
            });

            if (response.ok) {
                const deviceData = await response.json();
                
                // Controlla se i dati sono nuovi
                const dataTimestamp = deviceData.timestamp || Date.now();
                
                if (dataTimestamp > this.lastDataUpdate) {
                    this.lastDataUpdate = dataTimestamp;
                    
                    // Simula evento device_data_update
                    this.handleDeviceUpdate({
                        device_id: deviceId,
                        data: deviceData,
                        timestamp: dataTimestamp
                    });
                }
            } else {
                // Se polling fallisce, continua con simulazione
                if (this.debugLogCount < 5) {
                    console.warn(`⚠️ Polling dispositivo ${deviceId} fallito: ${response.status}`);
                }
            }
        } catch (error) {
            // Errore di rete - continua con simulazione
            if (this.debugLogCount < 5) {
                console.error(`❌ Errore polling dispositivo ${deviceId}:`, error.message);
            }
        }
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
            // Usa la configurazione passata dal server se disponibile
            if (window.QUADRO_CONFIG && window.QUADRO_CONFIG.quadro_id) {
                this.quadroId = window.QUADRO_CONFIG.quadro_id;
            }

            const response = await fetch(`/api/quadri/${this.quadroId}`);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            this.quadroData = await response.json();

            // Ripristina valori sensori da anteprima se disponibili
            if (this.quadroData.preview_state && this.quadroData.preview_state.sensor_values) {
                this.sensorValues = { ...this.quadroData.preview_state.sensor_values };
            }

            // Aggiorna UI con i dati del quadro
            this.updateQuadroInfo();

            // Carica dati del dispositivo
            if (this.quadroData.device_id) {
                await this.loadDeviceData();
                // Avvia polling HTTP
                this.startHTTPPolling(this.quadroData.device_id);
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
        const failed = results.filter(r => r.status !== 'fulfilled' || !r.value.success);

        if (failed.length > 0) {
            console.warn('❌ Oggetti falliti:', failed);
        }
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
                this.drawPlaceholder(ctx, size, objectFile);
                return false;
            }
        } else {
            this.drawPlaceholder(ctx, size, objectFile);

            // Prova a caricare asincronamente per la prossima volta
            this.loadObject(objectPath).catch(error => {
                console.error(`❌ Errore nel caricare oggetto ${objectFile}:`, error);
            });

            return false;
        }
    }

    drawPlaceholder(ctx, size, objectFile) {
        // Placeholder più visibile e grande
        ctx.fillStyle = '#ff6b6b';
        ctx.beginPath();
        ctx.arc(0, 0, Math.max(size, 20), 0, 2 * Math.PI);
        ctx.fill();

        // Bordo bianco spesso
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3;
        ctx.stroke();

        // Testo placeholder più grande
        ctx.fillStyle = '#ffffff';
        ctx.font = `bold ${Math.max(12, size / 2)}px Arial`;
        ctx.textAlign = 'center';
        ctx.fillText('?', 0, 0);

        // DEBUG: Log dettagliato LIMITATO
        this.debugLog(`📄 PLACEHOLDER per: ${objectFile} - size: ${size}`);
    }

    // NUOVO: Metodo per limitare i log di debug
    debugLog(message) {
        const now = Date.now();
        
        // Limita log uguali troppo frequenti
        if (now - this.lastLogTime < 1000) {
            return; // Skip log se è passato meno di 1 secondo
        }
        
        if (this.debugLogCount < this.maxDebugLogs) {
            console.warn(message);
            this.debugLogCount++;
            this.lastLogTime = now;
        } else if (this.debugLogCount === this.maxDebugLogs) {
            console.warn('⚠️ Debug log limit raggiunto, disabilitazione log per evitare spam');
            this.debugLogCount++;
        }
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

        // USA le dimensioni logiche invece di window.inner*
        const width = this.logicalWidth || window.innerWidth;
        const height = this.logicalHeight || window.innerHeight;

        // Reset del filtro all'inizio di ogni frame
        this.ctx.filter = 'none';

        // Pulisce il canvas con sfondo nero
        this.ctx.fillStyle = '#000000';
        this.ctx.fillRect(0, 0, width, height);

        // Applica i trigger attivi
        this.applyActiveTriggers(width, height);

        // Reset del filtro alla fine per evitare interferenze
        this.ctx.filter = 'none';
    }

    applyActiveTriggers(width, height) {
        if (!this.triggers) return 0;

        let activeTriggersCount = 0;

        Object.entries(this.triggers).forEach(([sensor, triggers]) => {
            const sensorValue = this.sensorValues[sensor];

            triggers.forEach((trigger, triggerIndex) => {
                if (this.isTriggerActive(trigger, sensorValue)) {
                    activeTriggersCount++;

                    trigger.actions.forEach((action, actionIndex) => {
                        this.executeAction(action, width, height, sensorValue, trigger);
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

        // Gestione coordinate del box migliorata
        let boxX, boxY, boxWidth, boxHeight;

        if (action.boxX !== undefined && action.boxY !== undefined && 
            action.boxWidth !== undefined && action.boxHeight !== undefined) {
            // Usa le coordinate salvate nell'azione con validazione
            boxX = Math.max(0, Math.min(100, action.boxX)) / 100 * width;
            boxY = Math.max(0, Math.min(100, action.boxY)) / 100 * height;
            boxWidth = Math.max(10, Math.min(100, action.boxWidth)) / 100 * width;
            boxHeight = Math.max(10, Math.min(100, action.boxHeight)) / 100 * height;
        } else {
            // Fallback: tutto lo schermo
            boxX = 0;
            boxY = 0;
            boxWidth = width;
            boxHeight = height;
        }

        // Validazione finale delle dimensioni del box
        if (boxWidth <= 0 || boxHeight <= 0) {
            boxX = 0;
            boxY = 0;
            boxWidth = width;
            boxHeight = height;
        }

        const baseRotation = (action.rotation || 0) * Math.PI / 180;

        this.ctx.globalAlpha = opacity;

        const actionSeed = this.getActionSeed(action);

        for (let i = 0; i < quantity; i++) {
            const seedX = this.seededRandom(actionSeed + i * 1000);
            const seedY = this.seededRandom(actionSeed + i * 2000);

            let x = boxX + (seedX * boxWidth);
            let y = boxY + (seedY * boxHeight);

            let size = baseSize;
            let rotation = baseRotation;

            // Calcolo intensità
            const intensity = Math.max(0, Math.min(1, sensorValue / 100));
            size *= (0.5 + intensity * 0.5);

            // Applica animazioni
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

            this.drawRealObject(this.ctx, objectFile, size);

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

                const distanceFromCenter = Math.abs(sensorValue - center) / (range / 2);
                const speedMultiplier = 1 + (distanceFromCenter * 4);
                return baseSpeed * speedMultiplier;

            case 'above':
            case 'below':
                return baseSpeed * 2.5;

            case 'duration':
                return baseSpeed * 1.8;

            default:
                return baseSpeed;
        }
    }

    getActionSeed(action) {
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
            hash = hash & hash;
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
        // Verifica che i dati siano per il dispositivo corretto
        if (data.device_id !== this.quadroData?.device_id) {
            return;
        }

        console.log('📡 Ricevuti dati ESP via HTTP:', data);
        
        // Imposta flag per evitare interferenze con simulazione
        this.isReceivingRealData = true;
        
        // Ferma la simulazione se attiva
        if (this.simulationInterval) {
            clearInterval(this.simulationInterval);
            this.simulationInterval = null;
            console.log('🛑 Simulazione fermata, uso dati reali HTTP');
        }

        // Aggiorna i valori sensori con i dati reali
        const oldValues = { ...this.sensorValues };
        
        this.sensorValues = {
            temperature: parseFloat(data.data.temperature) || this.sensorValues.temperature,
            humidity: parseFloat(data.data.humidity) || this.sensorValues.humidity,
            light: parseFloat(data.data.light) || this.sensorValues.light,
            audio: parseFloat(data.data.audio) || this.sensorValues.audio
        };

        // Log dei cambiamenti
        Object.keys(this.sensorValues).forEach(sensor => {
            if (Math.abs(oldValues[sensor] - this.sensorValues[sensor]) > 0.1) {
                console.log(`📈 ${sensor}: ${oldValues[sensor]} → ${this.sensorValues[sensor]}`);
            }
        });

        // Aggiorna immediatamente il display
        this.updateSensorDisplay();
    }

    startSensorSimulation() {
        // Non avviare la simulazione se stiamo ricevendo dati reali
        if (this.isReceivingRealData) {
            return;
        }

        console.log('🎲 Avvio simulazione sensori');
        
        // Aggiorna immediatamente i display
        this.updateSensorDisplay();

        // Simula variazioni realistiche
        this.simulationInterval = setInterval(() => {
            // Verifica se non stiamo ricevendo dati reali recenti
            if (this.isReceivingRealData && Date.now() - this.lastDataUpdate < 30000) {
                return; // Non simulare se abbiamo dati recenti
            }

            // Se i dati reali sono vecchi, riprendi la simulazione
            if (this.isReceivingRealData && Date.now() - this.lastDataUpdate >= 30000) {
                console.log('📡 Dati ESP non recenti, riprendo simulazione');
                this.isReceivingRealData = false;
            }

            // Simula variazioni graduali
            this.sensorValues = {
                temperature: 20.5 + Math.sin(Date.now() * 0.001) * 10,
                humidity: 65 + Math.cos(Date.now() * 0.0015) * 20,
                light: 1250 + Math.sin(Date.now() * 0.002) * 1000,
                audio: 850 + Math.random() * 400
            };

            this.updateSensorDisplay();
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
                if (sensorElement) {
                    sensorElement.setAttribute('data-active', hasActiveTrigger);
                }
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
                text.textContent = 'HTTP Polling Attivo';
                break;
            case 'connecting':
                indicator.classList.add('connecting');
                text.textContent = 'Inizializzazione...';
                break;
            case 'disconnected':
                text.textContent = 'Offline - Simulazione';
                break;
            case 'error':
                text.textContent = 'Modalità Offline';
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
        setTimeout(() => this.handleResize(), 100);
    }

    handleResize() {
        this.resizeCanvas();
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

        // Ferma il polling HTTP
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
        }

        // Ferma la simulazione
        if (this.simulationInterval) {
            clearInterval(this.simulationInterval);
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

// Debug functions
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.hostname === '192.168.4.1') {
    window.debugQuadro = function () {
        if (window.quadroViewer) {
            console.log('🔍 DEBUG QUADRO (HTTP Mode):', {
                triggers: window.quadroViewer.triggers,
                sensorValues: window.quadroViewer.sensorValues,
                isReceivingRealData: window.quadroViewer.isReceivingRealData,
                connectionState: window.quadroViewer.connectionState,
                deviceId: window.quadroViewer.quadroData?.device_id,
                pollingActive: !!window.quadroViewer.pollingInterval
            });
        }
    };

    window.forceActivateAllTriggers = function () {
        if (!window.quadroViewer) return;

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

        console.log('🎯 Tutti i trigger forzati attivi:', window.quadroViewer.sensorValues);
    };

    window.resetDebugLogs = function() {
        if (window.quadroViewer) {
            window.quadroViewer.debugLogCount = 0;
            window.quadroViewer.lastLogTime = 0;
            console.log('🔄 Debug logs reset');
        }
    };
}

// Inizializzazione principale
document.addEventListener('DOMContentLoaded', function () {
    let quadroId = null;

    if (window.QUADRO_CONFIG && window.QUADRO_CONFIG.quadro_id) {
        quadroId = window.QUADRO_CONFIG.quadro_id;
    } else {
        const path = window.location.pathname;
        quadroId = path.split('/').pop();
    }

    console.log('🚀 Inizializzazione QuadroViewer (HTTP Mode) per ID:', quadroId);
    window.quadroViewer = new QuadroViewer(quadroId);
});