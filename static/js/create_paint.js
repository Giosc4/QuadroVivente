// ============================================================================
// CREAZIONE QUADRI STEP-BY-STEP
// Sistema guidato per la creazione di quadri personalizzati
// ============================================================================

class QuadroCreator {
    constructor() {
        this.currentStep = 1;
        this.totalSteps = 4;
        this.socket = null;
        this.selectedDevice = null;
        this.selectedTemplate = null;
        this.sensorsConfig = {
            temperature: { min: 0, max: 40 },
            humidity: { min: 0, max: 100 },
            light: { min: 0, max: 4095 },
            audio: { min: 0, max: 4095 }
        };
        this.templates = {};
        this.realTimeData = { t: 20, h: 50, l: 2000, a: 500 };
        this.previewCanvas = null;
        this.previewCtx = null;
        this.animationId = null;

        this.init();
    }

    init() {
        this.setupSocket();
        this.setupEventListeners();
        this.loadTemplates();
        this.setupCanvas();
        this.updateUI();
    }

    setupSocket() {
        if (typeof io !== 'undefined') {
            this.socket = io();
            this.socket.on('device_data_update', (data) => {
                this.updateRealTimeData(data);
            });
        }
    }

    setupEventListeners() {
        // Slider per anteprima finale
        this.setupFinalPreviewSliders();

        // Campi di input per range sensori
        this.setupRangeInputs();

        // Aggiorna canvas quando vengono modificati i valori
        this.setupCanvasUpdates();
    }

    setupFinalPreviewSliders() {
        const sensors = ['temp', 'humidity', 'light', 'audio'];
        sensors.forEach(sensor => {
            const slider = document.getElementById(`final-${sensor}-slider`);
            const valueDisplay = document.getElementById(`final-${sensor}-value`);

            if (slider && valueDisplay) {
                slider.addEventListener('input', (e) => {
                    const value = parseFloat(e.target.value);
                    const unit = this.getSensorUnit(sensor);
                    valueDisplay.textContent = `${value}${unit}`;

                    this.updateSimulatedData(sensor, value);
                    this.updateFinalPreview();
                });
            }
        });
    }

    setupRangeInputs() {
        const sensors = ['temp', 'humidity', 'light', 'audio'];
        sensors.forEach(sensor => {
            const minInput = document.getElementById(`${sensor}-min`);
            const maxInput = document.getElementById(`${sensor}-max`);

            if (minInput && maxInput) {
                minInput.addEventListener('change', (e) => {
                    this.sensorsConfig[this.getSensorKey(sensor)].min = parseFloat(e.target.value);
                });

                maxInput.addEventListener('change', (e) => {
                    this.sensorsConfig[this.getSensorKey(sensor)].max = parseFloat(e.target.value);
                });
            }
        });
    }

    setupCanvasUpdates() {
        // Aggiorna i canvas quando cambiano i dati
        setInterval(() => {
            if (this.currentStep === 4) {
                this.updateFinalPreview();
            }
        }, 100);
    }

    setupCanvas() {
        const finalCanvas = document.getElementById('final-preview');
        if (finalCanvas) {
            this.previewCanvas = finalCanvas;
            this.previewCtx = finalCanvas.getContext('2d');
        }
    }

    async loadTemplates() {
        try {
            const response = await fetch('/api/templates');
            this.templates = await response.json();
            this.renderTemplates();
        } catch (error) {
            console.error('Errore nel caricamento dei template:', error);
        }
    }

    renderTemplates() {
        const container = document.getElementById('templates-grid');
        if (!container) return;

        container.innerHTML = '';

        Object.entries(this.templates).forEach(([key, template]) => {
            const templateCard = document.createElement('div');
            templateCard.className = 'template-card';
            templateCard.onclick = () => this.selectTemplate(key);

            templateCard.innerHTML = `
                <div class="template-preview">${this.getTemplateIcon(key)}</div>
                <h3>${template.name}</h3>
                <p>${template.description}</p>
            `;

            container.appendChild(templateCard);
        });
    }

