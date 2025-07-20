// ============================================================================
// CREATE PAINT - SISTEMA DI CREAZIONE QUADRI VIVENTI
// JavaScript semplificato con oggetti default reali
// ============================================================================

class QuadroCreator {
    constructor() {
        this.devices = {};
        this.selectedDevice = null;
        this.previewCanvas = null;
        this.previewCtx = null;
        this.animationId = null;
        this.isPlaying = true;
        this.createdQuadroId = null;
        this.editingQuadroId = null;
        this.isEditMode = false;

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
            temperature: { min: 0, max: 50, unit: '°C', step: 0.1 },
            humidity: { min: 20, max: 90, unit: '%', step: 1 },
            light: { min: 0, max: 4095, unit: '', step: 10 },
            audio: { min: 0, max: 2900, unit: '', step: 10 }
        };

        // Modal state
        this.currentTrigger = null;
        this.currentAction = null;
        this.editingTriggerIndex = -1;
        this.editingActionIndex = -1;

        this.lastAddObjectsAction = null;
        this.tempBoxCoords = { x: 20, y: 20, width: 60, height: 60 };
        this.visibleBoxes = new Set();

        this.init();
    }

    async init() {
        this.setupEventListeners();
        this.setupCanvas();
        this.setupDragAndDrop();

        // AGGIUNGERE questa riga:
        await this.checkEditMode();

        this.loadDevices();
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

    // Controlla se siamo in modalità edit
    async checkEditMode() {
        const urlParams = new URLSearchParams(window.location.search);
        const editId = urlParams.get('edit');

        if (editId) {
            console.log('🔧 Modalità edit attivata per quadro:', editId);
            this.isEditMode = true;
            this.editingQuadroId = editId;

            try {
                await this.loadQuadroForEdit(editId);
            } catch (error) {
                console.error('Errore nel caricamento quadro per edit:', error);
                alert('Errore nel caricamento del quadro da modificare');
                window.location.href = '/';
            }
        }
    }

    // Carica i dati del quadro esistente
    async loadQuadroForEdit(quadroId) {
        const response = await fetch(`/api/quadri/${quadroId}`);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const quadroData = await response.json();
        console.log('📊 Dati quadro caricati per edit:', quadroData);

        // Precompila i campi
        this.populateFieldsFromQuadro(quadroData);

        // Aggiorna il titolo della pagina
        this.updatePageForEditMode(quadroData.name);
    }

    // Popola i campi del form con i dati esistenti
    populateFieldsFromQuadro(quadroData) {
        // Caricamento base (già esistente)
        const nameInput = document.getElementById('quadro-name');
        if (nameInput) {
            nameInput.value = quadroData.name || '';
        }

        this.selectedDevice = quadroData.device_id;
        this.triggers = quadroData.triggers || {
            temperature: [],
            humidity: [],
            light: [],
            audio: []
        };

        // File caricati
        if (quadroData.uploaded_files && quadroData.uploaded_files.length > 0) {
            console.log('📁 File caricati trovati:', quadroData.uploaded_files);
            this.uploadedFiles = quadroData.uploaded_files.map(file => ({
                ...file,
                url: file.url || null,
                isFromServer: file.isFromServer || true
            }));
        }

        // NUOVO: Ripristina stato completo dell'anteprima
        if (quadroData.preview_state) {
            console.log('🔄 Ripristino stato anteprima...');

            // Ripristina valori sensori
            if (quadroData.preview_state.sensor_values) {
                this.sensorValues = { ...quadroData.preview_state.sensor_values };

                // Aggiorna i slider
                setTimeout(() => {
                    this.updateSlidersFromSensorValues();
                    this.updateSensorValues();
                }, 100);
            }

            // Ripristina stato UI
            if (quadroData.preview_state.ui_state) {
                this.isPlaying = quadroData.preview_state.ui_state.is_playing !== false;

                if (quadroData.preview_state.ui_state.visible_boxes) {
                    this.visibleBoxes = new Set(quadroData.preview_state.ui_state.visible_boxes);
                }

                if (quadroData.preview_state.ui_state.temp_box_coords) {
                    this.tempBoxCoords = { ...quadroData.preview_state.ui_state.temp_box_coords };
                }
            }
        }

        // Forza aggiornamento dell'interfaccia
        setTimeout(() => {
            this.renderTriggers();
            this.renderUploadedFiles();
            this.validateForm();
            this.updatePreview();

            const deviceSelect = document.getElementById('device-select');
            if (deviceSelect && this.selectedDevice) {
                deviceSelect.value = this.selectedDevice;
                this.updateDeviceStatus();
            }

            // Aggiorna checkbox dei box visibili
            this.updateCheckboxes();

            console.log('✅ Stato anteprima ripristinato completamente');
        }, 500);
    }

    // Aggiorna l'interfaccia per la modalità edit
    updatePageForEditMode(quadroName) {
        // Aggiorna il titolo della pagina
        document.title = `Modifica: ${quadroName} - Quadri Viventi`;

        // Aggiorna il header
        const headerTitle = document.querySelector('.create-header h1');
        if (headerTitle) {
            headerTitle.innerHTML = '✏️ Modifica Quadro Vivente';
        }

        const headerSubtitle = document.querySelector('.create-header .subtitle');
        if (headerSubtitle) {
            headerSubtitle.textContent = `Modifica il quadro: ${quadroName}`;
        }

        // Aggiorna il pulsante di salvataggio
        const saveBtn = document.getElementById('save-quadro-btn');
        if (saveBtn) {
            saveBtn.innerHTML = '💾 Salva Modifiche';
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
                    ${file.url && file.type.startsWith('image/') ?
                `<img src="${file.url}" alt="${file.name}" style="width:100%;height:100%;object-fit:cover;">` :
                `📄${file.isFromServer ? ' (Server)' : ''}`
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
            case 'add-svg':
                const objFile = action.objectFile || action.svgObject || 'N/A';
                const size = action.size || 100;
                const rotation = action.rotation || 0;
                const quantity = action.quantity || 1;
                const animation = action.objectAnimation || action.svgAnimation || 'static';
                // NON mostra più le coordinate del box
                return `${objFile} - Qtà: ${quantity} - Dim: ${size}% - Rot: ${rotation}° - Anim: ${animation}`;
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
            container.innerHTML = this.triggers[sensor].map((trigger, index) => {
                const triggerId = `${sensor}_${index}`;
                const hasObjectsActions = trigger.actions.some(action =>
                    action.type === 'add-objects' || action.type === 'add-svg'
                );

                return `
 <div class="trigger-item">
                    <div class="trigger-header">
                        <div class="trigger-title">Trigger ${index + 1}</div>
                        <div class="trigger-actions">
                            ${hasObjectsActions ? `
                                <label class="checkbox-container" title="Mostra area oggetti">
                                    <input type="checkbox" id="show-box-${triggerId}" 
                                           onchange="quadroCreator.toggleTriggerBox('${triggerId}')"
                                           ${this.visibleBoxes.has(triggerId) ? 'checked' : ''}>
                                    <span class="checkmark">📦</span>
                                </label>
                            ` : ''}
                            <button class="btn btn-small btn-secondary" onclick="quadroCreator.editTrigger('${sensor}', ${index})" title="Modifica trigger">
                                ✏️
                            </button>
                            <button class="btn btn-small btn-danger" onclick="quadroCreator.deleteTrigger('${sensor}', ${index})" title="Elimina trigger">
                                🗑️
                            </button>
                        </div>
                    </div>
                    <div class="trigger-summary">
                        <div class="trigger-condition">${this.getTriggerConditionText(trigger)}</div>
                        <div class="trigger-actions-count">${trigger.actions.length} azioni configurate</div>
                        ${trigger.actions.length > 0 ? `
                            <div class="trigger-actions-preview">
                                ${trigger.actions.map(action => this.getActionDescription(action)).join(', ')}
                            </div>
                        ` : ''}
                    </div>
                </div>
            `;
            }).join('');
        });
    }

    toggleTriggerBox(triggerId) {
        if (this.visibleBoxes.has(triggerId)) {
            this.visibleBoxes.delete(triggerId);
            console.log(`📦 Box nascosto per trigger: ${triggerId}`);
        } else {
            this.visibleBoxes.add(triggerId);
            console.log(`📦 Box mostrato per trigger: ${triggerId}`);
        }
    }

    getTriggerConditionText(trigger) {
        switch (trigger.condition) {
            case 'range':
                return `Tra ${trigger.params.min} e ${trigger.params.max}`;
            case 'above':
                return `Sopra ${trigger.params.threshold}`;
            case 'below':
                return `Sotto ${trigger.params.threshold}`;
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

        // Se è un'azione add-objects, diventa l'ultima (per configurazione)
        if (this.currentAction.type === 'add-objects' || this.currentAction.type === 'add-svg') {
            this.lastAddObjectsAction = this.currentAction;

            console.log('📦 Modalità configurazione attivata per add-objects');

            // MODIFICA: Carica le coordinate esistenti dall'azione o usa valori di default
            if (this.currentAction.boxX !== undefined && this.currentAction.boxY !== undefined) {
                this.tempBoxCoords = {
                    x: this.currentAction.boxX || 20,
                    y: this.currentAction.boxY || 20,
                    width: this.currentAction.boxWidth || 60,
                    height: this.currentAction.boxHeight || 60
                };
            } else {
                // Valori di default per nuove azioni
                this.tempBoxCoords = { x: 20, y: 20, width: 60, height: 60 };
            }

            console.log('Box coords:', this.tempBoxCoords);

            // Ridisegna il canvas per mostrare il box immediatamente
            this.updatePreview();
        }

        modal.style.display = 'block';
    }
    closeActionModal() {
        const modal = document.getElementById('action-modal');
        modal.style.display = 'none';

        // Pulisce la reference all'ultima azione quando chiude il modal
        this.lastAddObjectsAction = null;

        this.currentAction = null;
        this.editingActionIndex = -1;
        this.updatePreview();

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

        // AGGIUNTA: Dopo aver creato l'HTML, aggiorna lo stato degli elementi selezionati
        if (type === 'add-objects' || type === 'add-svg') {
            this.updateAddObjectsSelections();
        }
    }

    // NUOVO METODO: Aggiorna le selezioni per le azioni add-objects
    updateAddObjectsSelections() {
        // Aggiorna selezione oggetto
        const selectedObject = this.currentAction.objectFile || this.currentAction.svgObject;
        if (selectedObject) {
            document.querySelectorAll('.object-item').forEach(item => {
                item.classList.remove('selected');
            });
            const selectedItem = document.querySelector(`[onclick="quadroCreator.selectObject('${selectedObject}')"]`);
            if (selectedItem) {
                selectedItem.classList.add('selected');
            }
        }

        // Aggiorna selezione animazione
        const selectedAnimation = this.currentAction.objectAnimation || this.currentAction.svgAnimation;
        if (selectedAnimation) {
            document.querySelectorAll('.animation-type-item').forEach(item => {
                item.classList.remove('selected');
            });
            const selectedAnimItem = document.querySelector(`[onclick="quadroCreator.selectObjectAnimation('${selectedAnimation}')"]`);
            if (selectedAnimItem) {
                selectedAnimItem.classList.add('selected');
            }
        }

        if (this.currentAction.boxX !== undefined) {
            this.tempBoxCoords = {
                x: this.currentAction.boxX || 20,
                y: this.currentAction.boxY || 20,
                width: this.currentAction.boxWidth || 60,
                height: this.currentAction.boxHeight || 60
            };
            setTimeout(() => {
                const boxX = document.getElementById('box-x');
                const boxY = document.getElementById('box-y');
                const boxWidth = document.getElementById('box-width');
                const boxHeight = document.getElementById('box-height');

                if (boxX) boxX.value = this.tempBoxCoords.x;
                if (boxY) boxY.value = this.tempBoxCoords.y;
                if (boxWidth) boxWidth.value = this.tempBoxCoords.width;
                if (boxHeight) boxHeight.value = this.tempBoxCoords.height;

                // Aggiorna anche i display dei valori
                document.querySelectorAll('.range-value').forEach(display => {
                    if (display.parentElement.querySelector('#box-x')) {
                        display.textContent = this.tempBoxCoords.x + '%';
                    } else if (display.parentElement.querySelector('#box-y')) {
                        display.textContent = this.tempBoxCoords.y + '%';
                    } else if (display.parentElement.querySelector('#box-width')) {
                        display.textContent = this.tempBoxCoords.width + '%';
                    } else if (display.parentElement.querySelector('#box-height')) {
                        display.textContent = this.tempBoxCoords.height + '%';
                    }
                });
            }, 100);
        }
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
        <h5>📦 Area di Posizionamento</h5>
        <div class="position-controls">
            <div class="position-group">
                <label>X Box (%):</label>
                <div class="range-input-group">
                    <input type="range" id="box-x" min="0" max="100" value="${this.tempBoxCoords.x}" 
                           oninput="quadroCreator.updateTempBoxCoords()">
                    <span class="range-value">${this.tempBoxCoords.x}%</span>
                </div>
            </div>
            <div class="position-group">
                <label>Y Box (%):</label>
                <div class="range-input-group">
                    <input type="range" id="box-y" min="0" max="100" value="${this.tempBoxCoords.y}"
                           oninput="quadroCreator.updateTempBoxCoords()">
                    <span class="range-value">${this.tempBoxCoords.y}%</span>
                </div>
            </div>
        </div>
        <div class="position-controls">
            <div class="position-group">
                <label>Larghezza Box (%):</label>
                <div class="range-input-group">
                    <input type="range" id="box-width" min="10" max="100" value="${this.tempBoxCoords.width}"
                           oninput="quadroCreator.updateTempBoxCoords()">
                    <span class="range-value">${this.tempBoxCoords.width}%</span>
                </div>
            </div>
            <div class="position-group">
                <label>Altezza Box (%):</label>
                <div class="range-input-group">
                    <input type="range" id="box-height" min="10" max="100" value="${this.tempBoxCoords.height}"
                           oninput="quadroCreator.updateTempBoxCoords()">
                    <span class="range-value">${this.tempBoxCoords.height}%</span>
                </div>
            </div>
        </div>
        <small class="help-text">🎯 Box grigio visibile in tempo reale! Muovi i controlli per testare.</small>
    </div>
    
    <div class="param-section">
        <h5>🎨 Proprietà Oggetti</h5>
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
                <label>Rotazione Base (°):</label>
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
                <label>Velocità Base:</label>
                <div class="range-input-group">
                    <input type="range" id="object-speed" min="0.1" max="3" step="0.1" value="${this.currentAction.animationSpeed || 1}">
                    <span class="range-value">${this.currentAction.animationSpeed || 1}x</span>
                </div>
            </div>
        </div>
        <small class="help-text">La velocità finale dipenderà anche dal valore del sensore nel trigger</small>
    </div>
`;
    }

    updateTempBoxCoords() {
        const boxX = document.getElementById('box-x');
        const boxY = document.getElementById('box-y');
        const boxWidth = document.getElementById('box-width');
        const boxHeight = document.getElementById('box-height');

        if (boxX && boxY && boxWidth && boxHeight) {
            this.tempBoxCoords = {
                x: parseInt(boxX.value) || 0,
                y: parseInt(boxY.value) || 0,
                width: parseInt(boxWidth.value) || 100,
                height: parseInt(boxHeight.value) || 100
            };

            // Aggiorna anche i display dei valori
            const displays = document.querySelectorAll('.range-value');
            displays.forEach((display, index) => {
                if (display.parentElement.querySelector('#box-x')) {
                    display.textContent = this.tempBoxCoords.x + '%';
                } else if (display.parentElement.querySelector('#box-y')) {
                    display.textContent = this.tempBoxCoords.y + '%';
                } else if (display.parentElement.querySelector('#box-width')) {
                    display.textContent = this.tempBoxCoords.width + '%';
                } else if (display.parentElement.querySelector('#box-height')) {
                    display.textContent = this.tempBoxCoords.height + '%';
                }
            });

            // AGGIUNTA: Ridisegna il canvas per mostrare le modifiche
            this.updatePreview();
        }
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
        // Salva le proprietà degli oggetti
        this.currentAction.size = parseInt(document.getElementById('object-size').value);
        this.currentAction.opacity = parseInt(document.getElementById('object-opacity').value);
        this.currentAction.rotation = parseInt(document.getElementById('object-rotation').value);
        this.currentAction.quantity = parseInt(document.getElementById('object-quantity').value);
        this.currentAction.animationSpeed = parseFloat(document.getElementById('object-speed').value);

        // AGGIUNTA: Salva anche le coordinate del box
        this.currentAction.boxX = this.tempBoxCoords.x;
        this.currentAction.boxY = this.tempBoxCoords.y;
        this.currentAction.boxWidth = this.tempBoxCoords.width;
        this.currentAction.boxHeight = this.tempBoxCoords.height;

        // Normalizza il tipo di azione
        if (this.currentAction.type === 'add-svg') {
            this.currentAction.type = 'add-objects';
        }
    }

    drawObjectBoxes(ctx, width, height) {
        // Disegna un box per ogni trigger che ha il checkbox attivo
        Object.entries(this.triggers).forEach(([sensor, triggers]) => {
            const sensorValue = this.sensorValues[sensor];

            triggers.forEach((trigger, index) => {
                const triggerId = `${sensor}_${index}`;

                // Mostra il box solo se:
                // 1. Il checkbox è attivato, E
                // 2. Il trigger è attivo con i valori attuali, E  
                // 3. Il trigger ha azioni add-objects
                if (this.visibleBoxes.has(triggerId) &&
                    this.isTriggerActive(trigger, sensorValue)) {

                    const objectActions = trigger.actions.filter(action =>
                        action.type === 'add-objects' || action.type === 'add-svg'
                    );

                    objectActions.forEach(action => {
                        this.drawBoxForAction(ctx, action, width, height, triggerId);
                    });
                }
            });
        });

        // MANTIENI il box per l'azione in configurazione
        if (this.lastAddObjectsAction &&
            (this.lastAddObjectsAction.type === 'add-objects' || this.lastAddObjectsAction.type === 'add-svg')) {
            this.drawConfigurationBox(ctx, width, height);
        }
    }
    drawBoxForAction(ctx, action, width, height, triggerId) {
        let boxX, boxY, boxWidth, boxHeight;

        // MODIFICA: Controlla se l'azione ha coordinate salvate
        if (action.boxX !== undefined && action.boxY !== undefined) {
            // Usa le coordinate salvate nell'azione
            boxX = action.boxX / 100 * width;
            boxY = action.boxY / 100 * height;
            boxWidth = action.boxWidth / 100 * width;
            boxHeight = action.boxHeight / 100 * height;
        } else {
            // Usa coordinate fisse per ogni trigger (generate da un seed) solo come fallback
            const seed = this.getTriggerSeed(triggerId);
            const boxCoords = this.generateBoxCoords(seed);
            boxX = boxCoords.x / 100 * width;
            boxY = boxCoords.y / 100 * height;
            boxWidth = boxCoords.width / 100 * width;
            boxHeight = boxCoords.height / 100 * height;
        }

        // Disegna il bordo grigio
        ctx.strokeStyle = '#999999';
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 8]);
        ctx.strokeRect(boxX, boxY, boxWidth, boxHeight);
        ctx.setLineDash([]);

        // Etichetta del trigger
        ctx.fillStyle = '#666';
        ctx.font = '12px Arial';
        ctx.fillText(`${triggerId} (${action.quantity || 5} ${action.objectFile || 'oggetti'})`,
            boxX + 5, boxY + 15);
    }


    // 6. NUOVA FUNZIONE per disegnare il box di configurazione (quando modifica azione)
    drawConfigurationBox(ctx, width, height) {
        const boxX = this.tempBoxCoords.x / 100 * width;
        const boxY = this.tempBoxCoords.y / 100 * height;
        const boxWidth = this.tempBoxCoords.width / 100 * width;
        const boxHeight = this.tempBoxCoords.height / 100 * height;

        // Disegna con colore diverso per distinguerlo
        ctx.strokeStyle = '#ff6b6b';
        ctx.lineWidth = 3;
        ctx.setLineDash([5, 5]);
        ctx.strokeRect(boxX, boxY, boxWidth, boxHeight);
        ctx.setLineDash([]);

        // Etichetta speciale
        ctx.fillStyle = '#ff6b6b';
        ctx.font = 'bold 12px Arial';
        ctx.fillText('CONFIGURAZIONE', boxX + 5, boxY + 15);
    }


    // 7. NUOVE FUNZIONI UTILITY per coordinate box consistenti
    getTriggerSeed(triggerId) {
        let hash = 0;
        for (let i = 0; i < triggerId.length; i++) {
            const char = triggerId.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash);
    }

    generateBoxCoords(seed) {
        // Genera coordinate consistenti ma diverse per ogni trigger
        const rand1 = this.seededRandom(seed);
        const rand2 = this.seededRandom(seed + 1000);
        const rand3 = this.seededRandom(seed + 2000);
        const rand4 = this.seededRandom(seed + 3000);

        return {
            x: Math.floor(rand1 * 60 + 10),      // 10-70%
            y: Math.floor(rand2 * 60 + 10),      // 10-70%
            width: Math.floor(rand3 * 40 + 30),  // 30-70%
            height: Math.floor(rand4 * 40 + 30)  // 30-70%
        };
    }
    showBoxControls() {
        console.log('🎯 CONTROLLI BOX:');
        console.log('quadroCreator.tempBoxCoords:', this.tempBoxCoords);
        console.log('quadroCreator.debugShowBox:', this.debugShowBox);
        console.log('');
        console.log('📦 COMANDI UTILI:');
        console.log('quadroCreator.setBoxPosition(x, y, width, height) - Cambia posizione box');
        console.log('quadroCreator.toggleDebugBox() - Attiva/disattiva visualizzazione box');
        console.log('quadroCreator.testBoxMovement() - Test movimento automatico');
    }
    setBoxPosition(x, y, width, height) {
        this.tempBoxCoords = {
            x: Math.max(0, Math.min(100, x)),
            y: Math.max(0, Math.min(100, y)),
            width: Math.max(10, Math.min(100, width)),
            height: Math.max(10, Math.min(100, height))
        };
        console.log('📦 Box posizionato:', this.tempBoxCoords);
    }
    toggleDebugBox() {
        this.debugShowBox = !this.debugShowBox;
        console.log('📦 Debug box:', this.debugShowBox ? 'ATTIVO' : 'DISATTIVO');
    }
    testBoxMovement() {
        console.log('🎬 Test movimento box...');
        let step = 0;
        const interval = setInterval(() => {
            const positions = [
                { x: 10, y: 10, width: 30, height: 30 },
                { x: 50, y: 10, width: 40, height: 40 },
                { x: 50, y: 50, width: 40, height: 40 },
                { x: 10, y: 50, width: 30, height: 30 },
                { x: 25, y: 25, width: 50, height: 50 }
            ];

            if (step < positions.length) {
                this.setBoxPosition(
                    positions[step].x,
                    positions[step].y,
                    positions[step].width,
                    positions[step].height
                );
                step++;
            } else {
                clearInterval(interval);
                console.log('✅ Test completato');
            }
        }, 1000);
    }
    drawSingleObjectBox(ctx, action, width, height) {
        // Calcola le coordinate del box
        const boxX = (action.boxX || 0) / 100 * width;
        const boxY = (action.boxY || 0) / 100 * height;
        const boxWidth = (action.boxWidth || 100) / 100 * width;
        const boxHeight = (action.boxHeight || 100) / 100 * height;

        // Disegna il bordo grigio (1mm ≈ 3px su schermo)
        ctx.strokeStyle = '#999999';
        ctx.lineWidth = 3;
        ctx.setLineDash([5, 5]); // Linea tratteggiata per essere meno invasiva
        ctx.strokeRect(boxX, boxY, boxWidth, boxHeight);
        ctx.setLineDash([]); // Reset line dash
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

        // AGGIUNTA: Reset del filtro all'inizio di ogni frame
        ctx.filter = 'none';

        // Pulisci il canvas
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Applica i trigger attivi
        this.applyActiveTriggers(ctx, canvas.width, canvas.height);

        // AGGIUNTA: Reset del filtro alla fine per evitare interferenze
        ctx.filter = 'none';

        // Disegna i box degli oggetti per ultimo (sopra tutto)
        this.drawObjectBoxes(ctx, canvas.width, canvas.height);
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

    applyActiveTriggers(ctx, width, height) {
        let hasActiveTriggers = false;

        // Verifica ogni trigger per ogni sensore
        Object.entries(this.triggers).forEach(([sensor, triggers]) => {
            const sensorValue = this.sensorValues[sensor];

            triggers.forEach(trigger => {
                if (this.isTriggerActive(trigger, sensorValue)) {
                    hasActiveTriggers = true;
                    trigger.actions.forEach(action => {
                        // Passa anche il trigger per calcolare la velocità dinamica
                        this.executeAction(ctx, action, width, height, sensorValue, trigger);
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
            case 'duration':
                return Math.abs(value - trigger.params.target) < 5;
            default:
                return false;
        }
    }

    executeAction(ctx, action, width, height, sensorValue, trigger = null) {
        switch (action.type) {
            case 'load-image':
                this.renderLoadImageAction(ctx, action, width, height);
                break;
            case 'change-background':
                this.renderChangeBackgroundAction(ctx, action, width, height);
                break;
            case 'add-objects':
            case 'add-svg':
                this.renderAddObjectsAction(ctx, action, width, height, sensorValue, trigger);
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


    renderAddObjectsAction(ctx, action, width, height, sensorValue, trigger = null) {
        const quantity = action.quantity || 5;
        const baseSize = (action.size || 100) / 100 * 30;
        const opacity = (action.opacity || 100) / 100;
        const baseSpeed = action.animationSpeed || 1;

        const dynamicSpeed = this.calculateDynamicSpeed(trigger, sensorValue, baseSpeed);
        const time = Date.now() * 0.001 * dynamicSpeed;

        let boxX, boxY, boxWidth, boxHeight;

        // Determina quale box usare
        if (this.lastAddObjectsAction === action) {
            // Usa il box di configurazione (rosso)
            boxX = this.tempBoxCoords.x / 100 * width;
            boxY = this.tempBoxCoords.y / 100 * height;
            boxWidth = this.tempBoxCoords.width / 100 * width;
            boxHeight = this.tempBoxCoords.height / 100 * height;
        } else if (action.boxX !== undefined && action.boxY !== undefined) {
            // AGGIUNTA: Usa le coordinate salvate nell'azione
            boxX = action.boxX / 100 * width;
            boxY = action.boxY / 100 * height;
            boxWidth = action.boxWidth / 100 * width;
            boxHeight = action.boxHeight / 100 * height;
        } else {
            // Trova il triggerId per questa azione e usa le sue coordinate fisse
            let triggerId = null;
            Object.entries(this.triggers).forEach(([sensor, triggers]) => {
                triggers.forEach((trig, index) => {
                    if (trig.actions.includes(action)) {
                        triggerId = `${sensor}_${index}`;
                    }
                });
            });

            if (triggerId) {
                const seed = this.getTriggerSeed(triggerId);
                const boxCoords = this.generateBoxCoords(seed);
                boxX = boxCoords.x / 100 * width;
                boxY = boxCoords.y / 100 * height;
                boxWidth = boxCoords.width / 100 * width;
                boxHeight = boxCoords.height / 100 * height;
            } else {
                // Fallback: tutto lo schermo
                boxX = 0;
                boxY = 0;
                boxWidth = width;
                boxHeight = height;
            }
        }

        const baseRotation = (action.rotation || 0) * Math.PI / 180;

        ctx.globalAlpha = opacity;

        const actionSeed = this.getActionSeed(action);

        for (let i = 0; i < quantity; i++) {
            const seedX = this.seededRandom(actionSeed + i * 1000);
            const seedY = this.seededRandom(actionSeed + i * 2000);

            let x = boxX + (seedX * boxWidth);
            let y = boxY + (seedY * boxHeight);

            let size = baseSize;
            let rotation = baseRotation;

            const intensity = Math.max(0, Math.min(1, sensorValue / 100));
            size *= (0.5 + intensity * 0.5);

            // Applica animazioni (codice esistente)
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

            // CONTENIMENTO dentro il box
            x = Math.max(boxX + size, Math.min(boxX + boxWidth - size, x));
            y = Math.max(boxY + size, Math.min(boxY + boxHeight - size, y));

            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(rotation);

            const objectFile = action.objectFile || action.svgObject || 'star.svg';
            this.drawRealObject(ctx, objectFile, size);

            ctx.restore();
        }

        ctx.globalAlpha = 1;
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
        // Generatore pseudo-random con seed per posizioni consistenti
        const x = Math.sin(seed) * 10000;
        return x - Math.floor(x);
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

    // VERSIONE CORRETTA del metodo saveQuadro()
    async saveQuadro() {
        const name = document.getElementById('quadro-name').value;
        const deviceId = document.getElementById('device-select').value;

        // Validazione
        const validation = this.validateQuadroBeforeSave();
        if (!validation.valid) {
            alert('Errori di validazione:\n' + validation.errors.join('\n'));
            return;
        }
        if (validation.warnings.length > 0) {
            const proceed = confirm('Avvisi di validazione:\n' + validation.warnings.join('\n') + '\n\nVuoi continuare comunque?');
            if (!proceed) return;
        }

        if (!name || name.length > 50) {
            alert('Inserisci un nome valido per il quadro (max 50 caratteri)');
            return;
        }
        if (!deviceId) {
            alert('Seleziona un dispositivo ESP32');
            return;
        }

        // ✅ COSTRUISCE I DATI REALI (non hardcoded)
        const quadroData = {
            // === DATI BASE ===
            name: name,                    // ✅ Valore reale dal form
            device_id: deviceId,           // ✅ Valore reale dal form
            template: "personalizzato",
            is_predefined: false,
            version: "4.0",

            // === CONFIGURAZIONE TRIGGER ===
            triggers: this.triggers,       // ✅ Trigger reali configurati

            // === FILE CARICATI ===
            uploaded_files: this.uploadedFiles.map(file => ({
                id: file.id,
                name: file.name,
                type: file.type,
                url: file.url,
                isFromServer: file.isFromServer || false
            })),

            // === STATO ANTEPRIMA (PER RIPRISTINO ESATTO) ===
            preview_state: {
                // Valori sensori al momento del salvataggio
                sensor_values: { ...this.sensorValues },

                // Configurazione canvas
                canvas_config: {
                    width: this.previewCanvas.width,
                    height: this.previewCanvas.height
                },

                // Stato UI (box visibili, ecc.)
                ui_state: {
                    is_playing: this.isPlaying,
                    visible_boxes: Array.from(this.visibleBoxes),
                    temp_box_coords: { ...this.tempBoxCoords }
                },

                // Screenshot dell'anteprima (opzionale)
                preview_image: this.previewCanvas.toDataURL('image/png'),

                saved_at: new Date().toISOString()
            }
        };

        // Aggiungi timestamp appropriato
        if (this.isEditMode) {
            quadroData.updated_at = new Date().toISOString();
        } else {
            quadroData.created_at = new Date().toISOString();
        }

        try {
            const url = this.isEditMode ? `/api/quadri/${this.editingQuadroId}` : '/api/quadri';
            const method = this.isEditMode ? 'PUT' : 'POST';

            console.log(`${method} ${url}`, quadroData);

            const response = await fetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(quadroData)
            });

            if (response.ok) {
                const result = await response.json();

                if (this.isEditMode) {
                    this.createdQuadroId = this.editingQuadroId;
                    this.showSuccessModal('Quadro modificato con successo!');
                } else {
                    this.createdQuadroId = result.quadro_id;
                    this.showSuccessModal('Quadro creato con successo!');
                }
            } else {
                const error = await response.json();
                alert('Errore nel salvataggio: ' + (error.error || 'Errore sconosciuto'));
            }
        } catch (error) {
            console.error('Errore nel salvataggio:', error);
            alert('Errore di connessione. Riprova più tardi.');
        }
    }

    validateQuadroBeforeSave() {
        const errors = [];
        const warnings = [];

        // Verifica dati base
        const name = document.getElementById('quadro-name').value;
        const deviceId = document.getElementById('device-select').value;

        if (!name || name.length === 0) {
            errors.push('Nome quadro mancante');
        }
        if (!deviceId) {
            errors.push('Dispositivo ESP32 non selezionato');
        }

        // Verifica trigger
        const totalTriggers = Object.values(this.triggers).flat().length;
        if (totalTriggers === 0) {
            warnings.push('Nessun trigger configurato - il quadro sarà statico');
        }

        // Verifica azioni con coordinate
        Object.entries(this.triggers).forEach(([sensor, triggers]) => {
            triggers.forEach((trigger, triggerIndex) => {
                if (trigger.actions) {
                    trigger.actions.forEach((action, actionIndex) => {
                        if ((action.type === 'add-objects' || action.type === 'add-svg') &&
                            (action.boxX === undefined || action.boxY === undefined)) {
                            warnings.push(`Azione ${sensor}_${triggerIndex}_${actionIndex}: coordinate box mancanti`);
                        }
                    });
                }
            });
        });

        return {
            valid: errors.length === 0,
            errors,
            warnings,
            totalTriggers,
            totalActions: Object.values(this.triggers).flat()
                .reduce((acc, t) => acc + (t.actions ? t.actions.length : 0), 0)
        };
    }


    showSuccessModal(message = null) {
        const modal = document.getElementById('success-modal');
        const modalTitle = modal.querySelector('h2');
        const modalText = modal.querySelector('p');

        if (message) {
            modalTitle.textContent = this.isEditMode ? '✅ Quadro Modificato!' : '✅ Quadro Creato!';
            modalText.textContent = message;
        }

        modal.style.display = 'block';
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


    toggleAllBoxes(show = true) {
        this.visibleBoxes.clear();
        if (show) {
            Object.entries(this.triggers).forEach(([sensor, triggers]) => {
                triggers.forEach((trigger, index) => {
                    const hasObjectsActions = trigger.actions.some(action =>
                        action.type === 'add-objects' || action.type === 'add-svg'
                    );
                    if (hasObjectsActions) {
                        this.visibleBoxes.add(`${sensor}_${index}`);
                    }
                });
            });
        }
        // Aggiorna i checkbox nell'interfaccia
        this.updateCheckboxes();
        console.log(`📦 ${show ? 'Mostrati' : 'Nascosti'} tutti i box`);
    }

    updateCheckboxes() {
        Object.entries(this.triggers).forEach(([sensor, triggers]) => {
            triggers.forEach((trigger, index) => {
                const triggerId = `${sensor}_${index}`;
                const checkbox = document.getElementById(`show-box-${triggerId}`);
                if (checkbox) {
                    checkbox.checked = this.visibleBoxes.has(triggerId);
                }
            });
        });
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

    // NUOVA FUNZIONE: Esporta lo stato completo come JSON
    exportCurrentState() {
        const completeState = {
            name: document.getElementById('quadro-name').value,
            device_id: document.getElementById('device-select').value,
            template: 'personalizzato',
            is_predefined: false,
            triggers: this.triggers,
            uploaded_files: this.uploadedFiles.map(file => ({
                id: file.id,
                name: file.name,
                type: file.type,
                url: file.url,
                isFromServer: file.isFromServer || false
            })),
            version: "4.0",
            preview_state: {
                sensor_values: { ...this.sensorValues },
                canvas_config: {
                    width: this.previewCanvas.width,
                    height: this.previewCanvas.height
                },
                ui_state: {
                    is_playing: this.isPlaying,
                    visible_boxes: Array.from(this.visibleBoxes),
                    temp_box_coords: { ...this.tempBoxCoords }
                },
                preview_image: this.previewCanvas.toDataURL('image/png'),
                exported_at: new Date().toISOString()
            }
        };

        // Crea e scarica il file JSON
        const blob = new Blob([JSON.stringify(completeState, null, 2)], {
            type: 'application/json'
        });

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `quadro_${completeState.name.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        console.log('📥 Stato completo esportato:', completeState);
        return completeState;
    }

    // NUOVA FUNZIONE: Importa stato da JSON
    async importState(jsonData) {
        try {
            const quadroData = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;

            console.log('📤 Importazione stato:', quadroData);

            // Usa la funzione esistente per ripristinare tutto
            this.populateFieldsFromQuadro(quadroData);

            // Aggiorna immediatamente l'anteprima
            setTimeout(() => {
                this.updatePreview();
                console.log('✅ Importazione completata');
            }, 1000);

            return true;
        } catch (error) {
            console.error('❌ Errore importazione:', error);
            alert('Errore nell\'importazione del file JSON');
            return false;
        }
    }

    // NUOVA FUNZIONE: Ottieni solo i dati essenziali dello stato corrente
    getCurrentStateData() {
        return {
            // Informazioni base
            name: document.getElementById('quadro-name').value,
            device_id: document.getElementById('device-select').value,

            // Configurazione quadro
            triggers: this.triggers,
            uploaded_files: this.uploadedFiles.length,

            // Stato anteprima
            sensor_values: this.sensorValues,
            is_playing: this.isPlaying,
            visible_boxes_count: this.visibleBoxes.size,
            canvas_size: `${this.previewCanvas.width}x${this.previewCanvas.height}`,

            // Timestamp
            current_time: new Date().toISOString()
        };
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


window.updateTempBoxCoords = function () {
    if (quadroCreator && quadroCreator.updateTempBoxCoords) {
        quadroCreator.updateTempBoxCoords();
    }
};
window.showAllBoxes = function () {
    if (quadroCreator) {
        quadroCreator.toggleAllBoxes(true);
    }
};

window.hideAllBoxes = function () {
    if (quadroCreator) {
        quadroCreator.toggleAllBoxes(false);
    }
};

window.listVisibleBoxes = function () {
    if (quadroCreator) {
        console.log('📦 Box visibili:', Array.from(quadroCreator.visibleBoxes));
    }
};