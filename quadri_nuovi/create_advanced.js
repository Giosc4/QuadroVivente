// ============================================================================
// EDITOR AVANZATO QUADRI VIVENTI - JAVASCRIPT
// Sistema completo per creare quadri personalizzati che reagiscono ai sensori
// ============================================================================

class QuadroEditor {
    constructor() {
        this.socket = null;
        this.canvas = null;
        this.ctx = null;
        this.previewCanvas = null;
        this.previewCtx = null;
        this.currentTool = 'select';
        this.selectedDevices = [];
        this.canvasElements = [];
        this.selectedElement = null;
        this.isDragging = false;
        this.dragOffset = { x: 0, y: 0 };
        this.isPreviewRunning = false;
        this.animationId = null;
        this.lastFrameTime = 0;

        // Dati simulati per l'anteprima
        this.simulatedData = {
            t: 20, h: 50, l: 2000, a: 500
        };

        // Dati reali ricevuti dai dispositivi ESP32
        this.deviceData = {};

        // Configurazioni delle variabili
        this.variablesMappings = {
            temperature: {
                min: 0, max: 40,
                behavior: 'color',
                elements: [],
                colorRange: ['#0066cc', '#ff3333'] // Blu freddo -> Rosso caldo
            },
            humidity: {
                min: 0, max: 100,
                behavior: 'size',
                elements: [],
                colorRange: ['#8B4513', '#00CED1'] // Marrone secco -> Ciano umido
            },
            light: {
                min: 0, max: 4095,
                behavior: 'opacity',
                elements: [],
                colorRange: ['#000080', '#FFFF00'] // Blu scuro -> Giallo chiaro
            },
            audio: {
                min: 0, max: 4095,
                behavior: 'animation',
                elements: [],
                colorRange: ['#800080', '#FF00FF'] // Viola -> Magenta
            }
        };

        // Sistema di animazioni
        this.animations = [];
        this.animationTemplates = this.getAnimationTemplates();

        // Configurazione sfondo
        this.backgroundType = 'color';
        this.backgroundConfig = { color: '#87CEEB' };

        // Storia delle azioni (undo/redo)
        this.history = [];
        this.historyIndex = -1;

        this.init();
    }

    // ========================================================================
    // INIZIALIZZAZIONE
    // ========================================================================

    init() {
        console.log('🎨 Inizializzazione Editor Quadri Viventi...');
        this.setupCanvas();
        this.setupSocket();
        this.setupEventListeners();
        this.setupSliders();
        this.loadDevices();
        this.setupImageUpload();
        this.updateElementSelectors();
        this.setupKeyboardShortcuts();
        this.loadDraftIfExists();
        console.log('✅ Editor inizializzato con successo!');
    }