    getTemplateIcon(templateKey) {
        const icons = {
            'naturale': '🌄',
            'geometrico': '🔷',
            'minimalista': '⚪',
            'acquatico': '🌊'
        };
        return icons[templateKey] || '🎨';
    }

    selectTemplate(templateKey) {
        this.selectedTemplate = templateKey;

        // Aggiorna l'interfaccia
        document.querySelectorAll('.template-card').forEach(card => {
            card.classList.remove('selected');
        });
        event.target.closest('.template-card').classList.add('selected');

        console.log('Template selezionato:', templateKey);
        this.updateNextButtonState();
    }

    updateSimulatedData(sensor, value) {
        const sensorKey = this.getSensorKey(sensor);
        switch (sensorKey) {
            case 'temperature':
                this.realTimeData.t = value;
                break;
            case 'humidity':
                this.realTimeData.h = value;
                break;
            case 'light':
                this.realTimeData.l = value;
                break;
            case 'audio':
                this.realTimeData.a = value;
                break;
        }
    }

    updateRealTimeData(data) {
        if (data.device_id === this.selectedDevice) {
            this.realTimeData = {
                t: data.data.temperature,
                h: data.data.humidity,
                l: data.data.light,
                a: data.data.audio
            };
        }
    }

    updateFinalPreview() {
        if (!this.previewCtx) return;

        this.previewCtx.clearRect(0, 0, 800, 600);

        // Disegna lo sfondo basato sul template
        this.drawTemplateBackground(this.previewCtx);

        // Disegna le informazioni sui sensori
        this.drawSensorInfo(this.previewCtx);
    }

    drawTemplateBackground(ctx) {
        if (!this.selectedTemplate) return;

        switch (this.selectedTemplate) {
            case 'naturale':
                this.drawNaturalBackground(ctx);
                break;
            case 'geometrico':
                this.drawGeometricBackground(ctx);
                break;
            case 'minimalista':
                this.drawMinimalistBackground(ctx);
                break;
            case 'acquatico':
                this.drawAquaticBackground(ctx);
                break;
        }
    }

    drawNaturalBackground(ctx) {
        // Cielo
        const gradient = ctx.createLinearGradient(0, 0, 0, 300);
        gradient.addColorStop(0, '#87CEEB');
        gradient.addColorStop(1, '#98FB98');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 800, 300);

        // Montagne
        ctx.fillStyle = '#8B4513';
        ctx.beginPath();
        ctx.moveTo(0, 300);
        ctx.lineTo(200, 200);
        ctx.lineTo(400, 250);
        ctx.lineTo(600, 180);
        ctx.lineTo(800, 220);
        ctx.lineTo(800, 300);
        ctx.closePath();
        ctx.fill();

        // Terra
        ctx.fillStyle = '#228B22';
        ctx.fillRect(0, 300, 800, 300);

