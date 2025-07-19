// ============================================================================
// CREATE PAINT - SISTEMA DI CREAZIONE QUADRI VIVENTI
// JavaScript semplificato con oggetti default reali
// ============================================================================

class QuadroCreator {
    constructor() {
        this.socket = null;
        this.devices = {};
        this.selectedDevice = null;
        this.previewCanvas = null;
        this.previewCtx = null;
        this.animationId = null;
        this.isPlaying = true;
        this.createdQuadroId = null;

        // Sistema di caricamento oggetti default
        this.objectCache = new Map();
        this.objectLoading = new Map();

        // Valori sensori per simulazione
        this.sensorValues = {
            temperature: 20.5,
            humidity: 65,
            light: 1250,
            audio: 850
        };

        // Configurazione triggers e azioni
        this.triggers = {
            temperature: [],
            humidity: [],
            light: [],
            audio: []
        };

        // File caricati
        this.uploadedFiles = [];

        // Oggetti default disponibili
        this.availableObjects = [
            'bubble.svg', 'cloud-rain.svg', 'cloud.svg', 'comet.svg', 'coral.svg',
            'fish.svg', 'galaxy.svg', 'leaf.svg', 'planet.svg', 'rocket.svg',
            'seaweed.svg', 'snowflake.svg', 'sparkles.svg', 'star.svg', 'sun.svg',
            'wave.svg', 'waves.svg'
        ];

        // Animazioni disponibili (solo per oggetti)
        this.availableAnimations = [
            'fade', 'slide', 'bounce', 'rotate', 'scale', 'float',
            'pulse', 'wave', 'morph', 'sparkle', 'spiral'
        ];

        // Filtri visivi disponibili
        this.availableFilters = [
            'blur', 'brightness', 'contrast', 'saturation', 'hue-rotate',
            'sepia', 'grayscale', 'invert'
        ];

        // dentro constructor(), subito dopo this.triggers = { … }
        this.sensorLimits = {
            temperature: { min: 0, max: 50 },    // °C per DHT11
            humidity: { min: 20, max: 90 },    // %RH per DHT11
            light: { min: 0, max: 4095 },  // ADC 12‑bit
            audio: { min: 0, max: 2900 }
        };

        // Modal state
        this.currentTrigger = null;
        this.currentAction = null;
        this.editingTriggerIndex = -1;
        this.editingActionIndex = -1;

        this.init();
    }

    async init() {
        this.setupSocket();
        this.setupEventListeners();
        this.setupCanvas();
        this.setupDragAndDrop();
        this.loadDevices();

        // Pre-carica gli oggetti default
        await this.preloadAllObjects();

        this.startPreviewAnimation();
        this.hideLoadingOverlay();
    }

    // ============================================================================
    // SISTEMA DI CARICAMENTO OGGETTI DEFAULT
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

    async preloadAllObjects() {
        console.log('🔄 Inizio pre-caricamento oggetti default...');

        const loadPromises = this.availableObjects.map(async (obj) => {
            const path = `/static/images/${obj}`;
            try {
                await this.loadObject(path);
                console.log(`✅ Caricato: ${obj}`);
                return { obj, success: true };
            } catch (error) {
                console.error(`❌ Errore nel caricare ${obj}:`, error);
                return { obj, success: false };
            }
        });

        const results = await Promise.allSettled(loadPromises);
        const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;

        console.log(`🎯 Pre-caricati ${successful}/${this.availableObjects.length} oggetti default`);

        if (successful === this.availableObjects.length) {
            console.log('🚀 Tutti gli oggetti sono pronti per l\'uso!');
        }
    }