    setupCanvas() {
        this.canvas = document.getElementById('mainCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.previewCanvas = document.getElementById('previewCanvas');
        this.previewCtx = this.previewCanvas.getContext('2d');

        // Abilita il supporto per high DPI
        this.setupHighDPI(this.canvas, this.ctx);
        this.setupHighDPI(this.previewCanvas, this.previewCtx);

        // Setup eventi canvas
        this.canvas.addEventListener('mousedown', (e) => this.handleCanvasMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleCanvasMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.handleCanvasMouseUp(e));
        this.canvas.addEventListener('dblclick', (e) => this.handleCanvasDoubleClick(e));
        this.canvas.addEventListener('wheel', (e) => this.handleCanvasWheel(e));
        this.canvas.addEventListener('contextmenu', (e) => this.handleCanvasRightClick(e));

        // Ridisegna il canvas iniziale
        this.redrawCanvas();
    }

    setupHighDPI(canvas, ctx) {
        const devicePixelRatio = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();

        canvas.width = rect.width * devicePixelRatio;
        canvas.height = rect.height * devicePixelRatio;

        ctx.scale(devicePixelRatio, devicePixelRatio);

        canvas.style.width = rect.width + 'px';
        canvas.style.height = rect.height + 'px';
    }

    setupSocket() {
        if (typeof io !== 'undefined') {
            this.socket = io();

            this.socket.on('update_device_data', (data) => {
                this.updateDeviceData(data);
            });

            this.socket.on('connect', () => {
                console.log('🔌 Connesso al server WebSocket');
                this.showNotification('Connesso al server', 'success');
            });

            this.socket.on('disconnect', () => {
                console.log('❌ Disconnesso dal server');
                this.showNotification('Disconnesso dal server', 'warning');
            });

            this.socket.on('error', (error) => {
                console.error('❌ Errore WebSocket:', error);
                this.showNotification('Errore di connessione', 'error');
            });
        } else {
            console.warn('⚠️ Socket.IO non disponibile');
        }
    }

    setupEventListeners() {
        // Controlli dimensioni canvas
        const widthInput = document.getElementById('canvasWidth');
        const heightInput = document.getElementById('canvasHeight');

        if (widthInput) widthInput.addEventListener('change', () => this.updateCanvasSize());
        if (heightInput) heightInput.addEventListener('change', () => this.updateCanvasSize());

        // Controlli background
        const bgColorInput = document.getElementById('backgroundColor');
        if (bgColorInput) {
            bgColorInput.addEventListener('change', (e) => {
                this.backgroundConfig.color = e.target.value;
                this.redrawCanvas();
                this.saveToHistory('Cambiato colore sfondo');
            });
        }

        // Selezione dispositivi
        const deviceCheckboxes = document.querySelectorAll('#devices-list input[type="checkbox"]');
        deviceCheckboxes.forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                this.toggleDevice(e.target.value, e.target.checked);
            });
        });

        // Mappings variabili
        this.setupVariableMappingEvents();

        // Eventi del modal
        this.setupModalEvents();
    }

    setupVariableMappingEvents() {
        const variables = ['temp', 'humidity', 'light', 'audio'];

        variables.forEach(variable => {
            const minInput = document.getElementById(`${variable}Min`);
            const maxInput = document.getElementById(`${variable}Max`);
            const behaviorSelect = document.getElementById(`${variable}Behavior`);

            if (minInput) {
                minInput.addEventListener('change', () => {
                    this.updateVariableMapping(variable);
                });
            }

            if (maxInput) {
                maxInput.addEventListener('change', () => {
                    this.updateVariableMapping(variable);
                });
            }

            if (behaviorSelect) {
                behaviorSelect.addEventListener('change', () => {
                    this.updateVariableMapping(variable);
                });
            }
        });
    }

    setupSliders() {
        const sliders = [
            { id: 'temp', prop: 't', unit: '°C' },
            { id: 'humidity', prop: 'h', unit: '%' },
            { id: 'light', prop: 'l', unit: '' },
            { id: 'audio', prop: 'a', unit: '' }
        ];

        sliders.forEach(({ id, prop, unit }) => {
            const slider = document.getElementById(`${id}Slider`);
            const valueSpan = document.getElementById(`${id}Value`);

            if (slider && valueSpan) {
                slider.addEventListener('input', (e) => {
                    const val = parseFloat(e.target.value);
                    valueSpan.textContent = `${val}${unit}`;
                    this.simulatedData[prop] = val;

                    if (this.isPreviewRunning) {
                        this.updatePreview();
                    }
                });
            }
        });
    }

    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Ctrl+Z - Undo
            if (e.ctrlKey && e.key === 'z' && !e.shiftKey) {
                e.preventDefault();
                this.undo();
            }

            // Ctrl+Shift+Z - Redo
            if (e.ctrlKey && e.shiftKey && e.key === 'Z') {
                e.preventDefault();
                this.redo();
            }

            // Ctrl+S - Salva bozza
            if (e.ctrlKey && e.key === 's') {
                e.preventDefault();
                this.saveAsDraft();
            }

            // Delete - Elimina elemento selezionato
            if (e.key === 'Delete' && this.selectedElement) {
                e.preventDefault();
                this.deleteSelectedElement();
            }

            // Escape - Deseleziona
            if (e.key === 'Escape') {
                this.selectedElement = null;
                this.redrawCanvas();
            }

            // Frecce - Muovi elemento selezionato
            if (this.selectedElement && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
                e.preventDefault();
                this.moveSelectedElement(e.key);
            }
        });
    }

    setupModalEvents() {
        // Chiudi modal con X
        const closeBtn = document.querySelector('.close');
        if (closeBtn) {
            closeBtn.onclick = () => this.closeAnimationModal();
        }

        // Chiudi modal cliccando fuori
        window.onclick = (event) => {
            const modal = document.getElementById('animationModal');
            if (event.target === modal) {
                this.closeAnimationModal();
            }
        };
    }

    loadDevices() {
        // Simula il caricamento dei dispositivi disponibili
        // In produzione, questo farebbe una chiamata al server
        console.log('📱 Caricamento dispositivi ESP32...');

        // Esempio di dispositivi simulati
        const exampleDevices = [
            { id: 'esp32_001', name: 'Sensore Salotto', location: 'Via Roma 123', data: { t: 22.5, h: 45, l: 1500, a: 300 } },
            { id: 'esp32_002', name: 'Sensore Cucina', location: 'Via Roma 123', data: { t: 24.1, h: 55, l: 2000, a: 450 } }
        ];

        // Aggiorna l'interfaccia con i dispositivi disponibili
        this.updateDevicesList(exampleDevices);
    }

    updateDevicesList(devices) {
        const container = document.getElementById('devices-list');
        if (!container) return;

        container.innerHTML = '';

        if (devices.length === 0) {
            container.innerHTML = '<div class="no-devices">Nessun dispositivo ESP32 rilevato</div>';
            return;
        }

        devices.forEach(device => {
            const deviceDiv = document.createElement('div');
            deviceDiv.className = 'device-item';
            deviceDiv.dataset.deviceId = device.id;

            deviceDiv.innerHTML = `
                <input type="checkbox" id="device-${device.id}" value="${device.id}">
                <label for="device-${device.id}">
                    <span class="device-name">${device.name}</span>
                    <span class="device-location">${device.location}</span>
                    <div class="device-values">
                        <span>🌡️ ${device.data.t.toFixed(1)}°C</span>
                        <span>💧 ${device.data.h.toFixed(1)}%</span>
                        <span>💡 ${device.data.l}</span>
                        <span>🔊 ${device.data.a}</span>
                    </div>
                </label>
            `;

            container.appendChild(deviceDiv);

            // Aggiungi event listener per questo dispositivo
            const checkbox = deviceDiv.querySelector('input[type="checkbox"]');
            checkbox.addEventListener('change', (e) => {
                this.toggleDevice(e.target.value, e.target.checked);
            });
        });
    }

    setupImageUpload() {
        const imageUpload = document.getElementById('imageUpload');
        if (imageUpload) {
            imageUpload.addEventListener('change', (e) => this.handleImageUpload(e));
        }
    }

    loadDraftIfExists() {
        const draft = localStorage.getItem('quadro_draft');
        if (draft) {
            try {
                const config = JSON.parse(draft);
                if (confirm('È stata trovata una bozza salvata. Vuoi caricarla?')) {
                    this.loadConfiguration(config);
                    this.showNotification('Bozza caricata', 'success');
                }
            } catch (error) {
                console.error('Errore nel caricamento della bozza:', error);
                localStorage.removeItem('quadro_draft');
            }
        }
    }

    // ========================================================================
    // GESTIONE CANVAS E ELEMENTI
    // ========================================================================

    handleCanvasMouseDown(event) {
        const rect = this.canvas.getBoundingClientRect();
        const x = (event.clientX - rect.left) * (this.canvas.width / rect.width);
        const y = (event.clientY - rect.top) * (this.canvas.height / rect.height);

        switch (this.currentTool) {
            case 'select':
                this.handleSelectMouseDown(x, y);
                break;
            case 'text':
                this.addTextElement(x, y);
                break;
            case 'shape':
                this.addShapeElement(x, y);
                break;
            case 'image':
                this.showImageSelector(x, y);
                break;
            case 'variable':
                this.addVariableElement(x, y);
                break;
        }
    }

    handleSelectMouseDown(x, y) {
        const element = this.getElementAt(x, y);

        if (element) {
            this.selectedElement = element;
            this.isDragging = true;
            this.dragOffset = {
                x: x - element.x,
                y: y - element.y
            };
        } else {
            this.selectedElement = null;
        }

        this.redrawCanvas();
    }

    handleCanvasMouseMove(event) {
        if (!this.isDragging || !this.selectedElement) return;

        const rect = this.canvas.getBoundingClientRect();
        const x = (event.clientX - rect.left) * (this.canvas.width / rect.width);
        const y = (event.clientY - rect.top) * (this.canvas.height / rect.height);

        this.selectedElement.x = x - this.dragOffset.x;
        this.selectedElement.y = y - this.dragOffset.y;

        // Mantieni l'elemento entro i bounds del canvas
        this.selectedElement.x = Math.max(0, Math.min(this.canvas.width - (this.selectedElement.width || 50), this.selectedElement.x));
        this.selectedElement.y = Math.max(0, Math.min(this.canvas.height - (this.selectedElement.height || 50), this.selectedElement.y));

        this.redrawCanvas();
    }

    handleCanvasMouseUp(event) {
        if (this.isDragging) {
            this.isDragging = false;
            this.saveToHistory('Spostato elemento');
        }
    }

    handleCanvasDoubleClick(event) {
        const rect = this.canvas.getBoundingClientRect();
        const x = (event.clientX - rect.left) * (this.canvas.width / rect.width);
        const y = (event.clientY - rect.top) * (this.canvas.height / rect.height);

        const element = this.getElementAt(x, y);
        if (element) {
            this.editElement(element);
        }
    }

    handleCanvasWheel(event) {
        if (event.ctrlKey && this.selectedElement) {
            event.preventDefault();

            // Zoom dell'elemento selezionato
            const scaleFactor = event.deltaY < 0 ? 1.1 : 0.9;
            const newWidth = (this.selectedElement.width || 50) * scaleFactor;
            const newHeight = (this.selectedElement.height || 50) * scaleFactor;

            this.selectedElement.width = Math.max(10, Math.min(500, newWidth));
            this.selectedElement.height = Math.max(10, Math.min(500, newHeight));

            this.redrawCanvas();
            this.saveToHistory('Ridimensionato elemento');
        }
    }

    handleCanvasRightClick(event) {
        event.preventDefault();

        const rect = this.canvas.getBoundingClientRect();
        const x = (event.clientX - rect.left) * (this.canvas.width / rect.width);
        const y = (event.clientY - rect.top) * (this.canvas.height / rect.height);

        const element = this.getElementAt(x, y);
        if (element) {
            this.showContextMenu(event.clientX, event.clientY, element);
        }
    }

    getElementAt(x, y) {
        // Cerca dall'ultimo elemento (top) al primo (bottom)
        for (let i = this.canvasElements.length - 1; i >= 0; i--) {
            const element = this.canvasElements[i];
            if (this.isPointInElement(x, y, element)) {
                return element;
            }
        }
        return null;
    }

    isPointInElement(x, y, element) {
        const elementX = element.x || 0;
        const elementY = element.y || 0;
        const elementWidth = element.width || 50;
        const elementHeight = element.height || 50;

        return x >= elementX && x <= elementX + elementWidth &&
            y >= elementY && y <= elementY + elementHeight;
    }

    // ========================================================================
    // AGGIUNTA ELEMENTI
    // ========================================================================

    addTextElement(x, y) {
        const text = prompt('Inserisci il testo:');
        if (!text) return;

        const element = {
            type: 'text',
            id: this.generateId(),
            x: x - 50,
            y: y,
            text: text,
            fontSize: 16,
            fontFamily: 'Arial',
            color: '#ffffff',
            rotation: 0,
            opacity: 1,
            width: this.ctx.measureText(text).width,
            height: 20
        };

        this.canvasElements.push(element);
        this.selectedElement = element;
        this.redrawCanvas();
        this.updateElementSelectors();
        this.saveToHistory('Aggiunto testo');
    }

    addShapeElement(x, y) {
        const shapes = ['rectangle', 'circle', 'triangle', 'star', 'heart'];
        const shape = shapes[Math.floor(Math.random() * shapes.length)];

        const element = {
            type: 'shape',
            id: this.generateId(),
            shape: shape,
            x: x - 25,
            y: y - 25,
            width: 50,
            height: 50,
            color: this.getRandomColor(),
            strokeColor: '#ffffff',
            strokeWidth: 2,
            rotation: 0,
            opacity: 1,
            filled: true
        };

        this.canvasElements.push(element);
        this.selectedElement = element;
        this.redrawCanvas();
        this.updateElementSelectors();
        this.saveToHistory('Aggiunta forma');
    }

    addVariableElement(x, y) {
        const variables = ['temperature', 'humidity', 'light', 'audio'];
        const variable = variables[Math.floor(Math.random() * variables.length)];

        const element = {
            type: 'variable',
            id: this.generateId(),
            variable: variable,
            x: x - 30,
            y: y - 15,
            width: 100,
            height: 30,
            displayType: 'text',
            color: '#4CAF50',
            rotation: 0,
            opacity: 1,
            showLabel: true,
            precision: 1
        };

        this.canvasElements.push(element);
        this.selectedElement = element;
        this.redrawCanvas();
        this.updateElementSelectors();
        this.saveToHistory('Aggiunta variabile');
    }

    showImageSelector(x, y) {
        const uploadedImages = document.querySelectorAll('.uploaded-image');
        if (uploadedImages.length === 0) {
            alert('Carica prima delle immagini usando il pulsante "Carica Immagini"');
            return;
        }

        // Mostra un dialog per selezionare l'immagine
        this.showImageSelectionDialog(x, y);
    }

    showImageSelectionDialog(x, y) {
        const dialog = document.createElement('div');
        dialog.className = 'image-selection-dialog';
        dialog.style.position = 'fixed';
        dialog.style.top = '50%';
        dialog.style.left = '50%';
        dialog.style.transform = 'translate(-50%, -50%)';
        dialog.style.background = 'rgba(0,0,0,0.9)';
        dialog.style.padding = '20px';
        dialog.style.borderRadius = '10px';
        dialog.style.zIndex = '1000';
        dialog.style.maxWidth = '400px';
        dialog.style.maxHeight = '300px';
        dialog.style.overflowY = 'auto';

        dialog.innerHTML = '<h3 style="color: white; margin-top: 0;">Seleziona un\'immagine:</h3>';

        const uploadedImages = document.querySelectorAll('.uploaded-image');
        uploadedImages.forEach(img => {
            const imgClone = img.cloneNode(true);
            imgClone.style.margin = '5px';
            imgClone.style.cursor = 'pointer';
            imgClone.onclick = () => {
                this.addImageToCanvas(img.src, x, y);
                document.body.removeChild(dialog);
            };
            dialog.appendChild(imgClone);
        });

        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'Annulla';
        cancelBtn.style.marginTop = '10px';
        cancelBtn.style.background = '#f44336';
        cancelBtn.style.color = 'white';
        cancelBtn.style.border = 'none';
        cancelBtn.style.padding = '10px 20px';
        cancelBtn.style.borderRadius = '5px';
        cancelBtn.style.cursor = 'pointer';
        cancelBtn.onclick = () => document.body.removeChild(dialog);

        dialog.appendChild(cancelBtn);
        document.body.appendChild(dialog);
    }

    addImageToCanvas(imageSrc, x = 100, y = 100) {
        const img = new Image();
        img.onload = () => {
            const element = {
                type: 'image',
                id: this.generateId(),
                x: x - img.width / 2,
                y: y - img.height / 2,
                width: img.width,
                height: img.height,
                image: img,
                imageSrc: imageSrc,
                rotation: 0,
                opacity: 1,
                scale: 1
            };

            this.canvasElements.push(element);
            this.selectedElement = element;
            this.redrawCanvas();
            this.updateElementSelectors();
            this.saveToHistory('Aggiunta immagine');
        };
        img.src = imageSrc;
    }

    // ========================================================================
    // GESTIONE IMMAGINI
    // ========================================================================

    handleImageUpload(event) {
        const files = event.target.files;
        const container = document.getElementById('uploadedImages');

        Array.from(files).forEach(file => {
            if (file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const img = document.createElement('img');
                    img.src = e.target.result;
                    img.className = 'uploaded-image';
                    img.title = file.name;
                    img.onclick = () => this.addImageToCanvas(e.target.result);

                    // Aggiungi tooltip con nome file
                    img.addEventListener('mouseenter', (event) => {
                        this.showTooltip(event, file.name);
                    });

                    container.appendChild(img);
                };
                reader.readAsDataURL(file);
            }
        });

        // Reset dell'input per permettere il caricamento dello stesso file
        event.target.value = '';
    }

    // ========================================================================
    // RENDERING CANVAS
    // ========================================================================

    redrawCanvas() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Disegna il background
        this.drawBackground(this.ctx, this.canvas.width, this.canvas.height);

        // Disegna tutti gli elementi
        this.canvasElements.forEach(element => {
            this.drawElement(this.ctx, element);
        });

        // Evidenzia l'elemento selezionato
        this.highlightSelectedElement();

        // Disegna la griglia se abilitata
        if (this.showGrid) {
            this.drawGrid();
        }
    }

    drawBackground(ctx, width, height) {
        switch (this.backgroundType) {
            case 'color':
                ctx.fillStyle = this.backgroundConfig.color || '#87CEEB';
                ctx.fillRect(0, 0, width, height);
                break;

            case 'gradient':
                const gradient = ctx.createLinearGradient(0, 0, 0, height);
                gradient.addColorStop(0, this.backgroundConfig.startColor || '#87CEEB');
                gradient.addColorStop(1, this.backgroundConfig.endColor || '#4682B4');
                ctx.fillStyle = gradient;
                ctx.fillRect(0, 0, width, height);
                break;

            case 'image':
                if (this.backgroundConfig.image) {
                    ctx.drawImage(this.backgroundConfig.image, 0, 0, width, height);
                }
                break;
        }
    }

    drawElement(ctx, element) {
        ctx.save();

        // Applica trasformazioni globali
        ctx.globalAlpha = element.opacity || 1;

        // Applica rotazione
        if (element.rotation) {
            const centerX = element.x + (element.width || 0) / 2;
            const centerY = element.y + (element.height || 0) / 2;
            ctx.translate(centerX, centerY);
            ctx.rotate((element.rotation * Math.PI) / 180);
            ctx.translate(-centerX, -centerY);
        }

        // Applica scala
        if (element.scale && element.scale !== 1) {
            const centerX = element.x + (element.width || 0) / 2;
            const centerY = element.y + (element.height || 0) / 2;
            ctx.translate(centerX, centerY);
            ctx.scale(element.scale, element.scale);
            ctx.translate(-centerX, -centerY);
        }

        // Disegna l'elemento specifico
        switch (element.type) {
            case 'text':
                this.drawTextElement(ctx, element);
                break;
            case 'shape':
                this.drawShapeElement(ctx, element);
                break;
            case 'image':
                this.drawImageElement(ctx, element);
                break;
            case 'variable':
                this.drawVariableElement(ctx, element);
                break;
        }

        ctx.restore();
    }

    drawTextElement(ctx, element) {
        ctx.font = `${element.fontSize}px ${element.fontFamily}`;
        ctx.fillStyle = element.color;
        ctx.textAlign = element.textAlign || 'left';
        ctx.textBaseline = element.textBaseline || 'top';

        // Gestione testo multiriga
        const lines = element.text.split('\n');
        const lineHeight = element.fontSize * 1.2;

        lines.forEach((line, index) => {
            ctx.fillText(line, element.x, element.y + (index * lineHeight));
        });

        // Aggiorna dimensioni per il bounding box
        element.width = ctx.measureText(element.text).width;
        element.height = lines.length * lineHeight;
    }

    drawShapeElement(ctx, element) {
        ctx.fillStyle = element.color;

        if (element.strokeWidth > 0) {
            ctx.strokeStyle = element.strokeColor;
            ctx.lineWidth = element.strokeWidth;
        }

        switch (element.shape) {
            case 'rectangle':
                if (element.filled) ctx.fillRect(element.x, element.y, element.width, element.height);
                if (element.strokeWidth > 0) ctx.strokeRect(element.x, element.y, element.width, element.height);
                break;

            case 'circle':
                ctx.beginPath();
                ctx.arc(
                    element.x + element.width / 2,
                    element.y + element.height / 2,
                    Math.min(element.width, element.height) / 2,
                    0,
                    2 * Math.PI
                );
                if (element.filled) ctx.fill();
                if (element.strokeWidth > 0) ctx.stroke();
                break;

            case 'triangle':
                ctx.beginPath();
                ctx.moveTo(element.x + element.width / 2, element.y);
                ctx.lineTo(element.x, element.y + element.height);
                ctx.lineTo(element.x + element.width, element.y + element.height);
                ctx.closePath();
                if (element.filled) ctx.fill();
                if (element.strokeWidth > 0) ctx.stroke();
                break;

            case 'star':
                this.drawStar(ctx, element);
                break;

            case 'heart':
                this.drawHeart(ctx, element);
                break;
        }
    }

    drawStar(ctx, element) {
        const cx = element.x + element.width / 2;
        const cy = element.y + element.height / 2;
        const outerRadius = Math.min(element.width, element.height) / 2;
        const innerRadius = outerRadius * 0.4;
        const points = 5;

        ctx.beginPath();
        for (let i = 0; i < points * 2; i++) {
            const radius = i % 2 === 0 ? outerRadius : innerRadius;
            const angle = (i * Math.PI) / points;
            const x = cx + Math.cos(angle) * radius;
            const y = cy + Math.sin(angle) * radius;

            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.closePath();

        if (element.filled) ctx.fill();
        if (element.strokeWidth > 0) ctx.stroke();
    }

    drawHeart(ctx, element) {
        const cx = element.x + element.width / 2;
        const cy = element.y + element.height / 3;
        const width = element.width;
        const height = element.height;

        ctx.beginPath();
        ctx.moveTo(cx, cy + height / 4);
        ctx.bezierCurveTo(cx, cy, cx - width / 2, cy, cx - width / 2, cy + height / 4);
        ctx.bezierCurveTo(cx - width / 2, cy + height / 2, cx, cy + height * 0.75, cx, cy + height);
        ctx.bezierCurveTo(cx, cy + height * 0.75, cx + width / 2, cy + height / 2, cx + width / 2, cy + height / 4);
        ctx.bezierCurveTo(cx + width / 2, cy, cx, cy, cx, cy + height / 4);

        if (element.filled) ctx.fill();
        if (element.strokeWidth > 0) ctx.stroke();
    }

    drawImageElement(ctx, element) {
        if (element.image && element.image.complete) {
            ctx.drawImage(element.image, element.x, element.y, element.width, element.height);
        }
    }

    drawVariableElement(ctx, element) {
        const value = this.getVariableValue(element.variable);
        const mapping = this.variablesMappings[element.variable];

        switch (element.displayType) {
            case 'text':
                this.drawVariableText(ctx, element, value);
                break;
            case 'bar':
                this.drawVariableBar(ctx, element, value, mapping);
                break;
            case 'circle':
                this.drawVariableCircle(ctx, element, value, mapping);
                break;
            case 'gauge':
                this.drawVariableGauge(ctx, element, value, mapping);
                break;
        }
    }

    drawVariableText(ctx, element, value) {
        ctx.font = '14px Arial';
        ctx.fillStyle = element.color;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';

        const text = element.showLabel
            ? `${element.variable}: ${value.toFixed(element.precision)}`
            : value.toFixed(element.precision);

        ctx.fillText(text, element.x, element.y);

        // Aggiorna dimensioni
        element.width = ctx.measureText(text).width;
        element.height = 16;
    }

    drawVariableBar(ctx, element, value, mapping) {
        const percentage = Math.max(0, Math.min(1, (value - mapping.min) / (mapping.max - mapping.min)));
        const barWidth = element.width * percentage;

        // Background della barra
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.fillRect(element.x, element.y, element.width, element.height);

        // Barra del valore
        ctx.fillStyle = element.color;
        ctx.fillRect(element.x, element.y, barWidth, element.height);

        // Bordo
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.lineWidth = 1;
        ctx.strokeRect(element.x, element.y, element.width, element.height);

        // Testo del valore
        if (element.showLabel) {
            ctx.fillStyle = '#ffffff';
            ctx.font = '12px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(
                value.toFixed(element.precision),
                element.x + element.width / 2,
                element.y + element.height / 2
            );
        }
    }

    drawVariableCircle(ctx, element, value, mapping) {
        const percentage = Math.max(0, Math.min(1, (value - mapping.min) / (mapping.max - mapping.min)));
        const radius = Math.min(element.width, element.height) / 2;
        const centerX = element.x + element.width / 2;
        const centerY = element.y + element.height / 2;

        // Cerchio di background
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.fill();

        // Arco del valore
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius * 0.8, -Math.PI / 2, -Math.PI / 2 + (2 * Math.PI * percentage));
        ctx.strokeStyle = element.color;
        ctx.lineWidth = radius * 0.2;
        ctx.stroke();

        // Testo del valore
        if (element.showLabel) {
            ctx.fillStyle = '#ffffff';
            ctx.font = `${radius * 0.3}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(value.toFixed(element.precision), centerX, centerY);
        }
    }

    highlightSelectedElement() {
        if (!this.selectedElement) return;

        const element = this.selectedElement;
        const padding = 5;

        this.ctx.strokeStyle = '#ff4444';
        this.ctx.lineWidth = 2;
        this.ctx.setLineDash([5, 5]);
        this.ctx.strokeRect(
            element.x - padding,
            element.y - padding,
            (element.width || 50) + padding * 2,
            (element.height || 50) + padding * 2
        );
        this.ctx.setLineDash([]);

        // Disegna i punti di controllo per il ridimensionamento
        this.drawResizeHandles(element);
    }

    drawResizeHandles(element) {
        const handleSize = 8;
        const x = element.x;
        const y = element.y;
        const w = element.width || 50;
        const h = element.height || 50;

        const handles = [
            { x: x - handleSize / 2, y: y - handleSize / 2 }, // Top-left
            { x: x + w - handleSize / 2, y: y - handleSize / 2 }, // Top-right
            { x: x - handleSize / 2, y: y + h - handleSize / 2 }, // Bottom-left
            { x: x + w - handleSize / 2, y: y + h - handleSize / 2 } // Bottom-right
        ];

        this.ctx.fillStyle = '#ff4444';
        handles.forEach(handle => {
            this.ctx.fillRect(handle.x, handle.y, handleSize, handleSize);
        });
    }

    // ========================================================================
    // GESTIONE DISPOSITIVI E DATI
    // ========================================================================

    toggleDevice(deviceId, selected) {
        if (selected) {
            if (!this.selectedDevices.includes(deviceId)) {
                this.selectedDevices.push(deviceId);
            }
        } else {
            this.selectedDevices = this.selectedDevices.filter(id => id !== deviceId);
        }

        console.log('🔌 Dispositivi selezionati:', this.selectedDevices);
        this.updateDeviceDisplay();
    }

    updateDeviceDisplay() {
        // Aggiorna l'interfaccia per mostrare i dispositivi selezionati
        document.querySelectorAll('.device-item').forEach(item => {
            const deviceId = item.dataset.deviceId;
            const checkbox = item.querySelector('input[type="checkbox"]');

            if (checkbox && checkbox.checked) {
                item.classList.add('selected');
            } else {
                item.classList.remove('selected');
            }
        });
    }

    updateDeviceData(data) {
        console.log('📊 Dati ricevuti dal dispositivo:', data);

        // Aggiorna i dati del dispositivo
        this.deviceData[data.id] = data.data;

        // Aggiorna l'interfaccia dei dispositivi
        this.updateDeviceValuesDisplay(data.id, data.data);

        // Se l'anteprima è in esecuzione, aggiorna con i dati reali
        if (this.isPreviewRunning) {
            // Usa i dati del primo dispositivo selezionato se disponibile
            if (this.selectedDevices.includes(data.id)) {
                this.simulatedData.t = data.data.t || this.simulatedData.t;
                this.simulatedData.h = data.data.h || this.simulatedData.h;
                this.simulatedData.l = data.data.l || this.simulatedData.l;
                this.simulatedData.a = data.data.a || this.simulatedData.a;

                // Aggiorna anche gli slider
                this.updateSlidersFromData();
            }
        }
    }

    updateDeviceValuesDisplay(deviceId, data) {
        const deviceItem = document.querySelector(`[data-device-id="${deviceId}"]`);
        if (!deviceItem) return;

        const valuesContainer = deviceItem.querySelector('.device-values');
        if (valuesContainer) {
            valuesContainer.innerHTML = `
                <span>🌡️ ${data.t?.toFixed(1) || 'N/A'}°C</span>
                <span>💧 ${data.h?.toFixed(1) || 'N/A'}%</span>
                <span>💡 ${data.l || 'N/A'}</span>
                <span>🔊 ${data.a || 'N/A'}</span>
            `;
        }
    }

    updateSlidersFromData() {
        const sliders = [
            { id: 'temp', prop: 't', unit: '°C' },
            { id: 'humidity', prop: 'h', unit: '%' },
            { id: 'light', prop: 'l', unit: '' },
            { id: 'audio', prop: 'a', unit: '' }
        ];

        sliders.forEach(({ id, prop, unit }) => {
            const slider = document.getElementById(`${id}Slider`);
            const valueSpan = document.getElementById(`${id}Value`);

            if (slider && valueSpan) {
                const value = this.simulatedData[prop];
                slider.value = value;
                valueSpan.textContent = `${value}${unit}`;
            }
        });
    }

    getVariableValue(variable) {
        switch (variable) {
            case 'temperature': return this.simulatedData.t;
            case 'humidity': return this.simulatedData.h;
            case 'light': return this.simulatedData.l;
            case 'audio': return this.simulatedData.a;
            default: return 0;
        }
    }

    updateVariableMapping(variable) {
        const mapping = this.variablesMappings[variable];
        if (!mapping) return;

        const minInput = document.getElementById(`${variable}Min`);
        const maxInput = document.getElementById(`${variable}Max`);
        const behaviorSelect = document.getElementById(`${variable}Behavior`);

        if (minInput) mapping.min = parseFloat(minInput.value) || 0;
        if (maxInput) mapping.max = parseFloat(maxInput.value) || 100;
        if (behaviorSelect) mapping.behavior = behaviorSelect.value;

        console.log(`🔧 Aggiornato mapping per ${variable}:`, mapping);
    }

    // ========================================================================
    // SISTEMA DI ANTEPRIMA
    // ========================================================================

    startPreview() {
        this.isPreviewRunning = true;
        this.lastFrameTime = performance.now();
        this.animatePreview();

        console.log('▶️ Anteprima avviata');
        this.showNotification('Anteprima avviata', 'success');
    }

    stopPreview() {
        this.isPreviewRunning = false;

        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }

        console.log('⏹️ Anteprima fermata');
        this.showNotification('Anteprima fermata', 'info');
    }

    resetPreview() {
        this.stopPreview();
        this.previewCtx.clearRect(0, 0, this.previewCanvas.width, this.previewCanvas.height);
    }
    animatePreview() {
        if (!this.isPreviewRunning) return;

        const currentTime = performance.now();
        const deltaTime = currentTime - this.lastFrameTime;

        if (deltaTime > (1000 / 60)) { // Limita a 60 FPS
            this.lastFrameTime = currentTime;

            this.previewCtx.clearRect(0, 0, this.previewCanvas.width, this.previewCanvas.height);
            this.drawBackground(this.previewCtx, this.previewCanvas.width, this.previewCanvas.height);

            this.canvasElements.forEach(element => {
                const updatedElement = this.applySensorBehavior(element);
                this.drawElement(this.previewCtx, updatedElement);
            });
        }

        this.animationId = requestAnimationFrame(() => this.animatePreview());
    }

    applySensorBehavior(element) {
        const newElement = { ...element };

        Object.entries(this.variablesMappings).forEach(([variable, mapping]) => {
            if (mapping.elements.includes(element.id)) {
                const sensorValue = this.getVariableValue(variable);
                const normalizedValue = (sensorValue - mapping.min) / (mapping.max - mapping.min);

                switch (mapping.behavior) {
                    case 'color':
                        newElement.color = this.interpolateColor(mapping.colorRange[0], mapping.colorRange[1], normalizedValue);
                        break;
                    case 'size':
                        const scale = 0.5 + normalizedValue * 1.5;
                        newElement.width *= scale;
                        newElement.height *= scale;
                        break;
                    case 'opacity':
                        newElement.opacity = normalizedValue;
                        break;
                    case 'position':
                        newElement.y += Math.sin(performance.now() / 500) * normalizedValue * 10;
                        break;
                    case 'rotation':
                        newElement.rotation = (performance.now() / 100) * normalizedValue;
                        break;
                    case 'animation':
                        newElement.x += Math.cos(performance.now() / 500) * normalizedValue * 5;
                        newElement.y += Math.sin(performance.now() / 500) * normalizedValue * 5;
                        break;
                }
            }
        });

        return newElement;
    }

    interpolateColor(color1, color2, factor) {
        const hex = (color) => color.charAt(0) === '#' ? color.substr(1) : color;
        const r = Math.ceil(parseInt(hex(color1).substring(0, 2), 16) * (1 - factor) + parseInt(hex(color2).substring(0, 2), 16) * factor);
        const g = Math.ceil(parseInt(hex(color1).substring(2, 4), 16) * (1 - factor) + parseInt(hex(color2).substring(2, 4), 16) * factor);
        const b = Math.ceil(parseInt(hex(color1).substring(4, 6), 16) * (1 - factor) + parseInt(hex(color2).substring(4, 6), 16) * factor);

        return `rgb(${r}, ${g}, ${b})`;
    }

    // Metodi aggiuntivi per UI
    showNotification(message, type) {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;

        document.body.appendChild(notification);

        setTimeout(() => {
            document.body.removeChild(notification);
        }, 3000);
    }

    saveAsDraft() {
        const config = JSON.stringify(this.canvasElements);
        localStorage.setItem('quadro_draft', config);
        this.showNotification('Bozza salvata con successo!', 'success');
    }

    undo() {
        if (this.historyIndex > 0) {
            this.historyIndex--;
            this.canvasElements = JSON.parse(this.history[this.historyIndex]);
            this.redrawCanvas();
        }
    }

    redo() {
        if (this.historyIndex < this.history.length - 1) {
            this.historyIndex++;
            this.canvasElements = JSON.parse(this.history[this.historyIndex]);
            this.redrawCanvas();
        }
    }

    saveToHistory(action) {
        const snapshot = JSON.stringify(this.canvasElements);
        this.history = this.history.slice(0, this.historyIndex + 1);
        this.history.push(snapshot);
        this.historyIndex++;

        console.log(`📌 ${action}`);
    }

}