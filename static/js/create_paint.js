// ============================================================================
// CREATE PAINT - SISTEMA DI CREAZIONE QUADRI VIVENTI
// JavaScript completo per la creazione e configurazione di quadri personalizzati
// ============================================================================

class QuadroCreator {
    constructor() {
        this.socket = null;
        this.devices = {};
        this.selectedDevice = null;
        this.selectedTemplate = 'natura';
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

        // Configurazione sensori
        this.sensorsConfig = {
            temperature: { animations: {} },
            humidity: { animations: {} },
            light: { animations: {} },
            audio: { animations: {} }
        };

        // Configurazione personalizzata
        this.customConfig = {
            background: 'gradient',
            elements: []
        };

        // Templates predefiniti
        this.predefinedTemplates = {
            natura: this.getNaturaTemplate(),
            spazio: this.getSpazioTemplate(),
            oceano: this.getOceanoTemplate()
        };

        // Oggetti SVG disponibili
        this.availableSVGs = [];

        this.init();
    }

    // Templates predefiniti
    getNaturaTemplate() {
        return {
            temperature: {
                animations: {
                    svg_objects: {
                        object: 'snowflake.svg',
                        count: 15,
                        animation: 'snow_fall',
                        condition: 'below',
                        threshold: 15,
                        alternativeObject: 'sun.svg',
                        alternativeAnimation: 'sun_rays',
                        alternativeCondition: 'above',
                        alternativeThreshold: 25
                    }
                }
            },
            humidity: {
                animations: {
                    svg_objects: {
                        object: 'leaf.svg',
                        count: 10,
                        animation: 'falling_leaves',
                        condition: 'below',
                        threshold: 40,
                        levels: [
                            { threshold: 40, object: 'leaf.svg', animation: 'falling_leaves' },
                            { threshold: 60, object: 'bird.svg', animation: 'flying_birds' },
                            { threshold: 80, object: 'cloud-rain.svg', animation: 'rain_fall' }
                        ]
                    }
                }
            },
            light: {
                animations: {
                    color_change: {
                        type: 'variable',
                        condition: 'range',
                        threshold_min: 0,
                        threshold_max: 4095,
                        color_low: '#0a0a1e',
                        color_high: '#87ceeb',
                        gradient: true,
                        levels: ['#0a0a1e', '#4a5568', '#87ceeb', '#ffd93d']
                    },
                    svg_objects: {
                        object: 'star.svg',
                        count: 20,
                        animation: 'twinkle',
                        condition: 'below',
                        threshold: 500
                    }
                }
            },
            audio: {
                animations: {
                    waves: {
                        type: 'sea_waves',
                        sensitivity: 5,
                        count: 3,
                        origin: 'bottom'
                    }
                }
            }
        };
    }

    getSpazioTemplate() {
        return {
            temperature: {
                animations: {
                    color_change: {
                        type: 'variable',
                        condition: 'range',
                        threshold_min: 0,
                        threshold_max: 40,
                        color_low: '#001f3f',
                        color_high: '#ff6b6b'
                    }
                }
            },
            humidity: {
                animations: {
                    svg_objects: {
                        object: 'asteroid.svg',
                        count: 5,
                        animation: 'floating',
                        condition: 'range',
                        threshold_min: 30,
                        threshold_max: 70,
                        countVariable: true
                    }
                }
            },
            light: {
                animations: {
                    color_change: {
                        type: 'variable',
                        condition: 'range',
                        threshold_min: 0,
                        threshold_max: 4095,
                        color_low: '#000814',
                        color_high: '#1e3c72',
                        opacity: true
                    }
                }
            },
            audio: {
                animations: {
                    waves: {
                        type: 'solar_waves',
                        sensitivity: 7,
                        count: 5,
                        origin: 'object',
                        objectId: 'sun',
                        color: '#ffd700'
                    }
                }
            }
        };
    }

    getOceanoTemplate() {
        return {
            temperature: {
                animations: {
                    svg_objects: {
                        object: 'fish.svg',
                        count: 8,
                        animation: 'swim',
                        speedVariable: true,
                        speedRange: [0.5, 3],
                        temperatureMapping: true
                    }
                }
            },
            humidity: {
                animations: {
                    svg_objects: {
                        object: 'fish.svg',
                        count: 5,
                        animation: 'swim',
                        sizeVariable: true,
                        condition: 'levels',
                        levels: [
                            { threshold: 30, size: 'small', count: 3 },
                            { threshold: 60, size: 'medium', count: 5 },
                            { threshold: 80, size: 'large', count: 8 }
                        ]
                    }
                }
            },
            light: {
                animations: {
                    color_change: {
                        type: 'variable',
                        condition: 'gradient',
                        gradient: ['#000428', '#004e92', '#009ffd', '#2a2a72'],
                        opacity: false
                    }
                }
            },
            audio: {
                animations: {
                    waves: {
                        type: 'currents',
                        sensitivity: 6,
                        count: 4,
                        origin: 'multi',
                        pattern: 'circular'
                    }
                }
            }
        };
    }

    init() {
        this.setupSocket();
        this.setupEventListeners();
        this.setupCanvas();
        this.loadDevices();
        this.loadAvailableSVGs();
        this.initializeTemplates();
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
    }

