// ============================================================================
// EDITOR AVANZATO QUADRI VIVENTI
// Sistema per creare quadri personalizzati che reagiscono ai dati dei sensori
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
        this.isPreviewRunning = false;
        this.animationId = null;
        this.simulatedData = {
            t: 20, h: 50, l: 2000, a: 500
        };
        this.variablesMappings = {
            temperature: { min: 0, max: 40, behavior: 'color', elements: [] },
            humidity: { min: 0, max: 100, behavior: 'color', elements: [] },
            light: { min: 0, max: 4095, behavior: 'color', elements: [] },
            audio: { min: 0, max: 4095, behavior: 'color', elements: [] }
        };
        this.animations = [];
        this.backgroundType = 'color';
        this.backgroundConfig = { color: '#87CEEB' };

        this.init();
    }

    init() {
        this.setupCanvas();
        this.setupSocket();
        this.setupEventListeners();
        this.setupSliders();
        this.loadDevices();
        this.setupImageUpload();
        this.updateElementSelectors();
    }

    setupCanvas() {
        this.canvas = document.getElementById('mainCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.previewCanvas = document.getElementById('previewCanvas');
        this.previewCtx = this.previewCanvas.getContext('2d');

        // Setup canvas events
        this.canvas.addEventListener('click', (e) => this.handleCanvasClick(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleCanvasMouseMove(e));
        this.canvas.addEventListener('dblclick', (e) => this.handleCanvasDoubleClick(e));

        this.redrawCanvas();
    }

    setupSocket() {
        this.socket = io();
        this.socket.on('update_device_data', (data) => {
            this.updateDeviceData(data);
        });
        this.socket.on('connect', () => {
            console.log('Connesso al server');
        });
    }

    setupEventListeners() {
        // Canvas size controls
        document.getElementById('canvasWidth').addEventListener('change', () => this.updateCanvasSize());
        document.getElementById('canvasHeight').addEventListener('change', () => this.updateCanvasSize());

        // Background controls
        document.getElementById('backgroundColor').addEventListener('change', (e) => {
            this.backgroundConfig.color = e.target.value;
            this.redrawCanvas();
        });

        // Device selection
        document.querySelectorAll('#devices-list input[type="checkbox"]').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => this.toggleDevice(e.target.value, e.target.checked));
        });

        // Variable mappings
        this.setupVariableMappingEvents();
    }

    setupVariableMappingEvents() {
        const variables = ['temp', 'humidity', 'light', 'audio'];

        variables.forEach(variable => {
            const minInput = document.getElementById(`${variable}Min`);
            const maxInput = document.getElementById(`${variable}Max`);
            const behaviorSelect = document.getElementById(`${variable}Behavior`);

            if (minInput) minInput.addEventListener('change', () => this.updateVariableMapping(variable));
            if (maxInput) maxInput.addEventListener('change', () => this.updateVariableMapping(variable));
            if (behaviorSelect) behaviorSelect.addEventListener('change', () => this.updateVariableMapping(variable));
        });
    }

    setupSliders() {
        const sliders = ['temp', 'humidity', 'light', 'audio'];

        sliders.forEach(type => {
            const slider = document.getElementById(`${type}Slider`);
            const value = document.getElementById(`${type}Value`);

            if (slider && value) {
                slider.addEventListener('input', (e) => {
                    const val = parseFloat(e.target.value);
                    value.textContent = val;
                    this.simulatedData[type === 'temp' ? 't' : type === 'humidity' ? 'h' : type === 'light' ? 'l' : 'a'] = val;

                    if (this.isPreviewRunning) {
                        this.updatePreview();
                    }
                });
            }
        });
    }

    loadDevices() {
        // Simula il caricamento dei dispositivi ESP32 disponibili
        // In un'implementazione reale, questo farebbe una chiamata al server
        console.log('Caricamento dispositivi disponibili...');
    }

    setupImageUpload() {
        const imageUpload = document.getElementById('imageUpload');
        if (imageUpload) {
            imageUpload.addEventListener('change', (e) => this.handleImageUpload(e));
        }
    }

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
                    img.onclick = () => this.addImageToCanvas(e.target.result);
                    container.appendChild(img);
                };
                reader.readAsDataURL(file);
            }
        });
    }

    addImageToCanvas(imageSrc) {
        const img = new Image();
        img.onload = () => {
            const element = {
                type: 'image',
                id: this.generateId(),
                x: 100,
                y: 100,
                width: img.width,
                height: img.height,
                image: img,
                rotation: 0,
                opacity: 1,
                scale: 1
            };
            this.canvasElements.push(element);
            this.redrawCanvas();
            this.updateElementSelectors();
        };
        img.src = imageSrc;
    }

    generateId() {
        return 'element_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    toggleDevice(deviceId, selected) {
        if (selected) {
            if (!this.selectedDevices.includes(deviceId)) {
                this.selectedDevices.push(deviceId);
            }
        } else {
            this.selectedDevices = this.selectedDevices.filter(id => id !== deviceId);
        }
        console.log('Dispositivi selezionati:', this.selectedDevices);
    }

    updateCanvasSize() {
        const width = parseInt(document.getElementById('canvasWidth').value);
        const height = parseInt(document.getElementById('canvasHeight').value);

        this.canvas.width = width;
        this.canvas.height = height;
        this.previewCanvas.width = width;
        this.previewCanvas.height = height;

        this.redrawCanvas();
    }

    updateVariableMapping(variable) {
        const mapping = this.variablesMappings[variable];
        if (!mapping) return;

        const minInput = document.getElementById(`${variable}Min`);
        const maxInput = document.getElementById(`${variable}Max`);
        const behaviorSelect = document.getElementById(`${variable}Behavior`);

        if (minInput) mapping.min = parseFloat(minInput.value);
        if (maxInput) mapping.max = parseFloat(maxInput.value);
        if (behaviorSelect) mapping.behavior = behaviorSelect.value;

        console.log(`Aggiornato mapping per ${variable}:`, mapping);
    }

    handleCanvasClick(event) {
        const rect = this.canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        switch (this.currentTool) {
            case 'select':
                this.selectElementAt(x, y);
                break;
            case 'text':
                this.addTextElement(x, y);
                break;
            case 'shape':
                this.addShapeElement(x, y);
                break;
            case 'variable':
                this.addVariableElement(x, y);
                break;
        }
    }

    handleCanvasMouseMove(event) {
        if (this.currentTool === 'select' && this.selectedElement) {
            // Implementa il drag degli elementi
            const rect = this.canvas.getBoundingClientRect();
            const x = event.clientX - rect.left;
            const y = event.clientY - rect.top;

            if (event.buttons === 1) { // Mouse premuto
                this.selectedElement.x = x - (this.selectedElement.width || 50) / 2;
                this.selectedElement.y = y - (this.selectedElement.height || 50) / 2;
                this.redrawCanvas();
            }
        }
    }

    handleCanvasDoubleClick(event) {
        const rect = this.canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        const element = this.getElementAt(x, y);
        if (element) {
            this.editElement(element);
        }
    }

    selectElementAt(x, y) {
        this.selectedElement = this.getElementAt(x, y);
        this.redrawCanvas();
        this.highlightSelectedElement();
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

    addTextElement(x, y) {
        const text = prompt('Inserisci il testo:');
        if (text) {
            const element = {
                type: 'text',
                id: this.generateId(),
                x: x - 50,
                y: y,
                text: text,
                fontSize: 16,
                fontFamily: 'Arial',
                color: '#000000',
                rotation: 0,
                opacity: 1
            };
            this.canvasElements.push(element);
            this.redrawCanvas();
            this.updateElementSelectors();
        }
    }

    addShapeElement(x, y) {
        const shapes = ['rectangle', 'circle', 'triangle'];
        const shape = shapes[Math.floor(Math.random() * shapes.length)];

        const element = {
            type: 'shape',
            id: this.generateId(),
            shape: shape,
            x: x - 25,
            y: y - 25,
            width: 50,
            height: 50,
            color: '#ff6b6b',
            strokeColor: '#333',
            strokeWidth: 2,
            rotation: 0,
            opacity: 1
        };
        this.canvasElements.push(element);
        this.redrawCanvas();
        this.updateElementSelectors();
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
            width: 60,
            height: 30,
            displayType: 'text', // text, bar, circle
            color: '#4CAF50',
            rotation: 0,
            opacity: 1
        };
        this.canvasElements.push(element);
        this.redrawCanvas();
        this.updateElementSelectors();
    }

    editElement(element) {
        if (element.type === 'text') {
            const newText = prompt('Modifica il testo:', element.text);
            if (newText !== null) {
                element.text = newText;
                this.redrawCanvas();
            }
        }
        // Aggiungi altre modalità di editing per altri tipi di elementi
    }

    redrawCanvas() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.drawBackground();

        this.canvasElements.forEach(element => {
            this.drawElement(element);
        });

        this.highlightSelectedElement();
    }

    drawBackground() {
        if (this.backgroundType === 'color') {
            this.ctx.fillStyle = this.backgroundConfig.color || '#87CEEB';
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        } else if (this.backgroundType === 'gradient') {
            const gradient = this.ctx.createLinearGradient(0, 0, 0, this.canvas.height);
            gradient.addColorStop(0, this.backgroundConfig.startColor || '#87CEEB');
            gradient.addColorStop(1, this.backgroundConfig.endColor || '#4682B4');
            this.ctx.fillStyle = gradient;
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        }
    }

    drawElement(element) {
        this.ctx.save();

        // Applica trasformazioni
        this.ctx.globalAlpha = element.opacity || 1;

        if (element.rotation) {
            const centerX = element.x + (element.width || 0) / 2;
            const centerY = element.y + (element.height || 0) / 2;
            this.ctx.translate(centerX, centerY);
            this.ctx.rotate(element.rotation * Math.PI / 180);
            this.ctx.translate(-centerX, -centerY);
        }

        switch (element.type) {
            case 'text':
                this.drawTextElement(element);
                break;
            case 'shape':
                this.drawShapeElement(element);
                break;
            case 'image':
                this.drawImageElement(element);
                break;
            case 'variable':
                this.drawVariableElement(element);
                break;
        }

        this.ctx.restore();
    }

    drawTextElement(element) {
        this.ctx.font = `${element.fontSize}px ${element.fontFamily}`;
        this.ctx.fillStyle = element.color;
        this.ctx.fillText(element.text, element.x, element.y);
    }

    drawShapeElement(element) {
        this.ctx.fillStyle = element.color;
        this.ctx.strokeStyle = element.strokeColor;
        this.ctx.lineWidth = element.strokeWidth;

        switch (element.shape) {
            case 'rectangle':
                this.ctx.fillRect(element.x, element.y, element.width, element.height);
                this.ctx.strokeRect(element.x, element.y, element.width, element.height);
                break;
            case 'circle':
                this.ctx.beginPath();
                this.ctx.arc(element.x + element.width / 2, element.y + element.height / 2, element.width / 2, 0, 2 * Math.PI);
                this.ctx.fill();
                this.ctx.stroke();
                break;
            case 'triangle':
                this.ctx.beginPath();
                this.ctx.moveTo(element.x + element.width / 2, element.y);
                this.ctx.lineTo(element.x, element.y + element.height);
                this.ctx.lineTo(element.x + element.width, element.y + element.height);
                this.ctx.closePath();
                this.ctx.fill();
                this.ctx.stroke();
                break;
        }
    }

    drawImageElement(element) {
        if (element.image) {
            this.ctx.drawImage(element.image, element.x, element.y, element.width, element.height);
        }
    }

    drawVariableElement(element) {
        const value = this.getVariableValue(element.variable);
        const mapping = this.variablesMappings[element.variable];

        if (element.displayType === 'text') {
            this.ctx.font = '14px Arial';
            this.ctx.fillStyle = element.color;
            this.ctx.fillText(`${element.variable}: ${value.toFixed(1)}`, element.x, element.y);
        } else if (element.displayType === 'bar') {
            const percentage = (value - mapping.min) / (mapping.max - mapping.min);
            const barWidth = element.width * Math.max(0, Math.min(1, percentage));

            this.ctx.fillStyle = 'rgba(200,200,200,0.3)';
            this.ctx.fillRect(element.x, element.y, element.width, element.height);

            this.ctx.fillStyle = element.color;
            this.ctx.fillRect(element.x, element.y, barWidth, element.height);
        }
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

    highlightSelectedElement() {
        if (this.selectedElement) {
            this.ctx.strokeStyle = '#ff4444';
            this.ctx.lineWidth = 2;
            this.ctx.setLineDash([5, 5]);
            this.ctx.strokeRect(
                this.selectedElement.x,
                this.selectedElement.y,
                this.selectedElement.width || 50,
                this.selectedElement.height || 50
            );
            this.ctx.setLineDash([]);
        }
    }

    updateElementSelectors() {
        const selectors = ['tempElements', 'humidityElements', 'lightElements', 'audioElements'];

        selectors.forEach(selectorId => {
            const container = document.getElementById(selectorId);
            if (container) {
                container.innerHTML = '';

                this.canvasElements.forEach(element => {
                    const tag = document.createElement('div');
                    tag.className = 'element-tag';
                    tag.textContent = `${element.type} (${element.id.substr(-8)})`;
                    tag.onclick = () => tag.classList.toggle('selected');
                    container.appendChild(tag);
                });
            }
        });
    }

    updateDeviceData(data) {
        // Aggiorna i dati ricevuti dai dispositivi ESP32
        console.log('Dati ricevuti dal dispositivo:', data);

        if (this.isPreviewRunning) {
            // Usa i dati reali se disponibili
            this.simulatedData.t = data.data.t || this.simulatedData.t;
            this.simulatedData.h = data.data.h || this.simulatedData.h;
            this.simulatedData.l = data.data.l || this.simulatedData.l;
            this.simulatedData.a = data.data.a || this.simulatedData.a;
            this.updatePreview();
        }
    }

    startPreview() {
        this.isPreviewRunning = true;
        this.animatePreview();
        console.log('Anteprima avviata');
    }

    stopPreview() {
        this.isPreviewRunning = false;
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }
        console.log('Anteprima fermata');
    }

    resetPreview() {
        this.stopPreview();
        this.previewCtx.clearRect(0, 0, this.previewCanvas.width, this.previewCanvas.height);
        console.log('Anteprima resettata');
    }

    animatePreview() {
        if (!this.isPreviewRunning) return;

        this.updatePreview();
        this.animationId = requestAnimationFrame(() => this.animatePreview());
    }

    updatePreview() {
        this.previewCtx.clearRect(0, 0, this.previewCanvas.width, this.previewCanvas.height);

        // Disegna il background
        this.drawBackgroundOnPreview();

        // Disegna tutti gli elementi con le animazioni
        this.canvasElements.forEach(element => {
            this.drawElementOnPreview(element);
        });
    }

    drawBackgroundOnPreview() {
        if (this.backgroundType === 'color') {
            this.previewCtx.fillStyle = this.backgroundConfig.color || '#87CEEB';
            this.previewCtx.fillRect(0, 0, this.previewCanvas.width, this.previewCanvas.height);
        }
    }

    drawElementOnPreview(element) {
        this.previewCtx.save();

        // Applica le trasformazioni basate sui dati dei sensori
        this.applyVariableTransformations(element);

        // Disegna l'elemento (stessa logica del canvas principale)
        switch (element.type) {
            case 'text':
                this.previewCtx.font = `${element.fontSize}px ${element.fontFamily}`;
                this.previewCtx.fillStyle = element.color;
                this.previewCtx.fillText(element.text, element.x, element.y);
                break;
            case 'shape':
                this.drawShapeOnPreview(element);
                break;
            case 'image':
                if (element.image) {
                    this.previewCtx.drawImage(element.image, element.x, element.y, element.width, element.height);
                }
                break;
            case 'variable':
                this.drawVariableOnPreview(element);
                break;
        }

        this.previewCtx.restore();
    }

    drawShapeOnPreview(element) {
        this.previewCtx.fillStyle = element.color;
        this.previewCtx.strokeStyle = element.strokeColor;
        this.previewCtx.lineWidth = element.strokeWidth;

        switch (element.shape) {
            case 'rectangle':
                this.previewCtx.fillRect(element.x, element.y, element.width, element.height);
                this.previewCtx.strokeRect(element.x, element.y, element.width, element.height);
                break;
            case 'circle':
                this.previewCtx.beginPath();
                this.previewCtx.arc(element.x + element.width / 2, element.y + element.height / 2, element.width / 2, 0, 2 * Math.PI);
                this.previewCtx.fill();
                this.previewCtx.stroke();
                break;
            case 'triangle':
                this.previewCtx.beginPath();
                this.previewCtx.moveTo(element.x + element.width / 2, element.y);
                this.previewCtx.lineTo(element.x, element.y + element.height);
                this.previewCtx.lineTo(element.x + element.width, element.y + element.height);
                this.previewCtx.closePath();
                this.previewCtx.fill();
                this.previewCtx.stroke();
                break;
        }
    }

    drawVariableOnPreview(element) {
        const value = this.getVariableValue(element.variable);

        if (element.displayType === 'text') {
            this.previewCtx.font = '14px Arial';
            this.previewCtx.fillStyle = element.color;
            this.previewCtx.fillText(`${element.variable}: ${value.toFixed(1)}`, element.x, element.y);
        }
    }

    applyVariableTransformations(element) {
        // Applica le trasformazioni basate sui mappings delle variabili
        Object.keys(this.variablesMappings).forEach(variable => {
            const mapping = this.variablesMappings[variable];
            const value = this.getVariableValue(variable);
            const normalizedValue = (value - mapping.min) / (mapping.max - mapping.min);

            // Applica le trasformazioni in base al comportamento configurato
            switch (mapping.behavior) {
                case 'color':
                    this.applyColorTransformation(element, normalizedValue);
                    break;
                case 'size':
                    this.applySizeTransformation(element, normalizedValue);
                    break;
                case 'rotation':
                    this.applyRotationTransformation(element, normalizedValue);
                    break;
                case 'opacity':
                    this.applyOpacityTransformation(element, normalizedValue);
                    break;
            }
        });
    }

    applyColorTransformation(element, value) {
        const hue = value * 240; // Da rosso (0) a blu (240)
        element.color = `hsl(${hue}, 70%, 50%)`;
    }

    applySizeTransformation(element, value) {
        const scale = 0.5 + value * 1.5; // Scale da 0.5x a 2x
        this.previewCtx.scale(scale, scale);
    }

    applyRotationTransformation(element, value) {
        const rotation = value * 360; // Rotazione da 0 a 360 gradi
        const centerX = element.x + (element.width || 0) / 2;
        const centerY = element.y + (element.height || 0) / 2;
        this.previewCtx.translate(centerX, centerY);
        this.previewCtx.rotate(rotation * Math.PI / 180);
        this.previewCtx.translate(-centerX, -centerY);
    }

    applyOpacityTransformation(element, value) {
        this.previewCtx.globalAlpha = Math.max(0.1, value);
    }

    // Funzioni per gestire le animazioni template
    addAnimation(type) {
        console.log(`Aggiunta animazione: ${type}`);
        // Implementa l'aggiunta di animazioni predefinite
    }

    createCustomAnimation() {
        document.getElementById('animationModal').style.display = 'block';
    }

    // Funzioni per salvare e gestire i quadri
    createPainting() {
        const name = document.getElementById('paintingName').value || 'Quadro Senza Nome';
        const description = document.getElementById('paintingDescription').value || '';

        const paintingConfig = {
            name: name,
            description: description,
            devices: this.selectedDevices,
            elements: this.canvasElements,
            variables: this.variablesMappings,
            animations: this.animations,
            background: {
                type: this.backgroundType,
                config: this.backgroundConfig
            },
            canvas: {
                width: this.canvas.width,
                height: this.canvas.height
            },
            created: new Date().toISOString()
        };

        // Invia la configurazione al server
        fetch('/api/quadri', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(paintingConfig)
        })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    alert('Quadro creato con successo!');
                    window.location.href = '/';
                } else {
                    alert('Errore nella creazione del quadro: ' + data.error);
                }
            })
            .catch(error => {
                console.error('Errore:', error);
                alert('Errore di connessione al server');
            });
    }

    saveAsDraft() {
        const config = this.exportConfiguration();
        localStorage.setItem('quadro_draft', JSON.stringify(config));
        alert('Bozza salvata localmente!');
    }

    exportConfig() {
        const config = this.exportConfiguration();
        const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = 'quadro_config.json';
        a.click();

        URL.revokeObjectURL(url);
    }

    importConfig() {
        document.getElementById('configImport').click();
    }

    exportConfiguration() {
        return {
            name: document.getElementById('paintingName').value,
            description: document.getElementById('paintingDescription').value,
            devices: this.selectedDevices,
            elements: this.canvasElements,
            variables: this.variablesMappings,
            animations: this.animations,
            background: {
                type: this.backgroundType,
                config: this.backgroundConfig
            },
            canvas: {
                width: this.canvas.width,
                height: this.canvas.height
            }
        };
    }
}