    drawRealObject(ctx, objectFile, size) {
        const objectPath = `/static/images/${objectFile}`;

        // Usa l'oggetto dalla cache (dovrebbe essere già caricato)
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

            ctx.drawImage(
                objectImage,
                -drawWidth / 2,
                -drawHeight / 2,
                drawWidth,
                drawHeight
            );

            return true;
        } else {
            // Se non è in cache, prova a caricarlo asincronamente per la prossima volta
            this.loadObject(objectPath).catch(error => {
                console.error(`Errore nel caricare oggetto ${objectFile}:`, error);
            });

            // Per ora disegna un placeholder
            ctx.fillStyle = '#ddd';
            ctx.beginPath();
            ctx.arc(0, 0, size, 0, 2 * Math.PI);
            ctx.fill();

            // Testo placeholder
            ctx.fillStyle = '#666';
            ctx.font = `${Math.max(12, size / 3)}px Arial`;
            ctx.textAlign = 'center';
            ctx.fillText('Carico...', 0, 4);

            return false;
        }
    }

    // ============================================================================
    // SETUP FUNCTIONS
    // ============================================================================

    setupSocket() {
        if (typeof io === 'undefined') {
            console.error('Socket.IO non disponibile');
            return;
        }

        this.socket = io();

        this.socket.on('connect', () => {
            console.log('Connesso al server');
        });

        this.socket.on('device_data_update', (data) => {
            this.handleDeviceUpdate(data);
        });

        this.socket.on('disconnect', () => {
            console.log('Disconnesso dal server');
        });
    }

    setupEventListeners() {
        const nameInput = document.getElementById('quadro-name');
        nameInput.addEventListener('input', (e) => {
            this.validateForm();
        });

        const deviceSelect = document.getElementById('device-select');
        deviceSelect.addEventListener('change', (e) => {
            this.selectDevice(e.target.value);
        });

        const fileInput = document.getElementById('file-input');
        fileInput.addEventListener('change', (e) => {
            this.handleFileSelect(e.target.files);
        });

        const sliders = ['temp', 'humidity', 'light', 'audio'];
        sliders.forEach(slider => {
            const element = document.getElementById(`${slider}-slider`);
            element.addEventListener('input', (e) => {
                this.updateSensorValue(slider, e.target.value);
            });
        });

        window.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                this.closeModal(e.target);
            }
        });

        window.addEventListener('resize', () => {
            this.resizeCanvas();
        });
    }

    setupCanvas() {
        this.previewCanvas = document.getElementById('preview-canvas');
        this.previewCtx = this.previewCanvas.getContext('2d');
        this.previewCtx.imageSmoothingEnabled = true;
        this.previewCtx.textBaseline = 'middle';
        this.resizeCanvas();
    }

    resizeCanvas() {
        const container = this.previewCanvas.parentElement;
        const rect = container.getBoundingClientRect();

        const aspectRatio = 4 / 3;
        let width = rect.width - 4;
        let height = width / aspectRatio;

        if (height > rect.height - 4) {
            height = rect.height - 4;
            width = height * aspectRatio;
        }

        this.previewCanvas.width = Math.floor(width);
        this.previewCanvas.height = Math.floor(height);

        this.updatePreview();
    }

    setupDragAndDrop() {
        const uploadArea = document.getElementById('upload-area');
        const uploadPlaceholder = uploadArea.querySelector('.upload-placeholder');

        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            uploadPlaceholder.addEventListener(eventName, this.preventDefaults, false);
        });

        ['dragenter', 'dragover'].forEach(eventName => {
            uploadPlaceholder.addEventListener(eventName, () => {
                uploadPlaceholder.classList.add('dragover');
            }, false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            uploadPlaceholder.addEventListener(eventName, () => {
                uploadPlaceholder.classList.remove('dragover');
            }, false);
        });

        uploadPlaceholder.addEventListener('drop', (e) => {
            const files = e.dataTransfer.files;
            this.handleFileSelect(files);
        }, false);
    }

    preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    // ============================================================================
    // DEVICE MANAGEMENT
    // ============================================================================

    async loadDevices() {
        try {
            const response = await fetch('/api/devices');
            if (response.ok) {
                this.devices = await response.json();
                this.populateDeviceSelect();
            } else {
                console.error('Errore nel caricamento dispositivi:', response.status);
                this.devices = {};
                this.populateDeviceSelect();
            }
        } catch (error) {
            console.error('Errore nella richiesta dispositivi:', error);
            this.devices = {};
            this.populateDeviceSelect();
        }
    }

    populateDeviceSelect() {
        const select = document.getElementById('device-select');
        select.innerHTML = '<option value="">Seleziona un dispositivo...</option>';

        Object.entries(this.devices).forEach(([id, device]) => {
            const option = document.createElement('option');
            option.value = id;
            const statusIcon = device.online ? '🟢' : '🔴';
            option.textContent = `${device.name} ${statusIcon}`;
            select.appendChild(option);
        });
    }

    selectDevice(deviceId) {
        this.selectedDevice = deviceId;
        this.updateDeviceStatus();
        this.validateForm();

        if (deviceId && this.devices[deviceId]) {
            this.updateSensorValues();
        }
    }

    updateDeviceStatus() {
        const statusIndicator = document.querySelector('.status-indicator');
        const statusText = document.querySelector('.status-text');

        if (!this.selectedDevice) {
            statusIndicator.className = 'status-indicator';
            statusText.textContent = 'Seleziona un dispositivo';
            return;
        }

        const device = this.devices[this.selectedDevice];
        const isOnline = device && device.online;

        statusIndicator.className = `status-indicator ${isOnline ? 'online' : 'offline'}`;
        statusText.textContent = isOnline ? 'Online' : 'Offline';
    }

    // ============================================================================
    // FILE MANAGEMENT
    // ============================================================================

    handleFileSelect(files) {
        Array.from(files).forEach(file => {
            if (file.type.startsWith('image/') || file.name.endsWith('.svg')) {
                const fileObj = {
                    id: Date.now() + Math.random(),
                    file: file,
                    name: file.name,
                    type: file.type,
                    url: URL.createObjectURL(file)
                };

                this.uploadedFiles.push(fileObj);
                this.renderUploadedFiles();
            }
        });
    }

    renderUploadedFiles() {
        const container = document.getElementById('uploaded-files');
        container.innerHTML = this.uploadedFiles.map(file => `
            <div class="uploaded-file" data-file-id="${file.id}">
                <div class="file-info">
                    <div class="file-preview">
                        ${file.type.startsWith('image/') ?
                `<img src="${file.url}" alt="${file.name}" style="width:100%;height:100%;object-fit:cover;">` :
                '📄'
            }
                    </div>
                    <span class="file-name">${file.name}</span>
                </div>
                <button class="remove-file" onclick="quadroCreator.removeFile('${file.id}')">
                    🗑️
                </button>
            </div>
        `).join('');
    }

    removeFile(fileId) {
        this.uploadedFiles = this.uploadedFiles.filter(file => file.id !== fileId);
        this.renderUploadedFiles();
    }

    // ============================================================================
    // TRIGGER MANAGEMENT
    // ============================================================================

    addTrigger(sensor) {
        this.currentTrigger = {
            sensor: sensor,
            condition: 'range',
            params: {},
            actions: []
        };
        this.editingTriggerIndex = -1;
        this.showTriggerModal();
    }

    editTrigger(sensor, index) {
        this.currentTrigger = JSON.parse(JSON.stringify(this.triggers[sensor][index]));
        this.editingTriggerIndex = index;
        this.showTriggerModal();
    }

    deleteTrigger(sensor, index) {
        if (confirm('Sei sicuro di voler eliminare questo trigger?')) {
            this.triggers[sensor].splice(index, 1);
            this.renderTriggers();
            this.updatePreview();
        }
    }

    showTriggerModal() {
        const modal = document.getElementById('trigger-modal');
        const sensorSelect = document.getElementById('trigger-sensor');
        const conditionSelect = document.getElementById('trigger-condition');

        sensorSelect.value = this.currentTrigger.sensor;
        conditionSelect.value = this.currentTrigger.condition;

        this.updateTriggerCondition();
        this.renderTriggerActions();

        modal.style.display = 'block';
    }

    closeTriggerModal() {
        const modal = document.getElementById('trigger-modal');
        modal.style.display = 'none';
        this.currentTrigger = null;
        this.editingTriggerIndex = -1;
    }

    updateTriggerCondition() {
        const condition = document.getElementById('trigger-condition').value;
        const paramsContainer = document.getElementById('condition-params');
        const sensor = this.currentTrigger.sensor;
        const limits = this.sensorLimits[sensor];

        let html = '';

        switch (condition) {
            case 'range':
                html = `
                    <div class="param-row">
                    <div class="param-group">
                        <label>Valore Minimo:</label>
                        <input type="number" id="param-min"
                            min="${limits.min}" max="${limits.max}"
                            value="${this.currentTrigger.params.min ?? limits.min}">
                    </div>
                    <div class="param-group">
                        <label>Valore Massimo:</label>
                        <input type="number" id="param-max"
                            min="${limits.min}" max="${limits.max}"
                            value="${this.currentTrigger.params.max ?? limits.max}">
                    </div>
                    </div>
                    <small class="help-text">
                    Valori testati: da ${limits.min} a ${limits.max}
                    ${sensor === 'temperature' ? '°C' : sensor === 'humidity' ? '%RH' : ''}
                    </small>
                `;
                break;
            case 'above':
                html = `
    <div class="param-group">
      <label>Soglia:</label>
      <input type="number" id="param-threshold"
             min="${limits.min}" max="${limits.max}"
             value="${this.currentTrigger.params.threshold ?? limits.min}">
    </div>
    <small class="help-text">
      Soglia valida tra ${limits.min} e ${limits.max}
    </small>
  `;
                break;
            case 'below':
                html = `
    <div class="param-group">
      <label>Soglia:</label>
      <input type="number" id="param-threshold"
             min="${limits.min}" max="${limits.max}"
             value="${this.currentTrigger.params.threshold ?? limits.min}">
    </div>
    <small class="help-text">
      Soglia valida tra ${limits.min} e ${limits.max}
    </small>
  `;
                break;
            case 'change':
                html = `
                    <div class="param-row">
                        <div class="param-group">
                            <label>Variazione Minima:</label>
                            <input type="number" id="param-change" value="${this.currentTrigger.params.change || 5}">
                        </div>
                        <div class="param-group">
                            <label>Tempo (secondi):</label>
                            <input type="number" id="param-time" value="${this.currentTrigger.params.time || 10}">
                        </div>
                    </div>
                `;
                break;
            case 'duration':
                html = `
                    <div class="param-row">
                        <div class="param-group">
                            <label>Valore Target:</label>
                            <input type="number" id="param-target" value="${this.currentTrigger.params.target || 50}">
                        </div>
                        <div class="param-group">
                            <label>Durata (secondi):</label>
                            <input type="number" id="param-duration" value="${this.currentTrigger.params.duration || 30}">
                        </div>
                    </div>
                `;
                break;
        }

        paramsContainer.innerHTML = html;
    }

    renderTriggerActions() {
        const container = document.getElementById('actions-list');
        container.innerHTML = this.currentTrigger.actions.map((action, index) => `
            <div class="action-item">
                <div>
                    <div class="action-description">${this.getActionDescription(action)}</div>
                    <div class="action-params">${this.getActionParams(action)}</div>
                </div>
                <div style="display: flex; gap: 5px;">
                    <button class="btn btn-small btn-secondary" onclick="quadroCreator.editAction(${index})">
                        ✏️
                    </button>
                    <button class="remove-action" onclick="quadroCreator.removeAction(${index})">
                        🗑️
                    </button>
                </div>
            </div>
        `).join('');
    }

    getActionDescription(action) {
        const descriptions = {
            'load-image': '📷 Carica Immagine/SVG',
            'change-background': '🎨 Modifica Sfondo',
            'add-objects': '🌟 Aggiungi Oggetti Default',
            'add-svg': '🌟 Aggiungi Oggetti Default', // Compatibilità con vecchio nome
            'add-filter': '🎭 Filtri Visivi'
        };
        return descriptions[action.type] || action.type;
    }

    getActionParams(action) {
        switch (action.type) {
            case 'load-image':
                return `${action.image || 'N/A'} - Pos: ${action.x || 0},${action.y || 0} - Dim: ${action.size || 100}`;
            case 'change-background':
                return `${action.backgroundType || 'solid'} - ${action.color || '#ffffff'}`;
            case 'add-objects':
            case 'add-svg': // Supporta entrambi i valori per compatibilità
                const objFile = action.objectFile || action.svgObject || 'N/A';
                const pos = `${action.x || 50},${action.y || 50}`;
                const size = action.size || 100;
                const rotation = action.rotation || 0;
                const quantity = action.quantity || 1;
                const animation = action.objectAnimation || action.svgAnimation || 'static';
                return `${objFile} - Pos: ${pos} - Dim: ${size}% - Rot: ${rotation}° - Qtà: ${quantity} - Anim: ${animation}`;
            case 'add-filter':
                return `${action.filter || 'blur'} - Intensità: ${action.intensity || 50}%`;
            default:
                return 'Configurazione personalizzata';
        }
    }

    saveTrigger() {
        const condition = document.getElementById('trigger-condition').value;
        this.currentTrigger.condition = condition;
        this.currentTrigger.params = {};

        switch (condition) {
            case 'range':
                this.currentTrigger.params.min = parseFloat(document.getElementById('param-min').value);
                this.currentTrigger.params.max = parseFloat(document.getElementById('param-max').value);
                break;
            case 'above':
            case 'below':
                this.currentTrigger.params.threshold = parseFloat(document.getElementById('param-threshold').value);
                break;
            case 'change':
                this.currentTrigger.params.change = parseFloat(document.getElementById('param-change').value);
                this.currentTrigger.params.time = parseFloat(document.getElementById('param-time').value);
                break;
            case 'duration':
                this.currentTrigger.params.target = parseFloat(document.getElementById('param-target').value);
                this.currentTrigger.params.duration = parseFloat(document.getElementById('param-duration').value);
                break;
        }

        if (this.editingTriggerIndex >= 0) {
            this.triggers[this.currentTrigger.sensor][this.editingTriggerIndex] = this.currentTrigger;
        } else {
            this.triggers[this.currentTrigger.sensor].push(this.currentTrigger);
        }

        this.renderTriggers();
        this.closeTriggerModal();
        this.updatePreview();
    }

    renderTriggers() {
        Object.keys(this.triggers).forEach(sensor => {
            const container = document.getElementById(`${sensor}-triggers`);
            container.innerHTML = this.triggers[sensor].map((trigger, index) => `
                <div class="trigger-item">
                    <div class="trigger-header">
                        <div class="trigger-title">Trigger ${index + 1}</div>
                        <div class="trigger-actions">
                            <button class="btn btn-small btn-secondary" onclick="quadroCreator.editTrigger('${sensor}', ${index})">
                                ✏️
                            </button>
                            <button class="btn btn-small btn-danger" onclick="quadroCreator.deleteTrigger('${sensor}', ${index})">
                                🗑️
                            </button>
                        </div>
                    </div>
                    <div class="trigger-summary">
                        <div class="trigger-condition">${this.getTriggerConditionText(trigger)}</div>
                        <div class="trigger-actions-count">${trigger.actions.length} azioni configurate</div>
                    </div>
                </div>
            `).join('');
        });
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

    // ============================================================================
    // ACTION MANAGEMENT
    // ============================================================================

    addAction() {
        this.currentAction = {
            type: 'load-image'
        };
        this.editingActionIndex = -1;
        this.showActionModal();
    }

    editAction(index) {
        this.currentAction = JSON.parse(JSON.stringify(this.currentTrigger.actions[index]));
        this.editingActionIndex = index;
        this.showActionModal();
    }

    removeAction(index) {
        this.currentTrigger.actions.splice(index, 1);
        this.renderTriggerActions();
    }

    showActionModal() {
        const modal = document.getElementById('action-modal');
        const typeSelect = document.getElementById('action-type');

        typeSelect.value = this.currentAction.type;
        this.updateActionParams();

        modal.style.display = 'block';
    }

    closeActionModal() {
        const modal = document.getElementById('action-modal');
        modal.style.display = 'none';
        this.currentAction = null;
        this.editingActionIndex = -1;
    }

    updateActionParams() {
        const type = document.getElementById('action-type').value;
        const paramsContainer = document.getElementById('action-params');

        let html = '';

        switch (type) {
            case 'load-image':
                html = this.renderLoadImageParams();
                break;
            case 'change-background':
                html = this.renderChangeBackgroundParams();
                break;
            case 'add-objects':
            case 'add-svg': // Supporta entrambi i valori per compatibilità
                html = this.renderAddObjectsParams();
                break;
            case 'add-filter':
                html = this.renderAddFilterParams();
                break;
        }

        paramsContainer.innerHTML = html;
    }

    renderLoadImageParams() {
        return `
            <div class="param-section">
                <h5>📷 Immagine/SVG</h5>
                <div class="form-group">
                    <label>Fonte:</label>
                    <select id="image-source" onchange="quadroCreator.updateImageSource()">
                        <option value="uploaded">File Caricati</option>
                        <option value="url">URL Esterno</option>
                    </select>
                </div>
                <div id="image-source-params">
                    ${this.renderImageSourceParams()}
                </div>
            </div>
            
            <div class="param-section">
                <h5>📍 Posizione e Dimensioni</h5>
                <div class="position-controls">
                    <div class="position-group">
                        <label>X (%):</label>
                        <div class="range-input-group">
                            <input type="range" id="image-x" min="0" max="100" value="${this.currentAction.x || 50}">
                            <span class="range-value">${this.currentAction.x || 50}%</span>
                        </div>
                    </div>
                    <div class="position-group">
                        <label>Y (%):</label>
                        <div class="range-input-group">
                            <input type="range" id="image-y" min="0" max="100" value="${this.currentAction.y || 50}">
                            <span class="range-value">${this.currentAction.y || 50}%</span>
                        </div>
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Dimensione (%):</label>
                        <div class="range-input-group">
                            <input type="range" id="image-size" min="10" max="200" value="${this.currentAction.size || 100}">
                            <span class="range-value">${this.currentAction.size || 100}%</span>
                        </div>
                    </div>
                    <div class="form-group">
                        <label>Opacità (%):</label>
                        <div class="range-input-group">
                            <input type="range" id="image-opacity" min="0" max="100" value="${this.currentAction.opacity || 100}">
                            <span class="range-value">${this.currentAction.opacity || 100}%</span>
                        </div>
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Rotazione (°):</label>
                        <div class="range-input-group">
                            <input type="range" id="image-rotation" min="0" max="360" value="${this.currentAction.rotation || 0}">
                            <span class="range-value">${this.currentAction.rotation || 0}°</span>
                        </div>
                    </div>
                    <div class="form-group">
                        <label>Quantità:</label>
                        <div class="range-input-group">
                            <input type="range" id="image-quantity" min="1" max="20" value="${this.currentAction.quantity || 1}">
                            <span class="range-value">${this.currentAction.quantity || 1}</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    renderImageSourceParams() {
        const source = document.getElementById('image-source')?.value || 'uploaded';

        if (source === 'uploaded') {
            return `
                <div class="form-group">
                    <label>Seleziona File:</label>
                    <select id="selected-file">
                        <option value="">Nessun file selezionato</option>
                        ${this.uploadedFiles.map(file => `
                            <option value="${file.id}" ${this.currentAction.fileId === file.id ? 'selected' : ''}>
                                ${file.name}
                            </option>
                        `).join('')}
                    </select>
                </div>
            `;
        } else {
            return `
                <div class="form-group">
                    <label>URL Immagine:</label>
                    <input type="url" id="image-url" value="${this.currentAction.url || ''}" placeholder="https://...">
                </div>
            `;
        }
    }

    updateImageSource() {
        const paramsContainer = document.getElementById('image-source-params');
        if (paramsContainer) {
            paramsContainer.innerHTML = this.renderImageSourceParams();
        }
    }

    renderChangeBackgroundParams() {
        return `
            <div class="param-section">
                <h5>🎨 Tipo di Sfondo</h5>
                <div class="background-types-grid">
                    <div class="background-type-item ${this.currentAction.backgroundType === 'solid' ? 'selected' : ''}" 
                         onclick="quadroCreator.selectBackgroundType('solid')">
                        <div class="bg-type-icon">🎨</div>
                        <div class="bg-type-name">Colore Solido</div>
                        <div class="bg-type-desc">Un colore uniforme</div>
                    </div>
                    <div class="background-type-item ${this.currentAction.backgroundType === 'gradient' ? 'selected' : ''}" 
                         onclick="quadroCreator.selectBackgroundType('gradient')">
                        <div class="bg-type-icon">🌅</div>
                        <div class="bg-type-name">Gradiente</div>
                        <div class="bg-type-desc">Sfumatura tra colori</div>
                    </div>
                    <div class="background-type-item ${this.currentAction.backgroundType === 'overlay' ? 'selected' : ''}" 
                         onclick="quadroCreator.selectBackgroundType('overlay')">
                        <div class="bg-type-icon">📐</div>
                        <div class="bg-type-name">Overlay</div>
                        <div class="bg-type-desc">Sovrappone al corrente</div>
                    </div>
                    <div class="background-type-item ${this.currentAction.backgroundType === 'blend' ? 'selected' : ''}" 
                         onclick="quadroCreator.selectBackgroundType('blend')">
                        <div class="bg-type-icon">🔀</div>
                        <div class="bg-type-name">Miscela</div>
                        <div class="bg-type-desc">Mescola i colori</div>
                    </div>
                </div>
            </div>
            
            <div class="param-section" id="background-color-params">
                ${this.renderBackgroundColorParams()}
            </div>
        `;
    }

    renderBackgroundColorParams() {
        const type = this.currentAction.backgroundType || 'solid';

        switch (type) {
            case 'solid':
            case 'overlay':
                return `
                    <h5>🎨 Colore</h5>
                    <div class="color-picker-group">
                        <input type="color" id="bg-color" value="${this.currentAction.color || '#ffffff'}">
                        <span class="color-label">Colore principale</span>
                    </div>
                `;
            case 'gradient':
                return `
                    <h5>🌅 Gradiente</h5>
                    <div class="form-row">
                        <div class="color-picker-group">
                            <input type="color" id="bg-color1" value="${this.currentAction.color1 || '#667eea'}">
                            <span class="color-label">Colore 1</span>
                        </div>
                        <div class="color-picker-group">
                            <input type="color" id="bg-color2" value="${this.currentAction.color2 || '#764ba2'}">
                            <span class="color-label">Colore 2</span>
                        </div>
                    </div>
                    <div class="form-group">
                        <label>Direzione:</label>
                        <select id="gradient-direction">
                            <option value="vertical" ${this.currentAction.direction === 'vertical' ? 'selected' : ''}>Verticale</option>
                            <option value="horizontal" ${this.currentAction.direction === 'horizontal' ? 'selected' : ''}>Orizzontale</option>
                            <option value="diagonal" ${this.currentAction.direction === 'diagonal' ? 'selected' : ''}>Diagonale</option>
                            <option value="radial" ${this.currentAction.direction === 'radial' ? 'selected' : ''}>Radiale</option>
                        </select>
                    </div>
                `;
            case 'blend':
                return `
                    <h5>🔀 Miscela</h5>
                    <div class="color-picker-group">
                        <input type="color" id="blend-color" value="${this.currentAction.color || '#ffffff'}">
                        <span class="color-label">Colore da mescolare</span>
                    </div>
                    <div class="form-group">
                        <label>Modalità miscela:</label>
                        <select id="blend-mode">
                            <option value="multiply" ${this.currentAction.blendMode === 'multiply' ? 'selected' : ''}>Moltiplica</option>
                            <option value="screen" ${this.currentAction.blendMode === 'screen' ? 'selected' : ''}>Scolora</option>
                            <option value="overlay" ${this.currentAction.blendMode === 'overlay' ? 'selected' : ''}>Sovrapponi</option>
                            <option value="soft-light" ${this.currentAction.blendMode === 'soft-light' ? 'selected' : ''}>Luce soffusa</option>
                        </select>
                    </div>
                `;
        }
    }

    selectBackgroundType(type) {
        this.currentAction.backgroundType = type;

        document.querySelectorAll('.background-type-item').forEach(item => {
            item.classList.remove('selected');
        });
        event.target.closest('.background-type-item').classList.add('selected');

        const container = document.getElementById('background-color-params');
        container.innerHTML = this.renderBackgroundColorParams();
    }

    renderAddObjectsParams() {
        return `
            <div class="param-section">
                <h5>🌟 Oggetti Default</h5>
                <div class="objects-grid">
                    ${this.availableObjects.map(obj => `
                        <div class="object-item ${(this.currentAction.objectFile || this.currentAction.svgObject) === obj ? 'selected' : ''}" 
                             onclick="quadroCreator.selectObject('${obj}')">
                            <div class="object-icon">
                                <img src="/static/images/${obj}" alt="${this.formatObjectName(obj)}" 
                                     style="width: 24px; height: 24px; object-fit: contain;"
                                     onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
                                <span style="display: none;">${this.getObjectIcon(obj)}</span>
                            </div>
                            <div class="object-name">${this.formatObjectName(obj)}</div>
                        </div>
                    `).join('')}
                </div>
            </div>
            
            <div class="param-section">
                <h5>✨ Tipo di Animazione</h5>
                <div class="animation-types-grid">
                    ${this.availableAnimations.map(anim => `
                        <div class="animation-type-item ${(this.currentAction.objectAnimation || this.currentAction.svgAnimation) === anim ? 'selected' : ''}" 
                             onclick="quadroCreator.selectObjectAnimation('${anim}')">
                            <div class="animation-icon">${this.getAnimationIcon(anim)}</div>
                            <div class="animation-name">${this.formatAnimationName(anim)}</div>
                        </div>
                    `).join('')}
                </div>
            </div>
            
            <div class="param-section">
                <h5>📍 Posizione e Dimensioni</h5>
                <div class="position-controls">
                    <div class="position-group">
                        <label>X (%):</label>
                        <div class="range-input-group">
                            <input type="range" id="object-x" min="0" max="100" value="${this.currentAction.x || 50}">
                            <span class="range-value">${this.currentAction.x || 50}%</span>
                        </div>
                    </div>
                    <div class="position-group">
                        <label>Y (%):</label>
                        <div class="range-input-group">
                            <input type="range" id="object-y" min="0" max="100" value="${this.currentAction.y || 50}">
                            <span class="range-value">${this.currentAction.y || 50}%</span>
                        </div>
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Dimensione (%):</label>
                        <div class="range-input-group">
                            <input type="range" id="object-size" min="10" max="200" value="${this.currentAction.size || 100}">
                            <span class="range-value">${this.currentAction.size || 100}%</span>
                        </div>
                    </div>
                    <div class="form-group">
                        <label>Opacità (%):</label>
                        <div class="range-input-group">
                            <input type="range" id="object-opacity" min="0" max="100" value="${this.currentAction.opacity || 100}">
                            <span class="range-value">${this.currentAction.opacity || 100}%</span>
                        </div>
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Rotazione (°):</label>
                        <div class="range-input-group">
                            <input type="range" id="object-rotation" min="0" max="360" value="${this.currentAction.rotation || 0}">
                            <span class="range-value">${this.currentAction.rotation || 0}°</span>
                        </div>
                    </div>
                    <div class="form-group">
                        <label>Quantità:</label>
                        <div class="range-input-group">
                            <input type="range" id="object-quantity" min="1" max="30" value="${this.currentAction.quantity || 5}">
                            <span class="range-value">${this.currentAction.quantity || 5}</span>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="param-section">
                <h5>🎬 Controlli Animazione</h5>
                <div class="form-row">
                    <div class="form-group">
                        <label>Velocità Animazione:</label>
                        <div class="range-input-group">
                            <input type="range" id="object-speed" min="0.1" max="5" step="0.1" value="${this.currentAction.animationSpeed || 1}">
                            <span class="range-value">${this.currentAction.animationSpeed || 1}x</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    selectObject(objectFile) {
        this.currentAction.objectFile = objectFile;
        // Mantieni compatibilità con il vecchio formato
        this.currentAction.svgObject = objectFile;

        document.querySelectorAll('.object-item').forEach(item => {
            item.classList.remove('selected');
        });
        event.target.closest('.object-item').classList.add('selected');
    }

    selectObjectAnimation(animation) {
        this.currentAction.objectAnimation = animation;
        // Mantieni compatibilità con il vecchio formato
        this.currentAction.svgAnimation = animation;

        document.querySelectorAll('.animation-type-item').forEach(item => {
            item.classList.remove('selected');
        });
        event.target.closest('.animation-type-item').classList.add('selected');
    }

    renderAddFilterParams() {
        return `
            <div class="param-section">
                <h5>🎭 Filtri Visivi</h5>
                <div class="filter-types-grid">
                    ${this.availableFilters.map(filter => `
                        <div class="filter-type-item ${this.currentAction.filter === filter ? 'selected' : ''}" 
                             onclick="quadroCreator.selectFilter('${filter}')">
                            <div class="filter-name">${this.formatFilterName(filter)}</div>
                        </div>
                    `).join('')}
                </div>
            </div>
            
            <div class="param-section">
                <h5>🎚️ Intensità</h5>
                <div class="form-group">
                    <label>Intensità (%):</label>
                    <div class="range-input-group">
                        <input type="range" id="filter-intensity" min="0" max="200" value="${this.currentAction.intensity || 100}">
                        <span class="range-value">${this.currentAction.intensity || 100}%</span>
                    </div>
                </div>
            </div>
        `;
    }

    selectFilter(filter) {
        this.currentAction.filter = filter;

        document.querySelectorAll('.filter-type-item').forEach(item => {
            item.classList.remove('selected');
        });
        event.target.closest('.filter-type-item').classList.add('selected');
    }

    saveAction() {
        const type = document.getElementById('action-type').value;
        this.currentAction.type = type;

        switch (type) {
            case 'load-image':
                this.saveLoadImageAction();
                break;
            case 'change-background':
                this.saveChangeBackgroundAction();
                break;
            case 'add-objects':
            case 'add-svg': // Supporta entrambi i valori per compatibilità
                this.saveAddObjectsAction();
                break;
            case 'add-filter':
                this.saveAddFilterAction();
                break;
        }

        if (this.editingActionIndex >= 0) {
            this.currentTrigger.actions[this.editingActionIndex] = this.currentAction;
        } else {
            this.currentTrigger.actions.push(this.currentAction);
        }

        this.renderTriggerActions();
        this.closeActionModal();
    }

    saveLoadImageAction() {
        const source = document.getElementById('image-source').value;

        if (source === 'uploaded') {
            this.currentAction.fileId = document.getElementById('selected-file').value;
        } else {
            this.currentAction.url = document.getElementById('image-url').value;
        }

        this.currentAction.x = parseInt(document.getElementById('image-x').value);
        this.currentAction.y = parseInt(document.getElementById('image-y').value);
        this.currentAction.size = parseInt(document.getElementById('image-size').value);
        this.currentAction.opacity = parseInt(document.getElementById('image-opacity').value);
        this.currentAction.rotation = parseInt(document.getElementById('image-rotation').value);
        this.currentAction.quantity = parseInt(document.getElementById('image-quantity').value);
    }

    saveChangeBackgroundAction() {
        const type = this.currentAction.backgroundType || 'solid';

        switch (type) {
            case 'solid':
            case 'overlay':
                this.currentAction.color = document.getElementById('bg-color').value;
                break;
            case 'gradient':
                this.currentAction.color1 = document.getElementById('bg-color1').value;
                this.currentAction.color2 = document.getElementById('bg-color2').value;
                this.currentAction.direction = document.getElementById('gradient-direction').value;
                break;
            case 'blend':
                this.currentAction.color = document.getElementById('blend-color').value;
                this.currentAction.blendMode = document.getElementById('blend-mode').value;
                break;
        }
    }

    saveAddObjectsAction() {
        this.currentAction.x = parseInt(document.getElementById('object-x').value);
        this.currentAction.y = parseInt(document.getElementById('object-y').value);
        this.currentAction.size = parseInt(document.getElementById('object-size').value);
        this.currentAction.opacity = parseInt(document.getElementById('object-opacity').value);
        this.currentAction.rotation = parseInt(document.getElementById('object-rotation').value);
        this.currentAction.quantity = parseInt(document.getElementById('object-quantity').value);
        this.currentAction.animationSpeed = parseFloat(document.getElementById('object-speed').value);

        // Normalizza il tipo di azione
        if (this.currentAction.type === 'add-svg') {
            this.currentAction.type = 'add-objects';
        }
    }

    saveAddFilterAction() {
        this.currentAction.intensity = parseInt(document.getElementById('filter-intensity').value);
    }

    // ============================================================================
    // UTILITY FUNCTIONS
    // ============================================================================

    getObjectIcon(obj) {
        const icons = {
            'bubble.svg': '💧',
            'cloud-rain.svg': '🌧️',
            'cloud.svg': '☁️',
            'comet.svg': '☄️',
            'coral.svg': '🪸',
            'fish.svg': '🐟',
            'galaxy.svg': '🌌',
            'leaf.svg': '🍃',
            'planet.svg': '🪐',
            'rocket.svg': '🚀',
            'seaweed.svg': '🌿',
            'snowflake.svg': '❄️',
            'sparkles.svg': '✨',
            'star.svg': '⭐',
            'sun.svg': '☀️',
            'wave.svg': '🌊',
            'waves.svg': '🌊'
        };
        return icons[obj] || '📄';
    }

    formatObjectName(obj) {
        return obj.replace('.svg', '').replace('-', ' ').split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    }

    getAnimationIcon(animation) {
        const icons = {
            'fade': '🌅',
            'slide': '↔️',
            'bounce': '⏬',
            'rotate': '🔄',
            'scale': '📏',
            'float': '🎈',
            'pulse': '💓',
            'wave': '🌊',
            'morph': '🔄',
            'sparkle': '✨',
            'spiral': '🌀'
        };
        return icons[animation] || '✨';
    }

    formatAnimationName(animation) {
        return animation.charAt(0).toUpperCase() + animation.slice(1);
    }

    formatFilterName(filter) {
        const names = {
            'blur': 'Sfocatura',
            'brightness': 'Luminosità',
            'contrast': 'Contrasto',
            'saturation': 'Saturazione',
            'hue-rotate': 'Tonalità',
            'sepia': 'Seppia',
            'grayscale': 'Scala Grigio',
            'invert': 'Inverti'
        };
        return names[filter] || filter;
    }

    // ============================================================================
    // PREVIEW AND RENDERING
    // ============================================================================

    startPreviewAnimation() {
        const animate = () => {
            if (this.isPlaying) {
                this.updatePreview();
            }
            this.animationId = requestAnimationFrame(animate);
        };
        animate();
    }

    updatePreview() {
        if (!this.previewCtx) return;

        const canvas = this.previewCanvas;
        const ctx = this.previewCtx;

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        this.applyActiveTriggers(ctx, canvas.width, canvas.height);
    }

    applyActiveTriggers(ctx, width, height) {
        let hasActiveTriggers = false;

        // Verifica ogni trigger per ogni sensore
        Object.entries(this.triggers).forEach(([sensor, triggers]) => {
            const sensorValue = this.sensorValues[sensor];

            triggers.forEach(trigger => {
                if (this.isTriggerActive(trigger, sensorValue)) {
                    hasActiveTriggers = true;
                    trigger.actions.forEach(action => {
                        this.executeAction(ctx, action, width, height, sensorValue);
                    });
                }
            });
        });


    }


    isTriggerActive(trigger, value) {
        switch (trigger.condition) {
            case 'range':
                return value >= trigger.params.min && value <= trigger.params.max;
            case 'above':
                return value > trigger.params.threshold;
            case 'below':
                return value < trigger.params.threshold;
            case 'change':
                return Math.random() > 0.7;
            case 'duration':
                return Math.abs(value - trigger.params.target) < 5;
            default:
                return false;
        }
    }

    executeAction(ctx, action, width, height, sensorValue) {
        switch (action.type) {
            case 'load-image':
                this.renderLoadImageAction(ctx, action, width, height);
                break;
            case 'change-background':
                this.renderChangeBackgroundAction(ctx, action, width, height);
                break;
            case 'add-objects':
            case 'add-svg': // Supporta entrambi i valori per compatibilità
                this.renderAddObjectsAction(ctx, action, width, height, sensorValue);
                break;
            case 'add-filter':
                this.renderAddFilterAction(ctx, action, width, height);
                break;
        }
    }

    renderLoadImageAction(ctx, action, width, height) {
        const quantity = action.quantity || 1;
        const size = (action.size || 100) / 100 * Math.min(width, height) * 0.2;
        const opacity = (action.opacity || 100) / 100;

        ctx.globalAlpha = opacity;

        for (let i = 0; i < quantity; i++) {
            const x = (action.x || 50) / 100 * width + (i * 30) % width;
            const y = (action.y || 50) / 100 * height + Math.sin(Date.now() * 0.001 + i) * 20;

            ctx.save();
            ctx.translate(x, y);
            ctx.rotate((action.rotation || 0) * Math.PI / 180);

            ctx.fillStyle = '#4ecdc4';
            ctx.fillRect(-size / 2, -size / 2, size, size);

            ctx.restore();
        }

        ctx.globalAlpha = 1;
    }

    renderChangeBackgroundAction(ctx, action, width, height) {
        const type = action.backgroundType || 'solid';

        switch (type) {
            case 'solid':
                ctx.fillStyle = action.color || '#ffffff';
                ctx.fillRect(0, 0, width, height);
                break;

            case 'gradient':
                const gradient = this.createGradient(ctx, action, width, height);
                ctx.fillStyle = gradient;
                ctx.fillRect(0, 0, width, height);
                break;

            case 'overlay':
                ctx.fillStyle = action.color || '#ffffff';
                ctx.globalAlpha = 0.5;
                ctx.fillRect(0, 0, width, height);
                ctx.globalAlpha = 1;
                break;

            case 'blend':
                ctx.globalCompositeOperation = action.blendMode || 'multiply';
                ctx.fillStyle = action.color || '#ffffff';
                ctx.fillRect(0, 0, width, height);
                ctx.globalCompositeOperation = 'source-over';
                break;
        }
    }

    createGradient(ctx, action, width, height) {
        const direction = action.direction || 'vertical';
        let gradient;

        switch (direction) {
            case 'horizontal':
                gradient = ctx.createLinearGradient(0, 0, width, 0);
                break;
            case 'diagonal':
                gradient = ctx.createLinearGradient(0, 0, width, height);
                break;
            case 'radial':
                gradient = ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, Math.max(width, height) / 2);
                break;
            default:
                gradient = ctx.createLinearGradient(0, 0, 0, height);
        }

        gradient.addColorStop(0, action.color1 || '#667eea');
        gradient.addColorStop(1, action.color2 || '#764ba2');

        return gradient;
    }

    renderAddObjectsAction(ctx, action, width, height, sensorValue) {
        const quantity = action.quantity || 5;
        const baseSize = (action.size || 100) / 100 * 30;
        const opacity = (action.opacity || 100) / 100;
        const speed = action.animationSpeed || 1;
        const time = Date.now() * 0.001 * speed;

        // Posizione base configurata dall'utente
        const baseX = (action.x || 50) / 100 * width;
        const baseY = (action.y || 50) / 100 * height;
        const baseRotation = (action.rotation || 0) * Math.PI / 180;

        ctx.globalAlpha = opacity;

        // Debug: verifica che l'azione venga eseguita
        if (Math.random() < 0.01) { // Log occasionale per debug
            console.log('Rendering oggetti:', action.objectFile || action.svgObject, 'Quantità:', quantity, 'Pos:', action.x, action.y);
        }

        for (let i = 0; i < quantity; i++) {
            // Se quantità = 1, usa la posizione esatta. Se > 1, distribuisci intorno alla posizione base
            let x, y;
            if (quantity === 1) {
                x = baseX;
                y = baseY;
            } else {
                // Distribuisci gli oggetti in un pattern attorno alla posizione base
                const spread = Math.min(width, height) * 0.3; // Raggio di distribuzione
                const angle = (i / quantity) * Math.PI * 2;
                x = baseX + Math.cos(angle) * spread * 0.5;
                y = baseY + Math.sin(angle) * spread * 0.5;
            }

            let size = baseSize;
            let rotation = baseRotation;

            const intensity = Math.max(0, Math.min(1, sensorValue / 100));
            size *= (0.5 + intensity * 0.5);

            // Applica l'animazione scelta alla posizione e rotazione base
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
                    x = ((x + time * 50) % (width + 100)) - 50;
                    break;
                case 'fade':
                    ctx.globalAlpha = opacity * (0.3 + 0.7 * Math.sin(time + i));
                    break;
                case 'morph':
                    size *= (0.7 + 0.6 * Math.sin(time * 0.5 + i));
                    rotation += Math.sin(time * 0.3 + i) * 0.5;
                    break;
                case 'sparkle':
                    if (Math.sin(time * 3 + i) > 0.5) {
                        size *= 1.5;
                        ctx.globalAlpha = opacity * Math.random();
                    }
                    break;
            }

            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(rotation);

            // USA OGGETTI REALI DALLA DIRECTORY
            const objectFile = action.objectFile || action.svgObject || 'star.svg';
            this.drawRealObject(ctx, objectFile, size);

            ctx.restore();
        }

        ctx.globalAlpha = 1;
    }

    renderAddFilterAction(ctx, action, width, height) {
        const intensity = (action.intensity || 100) / 100;

        switch (action.filter) {
            case 'blur':
                ctx.filter = `blur(${intensity * 5}px)`;
                break;
            case 'brightness':
                ctx.filter = `brightness(${intensity})`;
                break;
            case 'contrast':
                ctx.filter = `contrast(${intensity})`;
                break;
            case 'saturation':
                ctx.filter = `saturate(${intensity})`;
                break;
            case 'grayscale':
                ctx.filter = `grayscale(${intensity})`;
                break;
            case 'sepia':
                ctx.filter = `sepia(${intensity})`;
                break;
            default:
                ctx.filter = 'none';
        }
    }

    // ============================================================================
    // SENSOR AND CONTROL FUNCTIONS
    // ============================================================================

    updateSensorValue(sensor, value) {
        const mapping = {
            'temp': 'temperature',
            'humidity': 'humidity',
            'light': 'light',
            'audio': 'audio'
        };

        const sensorKey = mapping[sensor] || sensor;
        this.sensorValues[sensorKey] = parseFloat(value);

        const slider = document.getElementById(`${sensor}-slider`);
        const display = slider.nextElementSibling;
        const unit = sensor === 'temp' ? '°C' : sensor === 'humidity' ? '%' : '';
        display.textContent = `${value}${unit}`;

        const overlayValue = document.getElementById(`${sensorKey}-value`);
        if (overlayValue) {
            overlayValue.textContent = `${value}${unit}`;
        }
    }

    updateSensorValues() {
        Object.entries(this.sensorValues).forEach(([sensor, value]) => {
            const element = document.getElementById(`${sensor}-value`);
            if (element) {
                const unit = sensor === 'temperature' ? '°C' : sensor === 'humidity' ? '%' : '';
                element.textContent = `${value}${unit}`;
            }
        });
    }

    handleDeviceUpdate(data) {
        if (data.device_id === this.selectedDevice) {
            this.sensorValues = {
                temperature: data.data.temperature || this.sensorValues.temperature,
                humidity: data.data.humidity || this.sensorValues.humidity,
                light: data.data.light || this.sensorValues.light,
                audio: data.data.audio || this.sensorValues.audio
            };

            this.updateSlidersFromSensorValues();
            this.updateSensorValues();
        }
    }

    updateSlidersFromSensorValues() {
        const sliders = {
            'temp-slider': this.sensorValues.temperature,
            'humidity-slider': this.sensorValues.humidity,
            'light-slider': this.sensorValues.light,
            'audio-slider': this.sensorValues.audio
        };

        Object.entries(sliders).forEach(([sliderId, value]) => {
            const slider = document.getElementById(sliderId);
            if (slider && value !== undefined) {
                slider.value = value;
                const display = slider.nextElementSibling;
                if (display) {
                    const unit = sliderId.includes('temp') ? '°C' :
                        sliderId.includes('humidity') ? '%' : '';
                    display.textContent = `${value}${unit}`;
                }
            }
        });
    }

    validateForm() {
        const name = document.getElementById('quadro-name').value;
        const device = document.getElementById('device-select').value;
        const saveBtn = document.getElementById('save-quadro-btn');

        const isValid = name.length > 0 && name.length <= 50 && device !== '';

        saveBtn.disabled = !isValid;
        saveBtn.classList.toggle('disabled', !isValid);
    }

    async saveQuadro() {
        const name = document.getElementById('quadro-name').value;
        const deviceId = document.getElementById('device-select').value;

        if (!name || name.length > 50) {
            alert('Inserisci un nome valido per il quadro (max 50 caratteri)');
            return;
        }

        if (!deviceId) {
            alert('Seleziona un dispositivo ESP32');
            return;
        }

        const quadroData = {
            name: name,
            device_id: deviceId,
            template: 'personalizzato',
            is_predefined: false,
            triggers: this.triggers,
            uploaded_files: this.uploadedFiles.map(file => ({
                id: file.id,
                name: file.name,
                type: file.type
            })),
            created_at: new Date().toISOString(),
            version: "4.0"
        };

        try {
            const response = await fetch('/api/quadri', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(quadroData)
            });

            if (response.ok) {
                const result = await response.json();
                this.createdQuadroId = result.quadro_id;
                this.showSuccessModal();
            } else {
                const error = await response.json();
                alert('Errore nel salvataggio: ' + (error.error || 'Errore sconosciuto'));
            }
        } catch (error) {
            console.error('Errore nel salvataggio:', error);
            alert('Errore di connessione. Riprova più tardi.');
        }
    }

    showSuccessModal() {
        document.getElementById('success-modal').style.display = 'block';
    }

    closeModal(modal) {
        modal.style.display = 'none';
    }

    hideLoadingOverlay() {
        const overlay = document.getElementById('loading-overlay');
        overlay.classList.add('hidden');
    }

    togglePreview() {
        this.isPlaying = !this.isPlaying;
        const btn = document.getElementById('play-btn');
        btn.textContent = this.isPlaying ? '⏸️ Pausa' : '▶️ Play';
    }

    resetPreview() {
        this.sensorValues = {
            temperature: 20.5,
            humidity: 65,
            light: 1250,
            audio: 850
        };

        document.getElementById('temp-slider').value = 20.5;
        document.getElementById('humidity-slider').value = 65;
        document.getElementById('light-slider').value = 1250;
        document.getElementById('audio-slider').value = 850;

        document.querySelectorAll('.slider-value').forEach((el, i) => {
            const values = ['20.5°C', '65%', '1250', '850'];
            el.textContent = values[i];
        });

        this.updateSensorValues();
    }

    testEffects() {
        const scenarios = [
            { temperature: 35, humidity: 80, light: 3000, audio: 2000 },
            { temperature: 5, humidity: 30, light: 500, audio: 100 },
            { temperature: 22, humidity: 55, light: 1500, audio: 1200 }
        ];

        let currentScenario = 0;

        const testInterval = setInterval(() => {
            if (currentScenario < scenarios.length) {
                const scenario = scenarios[currentScenario];

                Object.entries(scenario).forEach(([sensor, value]) => {
                    this.sensorValues[sensor] = value;
                    const sliderMap = {
                        temperature: 'temp',
                        humidity: 'humidity',
                        light: 'light',
                        audio: 'audio'
                    };

                    const slider = document.getElementById(`${sliderMap[sensor]}-slider`);
                    if (slider) {
                        slider.value = value;
                        const unit = sensor === 'temperature' ? '°C' : sensor === 'humidity' ? '%' : '';
                        slider.nextElementSibling.textContent = `${value}${unit}`;
                    }
                });

                this.updateSensorValues();
                currentScenario++;
            } else {
                clearInterval(testInterval);
                this.resetPreview();
            }
        }, 2000);
    }

    // Metodo aggiuntivo per testare rapidamente gli oggetti
    createTestTrigger() {
        const testTrigger = {
            sensor: 'temperature',
            condition: 'range',
            params: { min: 15, max: 30 }, // Range che copre il valore di default (20.5)
            actions: [{
                type: 'add-objects',
                objectFile: 'star.svg',
                x: 50,        // Centro orizzontale
                y: 50,        // Centro verticale  
                size: 100,    // Dimensione normale
                opacity: 100, // Opacità piena
                rotation: 0,  // Nessuna rotazione base
                quantity: 3,  // 3 stelle
                animationSpeed: 1,
                objectAnimation: 'float'
            }]
        };

        this.triggers.temperature.push(testTrigger);
        this.renderTriggers();
        this.updatePreview();

        console.log('🎯 Trigger di test creato! Dovresti vedere 3 stelle che fluttuano al centro.');

        return testTrigger;
    }
}