    setupEventListeners() {
        // Nome quadro
        const nameInput = document.getElementById('quadro-name');
        nameInput.addEventListener('input', (e) => {
            this.validateName(e.target.value);
        });

        // Selezione dispositivo
        const deviceSelect = document.getElementById('device-select');
        deviceSelect.addEventListener('change', (e) => {
            this.selectDevice(e.target.value);
        });

        // Selezione template
        document.querySelectorAll('.template-card').forEach(card => {
            card.addEventListener('click', () => {
                this.selectTemplate(card.dataset.template);
            });
        });

        // Checkbox animazioni
        document.querySelectorAll('.animation-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                this.toggleAnimation(e.target);
            });
        });

        // Slider di simulazione
        const sliders = ['temp', 'humidity', 'light', 'audio'];
        sliders.forEach(slider => {
            const element = document.getElementById(`${slider}-slider`);
            element.addEventListener('input', (e) => {
                this.updateSensorValue(slider, e.target.value);
            });
        });

        // Gestione input di configurazione
        document.querySelectorAll('.animation-config input, .animation-config select').forEach(input => {
            input.addEventListener('change', (e) => {
                this.updateAnimationConfig(e.target);
            });
        });

        // Gestione modali
        window.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                this.closeModal(e.target);
            }
        });
    }

    setupCanvas() {
        this.previewCanvas = document.getElementById('preview-canvas');
        this.previewCtx = this.previewCanvas.getContext('2d');

        // Ottimizzazioni rendering
        this.previewCtx.imageSmoothingEnabled = true;
        this.previewCtx.textBaseline = 'middle';
    }

    async loadDevices() {
        try {
            const response = await fetch('/api/devices');
            if (response.ok) {
                this.devices = await response.json();
                this.populateDeviceSelect();
            } else {
                console.error('Errore nel caricamento dispositivi');
            }
        } catch (error) {
            console.error('Errore nella richiesta dispositivi:', error);
        }
    }

    async loadAvailableSVGs() {
        // Simula il caricamento degli SVG disponibili
        this.availableSVGs = [
            'sun.svg', 'snowflake.svg', 'cloud.svg', 'cloud-rain.svg',
            'star.svg', 'moon.svg', 'leaf.svg', 'bird.svg',
            'fish.svg', 'bubble.svg', 'wave.svg', 'droplet.svg',
            'thermometer.svg', 'sparkles.svg', 'asteroid.svg',
            'galaxy.svg', 'butterfly.svg', 'music-note.svg'
        ];

        // Aggiorna le opzioni nei select
        this.updateSVGOptions();
    }

    updateSVGOptions() {
        document.querySelectorAll('.svg-object').forEach(select => {
            const currentValue = select.value;
            select.innerHTML = this.availableSVGs.map(svg => {
                const name = svg.replace('.svg', '');
                const icon = this.getSVGIcon(name);
                return `<option value="${svg}">${icon} ${this.formatSVGName(name)}</option>`;
            }).join('');
            select.value = currentValue;
        });
    }

    getSVGIcon(name) {
        const icons = {
            'sun': '☀️',
            'snowflake': '❄️',
            'cloud': '☁️',
            'cloud-rain': '🌧️',
            'star': '⭐',
            'moon': '🌙',
            'leaf': '🍃',
            'bird': '🐦',
            'fish': '🐟',
            'bubble': '💧',
            'wave': '🌊',
            'droplet': '💧',
            'thermometer': '🌡️',
            'sparkles': '✨',
            'asteroid': '☄️',
            'galaxy': '🌌',
            'butterfly': '🦋',
            'music-note': '🎵'
        };
        return icons[name] || '📄';
    }

    formatSVGName(name) {
        return name.charAt(0).toUpperCase() + name.slice(1).replace(/-/g, ' ');
    }

    populateDeviceSelect() {
        const select = document.getElementById('device-select');
        select.innerHTML = '<option value="">Seleziona un dispositivo...</option>';

        Object.entries(this.devices).forEach(([id, device]) => {
            const option = document.createElement('option');
            option.value = id;
            option.textContent = `${device.name} - ${device.location}`;
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
        const isOnline = device && device.data_count > 0;

        statusIndicator.className = `status-indicator ${isOnline ? 'online' : 'offline'}`;
        statusText.textContent = isOnline ?
            `Online - ${device.location}` :
            `Offline - ${device.location}`;
    }

    selectTemplate(template) {
        this.selectedTemplate = template;

        // Aggiorna UI
        document.querySelectorAll('.template-card').forEach(card => {
            card.classList.remove('selected');
        });
        document.querySelector(`[data-template="${template}"]`).classList.add('selected');

        // Mostra/nascondi configurazione personalizzata
        this.toggleCustomConfig(template === 'personalizzato');

        // Se template predefinito, carica la configurazione
        if (template !== 'personalizzato' && this.predefinedTemplates[template]) {
            this.loadTemplateConfig(this.predefinedTemplates[template]);
        }

        this.updatePreview();
    }

    loadTemplateConfig(config) {
        // Reset configurazione
        this.sensorsConfig = {
            temperature: { animations: {} },
            humidity: { animations: {} },
            light: { animations: {} },
            audio: { animations: {} }
        };

        // Deseleziona tutti i checkbox
        document.querySelectorAll('.animation-checkbox').forEach(checkbox => {
            checkbox.checked = false;
            const animConfig = checkbox.parentElement.nextElementSibling;
            if (animConfig) animConfig.classList.add('hidden');
        });

        // Applica configurazione template
        Object.entries(config).forEach(([sensor, sensorConfig]) => {
            Object.entries(sensorConfig.animations).forEach(([animationType, animConfig]) => {
                // Trova e attiva il checkbox corrispondente
                const checkbox = document.querySelector(
                    `.sensor-config[data-sensor="${sensor}"] .animation-checkbox[data-animation="${animationType}"]`
                );

                if (checkbox) {
                    checkbox.checked = true;
                    const configDiv = checkbox.parentElement.nextElementSibling;
                    if (configDiv) {
                        configDiv.classList.remove('hidden');
                        // Applica i valori della configurazione
                        this.applyAnimationConfig(configDiv, animConfig);
                    }
                }

                // Salva configurazione
                this.sensorsConfig[sensor].animations[animationType] = animConfig;
            });
        });
    }

    applyAnimationConfig(configDiv, config) {
        Object.entries(config).forEach(([key, value]) => {
            const input = configDiv.querySelector(`.${key.replace(/_/g, '-')}`);
            if (input) {
                if (input.type === 'checkbox') {
                    input.checked = value;
                } else {
                    input.value = value;
                }
            }
        });
    }

    toggleCustomConfig(show) {
        const customConfig = document.getElementById('custom-config');
        if (show) {
            customConfig.classList.remove('hidden');
            this.initializeCustomConfig();
        } else {
            customConfig.classList.add('hidden');
        }
    }

    initializeCustomConfig() {
        this.customConfig = {
            background: 'gradient',
            elements: []
        };
        this.renderCustomConfigUI();
    }

    renderCustomConfigUI() {
        const container = document.getElementById('custom-elements');
        container.innerHTML = `
            <div class="background-config">
                <h5>Sfondo</h5>
                <div class="background-type">
                    <div class="bg-option selected" data-bg="gradient" onclick="quadroCreator.selectBackground('gradient')">
                        🌅 Gradiente
                    </div>
                    <div class="bg-option" data-bg="solid" onclick="quadroCreator.selectBackground('solid')">
                        🎨 Colore Solido
                    </div>
                    <div class="bg-option" data-bg="image" onclick="quadroCreator.selectBackground('image')">
                        🖼️ Immagine
                    </div>
                </div>
                <div id="background-controls">
                    <div class="form-row">
                        <div class="form-group">
                            <label>Colore 1:</label>
                            <input type="color" id="bg-color1" value="#667eea" onchange="quadroCreator.updateBackground()">
                        </div>
                        <div class="form-group">
                            <label>Colore 2:</label>
                            <input type="color" id="bg-color2" value="#764ba2" onchange="quadroCreator.updateBackground()">
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="elements-config">
                <h5>Elementi</h5>
                <div id="elements-list"></div>
                <button class="add-element" onclick="quadroCreator.addCustomElement()">
                    ➕ Aggiungi Elemento
                </button>
            </div>
        `;
    }

    selectBackground(type) {
        this.customConfig.background = type;

        // Aggiorna UI
        document.querySelectorAll('.bg-option').forEach(option => {
            option.classList.remove('selected');
        });
        document.querySelector(`[data-bg="${type}"]`).classList.add('selected');

        // Aggiorna controlli
        this.updateBackgroundControls();
        this.updatePreview();
    }

    updateBackgroundControls() {
        const container = document.getElementById('background-controls');
        const type = this.customConfig.background;

        let html = '';

        switch (type) {
            case 'gradient':
                html = `
                    <div class="form-row">
                        <div class="form-group">
                            <label>Colore 1:</label>
                            <input type="color" id="bg-color1" value="#667eea" onchange="quadroCreator.updateBackground()">
                        </div>
                        <div class="form-group">
                            <label>Colore 2:</label>
                            <input type="color" id="bg-color2" value="#764ba2" onchange="quadroCreator.updateBackground()">
                        </div>
                    </div>
                    <div class="form-group">
                        <label>Direzione:</label>
                        <select id="bg-direction" onchange="quadroCreator.updateBackground()">
                            <option value="vertical">Verticale</option>
                            <option value="horizontal">Orizzontale</option>
                            <option value="diagonal">Diagonale</option>
                            <option value="radial">Radiale</option>
                        </select>
                    </div>
                `;
                break;
            case 'solid':
                html = `
                    <div class="form-group">
                        <label>Colore:</label>
                        <input type="color" id="bg-color" value="#667eea" onchange="quadroCreator.updateBackground()">
                    </div>
                `;
                break;
            case 'image':
                html = `
                    <div class="form-group">
                        <label>URL Immagine:</label>
                        <input type="text" id="bg-image-url" placeholder="https://..." onchange="quadroCreator.updateBackground()">
                    </div>
                    <div class="form-group">
                        <label>O carica file:</label>
                        <input type="file" id="bg-image" accept="image/*" onchange="quadroCreator.updateBackground()">
                    </div>
                `;
                break;
        }

        container.innerHTML = html;
    }

    addCustomElement() {
        const element = {
            id: Date.now(),
            type: 'shape',
            shape: 'circle',
            x: 50,
            y: 50,
            size: 30,
            color: '#FFFFFF',
            sensor: 'temperature',
            animation: 'static'
        };

        this.customConfig.elements.push(element);
        this.renderCustomElements();
        this.updatePreview();
    }

    renderCustomElements() {
        const container = document.getElementById('elements-list');
        container.innerHTML = this.customConfig.elements.map(element => `
            <div class="element-config" data-element-id="${element.id}">
                <div class="element-header">
                    <h6>Elemento ${element.id}</h6>
                    <button class="remove-element" onclick="quadroCreator.removeCustomElement(${element.id})">
                        🗑️
                    </button>
                </div>
                
                <div class="form-row">
                    <div class="form-group">
                        <label>Tipo:</label>
                        <select onchange="quadroCreator.updateCustomElement(${element.id}, 'type', this.value)">
                            <option value="shape" ${element.type === 'shape' ? 'selected' : ''}>Forma</option>
                            <option value="svg" ${element.type === 'svg' ? 'selected' : ''}>SVG</option>
                            <option value="text" ${element.type === 'text' ? 'selected' : ''}>Testo</option>
                            <option value="particle" ${element.type === 'particle' ? 'selected' : ''}>Particelle</option>
                        </select>
                    </div>
                    ${element.type === 'shape' ? `
                        <div class="form-group">
                            <label>Forma:</label>
                            <select onchange="quadroCreator.updateCustomElement(${element.id}, 'shape', this.value)">
                                <option value="circle" ${element.shape === 'circle' ? 'selected' : ''}>Cerchio</option>
                                <option value="square" ${element.shape === 'square' ? 'selected' : ''}>Quadrato</option>
                                <option value="triangle" ${element.shape === 'triangle' ? 'selected' : ''}>Triangolo</option>
                            </select>
                        </div>
                    ` : element.type === 'svg' ? `
                        <div class="form-group">
                            <label>SVG:</label>
                            <select onchange="quadroCreator.updateCustomElement(${element.id}, 'svg', this.value)">
                                ${this.availableSVGs.map(svg => `
                                    <option value="${svg}" ${element.svg === svg ? 'selected' : ''}>
                                        ${this.getSVGIcon(svg.replace('.svg', ''))} ${this.formatSVGName(svg.replace('.svg', ''))}
                                    </option>
                                `).join('')}
                            </select>
                        </div>
                    ` : ''}
                </div>
                
                <div class="form-row">
                    <div class="form-group">
                        <label>X (%):</label>
                        <input type="range" min="0" max="100" value="${element.x}" 
                               onchange="quadroCreator.updateCustomElement(${element.id}, 'x', this.value)">
                    </div>
                    <div class="form-group">
                        <label>Y (%):</label>
                        <input type="range" min="0" max="100" value="${element.y}" 
                               onchange="quadroCreator.updateCustomElement(${element.id}, 'y', this.value)">
                    </div>
                </div>
                
                <div class="form-row">
                    <div class="form-group">
                        <label>Dimensione:</label>
                        <input type="range" min="5" max="100" value="${element.size}" 
                               onchange="quadroCreator.updateCustomElement(${element.id}, 'size', this.value)">
                    </div>
                    <div class="form-group">
                        <label>Colore:</label>
                        <input type="color" value="${element.color}" 
                               onchange="quadroCreator.updateCustomElement(${element.id}, 'color', this.value)">
                    </div>
                </div>
                
                <div class="form-row">
                    <div class="form-group">
                        <label>Sensore:</label>
                        <select onchange="quadroCreator.updateCustomElement(${element.id}, 'sensor', this.value)">
                            <option value="temperature" ${element.sensor === 'temperature' ? 'selected' : ''}>Temperatura</option>
                            <option value="humidity" ${element.sensor === 'humidity' ? 'selected' : ''}>Umidità</option>
                            <option value="light" ${element.sensor === 'light' ? 'selected' : ''}>Luce</option>
                            <option value="audio" ${element.sensor === 'audio' ? 'selected' : ''}>Audio</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Animazione:</label>
                        <select onchange="quadroCreator.updateCustomElement(${element.id}, 'animation', this.value)">
                            <option value="static" ${element.animation === 'static' ? 'selected' : ''}>Statico</option>
                            <option value="pulse" ${element.animation === 'pulse' ? 'selected' : ''}>Pulsazione</option>
                            <option value="rotate" ${element.animation === 'rotate' ? 'selected' : ''}>Rotazione</option>
                            <option value="scale" ${element.animation === 'scale' ? 'selected' : ''}>Scala</option>
                            <option value="float" ${element.animation === 'float' ? 'selected' : ''}>Fluttuante</option>
                        </select>
                    </div>
                </div>
            </div>
        `).join('');
    }

    updateCustomElement(id, property, value) {
        const element = this.customConfig.elements.find(el => el.id === id);
        if (element) {
            element[property] = value;
            if (property === 'type') {
                // Reset type-specific properties
                if (value === 'shape') {
                    element.shape = 'circle';
                } else if (value === 'svg') {
                    element.svg = this.availableSVGs[0];
                }
                this.renderCustomElements();
            }
            this.updatePreview();
        }
    }

    removeCustomElement(id) {
        this.customConfig.elements = this.customConfig.elements.filter(el => el.id !== id);
        this.renderCustomElements();
        this.updatePreview();
    }

    updateBackground() {
        this.updatePreview();
    }

    initializeTemplates() {
        // Inizializza le anteprime dei template
        document.querySelectorAll('.template-card').forEach(card => {
            const canvas = card.querySelector('canvas');
            const ctx = canvas.getContext('2d');
            const template = card.dataset.template;

            this.drawTemplatePreview(ctx, template, 120, 80);
        });

        // Seleziona il primo template
        this.selectTemplate('natura');
    }

    drawTemplatePreview(ctx, template, width, height) {
        ctx.clearRect(0, 0, width, height);

        switch (template) {
            case 'natura':
                this.drawNaturePreview(ctx, width, height);
                break;
            case 'spazio':
                this.drawSpacePreview(ctx, width, height);
                break;
            case 'oceano':
                this.drawOceanPreview(ctx, width, height);
                break;
            case 'personalizzato':
                this.drawCustomPreview(ctx, width, height);
                break;
        }
    }

    drawNaturePreview(ctx, width, height) {
        // Cielo
        const gradient = ctx.createLinearGradient(0, 0, 0, height * 0.6);
        gradient.addColorStop(0, '#87CEEB');
        gradient.addColorStop(1, '#98FB98');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height * 0.6);

        // Montagne
        ctx.fillStyle = '#8B4513';
        ctx.beginPath();
        ctx.moveTo(0, height * 0.6);
        ctx.lineTo(width * 0.3, height * 0.4);
        ctx.lineTo(width * 0.7, height * 0.5);
        ctx.lineTo(width, height * 0.45);
        ctx.lineTo(width, height * 0.6);
        ctx.closePath();
        ctx.fill();

        // Terra
        ctx.fillStyle = '#228B22';
        ctx.fillRect(0, height * 0.6, width, height * 0.4);

        // Sole
        ctx.fillStyle = '#FFD700';
        ctx.beginPath();
        ctx.arc(width * 0.8, height * 0.2, 8, 0, 2 * Math.PI);
        ctx.fill();
    }

    drawSpacePreview(ctx, width, height) {
        // Spazio
        ctx.fillStyle = '#000814';
        ctx.fillRect(0, 0, width, height);

        // Stelle
        ctx.fillStyle = '#FFFFFF';
        for (let i = 0; i < 20; i++) {
            const x = Math.random() * width;
            const y = Math.random() * height;
            ctx.beginPath();
            ctx.arc(x, y, 1, 0, 2 * Math.PI);
            ctx.fill();
        }

        // Pianeta
        ctx.fillStyle = '#4A90E2';
        ctx.beginPath();
        ctx.arc(width * 0.3, height * 0.7, 15, 0, 2 * Math.PI);
        ctx.fill();

        // Nebulosa
        const nebula = ctx.createRadialGradient(width * 0.7, height * 0.3, 0, width * 0.7, height * 0.3, 20);
        nebula.addColorStop(0, 'rgba(255, 105, 180, 0.3)');
        nebula.addColorStop(1, 'rgba(255, 105, 180, 0)');
        ctx.fillStyle = nebula;
        ctx.beginPath();
        ctx.arc(width * 0.7, height * 0.3, 20, 0, 2 * Math.PI);
        ctx.fill();
    }

    drawOceanPreview(ctx, width, height) {
        // Oceano
        const gradient = ctx.createLinearGradient(0, 0, 0, height);
        gradient.addColorStop(0, '#87CEEB');
        gradient.addColorStop(1, '#000080');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);

        // Onde
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let x = 0; x < width; x++) {
            const y = height * 0.3 + Math.sin(x * 0.1) * 5;
            if (x === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }
        ctx.stroke();

        // Bolle
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        for (let i = 0; i < 8; i++) {
            const x = (width / 8) * i;
            const y = height * 0.6 + Math.sin(i) * 10;
            ctx.beginPath();
            ctx.arc(x, y, 3, 0, 2 * Math.PI);
            ctx.fill();
        }
    }

    drawCustomPreview(ctx, width, height) {
        // Gradiente personalizzato
        const gradient = ctx.createLinearGradient(0, 0, width, height);
        gradient.addColorStop(0, '#667eea');
        gradient.addColorStop(1, '#764ba2');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);

        // Icona personalizzazione
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '24px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🎨', width / 2, height / 2);
    }

    toggleAnimation(checkbox) {
        const animationConfig = checkbox.parentElement.nextElementSibling;
        const sensor = checkbox.closest('.sensor-config').dataset.sensor;
        const animationType = checkbox.dataset.animation;

        if (checkbox.checked) {
            animationConfig.classList.remove('hidden');
            this.sensorsConfig[sensor].animations[animationType] = this.getDefaultAnimationConfig(animationType, sensor);
        } else {
            animationConfig.classList.add('hidden');
            delete this.sensorsConfig[sensor].animations[animationType];
        }

        this.updatePreview();
    }

    getDefaultAnimationConfig(type, sensor) {
        const defaults = {
            color_change: {
                type: 'variable',
                condition: 'range',
                threshold_min: this.getDefaultThreshold(sensor, 'min'),
                threshold_max: this.getDefaultThreshold(sensor, 'max'),
                color_low: this.getDefaultColor(sensor, 'low'),
                color_high: this.getDefaultColor(sensor, 'high')
            },
            svg_objects: {
                object: this.getDefaultSVG(sensor),
                count: 5,
                animation: 'floating',
                condition: 'always',
                threshold: this.getDefaultThreshold(sensor, 'mid')
            },
            waves: {
                type: this.getDefaultWaveType(sensor),
                amplitude: 5,
                frequency: 3,
                sensitivity: 5,
                intensity: 5,
                speed: 3,
                count: 3,
                origin: 'center'
            }
        };

        return defaults[type] || {};
    }

    getDefaultThreshold(sensor, type) {
        const thresholds = {
            temperature: { min: 15, max: 30, mid: 22 },
            humidity: { min: 40, max: 70, mid: 55 },
            light: { min: 500, max: 3000, mid: 1750 },
            audio: { min: 500, max: 2000, mid: 1250 }
        };
        return thresholds[sensor][type];
    }

    getDefaultColor(sensor, type) {
        const colors = {
            temperature: { low: '#4da6ff', high: '#ff4d4d' },
            humidity: { low: '#d4b896', high: '#4ecdc4' },
            light: { low: '#1a1a2e', high: '#ffd93d' },
            audio: { low: '#2a2a2a', high: '#a8e6cf' }
        };
        return colors[sensor][type];
    }

    getDefaultSVG(sensor) {
        const svgs = {
            temperature: 'sun.svg',
            humidity: 'cloud.svg',
            light: 'star.svg',
            audio: 'wave.svg'
        };
        return svgs[sensor];
    }

    getDefaultWaveType(sensor) {
        const types = {
            temperature: 'heat',
            humidity: 'sea',
            light: 'radial_waves',
            audio: 'sound_rings'
        };
        return types[sensor];
    }

    updateAnimationConfig(input) {
        const sensorConfig = input.closest('.sensor-config');
        const animationConfig = input.closest('.animation-config');
        const sensor = sensorConfig.dataset.sensor;
        const animationType = animationConfig.previousElementSibling.querySelector('.animation-checkbox').dataset.animation;

        if (!this.sensorsConfig[sensor].animations[animationType]) {
            this.sensorsConfig[sensor].animations[animationType] = {};
        }

        const config = this.sensorsConfig[sensor].animations[animationType];
        const property = this.getPropertyName(input);

        config[property] = input.type === 'number' ? parseFloat(input.value) : input.value;

        // Gestione condizioni e soglie
        if (property === 'condition_type' || property === 'svg_condition') {
            this.updateThresholdVisibility(animationConfig, input.value);
        }

        this.updatePreview();
    }

    getPropertyName(input) {
        // Mappa le classi ai nomi delle proprietà
        const classToProperty = {
            'color-type': 'type',
            'condition-type': 'condition',
            'threshold-min': 'threshold_min',
            'threshold-max': 'threshold_max',
            'color-low': 'color_low',
            'color-high': 'color_high',
            'svg-object': 'object',
            'object-count': 'count',
            'animation-style': 'animation',
            'svg-condition': 'condition',
            'svg-threshold': 'threshold',
            'svg-threshold-min': 'threshold_min',
            'svg-threshold-max': 'threshold_max',
            'wave-type': 'type',
            'wave-amplitude': 'amplitude',
            'wave-frequency': 'frequency',
            'wave-sensitivity': 'sensitivity',
            'wave-intensity': 'intensity',
            'wave-speed': 'speed',
            'wave-count': 'count',
            'wave-origin': 'origin',
            'gradual-mode': 'gradual_mode',
            'movement-type': 'movement'
        };

        for (const [className, propertyName] of Object.entries(classToProperty)) {
            if (input.classList.contains(className)) {
                return propertyName;
            }
        }

        return input.className;
    }

    updateThresholdVisibility(animationConfig, condition) {
        const thresholdMin = animationConfig.querySelector('.threshold-min, .svg-threshold-min');
        const thresholdMax = animationConfig.querySelector('.threshold-max, .svg-threshold-max');
        const singleThreshold = animationConfig.querySelector('.svg-threshold');

        if (thresholdMin && thresholdMax) {
            const minGroup = thresholdMin.closest('.form-group');
            const maxGroup = thresholdMax.closest('.form-group');

            switch (condition) {
                case 'above':
                    if (minGroup) minGroup.style.display = 'none';
                    if (maxGroup) maxGroup.style.display = 'block';
                    break;
                case 'below':
                    if (minGroup) minGroup.style.display = 'block';
                    if (maxGroup) maxGroup.style.display = 'none';
                    break;
                case 'range':
                    if (minGroup) minGroup.style.display = 'block';
                    if (maxGroup) maxGroup.style.display = 'block';
                    break;
                default:
                    if (minGroup) minGroup.style.display = 'none';
                    if (maxGroup) maxGroup.style.display = 'none';
            }
        }

        if (singleThreshold) {
            const thresholdGroup = singleThreshold.closest('.form-group');
            if (condition === 'always') {
                thresholdGroup.style.display = 'none';
            } else {
                thresholdGroup.style.display = 'block';
            }
        }
    }

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
        const display = document.querySelector(`#${sensor}-slider`).nextElementSibling;
        const unit = sensor === 'temp' ? '°C' : sensor === 'humidity' ? '%' : '';
        display.textContent = `${value}${unit}`;

        // Aggiorna overlay
        const overlayValue = document.getElementById(`${sensorKey}-value`);
        if (overlayValue) {
            overlayValue.textContent = `${value}${unit}`;
        }

        this.updatePreview();
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

        // Pulisci canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Disegna template base
        this.drawTemplateBase(ctx, this.selectedTemplate, canvas.width, canvas.height);

        // Applica animazioni basate sui sensori
        this.applyAnimations(ctx, canvas.width, canvas.height);
    }

    drawTemplateBase(ctx, template, width, height) {
        switch (template) {
            case 'natura':
                this.drawNatureBase(ctx, width, height);
                break;
            case 'spazio':
                this.drawSpaceBase(ctx, width, height);
                break;
            case 'oceano':
                this.drawOceanBase(ctx, width, height);
                break;
            case 'personalizzato':
                this.drawCustomBase(ctx, width, height);
                break;
        }
    }

    drawNatureBase(ctx, width, height) {
        // Cielo con gradiente basato sulla temperatura
        const temp = this.sensorValues.temperature;
        const tempNormalized = Math.max(0, Math.min(1, (temp - 0) / 40));

        const skyColor1 = this.interpolateColor([135, 206, 235], [255, 200, 150], tempNormalized);
        const skyColor2 = this.interpolateColor([152, 251, 152], [255, 160, 122], tempNormalized);

        const gradient = ctx.createLinearGradient(0, 0, 0, height * 0.6);
        gradient.addColorStop(0, `rgb(${skyColor1.join(',')})`);
        gradient.addColorStop(1, `rgb(${skyColor2.join(',')})`);

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height * 0.6);

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

        // Terra
        ctx.fillStyle = '#228B22';
        ctx.fillRect(0, height * 0.6, width, height * 0.4);

        // Sole che si muove con la luce
        const light = this.sensorValues.light;
        const lightNormalized = Math.max(0, Math.min(1, light / 4095));
        const sunX = width * 0.1 + (width * 0.8 * lightNormalized);
        const sunY = height * 0.1 + (height * 0.3 * (1 - lightNormalized));
        const sunSize = 20 + (15 * lightNormalized);

        ctx.fillStyle = `rgba(255, 223, 0, ${0.5 + 0.5 * lightNormalized})`;
        ctx.beginPath();
        ctx.arc(sunX, sunY, sunSize, 0, 2 * Math.PI);
        ctx.fill();

        // Nuvole che si muovono con l'umidità
        const humidity = this.sensorValues.humidity;
        const cloudCount = Math.floor(humidity / 25);
        const time = Date.now() * 0.001;

        ctx.fillStyle = `rgba(255, 255, 255, ${0.3 + 0.4 * humidity / 100})`;
        for (let i = 0; i < cloudCount; i++) {
            const x = (width * 0.2 * i + time * 20) % (width + 100) - 50;
            const y = height * 0.2 + Math.sin(time + i) * 30;
            this.drawCloud(ctx, x, y, 40 + i * 5);
        }
    }

    drawSpaceBase(ctx, width, height) {
        // Spazio profondo
        const lightLevel = this.sensorValues.light / 4095;
        const spaceColor = Math.floor(20 * lightLevel);

        ctx.fillStyle = `rgb(${spaceColor}, ${spaceColor}, ${spaceColor + 20})`;
        ctx.fillRect(0, 0, width, height);

        // Stelle che brillano con la luce
        const starCount = Math.floor(50 + lightLevel * 100);
        ctx.fillStyle = `rgba(255, 255, 255, ${0.3 + 0.7 * lightLevel})`;

        for (let i = 0; i < starCount; i++) {
            const x = (width * 0.123 * i) % width;
            const y = (height * 0.456 * i) % height;
            const size = 1 + Math.sin(Date.now() * 0.001 + i) * 0.5;

            ctx.beginPath();
            ctx.arc(x, y, size, 0, 2 * Math.PI);
            ctx.fill();
        }

        // Pianeta che cambia colore con la temperatura
        const temp = this.sensorValues.temperature;
        const planetColor = this.interpolateColor([100, 149, 237], [255, 69, 0], temp / 40);

        ctx.fillStyle = `rgb(${planetColor.join(',')})`;
        ctx.beginPath();
        ctx.arc(width * 0.3, height * 0.7, 40, 0, 2 * Math.PI);
        ctx.fill();

        // Nebulosa che pulsa con l'audio
        const audio = this.sensorValues.audio;
        const audioNormalized = Math.max(0, Math.min(1, audio / 4095));
        const nebulaSize = 50 + audioNormalized * 30;

        const nebula = ctx.createRadialGradient(width * 0.7, height * 0.3, 0, width * 0.7, height * 0.3, nebulaSize);
        nebula.addColorStop(0, `rgba(255, 105, 180, ${0.3 + 0.4 * audioNormalized})`);
        nebula.addColorStop(1, 'rgba(255, 105, 180, 0)');

        ctx.fillStyle = nebula;
        ctx.beginPath();
        ctx.arc(width * 0.7, height * 0.3, nebulaSize, 0, 2 * Math.PI);
        ctx.fill();
    }

    drawOceanBase(ctx, width, height) {
        // Oceano con gradiente di profondità
        const humidity = this.sensorValues.humidity;
        const humidityNormalized = Math.max(0, Math.min(1, humidity / 100));

        const waterColor1 = this.interpolateColor([135, 206, 235], [0, 0, 139], humidityNormalized);
        const waterColor2 = this.interpolateColor([0, 0, 139], [25, 25, 112], humidityNormalized);

        const gradient = ctx.createLinearGradient(0, 0, 0, height);
        gradient.addColorStop(0, `rgb(${waterColor1.join(',')})`);
        gradient.addColorStop(1, `rgb(${waterColor2.join(',')})`);

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);

        // Onde che si muovono con l'audio
        const audio = this.sensorValues.audio;
        const audioNormalized = Math.max(0, Math.min(1, audio / 4095));
        const time = Date.now() * 0.001;

        ctx.strokeStyle = `rgba(255, 255, 255, ${0.2 + 0.3 * audioNormalized})`;
        ctx.lineWidth = 2;

        for (let i = 0; i < 3; i++) {
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
        const bubbleCount = Math.floor(humidityNormalized * 20);
        ctx.fillStyle = `rgba(255, 255, 255, ${0.3 + 0.4 * humidityNormalized})`;

        for (let i = 0; i < bubbleCount; i++) {
            const x = (width / bubbleCount) * i + Math.sin(time + i) * 30;
            const y = height - ((time * 30 + i * 50) % (height + 30));
            const size = 3 + Math.sin(time + i) * 2;

            ctx.beginPath();
            ctx.arc(x, y, size, 0, 2 * Math.PI);
            ctx.fill();
        }
    }

    drawCustomBase(ctx, width, height) {
        // Disegna lo sfondo
        this.drawCustomBackground(ctx, width, height);

        // Disegna gli elementi personalizzati
        this.drawCustomElements(ctx, width, height);
    }

    drawCustomBackground(ctx, width, height) {
        const bgType = this.customConfig.background;

        switch (bgType) {
            case 'gradient':
                const color1 = document.getElementById('bg-color1')?.value || '#667eea';
                const color2 = document.getElementById('bg-color2')?.value || '#764ba2';
                const direction = document.getElementById('bg-direction')?.value || 'vertical';

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

                gradient.addColorStop(0, color1);
                gradient.addColorStop(1, color2);
                ctx.fillStyle = gradient;
                ctx.fillRect(0, 0, width, height);
                break;

            case 'solid':
                const color = document.getElementById('bg-color')?.value || '#667eea';
                ctx.fillStyle = color;
                ctx.fillRect(0, 0, width, height);
                break;

            case 'image':
                // Per ora usa un fallback
                ctx.fillStyle = '#000000';
                ctx.fillRect(0, 0, width, height);
                break;
        }
    }

    drawCustomElements(ctx, width, height) {
        const time = Date.now() * 0.001;

        this.customConfig.elements.forEach(element => {
            const x = (element.x / 100) * width;
            const y = (element.y / 100) * height;
            let size = element.size;

            // Applica animazione basata sui sensori
            const sensorValue = this.sensorValues[element.sensor];
            const normalized = this.normalizeValue(sensorValue, 0, 100);

            ctx.save();
            ctx.translate(x, y);

            switch (element.animation) {
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
                case 'float':
                    ctx.translate(0, Math.sin(time + normalized * 5) * 10);
                    break;
            }

            ctx.fillStyle = element.color;

            // Disegna l'elemento
            if (element.type === 'shape') {
                switch (element.shape) {
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
            } else if (element.type === 'svg') {
                // Simula SVG con forme
                this.drawSVGObject(ctx, element.svg || 'star.svg', 0, 0, size);
            }

            ctx.restore();
        });
    }

    applyAnimations(ctx, width, height) {
        // Applica le animazioni configurate per ogni sensore
        Object.entries(this.sensorsConfig).forEach(([sensor, config]) => {
            const sensorValue = this.sensorValues[sensor];

            Object.entries(config.animations).forEach(([animationType, animConfig]) => {
                if (this.shouldTriggerAnimation(sensorValue, animConfig)) {
                    this.renderAnimation(ctx, animationType, animConfig, sensorValue, sensor, width, height);
                }
            });
        });
    }

    shouldTriggerAnimation(value, config) {
        if (!config.condition || config.condition === 'always') return true;

        switch (config.condition) {
            case 'above':
                return value > (config.threshold || config.threshold_max || 0);
            case 'below':
                return value < (config.threshold || config.threshold_min || 100);
            case 'range':
                return value >= (config.threshold_min || 0) && value <= (config.threshold_max || 100);
            default:
                return true;
        }
    }

    renderAnimation(ctx, type, config, value, sensor, width, height) {
        switch (type) {
            case 'color_change':
                this.renderColorChange(ctx, config, value, width, height);
                break;
            case 'svg_objects':
                this.renderSVGObjects(ctx, config, value, sensor, width, height);
                break;
            case 'waves':
                this.renderWaves(ctx, config, value, sensor, width, height);
                break;
        }
    }

    renderColorChange(ctx, config, value, width, height) {
        if (config.type === 'variable') {
            const normalized = this.normalizeValue(value, config.threshold_min, config.threshold_max);
            const color = this.interpolateColorHex(config.color_low, config.color_high, normalized);

            ctx.fillStyle = color + '40'; // Aggiunge trasparenza
            ctx.fillRect(0, 0, width, height);
        } else {
            ctx.fillStyle = config.color_low + '40';
            ctx.fillRect(0, 0, width, height);
        }
    }

    renderSVGObjects(ctx, config, value, sensor, width, height) {
        const count = config.count || 5;
        const time = Date.now() * 0.001;

        // Determina l'oggetto e l'animazione basati sui livelli
        let currentObject = config.object;
        let currentAnimation = config.animation;

        if (config.levels && Array.isArray(config.levels)) {
            // Sistema a livelli per i template
            for (const level of config.levels) {
                if (sensor === 'humidity') {
                    if (value >= level.threshold) {
                        currentObject = level.object;
                        currentAnimation = level.animation;
                    }
                }
            }
        }

        ctx.fillStyle = this.getSVGColor(currentObject);

        for (let i = 0; i < count; i++) {
            let x = (width / count) * i + (width / count) * 0.5;
            let y = height * 0.5;

            // Applica animazione specifica
            switch (currentAnimation) {
                case 'floating':
                    y += Math.sin(time + i) * 20;
                    break;
                case 'linear':
                    x = (x + time * 50) % width;
                    break;
                case 'rotation':
                    ctx.save();
                    ctx.translate(x, y);
                    ctx.rotate(time + i);
                    x = 0;
                    y = 0;
                    break;
                case 'snow_fall':
                    x = (Math.random() * width + time * 10 + i * 50) % width;
                    y = (Math.random() * height + time * 30 + i * 30) % height;
                    break;
                case 'sun_rays':
                    // Raggi solari speciali
                    this.drawSunRays(ctx, width * 0.8, height * 0.2, 30 + value, time);
                    continue;
                case 'falling_leaves':
                    x = (width / count) * i + Math.sin(time * 0.5 + i) * 50;
                    y = ((time * 20 + i * 40) % (height + 50)) - 25;
                    ctx.save();
                    ctx.translate(x, y);
                    ctx.rotate(time * 0.5 + i);
                    x = 0;
                    y = 0;
                    break;
                case 'flying_birds':
                    x = ((time * 40 + i * 100) % (width + 100)) - 50;
                    y = height * 0.3 + Math.sin(time * 2 + i) * 30;
                    break;
                case 'rain_fall':
                    x = (width / count) * i + Math.random() * 20;
                    y = ((time * 100 + i * 20) % (height + 20)) - 10;
                    // Disegna goccia di pioggia
                    ctx.strokeStyle = 'rgba(100, 149, 237, 0.8)';
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.moveTo(x, y);
                    ctx.lineTo(x - 2, y + 10);
                    ctx.stroke();
                    continue;
                case 'twinkle':
                    const twinkle = Math.sin(time * 3 + i) * 0.5 + 0.5;
                    ctx.globalAlpha = twinkle;
                    break;
                case 'swim':
                    x = ((time * 30 + i * 80) % (width + 100)) - 50;
                    y = height * 0.5 + Math.sin(time + i) * 50;
                    // Movimento ondulatorio per i pesci
                    ctx.save();
                    ctx.translate(x, y);
                    ctx.rotate(Math.sin(time + i) * 0.2);
                    x = 0;
                    y = 0;
                    break;
            }

            this.drawSVGObject(ctx, currentObject, x, y, 20);

            if (currentAnimation === 'rotation' || currentAnimation === 'falling_leaves' || currentAnimation === 'swim') {
                ctx.restore();
            }
            if (currentAnimation === 'twinkle') {
                ctx.globalAlpha = 1;
            }
        }
    }

    renderWaves(ctx, config, value, sensor, width, height) {
        const amplitude = (config.amplitude || config.intensity || 5) * (value / this.getMaxSensorValue(sensor));
        const frequency = config.frequency || config.speed || 3;
        const sensitivity = config.sensitivity || 5;
        const count = config.count || 3;
        const time = Date.now() * 0.001;

        ctx.strokeStyle = `rgba(255, 255, 255, 0.4)`;
        ctx.lineWidth = 2;

        switch (config.type) {
            case 'sea_waves':
            case 'sea':
                // Onde del mare orizzontali
                for (let wave = 0; wave < count; wave++) {
                    ctx.beginPath();
                    for (let x = 0; x < width; x++) {
                        const y = height * 0.5 + wave * 50 +
                            Math.sin(x * 0.01 * frequency + time + wave) * amplitude;
                        if (x === 0) {
                            ctx.moveTo(x, y);
                        } else {
                            ctx.lineTo(x, y);
                        }
                    }
                    ctx.stroke();
                }
                break;

            case 'solar_waves':
            case 'sound_rings':
                // Onde radiali dal centro o da un punto specifico
                const centerX = config.origin === 'object' ? width * 0.7 : width / 2;
                const centerY = config.origin === 'object' ? height * 0.3 : height / 2;

                ctx.strokeStyle = config.color || 'rgba(255, 215, 0, 0.6)';

                for (let i = 0; i < count; i++) {
                    const radius = (time * 50 + i * 30) % 200;
                    const alpha = Math.max(0, 1 - radius / 200);

                    ctx.globalAlpha = alpha * (amplitude / 10);
                    ctx.beginPath();
                    ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
                    ctx.stroke();
                }
                ctx.globalAlpha = 1;
                break;

            case 'currents':
                // Correnti marine circolari
                ctx.strokeStyle = 'rgba(100, 149, 237, 0.3)';
                for (let i = 0; i < count; i++) {
                    ctx.beginPath();
                    const startAngle = time * 0.5 + i * (Math.PI * 2 / count);
                    ctx.arc(
                        width * 0.5 + Math.cos(startAngle) * 100,
                        height * 0.5 + Math.sin(startAngle) * 100,
                        50 + amplitude * 2,
                        0, 2 * Math.PI
                    );
                    ctx.stroke();
                }
                break;

            case 'heat':
            case 'cold':
            case 'thermal':
                // Onde termiche verticali
                const isHeat = config.type === 'heat';
                ctx.strokeStyle = isHeat ? 'rgba(255, 100, 0, 0.3)' : 'rgba(100, 200, 255, 0.3)';

                for (let i = 0; i < width; i += 40) {
                    ctx.beginPath();
                    for (let y = 0; y < height; y++) {
                        const x = i + Math.sin(y * 0.02 + time) * amplitude;
                        if (y === 0) {
                            ctx.moveTo(x, y);
                        } else {
                            ctx.lineTo(x, y);
                        }
                    }
                    ctx.stroke();
                }
                break;
        }
    }

    getMaxSensorValue(sensor) {
        const maxValues = {
            temperature: 45,
            humidity: 100,
            light: 4095,
            audio: 4095
        };
        return maxValues[sensor] || 100;
    }

    drawSunRays(ctx, x, y, intensity, time) {
        const rayCount = 12;
        ctx.strokeStyle = `rgba(255, 223, 0, ${Math.min(0.8, intensity / 50)})`;
        ctx.lineWidth = 3;

        for (let i = 0; i < rayCount; i++) {
            const angle = (i / rayCount) * Math.PI * 2 + time * 0.2;
            const rayLength = 30 + intensity;

            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(
                x + Math.cos(angle) * rayLength,
                y + Math.sin(angle) * rayLength
            );
            ctx.stroke();
        }

        // Disegna il sole al centro
        ctx.fillStyle = 'rgba(255, 223, 0, 0.8)';
        ctx.beginPath();
        ctx.arc(x, y, 15, 0, 2 * Math.PI);
        ctx.fill();
    }

    // Funzioni di utilità
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

    drawSVGObject(ctx, object, x, y, size) {
        ctx.save();
        ctx.translate(x, y);

        switch (object) {
            case 'sun.svg':
                ctx.fillStyle = '#FFD700';
                ctx.beginPath();
                ctx.arc(0, 0, size * 0.5, 0, 2 * Math.PI);
                ctx.fill();
                break;
            case 'snowflake.svg':
                ctx.strokeStyle = '#FFFFFF';
                ctx.lineWidth = 2;
                for (let i = 0; i < 6; i++) {
                    ctx.beginPath();
                    ctx.moveTo(0, 0);
                    ctx.lineTo(0, -size);
                    ctx.stroke();
                    ctx.rotate(Math.PI / 3);
                }
                break;
            case 'star.svg':
                ctx.fillStyle = '#FFFFFF';
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
                break;
            case 'cloud.svg':
            case 'cloud-rain.svg':
                ctx.fillStyle = 'rgba(200, 200, 200, 0.8)';
                this.drawCloud(ctx, 0, 0, size);
                break;
            case 'leaf.svg':
                ctx.fillStyle = '#90EE90';
                ctx.beginPath();
                ctx.ellipse(0, 0, size * 0.4, size * 0.7, 0, 0, 2 * Math.PI);
                ctx.fill();
                break;
            case 'bird.svg':
                ctx.strokeStyle = '#333333';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(-size, 0);
                ctx.quadraticCurveTo(0, -size * 0.5, size, 0);
                ctx.stroke();
                break;
            case 'fish.svg':
                ctx.fillStyle = '#4169E1';
                ctx.beginPath();
                ctx.ellipse(0, 0, size * 0.7, size * 0.4, 0, 0, 2 * Math.PI);
                ctx.fill();
                // Coda
                ctx.beginPath();
                ctx.moveTo(size * 0.5, 0);
                ctx.lineTo(size, -size * 0.3);
                ctx.lineTo(size, size * 0.3);
                ctx.closePath();
                ctx.fill();
                break;
            case 'bubble.svg':
            case 'droplet.svg':
                ctx.fillStyle = 'rgba(173, 216, 230, 0.6)';
                ctx.strokeStyle = 'rgba(100, 149, 237, 0.8)';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.arc(0, 0, size * 0.5, 0, 2 * Math.PI);
                ctx.fill();
                ctx.stroke();
                break;
            case 'wave.svg':
                ctx.strokeStyle = '#4169E1';
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.moveTo(-size, 0);
                ctx.quadraticCurveTo(-size / 2, -size / 2, 0, 0);
                ctx.quadraticCurveTo(size / 2, size / 2, size, 0);
                ctx.stroke();
                break;
            case 'moon.svg':
                ctx.fillStyle = '#F0E68C';
                ctx.beginPath();
                ctx.arc(0, 0, size * 0.5, 0, 2 * Math.PI);
                ctx.fill();
                ctx.fillStyle = '#000';
                ctx.beginPath();
                ctx.arc(size * 0.2, -size * 0.1, size * 0.4, 0, 2 * Math.PI);
                ctx.fill();
                break;
            case 'sparkles.svg':
                ctx.fillStyle = '#FFD700';
                for (let i = 0; i < 4; i++) {
                    ctx.save();
                    ctx.rotate(i * Math.PI / 2);
                    ctx.beginPath();
                    ctx.moveTo(0, -size);
                    ctx.lineTo(-size * 0.2, 0);
                    ctx.lineTo(0, size);
                    ctx.lineTo(size * 0.2, 0);
                    ctx.closePath();
                    ctx.fill();
                    ctx.restore();
                }
                break;
            default:
                // Fallback - cerchio generico
                ctx.fillStyle = '#FFFFFF';
                ctx.beginPath();
                ctx.arc(0, 0, size * 0.5, 0, 2 * Math.PI);
                ctx.fill();
        }

        ctx.restore();
    }

    getSVGColor(object) {
        const colors = {
            'sun.svg': '#FFD700',
            'snowflake.svg': '#FFFFFF',
            'star.svg': '#FFFFFF',
            'cloud.svg': '#C0C0C0',
            'cloud-rain.svg': '#708090',
            'bubble.svg': '#87CEEB',
            'leaf.svg': '#90EE90',
            'bird.svg': '#333333',
            'fish.svg': '#4169E1',
            'wave.svg': '#4169E1',
            'moon.svg': '#F0E68C',
            'sparkles.svg': '#FFD700'
        };
        return colors[object] || '#FFFFFF';
    }

    interpolateColor(color1, color2, factor) {
        return color1.map((c, i) => Math.round(c + factor * (color2[i] - c)));
    }

    interpolateColorHex(hex1, hex2, factor) {
        const color1 = this.hexToRgb(hex1);
        const color2 = this.hexToRgb(hex2);
        const result = this.interpolateColor(color1, color2, factor);
        return this.rgbToHex(result[0], result[1], result[2]);
    }

    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? [
            parseInt(result[1], 16),
            parseInt(result[2], 16),
            parseInt(result[3], 16)
        ] : [0, 0, 0];
    }

    rgbToHex(r, g, b) {
        return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
    }

    normalizeValue(value, min, max) {
        return Math.max(0, Math.min(1, (value - min) / (max - min)));
    }

    handleDeviceUpdate(data) {
        if (data.device_id === this.selectedDevice) {
            this.sensorValues = {
                temperature: data.data.temperature,
                humidity: data.data.humidity,
                light: data.data.light,
                audio: data.data.audio
            };
            this.updateSensorValues();
        }
    }

    validateName(name) {
        const isValid = name.length > 0 && name.length <= 50;
        this.validateForm();
        return isValid;
    }

    validateForm() {
        const name = document.getElementById('quadro-name').value;
        const device = document.getElementById('device-select').value;
        const saveBtn = document.getElementById('save-quadro-btn');

        const isValid = name.length > 0 && name.length <= 50 && device !== '';

        if (isValid) {
            saveBtn.disabled = false;
            saveBtn.classList.remove('disabled');
        } else {
            saveBtn.disabled = true;
            saveBtn.classList.add('disabled');
        }
    }

    async saveQuadro() {
        const name = document.getElementById('quadro-name').value;
        const deviceId = document.getElementById('device-select').value;

        if (!this.validateName(name)) {
            alert('Inserisci un nome valido per il quadro (max 50 caratteri)');
            return;
        }

        if (!deviceId) {
            alert('Seleziona un dispositivo ESP32');
            return;
        }

        // Prepara la configurazione finale
        let finalConfig;
        if (this.selectedTemplate === 'personalizzato') {
            finalConfig = {
                ...this.sensorsConfig,
                customConfig: this.customConfig
            };
        } else {
            // Per i template predefiniti, usa la configurazione del template
            finalConfig = this.predefinedTemplates[this.selectedTemplate];
        }

        const quadroData = {
            name: name,
            device_id: deviceId,
            template: this.selectedTemplate,
            is_predefined: this.selectedTemplate !== 'personalizzato',
            sensors_config: finalConfig,
            created_at: new Date().toISOString(),
            version: "3.0"
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

    // Controlli anteprima
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
                    slider.value = value;

                    const unit = sensor === 'temperature' ? '°C' : sensor === 'humidity' ? '%' : '';
                    slider.nextElementSibling.textContent = `${value}${unit}`;
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
// FUNZIONI GLOBALI
// ============================================================================

let quadroCreator;

// Inizializzazione
document.addEventListener('DOMContentLoaded', function () {
    quadroCreator = new QuadroCreator();
});

// Funzioni di controllo
function goBack() {
    window.history.back();
}

function saveQuadro() {
    quadroCreator.saveQuadro();
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

function viewQuadro() {
    if (quadroCreator.createdQuadroId) {
        window.location.href = `/quadro/${quadroCreator.createdQuadroId}`;
    }
}

function goToHome() {
    window.location.href = '/';
}

// Gestione responsive
window.addEventListener('resize', function () {
    if (quadroCreator && quadroCreator.previewCanvas) {
        // Riadatta il canvas alle nuove dimensioni
        quadroCreator.updatePreview();
    }
});

// Gestione errori globali
window.addEventListener('error', function (e) {
    console.error('Errore JavaScript:', e.error);
});

// Gestione beforeunload
window.addEventListener('beforeunload', function (e) {
    // Avvisa l'utente se sta per lasciare la pagina con modifiche non salvate
    const name = document.getElementById('quadro-name').value;
    if (name && !quadroCreator.createdQuadroId) {
        e.preventDefault();
        e.returnValue = 'Hai modifiche non salvate. Sei sicuro di voler lasciare la pagina?';
    }
});