// ============================================================================
// FUNZIONI GLOBALI PER L'INTERFACCIA
// ============================================================================

let editor;

// Inizializzazione quando il DOM è pronto
document.addEventListener('DOMContentLoaded', function () {
    editor = new QuadroEditor();
});

// Funzioni per cambiare tab
function switchTab(tabName) {
    // Nasconde tutti i contenuti dei tab
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });

    // Rimuove la classe active da tutti i bottoni dei tab
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    // Attiva il tab selezionato
    document.getElementById(`${tabName}-tab`).classList.add('active');
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
}

// Funzioni per selezionare gli strumenti
function selectTool(tool) {
    editor.currentTool = tool;

    // Aggiorna l'interfaccia
    document.querySelectorAll('.tool-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`[data-tool="${tool}"]`).classList.add('active');

    // Cambia il cursore del canvas
    const canvas = document.getElementById('mainCanvas');
    switch (tool) {
        case 'select':
            canvas.style.cursor = 'default';
            break;
        case 'text':
            canvas.style.cursor = 'text';
            break;
        case 'shape':
        case 'image':
        case 'variable':
            canvas.style.cursor = 'crosshair';
            break;
    }
}

// Funzioni per gestire il background
function selectBackgroundType(type) {
    editor.backgroundType = type;

    // Aggiorna l'interfaccia
    document.querySelectorAll('.bg-option').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`[data-type="${type}"]`).classList.add('active');

    // Aggiorna i controlli del background
    const controls = document.getElementById('background-controls');
    controls.innerHTML = '';

    switch (type) {
        case 'color':
            controls.innerHTML = '<input type="color" id="backgroundColor" value="#87CEEB">';
            document.getElementById('backgroundColor').addEventListener('change', (e) => {
                editor.backgroundConfig.color = e.target.value;
                editor.redrawCanvas();
            });
            break;
        case 'gradient':
            controls.innerHTML = `
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                    <input type="color" id="gradientStart" value="#87CEEB" placeholder="Inizio">
                    <input type="color" id="gradientEnd" value="#4682B4" placeholder="Fine">
                </div>
            `;
            document.getElementById('gradientStart').addEventListener('change', (e) => {
                editor.backgroundConfig.startColor = e.target.value;
                editor.redrawCanvas();
            });
            document.getElementById('gradientEnd').addEventListener('change', (e) => {
                editor.backgroundConfig.endColor = e.target.value;
                editor.redrawCanvas();
            });
            break;
        case 'image':
            controls.innerHTML = `
                <input type="file" id="backgroundImage" accept="image/*">
                <small style="opacity: 0.7;">Carica un'immagine di sfondo</small>
            `;
            document.getElementById('backgroundImage').addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        const img = new Image();
                        img.onload = () => {
                            editor.backgroundConfig.image = img;
                            editor.redrawCanvas();
                        };
                        img.src = event.target.result;
                    };
                    reader.readAsDataURL(file);
                }
            });
            break;
    }
}

