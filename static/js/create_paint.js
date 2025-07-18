// ============================================================================
// CREATE PAINT - SISTEMA DI CREAZIONE QUADRI VIVENTI
// JavaScript completo per la creazione e configurazione di quadri personalizzati
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

        // Oggetti SVG predefiniti disponibili
        this.availableSVGs = [
            'bubble.svg', 'cloud-rain.svg', 'cloud.svg', 'comet.svg', 'coral.svg',
            'fish.svg', 'galaxy.svg', 'leaf.svg', 'planet.svg', 'rocket.svg',
            'seaweed.svg', 'snowflake.svg', 'sparkles.svg', 'star.svg', 'sun.svg',
            'wave.svg', 'waves.svg'
        ];

        // Animazioni disponibili
        this.availableAnimations = [
            'fade', 'slide', 'bounce', 'rotate', 'scale', 'float',
            'pulse', 'wave', 'morph', 'sparkle', 'spiral'
        ];

        // Filtri visivi disponibili
        this.availableFilters = [
            'blur', 'brightness', 'contrast', 'saturation', 'hue-rotate',
            'sepia', 'grayscale', 'invert'
        ];

        // Modal state
        this.currentTrigger = null;
        this.currentAction = null;
        this.editingTriggerIndex = -1;
        this.editingActionIndex = -1;

        this.init();
    }

    init() {
        this.setupSocket();
        this.setupEventListeners();
        this.setupCanvas();
        this.setupDragAndDrop();
        this.loadDevices();
        this.startPreviewAnimation();
        this.hideLoadingOverlay();
    }

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
        // Nome quadro
        const nameInput = document.getElementById('quadro-name');
        nameInput.addEventListener('input', (e) => {
            this.validateForm();
        });

        // Selezione dispositivo
        const deviceSelect = document.getElementById('device-select');
        deviceSelect.addEventListener('change', (e) => {
            this.selectDevice(e.target.value);
        });

        // File input
        const fileInput = document.getElementById('file-input');
        fileInput.addEventListener('change', (e) => {
            this.handleFileSelect(e.target.files);
        });

        // Slider di simulazione
        const sliders = ['temp', 'humidity', 'light', 'audio'];
        sliders.forEach(slider => {
            const element = document.getElementById(`${slider}-slider`);
            element.addEventListener('input', (e) => {
                this.updateSensorValue(slider, e.target.value);
            });
        });

        // Gestione modali
        window.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                this.closeModal(e.target);
            }
        });

        // Gestione resize
        window.addEventListener('resize', () => {
            this.resizeCanvas();
        });
    }

    setupCanvas() {
        this.previewCanvas = document.getElementById('preview-canvas');
        this.previewCtx = this.previewCanvas.getContext('2d');

        // Ottimizzazioni rendering
        this.previewCtx.imageSmoothingEnabled = true;
        this.previewCtx.textBaseline = 'middle';

        this.resizeCanvas();
    }

    resizeCanvas() {
        const container = this.previewCanvas.parentElement;
        const rect = container.getBoundingClientRect();

        // Mantieni proporzioni 4:3
        const aspectRatio = 4 / 3;
        let width = rect.width - 4; // bordo
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

    async loadDevices() {
        try {
            const response = await fetch('/api/devices');
            if (response.ok) {
                this.devices = await response.json();
                this.populateDeviceSelect();
            } else {
                console.error('Errore nel caricamento dispositivi:', response.status);
                // Fallback per testing locale
                this.devices = {};
                this.populateDeviceSelect();
            }
        } catch (error) {
            console.error('Errore nella richiesta dispositivi:', error);
            // Fallback per testing locale
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
    // GESTIONE TRIGGERS
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

        let html = '';

        switch (condition) {
            case 'range':
                html = `
                    <div class="param-row">
                        <div class="param-group">
                            <label>Valore Minimo:</label>
                            <input type="number" id="param-min" value="${this.currentTrigger.params.min || 0}">
                        </div>
                        <div class="param-group">
                            <label>Valore Massimo:</label>
                            <input type="number" id="param-max" value="${this.currentTrigger.params.max || 100}">
                        </div>
                    </div>
                `;
                break;
            case 'above':
                html = `
                    <div class="param-group">
                        <label>Soglia:</label>
                        <input type="number" id="param-threshold" value="${this.currentTrigger.params.threshold || 50}">
                    </div>
                `;
                break;
            case 'below':
                html = `
                    <div class="param-group">
                        <label>Soglia:</label>
                        <input type="number" id="param-threshold" value="${this.currentTrigger.params.threshold || 50}">
                    </div>
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
            'add-svg': '🌟 Aggiungi Oggetti SVG',
            'add-animation': '✨ Aggiungi Animazione',
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
            case 'add-svg':
                return `${action.svgObject || 'N/A'} - Quantità: ${action.quantity || 1} - Animazione: ${action.svgAnimation || 'static'}`;
            case 'add-animation':
                return `${action.animation || 'fade'} - Durata: ${action.duration || 1000}ms`;
            case 'add-filter':
                return `${action.filter || 'blur'} - Intensità: ${action.intensity || 50}%`;
            default:
                return 'Configurazione personalizzata';
        }
    }

    saveTrigger() {
        // Raccogli parametri condizione
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

        // Salva o aggiorna trigger
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
    // GESTIONE AZIONI
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
            case 'add-svg':
                html = this.renderAddSVGParams();
                break;
            case 'add-animation':
                html = this.renderAddAnimationParams();
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

        // Aggiorna UI
        document.querySelectorAll('.background-type-item').forEach(item => {
            item.classList.remove('selected');
        });
        event.target.closest('.background-type-item').classList.add('selected');

        // Aggiorna parametri colore
        const container = document.getElementById('background-color-params');
        container.innerHTML = this.renderBackgroundColorParams();
    }

    renderAddSVGParams() {
        return `
            <div class="param-section">
                <h5>🌟 Oggetti SVG</h5>
                <div class="svg-objects-grid">
                    ${this.availableSVGs.map(svg => `
                        <div class="svg-object-item ${this.currentAction.svgObject === svg ? 'selected' : ''}" 
                             onclick="quadroCreator.selectSVGObject('${svg}')">
                            <div class="svg-icon">
                                <img src="/static/images/${svg}" alt="${this.formatSVGName(svg)}" style="width: 24px; height: 24px; object-fit: contain;">
                            </div>
                            <div class="svg-name">${this.formatSVGName(svg)}</div>
                        </div>
                    `).join('')}
                </div>
            </div>
            
            <div class="param-section">
                <h5>✨ Tipo di Animazione</h5>
                <div class="animation-types-grid">
                    ${this.availableAnimations.map(anim => `
                        <div class="animation-type-item ${this.currentAction.svgAnimation === anim ? 'selected' : ''}" 
                             onclick="quadroCreator.selectSVGAnimation('${anim}')">
                            <div class="animation-icon">${this.getAnimationIcon(anim)}</div>
                            <div class="animation-name">${this.formatAnimationName(anim)}</div>
                        </div>
                    `).join('')}
                </div>
            </div>
            
            <div class="param-section">
                <h5>📊 Parametri</h5>
                <div class="form-row">
                    <div class="form-group">
                        <label>Quantità:</label>
                        <div class="range-input-group">
                            <input type="range" id="svg-quantity" min="1" max="30" value="${this.currentAction.quantity || 5}">
                            <span class="range-value">${this.currentAction.quantity || 5}</span>
                        </div>
                    </div>
                    <div class="form-group">
                        <label>Dimensione (%):</label>
                        <div class="range-input-group">
                            <input type="range" id="svg-size" min="10" max="200" value="${this.currentAction.size || 100}">
                            <span class="range-value">${this.currentAction.size || 100}%</span>
                        </div>
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Opacità (%):</label>
                        <div class="range-input-group">
                            <input type="range" id="svg-opacity" min="0" max="100" value="${this.currentAction.opacity || 100}">
                            <span class="range-value">${this.currentAction.opacity || 100}%</span>
                        </div>
                    </div>
                    <div class="form-group">
                        <label>Velocità Animazione:</label>
                        <div class="range-input-group">
                            <input type="range" id="svg-speed" min="0.1" max="5" step="0.1" value="${this.currentAction.animationSpeed || 1}">
                            <span class="range-value">${this.currentAction.animationSpeed || 1}x</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    selectSVGObject(svg) {
        this.currentAction.svgObject = svg;

        // Aggiorna UI
        document.querySelectorAll('.svg-object-item').forEach(item => {
            item.classList.remove('selected');
        });
        event.target.closest('.svg-object-item').classList.add('selected');
    }

    renderAddAnimationParams() {
        return `
            <div class="param-section">
                <h5>✨ Tipo di Animazione</h5>
                <div class="animation-types-grid">
                    ${this.availableAnimations.map(anim => `
                        <div class="animation-type-item ${this.currentAction.animation === anim ? 'selected' : ''}" 
                             onclick="quadroCreator.selectAnimation('${anim}')">
                            <div class="animation-icon">${this.getAnimationIcon(anim)}</div>
                            <div class="animation-name">${this.formatAnimationName(anim)}</div>
                        </div>
                    `).join('')}
                </div>
            </div>
            
            <div class="param-section">
                <h5>⏱️ Controlli Animazione</h5>
                <div class="form-row">
                    <div class="form-group">
                        <label>Durata (ms):</label>
                        <div class="range-input-group">
                            <input type="range" id="anim-duration" min="100" max="5000" step="100" value="${this.currentAction.duration || 1000}">
                            <span class="range-value">${this.currentAction.duration || 1000}ms</span>
                        </div>
                    </div>
                    <div class="form-group">
                        <label>Easing:</label>
                        <select id="anim-easing">
                            <option value="linear" ${this.currentAction.easing === 'linear' ? 'selected' : ''}>Lineare</option>
                            <option value="ease" ${this.currentAction.easing === 'ease' ? 'selected' : ''}>Naturale</option>
                            <option value="ease-in" ${this.currentAction.easing === 'ease-in' ? 'selected' : ''}>Accelera</option>
                            <option value="ease-out" ${this.currentAction.easing === 'ease-out' ? 'selected' : ''}>Decelera</option>
                            <option value="ease-in-out" ${this.currentAction.easing === 'ease-in-out' ? 'selected' : ''}>Acc/Dec</option>
                        </select>
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>
                            <input type="checkbox" id="anim-loop" ${this.currentAction.loop ? 'checked' : ''}>
                            Loop infinito
                        </label>
                    </div>
                    <div class="form-group">
                        <label>Ripetizioni:</label>
                        <input type="number" id="anim-iterations" min="1" max="100" value="${this.currentAction.iterations || 1}" 
                               ${this.currentAction.loop ? 'disabled' : ''}>
                    </div>
                </div>
            </div>
        `;
    }

    selectAnimation(animation) {
        this.currentAction.animation = animation;

        // Aggiorna UI
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

        // Aggiorna UI
        document.querySelectorAll('.filter-type-item').forEach(item => {
            item.classList.remove('selected');
        });
        event.target.closest('.filter-type-item').classList.add('selected');
    }

    saveAction() {
        // Raccogli tutti i parametri in base al tipo di azione
        const type = document.getElementById('action-type').value;
        this.currentAction.type = type;

        switch (type) {
            case 'load-image':
                this.saveLoadImageAction();
                break;
            case 'change-background':
                this.saveChangeBackgroundAction();
                break;
            case 'add-svg':
                this.saveAddSVGAction();
                break;
            case 'add-animation':
                this.saveAddAnimationAction();
                break;
            case 'add-filter':
                this.saveAddFilterAction();
                break;
        }

        // Salva o aggiorna azione
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

    saveAddSVGAction() {
        this.currentAction.quantity = parseInt(document.getElementById('svg-quantity').value);
        this.currentAction.size = parseInt(document.getElementById('svg-size').value);
        this.currentAction.opacity = parseInt(document.getElementById('svg-opacity').value);
        this.currentAction.animationSpeed = parseFloat(document.getElementById('svg-speed').value);
        // svgObject e svgAnimation sono già salvati nelle funzioni select
    }

    saveAddAnimationAction() {
        this.currentAction.duration = parseInt(document.getElementById('anim-duration').value);
        this.currentAction.easing = document.getElementById('anim-easing').value;
        this.currentAction.loop = document.getElementById('anim-loop').checked;
        if (!this.currentAction.loop) {
            this.currentAction.iterations = parseInt(document.getElementById('anim-iterations').value);
        }
    }

    saveAddFilterAction() {
        this.currentAction.intensity = parseInt(document.getElementById('filter-intensity').value);
    }

    // ============================================================================
    // UTILITY FUNCTIONS
    // ============================================================================

    getSVGIcon(svg) {
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
        return icons[svg] || '📄';
    }

    formatSVGName(svg) {
        return svg.replace('.svg', '').replace('-', ' ').split(' ')
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

        // Pulisci canvas con sfondo bianco
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Applica triggers attivi
        this.applyActiveTriggers(ctx, canvas.width, canvas.height);
    }

    applyActiveTriggers(ctx, width, height) {
        // Verifica ogni trigger per ogni sensore
        Object.entries(this.triggers).forEach(([sensor, triggers]) => {
            const sensorValue = this.sensorValues[sensor];

            triggers.forEach(trigger => {
                if (this.isTriggerActive(trigger, sensorValue)) {
                    // Esegui tutte le azioni del trigger
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
                // Per ora semplificato - in un'app reale tracceremmo i valori storici
                return Math.random() > 0.7; // Simula variazione
            case 'duration':
                // Per ora semplificato - in un'app reale tracceremmo il tempo
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
            case 'add-svg':
                this.renderAddSVGAction(ctx, action, width, height, sensorValue);
                break;
            case 'add-animation':
                this.renderAddAnimationAction(ctx, action, width, height);
                break;
            case 'add-filter':
                this.renderAddFilterAction(ctx, action, width, height);
                break;
        }
    }

    renderLoadImageAction(ctx, action, width, height) {
        // Simulazione caricamento immagine
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

            // Simula immagine con un rettangolo colorato
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
            default: // vertical
                gradient = ctx.createLinearGradient(0, 0, 0, height);
        }

        gradient.addColorStop(0, action.color1 || '#667eea');
        gradient.addColorStop(1, action.color2 || '#764ba2');

        return gradient;
    }

    renderAddSVGAction(ctx, action, width, height, sensorValue) {
        const quantity = action.quantity || 5;
        const baseSize = (action.size || 100) / 100 * 30;
        const opacity = (action.opacity || 100) / 100;
        const speed = action.animationSpeed || 1;
        const time = Date.now() * 0.001 * speed;

        ctx.globalAlpha = opacity;

        for (let i = 0; i < quantity; i++) {
            let x = (width / quantity) * i + (width / quantity) * 0.5;
            let y = height * 0.5;
            let size = baseSize;
            let rotation = 0;

            // Modifica in base al valore del sensore
            const intensity = Math.max(0, Math.min(1, sensorValue / 100));
            size *= (0.5 + intensity * 0.5);

            // Applica l'animazione scelta
            switch (action.svgAnimation) {
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
                case 'fade':
                    ctx.globalAlpha = opacity * (0.3 + 0.7 * Math.sin(time + i));
                    break;
                case 'morph':
                    size *= (0.7 + 0.6 * Math.sin(time * 0.5 + i));
                    rotation = Math.sin(time * 0.3 + i) * 0.5;
                    break;
                case 'sparkle':
                    if (Math.sin(time * 3 + i) > 0.5) {
                        size *= 1.5;
                        ctx.globalAlpha = opacity * Math.random();
                    }
                    break;
                default: // 'static' o nessuna animazione
                    break;
            }

            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(rotation);

            // Carica e disegna l'SVG reale
            this.drawRealSVG(ctx, action.svgObject || 'star.svg', size);

            ctx.restore();
        }

        ctx.globalAlpha = 1;
    }

    drawSVGObject(ctx, svgType, size) {
        switch (svgType) {
            case 'star.svg':
                this.drawStar(ctx, size);
                break;
            case 'sun.svg':
                this.drawSun(ctx, size);
                break;
            case 'snowflake.svg':
                this.drawSnowflake(ctx, size);
                break;
            case 'bubble.svg':
                this.drawBubble(ctx, size);
                break;
            case 'leaf.svg':
                this.drawLeaf(ctx, size);
                break;
            case 'fish.svg':
                this.drawFish(ctx, size);
                break;
            default:
                this.drawDefault(ctx, size);
        }
    }

    drawStar(ctx, size) {
        ctx.fillStyle = '#ffd700';
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
            const angle = (i * Math.PI * 2) / 5 - Math.PI / 2;
            const x = Math.cos(angle) * size;
            const y = Math.sin(angle) * size;
            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
            const innerAngle = ((i + 0.5) * Math.PI * 2) / 5 - Math.PI / 2;
            const innerX = Math.cos(innerAngle) * size * 0.5;
            const innerY = Math.sin(innerAngle) * size * 0.5;
            ctx.lineTo(innerX, innerY);
        }
        ctx.closePath();
        ctx.fill();
    }

    drawSun(ctx, size) {
        // Centro
        ctx.fillStyle = '#ffd700';
        ctx.beginPath();
        ctx.arc(0, 0, size * 0.6, 0, 2 * Math.PI);
        ctx.fill();

        // Raggi
        ctx.strokeStyle = '#ffd700';
        ctx.lineWidth = 3;
        for (let i = 0; i < 8; i++) {
            const angle = (i * Math.PI * 2) / 8;
            ctx.beginPath();
            ctx.moveTo(Math.cos(angle) * size * 0.7, Math.sin(angle) * size * 0.7);
            ctx.lineTo(Math.cos(angle) * size, Math.sin(angle) * size);
            ctx.stroke();
        }
    }

    drawSnowflake(ctx, size) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;

        for (let i = 0; i < 6; i++) {
            ctx.save();
            ctx.rotate((i * Math.PI) / 3);

            // Linea principale
            ctx.beginPath();
            ctx.moveTo(0, -size);
            ctx.lineTo(0, size);
            ctx.stroke();

            // Braccia
            ctx.beginPath();
            ctx.moveTo(0, -size * 0.7);
            ctx.lineTo(-size * 0.3, -size * 0.4);
            ctx.moveTo(0, -size * 0.7);
            ctx.lineTo(size * 0.3, -size * 0.4);
            ctx.stroke();

            ctx.restore();
        }
    }

    drawBubble(ctx, size) {
        ctx.fillStyle = 'rgba(173, 216, 230, 0.6)';
        ctx.strokeStyle = 'rgba(100, 149, 237, 0.8)';
        ctx.lineWidth = 2;

        ctx.beginPath();
        ctx.arc(0, 0, size, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();

        // Riflesso
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.beginPath();
        ctx.arc(-size * 0.3, -size * 0.3, size * 0.3, 0, 2 * Math.PI);
        ctx.fill();
    }

    drawLeaf(ctx, size) {
        ctx.fillStyle = '#90ee90';
        ctx.beginPath();
        ctx.ellipse(0, 0, size * 0.6, size, 0, 0, 2 * Math.PI);
        ctx.fill();

        // Nervatura
        ctx.strokeStyle = '#228b22';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, -size);
        ctx.lineTo(0, size);
        ctx.stroke();
    }

    drawFish(ctx, size) {
        ctx.fillStyle = '#4169e1';

        // Corpo
        ctx.beginPath();
        ctx.ellipse(0, 0, size * 0.8, size * 0.5, 0, 0, 2 * Math.PI);
        ctx.fill();

        // Coda
        ctx.beginPath();
        ctx.moveTo(size * 0.6, 0);
        ctx.lineTo(size * 1.2, -size * 0.4);
        ctx.lineTo(size * 1.2, size * 0.4);
        ctx.closePath();
        ctx.fill();

        // Occhio
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(-size * 0.3, -size * 0.1, size * 0.2, 0, 2 * Math.PI);
        ctx.fill();

        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.arc(-size * 0.3, -size * 0.1, size * 0.1, 0, 2 * Math.PI);
        ctx.fill();
    }

    drawRealSVG(ctx, svgFile, size) {
        // Per ora disegnamo una rappresentazione semplificata
        // In un'implementazione completa, caricheremmo l'SVG reale
        const svgPath = `/static/images/${svgFile}`;

        // Fallback: disegna una rappresentazione basata sul nome del file
        switch (svgFile) {
            case 'star.svg':
                this.drawStar(ctx, size);
                break;
            case 'sun.svg':
                this.drawSun(ctx, size);
                break;
            case 'snowflake.svg':
                this.drawSnowflake(ctx, size);
                break;
            case 'bubble.svg':
                this.drawBubble(ctx, size);
                break;
            case 'leaf.svg':
                this.drawLeaf(ctx, size);
                break;
            case 'fish.svg':
                this.drawFish(ctx, size);
                break;
            case 'cloud.svg':
                this.drawCloud(ctx, size);
                break;
            case 'cloud-rain.svg':
                this.drawCloudRain(ctx, size);
                break;
            case 'wave.svg':
            case 'waves.svg':
                this.drawWave(ctx, size);
                break;
            case 'comet.svg':
                this.drawComet(ctx, size);
                break;
            case 'rocket.svg':
                this.drawRocket(ctx, size);
                break;
            case 'planet.svg':
                this.drawPlanet(ctx, size);
                break;
            case 'galaxy.svg':
                this.drawGalaxy(ctx, size);
                break;
            case 'coral.svg':
                this.drawCoral(ctx, size);
                break;
            case 'seaweed.svg':
                this.drawSeaweed(ctx, size);
                break;
            case 'sparkles.svg':
                this.drawSparkles(ctx, size);
                break;
            default:
                this.drawDefault(ctx, size);
        }
    }

    // Nuove funzioni per disegnare gli SVG aggiuntivi
    drawCloud(ctx, size) {
        ctx.fillStyle = 'rgba(220, 220, 220, 0.9)';
        ctx.beginPath();
        ctx.arc(-size * 0.5, 0, size * 0.4, 0, 2 * Math.PI);
        ctx.arc(0, 0, size * 0.5, 0, 2 * Math.PI);
        ctx.arc(size * 0.5, 0, size * 0.4, 0, 2 * Math.PI);
        ctx.arc(size * 0.2, -size * 0.3, size * 0.35, 0, 2 * Math.PI);
        ctx.fill();
    }

    drawCloudRain(ctx, size) {
        // Disegna la nuvola
        this.drawCloud(ctx, size);

        // Disegna la pioggia
        ctx.strokeStyle = 'rgba(100, 149, 237, 0.8)';
        ctx.lineWidth = 2;
        for (let i = 0; i < 5; i++) {
            const x = -size * 0.5 + (size * i / 4);
            ctx.beginPath();
            ctx.moveTo(x, size * 0.3);
            ctx.lineTo(x - size * 0.1, size * 0.7);
            ctx.stroke();
        }
    }

    drawWave(ctx, size) {
        ctx.strokeStyle = '#4169E1';
        ctx.lineWidth = 4;
        ctx.beginPath();
        for (let x = -size; x <= size; x += 5) {
            const y = Math.sin(x * 0.1) * size * 0.3;
            if (x === -size) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }
        ctx.stroke();
    }

    drawComet(ctx, size) {
        // Testa della cometa
        ctx.fillStyle = '#FFD700';
        ctx.beginPath();
        ctx.arc(size * 0.3, 0, size * 0.3, 0, 2 * Math.PI);
        ctx.fill();

        // Coda della cometa
        ctx.fillStyle = 'rgba(255, 215, 0, 0.6)';
        ctx.beginPath();
        ctx.moveTo(size * 0.3, 0);
        ctx.lineTo(-size, -size * 0.2);
        ctx.lineTo(-size, size * 0.2);
        ctx.closePath();
        ctx.fill();
    }

    drawRocket(ctx, size) {
        ctx.fillStyle = '#FF4500';

        // Corpo del razzo
        ctx.fillRect(-size * 0.2, -size * 0.6, size * 0.4, size * 1.2);

        // Punta del razzo
        ctx.beginPath();
        ctx.moveTo(-size * 0.2, -size * 0.6);
        ctx.lineTo(0, -size);
        ctx.lineTo(size * 0.2, -size * 0.6);
        ctx.closePath();
        ctx.fill();

        // Fiamma
        ctx.fillStyle = '#FF6347';
        ctx.beginPath();
        ctx.moveTo(-size * 0.15, size * 0.6);
        ctx.lineTo(0, size);
        ctx.lineTo(size * 0.15, size * 0.6);
        ctx.closePath();
        ctx.fill();
    }

    drawPlanet(ctx, size) {
        // Pianeta
        ctx.fillStyle = '#4169E1';
        ctx.beginPath();
        ctx.arc(0, 0, size * 0.8, 0, 2 * Math.PI);
        ctx.fill();

        // Anelli
        ctx.strokeStyle = '#FFD700';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(0, 0, size * 1.2, size * 0.3, 0, 0, 2 * Math.PI);
        ctx.stroke();
    }

    drawGalaxy(ctx, size) {
        const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, size);
        gradient.addColorStop(0, '#FF69B4');
        gradient.addColorStop(0.5, '#9370DB');
        gradient.addColorStop(1, '#000080');

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(0, 0, size, 0, 2 * Math.PI);
        ctx.fill();

        // Stelle
        ctx.fillStyle = '#FFFFFF';
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            const radius = size * 0.3 + Math.random() * size * 0.4;
            const x = Math.cos(angle) * radius;
            const y = Math.sin(angle) * radius;
            ctx.beginPath();
            ctx.arc(x, y, 2, 0, 2 * Math.PI);
            ctx.fill();
        }
    }

    drawCoral(ctx, size) {
        ctx.fillStyle = '#FF7F50';
        ctx.strokeStyle = '#FF6347';
        ctx.lineWidth = 2;

        // Rami del corallo
        for (let i = 0; i < 5; i++) {
            const angle = (i / 5) * Math.PI * 2;
            const length = size * 0.8;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(Math.cos(angle) * length, Math.sin(angle) * length);
            ctx.stroke();

            // Piccoli rami
            ctx.beginPath();
            ctx.arc(Math.cos(angle) * length * 0.6, Math.sin(angle) * length * 0.6, size * 0.1, 0, 2 * Math.PI);
            ctx.fill();
        }
    }

    drawSeaweed(ctx, size) {
        ctx.strokeStyle = '#228B22';
        ctx.lineWidth = 4;

        for (let i = 0; i < 3; i++) {
            const x = -size * 0.3 + i * size * 0.3;
            ctx.beginPath();
            ctx.moveTo(x, size);

            for (let y = size; y >= -size; y -= 10) {
                const wave = Math.sin(y * 0.1 + Date.now() * 0.001) * size * 0.2;
                ctx.lineTo(x + wave, y);
            }
            ctx.stroke();
        }
    }

    drawSparkles(ctx, size) {
        ctx.fillStyle = '#FFD700';

        for (let i = 0; i < 6; i++) {
            const angle = (i / 6) * Math.PI * 2;
            const radius = size * 0.5;
            const x = Math.cos(angle) * radius;
            const y = Math.sin(angle) * radius;

            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(angle);

            // Forma a stella piccola
            ctx.beginPath();
            ctx.moveTo(0, -size * 0.15);
            ctx.lineTo(-size * 0.05, 0);
            ctx.lineTo(0, size * 0.15);
            ctx.lineTo(size * 0.05, 0);
            ctx.closePath();
            ctx.fill();

            ctx.restore();
        }
    }

    renderAddAnimationAction(ctx, action, width, height) {
        // Le animazioni sono gestite a livello di CSS/transform
        // Qui possiamo simulare alcuni effetti base
        const time = Date.now() * 0.001;

        switch (action.animation) {
            case 'pulse':
                const scale = 0.8 + 0.4 * Math.sin(time * 2);
                ctx.scale(scale, scale);
                break;
            case 'rotate':
                ctx.rotate(time);
                break;
            case 'wave':
                // Effetto ondulatorio sull'intero canvas
                const imageData = ctx.getImageData(0, 0, width, height);
                // Simulazione semplificata
                break;
        }
    }

    renderAddFilterAction(ctx, action, width, height) {
        // I filtri CSS sono più complessi da simulare in canvas
        // Qui possiamo applicare alcuni effetti base
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
    // SENSOR SIMULATION AND CONTROLS
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

        // Aggiorna display
        const slider = document.getElementById(`${sensor}-slider`);
        const display = slider.nextElementSibling;
        const unit = sensor === 'temp' ? '°C' : sensor === 'humidity' ? '%' : '';
        display.textContent = `${value}${unit}`;

        // Aggiorna overlay
        const overlayValue = document.getElementById(`${sensorKey}-value`);
        if (overlayValue) {
            overlayValue.textContent = `${value}${unit}`;
        }
    }

    updateSensorValues() {
        // Aggiorna i valori dell'overlay con i dati attuali
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
            // Aggiorna i valori sensori con i dati ricevuti dal server
            this.sensorValues = {
                temperature: data.data.temperature || this.sensorValues.temperature,
                humidity: data.data.humidity || this.sensorValues.humidity,
                light: data.data.light || this.sensorValues.light,
                audio: data.data.audio || this.sensorValues.audio
            };

            // Aggiorna anche gli slider per riflettere i nuovi valori
            this.updateSlidersFromSensorValues();
            this.updateSensorValues();
        }
    }

    updateSlidersFromSensorValues() {
        // Aggiorna gli slider con i valori attuali dei sensori
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

    // ============================================================================
    // VALIDATION AND SAVING
    // ============================================================================

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

    // ============================================================================
    // PREVIEW CONTROLS
    // ============================================================================

    togglePreview() {
        this.isPlaying = !this.isPlaying;
        const btn = document.getElementById('play-btn');
        btn.textContent = this.isPlaying ? '⏸️ Pausa' : '▶️ Play';
    }

    resetPreview() {
        // Reset ai valori di default
        this.sensorValues = {
            temperature: 20.5,
            humidity: 65,
            light: 1250,
            audio: 850
        };

        // Aggiorna slider
        document.getElementById('temp-slider').value = 20.5;
        document.getElementById('humidity-slider').value = 65;
        document.getElementById('light-slider').value = 1250;
        document.getElementById('audio-slider').value = 850;

        // Aggiorna display
        document.querySelectorAll('.slider-value').forEach((el, i) => {
            const values = ['20.5°C', '65%', '1250', '850'];
            el.textContent = values[i];
        });

        this.updateSensorValues();
    }

    testEffects() {
        // Simula tre scenari di test
        const scenarios = [
            { temperature: 35, humidity: 80, light: 3000, audio: 2000 }, // Caldo e umido
            { temperature: 5, humidity: 30, light: 500, audio: 100 },   // Freddo e secco
            { temperature: 22, humidity: 55, light: 1500, audio: 1200 } // Neutro
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
}

// ============================================================================
// GLOBAL FUNCTIONS AND EVENT HANDLERS
// ============================================================================

let quadroCreator;

// Inizializzazione
document.addEventListener('DOMContentLoaded', function () {
    quadroCreator = new QuadroCreator();

    // Setup range input listeners per aggiornare i valori visualizzati
    document.addEventListener('input', function (e) {
        if (e.target.type === 'range') {
            const valueDisplay = e.target.parentElement.querySelector('.range-value');
            if (valueDisplay) {
                let value = e.target.value;
                const id = e.target.id;

                // Aggiungi unità appropriate
                if (id.includes('duration')) {
                    value += 'ms';
                } else if (id.includes('rotation')) {
                    value += '°';
                } else if (id.includes('opacity') || id.includes('size') || id.includes('intensity')) {
                    value += '%';
                }

                valueDisplay.textContent = value;
            }
        }
    });
});

// Funzioni di controllo globali
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

    // Fai una richiesta al server per i dati più recenti del device
    fetch(`/api/device_data?device_id=${encodeURIComponent(deviceId)}`)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            // Aggiorna i controlli con i dati ricevuti
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

// Funzioni globali per gestire gli eventi dai template HTML generati dinamicamente
window.selectBackgroundType = function (type) {
    if (quadroCreator && quadroCreator.currentAction) {
        quadroCreator.selectBackgroundType(type);
    }
};

window.selectSVGObject = function (svg) {
    if (quadroCreator && quadroCreator.currentAction) {
        quadroCreator.selectSVGObject(svg);
    }
};

window.selectSVGAnimation = function (animation) {
    if (quadroCreator && quadroCreator.currentAction) {
        quadroCreator.selectSVGAnimation(animation);
    }
};

window.selectAnimation = function (animation) {
    if (quadroCreator && quadroCreator.currentAction) {
        quadroCreator.selectAnimation(animation);
    }
};

window.selectFilter = function (filter) {
    if (quadroCreator && quadroCreator.currentAction) {
        quadroCreator.selectFilter(filter);
    }
};
function drawDefault(ctx, size) {
    ctx.fillStyle = '#667eea';
    ctx.beginPath();
    ctx.arc(0, 0, size, 0, 2 * Math.PI);
    ctx.fill();
}

// Gestione responsive
window.addEventListener('resize', function () {
    if (quadroCreator && quadroCreator.previewCanvas) {
        quadroCreator.resizeCanvas();
    }
});

// Gestione errori globali
window.addEventListener('error', function (e) {
    console.error('Errore JavaScript:', e.error);
});

// Gestione beforeunload
window.addEventListener('beforeunload', function (e) {
    const name = document.getElementById('quadro-name').value;
    const hasTriggers = Object.values(quadroCreator?.triggers || {}).some(triggers => triggers.length > 0);

    if ((name || hasTriggers) && !quadroCreator?.createdQuadroId) {
        e.preventDefault();
        e.returnValue = 'Hai modifiche non salvate. Sei sicuro di voler lasciare la pagina?';
    }
});



// Gestione responsive
window.addEventListener('resize', function () {
    if (quadroCreator && quadroCreator.previewCanvas) {
        quadroCreator.resizeCanvas();
    }
});

// Gestione errori globali
window.addEventListener('error', function (e) {
    console.error('Errore JavaScript:', e.error);
});

// Gestione beforeunload
window.addEventListener('beforeunload', function (e) {
    const name = document.getElementById('quadro-name').value;
    const hasTriggers = Object.values(quadroCreator?.triggers || {}).some(triggers => triggers.length > 0);

    if ((name || hasTriggers) && !quadroCreator?.createdQuadroId) {
        e.preventDefault();
        e.returnValue = 'Hai modifiche non salvate. Sei sicuro di voler lasciare la pagina?';
    }
});