// ============================================================================
// GLOBAL FUNCTIONS
// ============================================================================

let quadroCreator;

document.addEventListener('DOMContentLoaded', function () {
    quadroCreator = new QuadroCreator();

    document.addEventListener('input', function (e) {
        if (e.target.type === 'range') {
            const valueDisplay = e.target.parentElement.querySelector('.range-value');
            if (valueDisplay) {
                let value = e.target.value;
                const id = e.target.id;

                if (id.includes('rotation')) {
                    value += '°';
                } else if (id.includes('opacity') || id.includes('size') || id.includes('intensity')) {
                    value += '%';
                }

                valueDisplay.textContent = value;
            }
        }
    });
});

function goBack() {
    window.history.back();
}

function saveQuadro() {
    quadroCreator.saveQuadro();
}

function addTrigger(sensor) {
    quadroCreator.addTrigger(sensor);
}

function togglePreview() {
    quadroCreator.togglePreview();
}

function resetPreview() {
    quadroCreator.resetPreview();
}

function testEffects() {
    quadroCreator.testEffects();
}

function createTestTrigger() {
    if (quadroCreator) {
        return quadroCreator.createTestTrigger();
    }
}

function checkObjectsStatus() {
    if (quadroCreator) {
        console.log('📊 Stato oggetti caricati:');
        quadroCreator.availableObjects.forEach(obj => {
            const path = `/static/images/${obj}`;
            const isLoaded = quadroCreator.objectCache.has(path);
            console.log(`${isLoaded ? '✅' : '❌'} ${obj}: ${isLoaded ? 'Caricato' : 'Non caricato'}`);
        });

        const totalLoaded = quadroCreator.availableObjects.filter(obj =>
            quadroCreator.objectCache.has(`/static/images/${obj}`)
        ).length;

        console.log(`\n📈 Totale: ${totalLoaded}/${quadroCreator.availableObjects.length} oggetti pronti`);

        if (totalLoaded === 0) {
            console.log('💡 Suggerimento: Verifica che i file SVG esistano nella directory /static/images/');
        }
    }
}