// Funzioni per l'anteprima
function startPreview() {
    editor.startPreview();

    // Aggiorna l'interfaccia
    document.querySelector('[onclick="startPreview()"]').textContent = '⏸️ Pausa';
    document.querySelector('[onclick="startPreview()"]').setAttribute('onclick', 'pausePreview()');
}

function pausePreview() {
    editor.stopPreview();

    // Aggiorna l'interfaccia
    document.querySelector('[onclick="pausePreview()"]').textContent = '▶️ Avvia Anteprima';
    document.querySelector('[onclick="pausePreview()"]').setAttribute('onclick', 'startPreview()');
}

function stopPreview() {
    editor.stopPreview();

    // Reset dell'interfaccia
    document.querySelector('[onclick="pausePreview()"], [onclick="startPreview()"]').textContent = '▶️ Avvia Anteprima';
    document.querySelector('[onclick="pausePreview()"], [onclick="startPreview()"]').setAttribute('onclick', 'startPreview()');
}

function resetPreview() {
    editor.resetPreview();
    stopPreview();
}

// Funzioni per le animazioni
function addAnimation(type) {
    const animations = {
        floating: {
            name: 'Fluttuante',
            type: 'position',
            keyframes: [
                { time: 0, y: 0 },
                { time: 50, y: -10 },
                { time: 100, y: 0 }
            ],
            duration: 2000,
            loop: true,
            easing: 'ease-in-out'
        },
        rotating: {
            name: 'Rotazione',
            type: 'rotation',
            keyframes: [
                { time: 0, rotation: 0 },
                { time: 100, rotation: 360 }
            ],
            duration: 3000,
            loop: true,
            easing: 'linear'
        },
        pulsing: {
            name: 'Pulsazione',
            type: 'scale',
            keyframes: [
                { time: 0, scale: 1 },
                { time: 50, scale: 1.2 },
                { time: 100, scale: 1 }
            ],
            duration: 1500,
            loop: true,
            easing: 'ease-in-out'
        },
        bouncing: {
            name: 'Rimbalzo',
            type: 'position',
            keyframes: [
                { time: 0, y: 0 },
                { time: 25, y: -20 },
                { time: 50, y: 0 },
                { time: 75, y: -10 },
                { time: 100, y: 0 }
            ],
            duration: 1000,
            loop: true,
            easing: 'ease-out'
        },
        wave: {
            name: 'Onda',
            type: 'position',
            keyframes: [
                { time: 0, x: 0, y: 0 },
                { time: 25, x: 5, y: -5 },
                { time: 50, x: 0, y: 0 },
                { time: 75, x: -5, y: 5 },
                { time: 100, x: 0, y: 0 }
            ],
            duration: 2500,
            loop: true,
            easing: 'ease-in-out'
        },
        sparkle: {
            name: 'Scintillio',
            type: 'opacity',
            keyframes: [
                { time: 0, opacity: 1 },
                { time: 20, opacity: 0.3 },
                { time: 40, opacity: 1 },
                { time: 60, opacity: 0.5 },
                { time: 80, opacity: 1 },
                { time: 100, opacity: 1 }
            ],
            duration: 800,
            loop: true,
            easing: 'linear'
        }
    };

    if (animations[type]) {
        editor.animations.push(animations[type]);
        updateAnimationsList();
        console.log(`Aggiunta animazione: ${animations[type].name}`);
    }
}