        // Sole/Luna basato sulla luce
        const lightLevel = this.realTimeData.l / 4095;
        ctx.fillStyle = lightLevel > 0.5 ? '#FFD700' : '#F0F0F0';
        ctx.beginPath();
        ctx.arc(700, 80, 30, 0, 2 * Math.PI);
        ctx.fill();
    }

    drawGeometricBackground(ctx) {
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(0, 0, 800, 600);

        // Griglia di linee
        ctx.strokeStyle = '#333333';
        ctx.lineWidth = 1;
        for (let i = 0; i < 800; i += 50) {
            ctx.beginPath();
            ctx.moveTo(i, 0);
            ctx.lineTo(i, 600);
            ctx.stroke();
        }
        for (let i = 0; i < 600; i += 50) {
            ctx.beginPath();
            ctx.moveTo(0, i);
            ctx.lineTo(800, i);
            ctx.stroke();
        }

        // Forme geometriche colorate
        const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FECA57'];
        const audioLevel = this.realTimeData.a / 4095;
        
        for (let i = 0; i < 5; i++) {
            ctx.fillStyle = colors[i];
            const x = 150 + i * 100;
            const y = 300;
            const size = 30 + audioLevel * 50;
            
            if (i % 2 === 0) {
                ctx.fillRect(x - size/2, y - size/2, size, size);
            } else {
                ctx.beginPath();
                ctx.arc(x, y, size/2, 0, 2 * Math.PI);
                ctx.fill();
            }
        }
    }

    drawMinimalistBackground(ctx) {
        ctx.fillStyle = '#f5f5f5';
        ctx.fillRect(0, 0, 800, 600);

        // Linee minimaliste
        ctx.strokeStyle = '#333333';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(400, 0);
        ctx.lineTo(400, 600);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(0, 300);
        ctx.lineTo(800, 300);
        ctx.stroke();

        // Elemento centrale che pulsa con l'audio
        const audioLevel = this.realTimeData.a / 4095;
        const centerSize = 40 + audioLevel * 60;

        ctx.fillStyle = '#667eea';
        ctx.beginPath();
        ctx.arc(400, 300, centerSize, 0, 2 * Math.PI);
        ctx.fill();
    }

    drawAquaticBackground(ctx) {
        // Acqua
        const gradient = ctx.createLinearGradient(0, 0, 0, 600);
        gradient.addColorStop(0, '#87CEEB');
        gradient.addColorStop(1, '#000080');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 800, 600);

        // Onde
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.3;
        const humidityLevel = this.realTimeData.h / 100;
        
        for (let i = 0; i < 3; i++) {
            ctx.beginPath();
            for (let x = 0; x < 800; x++) {
                const y = 100 + i * 100 + Math.sin(x * 0.01 + Date.now() * 0.001) * (20 + humidityLevel * 30);
                if (x === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
            }
            ctx.stroke();
        }
        ctx.globalAlpha = 1;

        // Bolle
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        const bubbleCount = Math.floor(humidityLevel * 20);
        for (let i = 0; i < bubbleCount; i++) {
            const x = Math.random() * 800;
            const y = 400 + Math.random() * 200;
            const size = 5 + Math.random() * 10;
            ctx.beginPath();
            ctx.arc(x, y, size, 0, 2 * Math.PI);
            ctx.fill();
        }
    }

    drawSensorInfo(ctx) {
        const sensors = [
            { key: 'temperature', name: 'Temp', icon: '🌡️', unit: '°C' },
            { key: 'humidity', name: 'Umidità', icon: '💧', unit: '%' },
            { key: 'light', name: 'Luce', icon: '💡', unit: '' },
            { key: 'audio', name: 'Audio', icon: '🔊', unit: '' }
        ];

        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(10, 10, 200, 120);

        ctx.fillStyle = '#ffffff';
        ctx.font = '16px Arial';
        ctx.textAlign = 'left';
        ctx.fillText('Dati Sensori:', 20, 30);

        sensors.forEach((sensor, index) => {
            const value = this.getSensorValue(sensor.key);
            const y = 50 + (index * 20);
            ctx.fillText(`${sensor.icon} ${sensor.name}: ${value.toFixed(1)}${sensor.unit}`, 20, y);
        });
    }

    // Utility functions
    getSensorKey(sensor) {
        const mapping = {
            'temp': 'temperature',
            'humidity': 'humidity',
            'light': 'light',
            'audio': 'audio'
        };
        return mapping[sensor] || sensor;
    }

    getSensorValue(sensorKey) {
        const mapping = {
            'temperature': this.realTimeData.t,
            'humidity': this.realTimeData.h,
            'light': this.realTimeData.l,
            'audio': this.realTimeData.a
        };
        return mapping[sensorKey] || 0;
    }

    getSensorUnit(sensor) {
        const units = {
            'temp': '°C',
            'humidity': '%',
            'light': '',
            'audio': ''
        };
        return units[sensor] || '';
    }

    // Navigation functions
    nextStep() {
        if (this.currentStep < this.totalSteps && this.canProceedToNextStep()) {
            this.currentStep++;
            this.updateUI();
            this.onStepChange();
        }
    }

    previousStep() {
        if (this.currentStep > 1) {
            this.currentStep--;
            this.updateUI();
            this.onStepChange();
        }
    }

    canProceedToNextStep() {
        switch (this.currentStep) {
            case 1:
                return this.selectedDevice && document.getElementById('quadro-name').value.trim();
            case 2:
                return this.selectedTemplate;
            case 3:
                return true; // Configurazione sensori sempre valida
            case 4:
                return true;
            default:
                return false;
        }
    }

    onStepChange() {
        // Aggiorna l'anteprima finale
        if (this.currentStep === 4) {
            this.generateConfigurationSummary();
            this.updateFinalPreview();
        }
    }

    updateUI() {
        this.updateProgressBar();
        this.updateStepVisibility();
        this.updateNavigationButtons();
    }

    updateProgressBar() {
        const progressFill = document.getElementById('progress-fill');
        const progressPercentage = (this.currentStep / this.totalSteps) * 100;
        progressFill.style.width = `${progressPercentage}%`;

        // Aggiorna gli step
        document.querySelectorAll('.step').forEach((step, index) => {
            const stepNumber = index + 1;
            step.classList.remove('active', 'completed');

            if (stepNumber === this.currentStep) {
                step.classList.add('active');
            } else if (stepNumber < this.currentStep) {
                step.classList.add('completed');
            }
        });
    }

    updateStepVisibility() {
        document.querySelectorAll('.step-panel').forEach((panel, index) => {
            panel.classList.remove('active');
            if (index + 1 === this.currentStep) {
                panel.classList.add('active');
            }
        });
    }

    updateNavigationButtons() {
        const prevBtn = document.getElementById('prev-btn');
        const nextBtn = document.getElementById('next-btn');
        const createBtn = document.getElementById('create-btn');

        prevBtn.disabled = this.currentStep === 1;
        this.updateNextButtonState();

        if (this.currentStep === this.totalSteps) {
            nextBtn.style.display = 'none';
            createBtn.style.display = 'block';
        } else {
            nextBtn.style.display = 'block';
            createBtn.style.display = 'none';
        }
    }

    updateNextButtonState() {
        const nextBtn = document.getElementById('next-btn');
        nextBtn.disabled = !this.canProceedToNextStep();
    }

    generateConfigurationSummary() {
        const container = document.getElementById('configuration-summary');
        if (!container) return;

        container.innerHTML = '';

        // Dispositivo
        const deviceSummary = document.createElement('div');
        deviceSummary.className = 'summary-item';
        deviceSummary.innerHTML = `
            <h4>📱 Dispositivo</h4>
            <p>${this.selectedDevice || 'Nessuno'}</p>
        `;
        container.appendChild(deviceSummary);

        // Template
        const templateSummary = document.createElement('div');
        templateSummary.className = 'summary-item';
        templateSummary.innerHTML = `
            <h4>🎨 Template</h4>
            <p>${this.selectedTemplate ? this.templates[this.selectedTemplate].name : 'Nessuno'}</p>
        `;
        container.appendChild(templateSummary);

        // Sensori
        Object.entries(this.sensorsConfig).forEach(([sensor, config]) => {
            const sensorSummary = document.createElement('div');
            sensorSummary.className = 'summary-item';
            const sensorIcon = this.getSensorIcon(sensor);

            sensorSummary.innerHTML = `
                <h4>${sensorIcon} ${sensor.charAt(0).toUpperCase() + sensor.slice(1)}</h4>
                <p>Range: ${config.min} - ${config.max}</p>
            `;
            container.appendChild(sensorSummary);
        });
    }

    getSensorIcon(sensor) {
        const icons = {
            'temperature': '🌡️',
            'humidity': '💧',
            'light': '💡',
            'audio': '🔊'
        };
        return icons[sensor] || '📊';
    }

    async createPainting() {
        const quadroName = document.getElementById('quadro-name').value.trim();

        if (!quadroName) {
            alert('Inserisci un nome per il quadro');
            return;
        }

        if (!this.selectedDevice) {
            alert('Seleziona un dispositivo');
            return;
        }

        if (!this.selectedTemplate) {
            alert('Seleziona un template');
            return;
        }

        // Mostra loading
        document.getElementById('loading-overlay').style.display = 'flex';

        try {
            const quadroConfig = {
                name: quadroName,
                device_id: this.selectedDevice,
                template: this.selectedTemplate,
                sensors_config: this.sensorsConfig
            };

            const response = await fetch('/api/quadri', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(quadroConfig)
            });

            const result = await response.json();

            if (result.status === 'success') {
                alert('Quadro creato con successo!');
                window.location.href = '/';
            } else {
                alert('Errore nella creazione del quadro: ' + result.message);
            }
        } catch (error) {
            console.error('Errore:', error);
            alert('Errore di connessione al server');
        } finally {
            document.getElementById('loading-overlay').style.display = 'none';
        }
    }
}