function previewEspData() {
    const btn = document.getElementById('esp-preview-btn');
    btn.disabled = true;
    btn.textContent = '🔄 Carico...';

    const deviceId = document.getElementById('device-select').value;
    if (!deviceId) {
        alert("Seleziona prima un dispositivo ESP32!");
        btn.disabled = false;
        btn.textContent = '📡 Dati Live ESP';
        return;
    }

    fetch(`/api/device_data?device_id=${encodeURIComponent(deviceId)}`)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            if (data.temperature !== undefined) {
                const tempSlider = document.getElementById('temp-slider');
                tempSlider.value = data.temperature;
                quadroCreator.updateSensorValue('temp', data.temperature);
            }
            if (data.humidity !== undefined) {
                const humiditySlider = document.getElementById('humidity-slider');
                humiditySlider.value = data.humidity;
                quadroCreator.updateSensorValue('humidity', data.humidity);
            }
            if (data.light !== undefined) {
                const lightSlider = document.getElementById('light-slider');
                lightSlider.value = data.light;
                quadroCreator.updateSensorValue('light', data.light);
            }
            if (data.audio !== undefined) {
                const audioSlider = document.getElementById('audio-slider');
                audioSlider.value = data.audio;
                quadroCreator.updateSensorValue('audio', data.audio);
            }

            console.log('Dati ESP32 caricati:', data);
        })
        .catch(error => {
            console.error('Errore nel caricamento dati ESP32:', error);
            alert("Impossibile ottenere dati dall'ESP32. Dispositivo offline o errore di connessione.");
        })
        .finally(() => {
            btn.disabled = false;
            btn.textContent = '📡 Dati Live ESP';
        });
}