function updateAnimationsList() {
    const container = document.getElementById('animationsList');
    if (!container) return;

    container.innerHTML = '';

    editor.animations.forEach((animation, index) => {
        const animationDiv = document.createElement('div');
        animationDiv.className = 'animation-item';
        animationDiv.innerHTML = `
            <h5>${animation.name}</h5>
            <p>Tipo: ${animation.type}</p>
            <p>Durata: ${animation.duration}ms</p>
            <div class="animation-item-controls">
                <button onclick="editAnimation(${index})">✏️ Modifica</button>
                <button onclick="duplicateAnimation(${index})">📋 Duplica</button>
                <button onclick="deleteAnimation(${index})">🗑️ Elimina</button>
            </div>
        `;
        container.appendChild(animationDiv);
    });
}

function editAnimation(index) {
    const animation = editor.animations[index];
    if (animation) {
        // Apri il modal di editing
        openAnimationModal(animation, index);
    }
}

function duplicateAnimation(index) {
    const animation = editor.animations[index];
    if (animation) {
        const copy = JSON.parse(JSON.stringify(animation));
        copy.name += ' (Copia)';
        editor.animations.push(copy);
        updateAnimationsList();
    }
}

function deleteAnimation(index) {
    if (confirm('Sei sicuro di voler eliminare questa animazione?')) {
        editor.animations.splice(index, 1);
        updateAnimationsList();
    }
}