// Global functions
let quadroCreator;

function selectDevice(deviceId) {
    quadroCreator.selectedDevice = deviceId;

    // Aggiorna l'interfaccia
    document.querySelectorAll('.device-card').forEach(card => {
        card.classList.remove('selected');
    });
    event.target.closest('.device-card').classList.add('selected');

    console.log('Dispositivo selezionato:', deviceId);
    quadroCreator.updateNextButtonState();
}

function nextStep() {
    quadroCreator.nextStep();
}

function previousStep() {
    quadroCreator.previousStep();
}

function createPainting() {
    quadroCreator.createPainting();
}

function useRealData() {
    // Usa i dati reali dal dispositivo selezionato
    document.getElementById('final-temp-slider').value = quadroCreator.realTimeData.t;
    document.getElementById('final-humidity-slider').value = quadroCreator.realTimeData.h;
    document.getElementById('final-light-slider').value = quadroCreator.realTimeData.l;
    document.getElementById('final-audio-slider').value = quadroCreator.realTimeData.a;

    document.getElementById('final-temp-value').textContent = quadroCreator.realTimeData.t.toFixed(1) + '°C';
    document.getElementById('final-humidity-value').textContent = quadroCreator.realTimeData.h.toFixed(1) + '%';
    document.getElementById('final-light-value').textContent = quadroCreator.realTimeData.l.toString();
    document.getElementById('final-audio-value').textContent = quadroCreator.realTimeData.a.toString();

    quadroCreator.updateFinalPreview();
}

function randomizeData() {
    // Genera dati casuali
    const tempValue = Math.random() * 40;
    const humidityValue = Math.random() * 100;
    const lightValue = Math.random() * 4095;
    const audioValue = Math.random() * 4095;

    document.getElementById('final-temp-slider').value = tempValue;
    document.getElementById('final-humidity-slider').value = humidityValue;
    document.getElementById('final-light-slider').value = lightValue;
    document.getElementById('final-audio-slider').value = audioValue;

    document.getElementById('final-temp-value').textContent = tempValue.toFixed(1) + '°C';
    document.getElementById('final-humidity-value').textContent = humidityValue.toFixed(1) + '%';
    document.getElementById('final-light-value').textContent = Math.floor(lightValue).toString();
    document.getElementById('final-audio-value').textContent = Math.floor(audioValue).toString();

    quadroCreator.updateSimulatedData('temp', tempValue);
    quadroCreator.updateSimulatedData('humidity', humidityValue);
    quadroCreator.updateSimulatedData('light', lightValue);
    quadroCreator.updateSimulatedData('audio', audioValue);

    quadroCreator.updateFinalPreview();
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function () {
    quadroCreator = new QuadroCreator();
});