function viewQuadro() {
    if (quadroCreator.createdQuadroId) {
        window.location.href = `/quadro/${quadroCreator.createdQuadroId}`;
    }
}

function goToHome() {
    window.location.href = '/';
}

window.selectBackgroundType = function (type) {
    if (quadroCreator && quadroCreator.currentAction) {
        quadroCreator.selectBackgroundType(type);
    }
};

window.selectObject = function (obj) {
    if (quadroCreator && quadroCreator.currentAction) {
        quadroCreator.selectObject(obj);
    }
};

window.selectObjectAnimation = function (animation) {
    if (quadroCreator && quadroCreator.currentAction) {
        quadroCreator.selectObjectAnimation(animation);
    }
};

window.selectFilter = function (filter) {
    if (quadroCreator && quadroCreator.currentAction) {
        quadroCreator.selectFilter(filter);
    }
};

window.checkObjectsStatus = function () {
    checkObjectsStatus();
};

window.addEventListener('resize', function () {
    if (quadroCreator && quadroCreator.previewCanvas) {
        quadroCreator.resizeCanvas();
    }
});

window.addEventListener('error', function (e) {
    console.error('Errore JavaScript:', e.error);
});

window.addEventListener('beforeunload', function (e) {
    const name = document.getElementById('quadro-name').value;
    const hasTriggers = Object.values(quadroCreator?.triggers || {}).some(triggers => triggers.length > 0);

    if ((name || hasTriggers) && !quadroCreator?.createdQuadroId) {
        e.preventDefault();
        e.returnValue = 'Hai modifiche non salvate. Sei sicuro di voler lasciare la pagina?';
    }
});