function createCustomAnimation() {
    openAnimationModal();
}

function openAnimationModal(animation = null, index = null) {
    const modal = document.getElementById('animationModal');
    modal.style.display = 'block';

    // Popola il modal con i dati dell'animazione se fornita
    if (animation) {
        document.getElementById('animDuration').value = animation.duration;
        document.getElementById('animLoop').checked = animation.loop;
        document.getElementById('animEasing').value = animation.easing;

        // Popola i keyframes
        populateKeyframes(animation.keyframes);
    } else {
        // Reset del modal per nuova animazione
        document.getElementById('animDuration').value = 1000;
        document.getElementById('animLoop').checked = true;
        document.getElementById('animEasing').value = 'ease';
        document.getElementById('keyframesList').innerHTML = '';
    }

    // Salva l'indice per il salvataggio
    modal.dataset.editingIndex = index;
}

function populateKeyframes(keyframes) {
    const container = document.getElementById('keyframesList');
    container.innerHTML = '';

    keyframes.forEach((keyframe, index) => {
        addKeyframeToList(keyframe, index);
    });
}

function addKeyframe() {
    const keyframe = {
        time: 0,
        x: 0,
        y: 0,
        rotation: 0,
        scale: 1,
        opacity: 1
    };

    const container = document.getElementById('keyframesList');
    const index = container.children.length;
    addKeyframeToList(keyframe, index);
}

function addKeyframeToList(keyframe, index) {
    const container = document.getElementById('keyframesList');

    const keyframeDiv = document.createElement('div');
    keyframeDiv.className = 'keyframe-item';
    keyframeDiv.innerHTML = `
        <div class="keyframe-header">
            <span class="keyframe-time">Keyframe ${index + 1}</span>
            <button class="keyframe-delete" onclick="deleteKeyframe(${index})">🗑️</button>
        </div>
        <div class="keyframe-properties">
            <div class="keyframe-property">
                <label>Tempo %:</label>
                <input type="number" min="0" max="100" value="${keyframe.time || 0}" data-property="time">
            </div>
            <div class="keyframe-property">
                <label>X:</label>
                <input type="number" value="${keyframe.x || 0}" data-property="x">
            </div>
            <div class="keyframe-property">
                <label>Y:</label>
                <input type="number" value="${keyframe.y || 0}" data-property="y">
            </div>
            <div class="keyframe-property">
                <label>Rotazione:</label>
                <input type="number" value="${keyframe.rotation || 0}" data-property="rotation">
            </div>
            <div class="keyframe-property">
                <label>Scala:</label>
                <input type="number" step="0.1" value="${keyframe.scale || 1}" data-property="scale">
            </div>
            <div class="keyframe-property">
                <label>Opacità:</label>
                <input type="number" step="0.1" min="0" max="1" value="${keyframe.opacity || 1}" data-property="opacity">
            </div>
        </div>
    `;

    container.appendChild(keyframeDiv);
}

function deleteKeyframe(index) {
    const container = document.getElementById('keyframesList');
    if (container.children.length > 1) { // Mantieni almeno un keyframe
        container.children[index].remove();
        // Rinumera i keyframes
        Array.from(container.children).forEach((child, newIndex) => {
            child.querySelector('.keyframe-time').textContent = `Keyframe ${newIndex + 1}`;
        });
    }
}

function saveCustomAnimation() {
    const modal = document.getElementById('animationModal');
    const editingIndex = modal.dataset.editingIndex;

    // Raccogli i dati dell'animazione
    const animation = {
        name: prompt('Nome dell\'animazione:', 'Animazione Personalizzata') || 'Animazione Personalizzata',
        duration: parseInt(document.getElementById('animDuration').value),
        loop: document.getElementById('animLoop').checked,
        easing: document.getElementById('animEasing').value,
        keyframes: []
    };

    // Raccogli i keyframes
    const keyframeItems = document.querySelectorAll('.keyframe-item');
    keyframeItems.forEach(item => {
        const keyframe = {};
        const inputs = item.querySelectorAll('input[data-property]');
        inputs.forEach(input => {
            const property = input.dataset.property;
            const value = property === 'time' ? parseInt(input.value) : parseFloat(input.value);
            keyframe[property] = value;
        });
        animation.keyframes.push(keyframe);
    });

    // Salva l'animazione
    if (editingIndex !== null && editingIndex !== 'null') {
        editor.animations[editingIndex] = animation;
    } else {
        editor.animations.push(animation);
    }

    updateAnimationsList();
    closeAnimationModal();
}

function closeAnimationModal() {
    document.getElementById('animationModal').style.display = 'none';
}

// Funzioni per import/export
function importAnimation() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const animation = JSON.parse(event.target.result);
                    editor.animations.push(animation);
                    updateAnimationsList();
                    alert('Animazione importata con successo!');
                } catch (error) {
                    alert('Errore nel caricamento del file di animazione');
                }
            };
            reader.readAsText(file);
        }
    };
    input.click();
}

function exportAnimation() {
    if (editor.animations.length === 0) {
        alert('Nessuna animazione da esportare');
        return;
    }

    const animations = editor.animations;
    const blob = new Blob([JSON.stringify(animations, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = 'animazioni.json';
    a.click();

    URL.revokeObjectURL(url);
}

// Funzioni principali
function saveAsDraft() {
    editor.saveAsDraft();
}

function exportConfig() {
    editor.exportConfig();
}

function importConfig() {
    const input = document.getElementById('configImport');
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const config = JSON.parse(event.target.result);
                    editor.loadConfiguration(config);
                    alert('Configurazione importata con successo!');
                } catch (error) {
                    alert('Errore nel caricamento del file di configurazione');
                }
            };
            reader.readAsText(file);
        }
    };
    input.click();
}

function createPainting() {
    // Validazione
    const name = document.getElementById('paintingName').value.trim();
    if (!name) {
        alert('Inserisci un nome per il quadro');
        return;
    }

    if (editor.selectedDevices.length === 0) {
        if (!confirm('Nessun dispositivo ESP32 selezionato. Continuare comunque?')) {
            return;
        }
    }

    if (editor.canvasElements.length === 0) {
        if (!confirm('Il quadro è vuoto. Continuare comunque?')) {
            return;
        }
    }

    editor.createPainting();
}

// Gestione del modal
document.addEventListener('DOMContentLoaded', function () {
    // Chiudi il modal cliccando sulla X
    document.querySelector('.close').onclick = function () {
        closeAnimationModal();
    };

    // Chiudi il modal cliccando fuori
    window.onclick = function (event) {
        const modal = document.getElementById('animationModal');
        if (event.target == modal) {
            closeAnimationModal();
        }
    };

    // Gestisce l'import dei file di configurazione
    const configImport = document.getElementById('configImport');
    if (configImport) {
        configImport.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    try {
                        const config = JSON.parse(event.target.result);
                        editor.loadConfiguration(config);
                        alert('Configurazione caricata con successo!');
                    } catch (error) {
                        console.error('Errore nel parsing del JSON:', error);
                        alert('File di configurazione non valido');
                    }
                };
                reader.readAsText(file);
            }
        });
    }
});

// Estende la classe QuadroEditor con il metodo loadConfiguration
if (typeof QuadroEditor !== 'undefined') {
    QuadroEditor.prototype.loadConfiguration = function (config) {
        // Carica la configurazione
        if (config.name) document.getElementById('paintingName').value = config.name;
        if (config.description) document.getElementById('paintingDescription').value = config.description;

        // Carica elementi del canvas
        if (config.elements) {
            this.canvasElements = config.elements;
            this.redrawCanvas();
            this.updateElementSelectors();
        }

        // Carica mappings delle variabili
        if (config.variables) {
            this.variablesMappings = config.variables;
            this.updateVariableInputs();
        }

        // Carica animazioni
        if (config.animations) {
            this.animations = config.animations;
            updateAnimationsList();
        }

        // Carica background
        if (config.background) {
            this.backgroundType = config.background.type;
            this.backgroundConfig = config.background.config;
            selectBackgroundType(this.backgroundType);
        }

        // Carica dimensioni canvas
        if (config.canvas) {
            document.getElementById('canvasWidth').value = config.canvas.width;
            document.getElementById('canvasHeight').value = config.canvas.height;
            this.updateCanvasSize();
        }

        // Carica dispositivi selezionati
        if (config.devices) {
            this.selectedDevices = config.devices;
            this.updateDeviceSelection();
        }
    };

    QuadroEditor.prototype.updateVariableInputs = function () {
        const variables = ['temp', 'humidity', 'light', 'audio'];

        variables.forEach(variable => {
            const mapping = this.variablesMappings[variable];
            if (mapping) {
                const minInput = document.getElementById(`${variable}Min`);
                const maxInput = document.getElementById(`${variable}Max`);
                const behaviorSelect = document.getElementById(`${variable}Behavior`);

                if (minInput) minInput.value = mapping.min;
                if (maxInput) maxInput.value = mapping.max;
                if (behaviorSelect) behaviorSelect.value = mapping.behavior;
            }
        });
    };

    QuadroEditor.prototype.updateDeviceSelection = function () {
        document.querySelectorAll('#devices-list input[type="checkbox"]').forEach(checkbox => {
            checkbox.checked = this.selectedDevices.includes(checkbox.value);
        });
    };
}