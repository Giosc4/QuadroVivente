// ============================================================================
// CREAZIONE QUADRI STEP-BY-STEP
// Sistema guidato per la creazione di quadri personalizzati
// ============================================================================

class QuadroCreator {
    constructor() {
        this.currentStep = 1;
        this.totalSteps = 7;
        this.socket = null;
        this.selectedDevice = null;
        this.selectedTemplate = null;
        this.sensorsConfig = {
            temperature: { min: 0, max: 40, animation: null },
            humidity: { min: 0, max: 100, animation: null },
            light: { min: 0, max: 4095, animation: null },
            audio: { min: 0, max: 4095, animation: null }
        };
        this.availableAnimations = {};
        this.templates = {};
        this.realTimeData = { t: 20, h: 50, l: 2000, a: 500 };
        this.previewCanvases = {};

        this.init();
    }

    init() {
        this.setupSocket();
        this.setupEventListeners();
        this.loadTemplates();
        this.loadAnimations();
        this.setupCanvases();
        this.updateUI();
    }

    setupSocket() {
        this.socket = io();
        this.socket.on('device_data_update', (data) => {
            this.updateRealTimeData(data);
        });
        this.socket.on('connect', () => {
            console.log('Connesso al server');
        });
    }

    setupEventListeners() {
        // Slider per simulazione sensori
        const sensors = ['temp', 'humidity', 'light', 'audio'];
        sensors.forEach(sensor => {
            this.setupSensorSlider(sensor);
        });

        // Slider per anteprima finale
        this.setupFinalPreviewSliders();

        // Campi di input per range sensori
        this.setupRangeInputs();

        // Aggiorna canvas quando vengono modificati i valori
        this.setupCanvasUpdates();
    }

    setupSensorSlider(sensor) {
        const slider = document.getElementById(`${sensor}-simulator`);
        const valueDisplay = document.getElementById(`${sensor}-value`);

        if (slider && valueDisplay) {
            slider.addEventListener('input', (e) => {
                const value = parseFloat(e.target.value);
                const unit = this.getSensorUnit(sensor);
                valueDisplay.textContent = `${value}${unit}`;

                // Aggiorna i dati simulati
                this.updateSimulatedData(sensor, value);

                // Aggiorna l'anteprima del canvas
                this.updatePreviewCanvas(sensor);
            });
        }
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
                    this.updatePreviewCanvas(sensor);
                });

                maxInput.addEventListener('change', (e) => {
                    this.sensorsConfig[this.getSensorKey(sensor)].max = parseFloat(e.target.value);
                    this.updatePreviewCanvas(sensor);
                });
            }
        });
    }

    setupCanvasUpdates() {
        // Aggiorna i canvas quando cambiano i dati
        setInterval(() => {
            if (this.currentStep >= 3 && this.currentStep <= 6) {
                const sensor = this.getCurrentSensorFromStep();
                this.updatePreviewCanvas(sensor);
            }
            if (this.currentStep === 7) {
                this.updateFinalPreview();
            }
        }, 100);
    }

    setupCanvases() {
        const sensors = ['temp', 'humidity', 'light', 'audio'];
        sensors.forEach(sensor => {
            const canvas = document.getElementById(`${sensor}-preview`);
            if (canvas) {
                this.previewCanvases[sensor] = canvas.getContext('2d');
            }
        });

        const finalCanvas = document.getElementById('final-preview');
        if (finalCanvas) {
            this.previewCanvases.final = finalCanvas.getContext('2d');
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

    async loadAnimations() {
        try {
            const response = await fetch('/api/animations');
            this.availableAnimations = await response.json();
        } catch (error) {
            console.error('Errore nel caricamento delle animazioni:', error);
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

    renderAnimations(sensor) {
        const container = document.getElementById(`${sensor}-animations`);
        if (!container || !this.availableAnimations[this.getSensorKey(sensor)]) return;

        container.innerHTML = '';

        const animations = this.availableAnimations[this.getSensorKey(sensor)];
        Object.entries(animations).forEach(([key, animation]) => {
            const animationCard = document.createElement('div');
            animationCard.className = 'animation-option';
            animationCard.onclick = () => this.selectAnimation(sensor, key);

            animationCard.innerHTML = `
                <h4>${animation.name}</h4>
                <p>${animation.description}</p>
            `;

            container.appendChild(animationCard);
        });
    }

    selectAnimation(sensor, animationKey) {
        const sensorKey = this.getSensorKey(sensor);
        this.sensorsConfig[sensorKey].animation = animationKey;

        // Aggiorna l'interfaccia
        document.querySelectorAll(`#${sensor}-animations .animation-option`).forEach(option => {
            option.classList.remove('selected');
        });
        event.target.closest('.animation-option').classList.add('selected');

        console.log(`Animazione selezionata per ${sensor}:`, animationKey);
        this.updatePreviewCanvas(sensor);
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

    updatePreviewCanvas(sensor) {
        const canvas = this.previewCanvases[sensor];
        if (!canvas) return;

        const sensorKey = this.getSensorKey(sensor);
        const config = this.sensorsConfig[sensorKey];
        const value = this.getSensorValue(sensorKey);

        // Pulisce il canvas
        canvas.clearRect(0, 0, 300, 200);

        // Disegna lo sfondo
        canvas.fillStyle = '#001122';
        canvas.fillRect(0, 0, 300, 200);

        if (config.animation) {
            this.drawAnimation(canvas, sensor, config.animation, value, config);
        } else {
            // Disegna un placeholder
            canvas.fillStyle = '#ffffff';
            canvas.font = '16px Arial';
            canvas.textAlign = 'center';
            canvas.fillText('Seleziona un\'animazione', 150, 100);
        }
    }

    drawAnimation(ctx, sensor, animationType, value, config) {
        const normalizedValue = this.normalizeValue(value, config.min, config.max);

        switch (animationType) {
            case 'color_change':
                this.drawColorChange(ctx, normalizedValue);
                break;
            case 'size_change':
                this.drawSizeChange(ctx, normalizedValue);
                break;
            case 'water_drops':
                this.drawWaterDrops(ctx, normalizedValue);
                break;
            case 'brightness_change':
                this.drawBrightnessChange(ctx, normalizedValue);
                break;
            case 'pulse_effect':
                this.drawPulseEffect(ctx, normalizedValue);
                break;
            case 'flame_effect':
                this.drawFlameEffect(ctx, normalizedValue);
                break;
            case 'mist_effect':
                this.drawMistEffect(ctx, normalizedValue);
                break;
            case 'day_night_cycle':
                this.drawDayNightCycle(ctx, normalizedValue);
                break;
            case 'wave_animation':
                this.drawWaveAnimation(ctx, normalizedValue);
                break;
            case 'particle_burst':
                this.drawParticleBurst(ctx, normalizedValue);
                break;
            default:
                this.drawDefaultAnimation(ctx, normalizedValue);
        }
    }

    drawColorChange(ctx, value) {
        const hue = value * 240; // Da rosso a blu
        ctx.fillStyle = `hsl(${hue}, 70%, 50%)`;
        ctx.fillRect(50, 50, 200, 100);

        ctx.fillStyle = '#ffffff';
        ctx.font = '14px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Cambio Colore', 150, 110);
    }

    drawSizeChange(ctx, value) {
        const size = 20 + (value * 80);
        ctx.fillStyle = '#4CAF50';
        ctx.beginPath();
        ctx.arc(150, 100, size, 0, 2 * Math.PI);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.font = '14px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Cambio Dimensione', 150, 170);
    }

    drawWaterDrops(ctx, value) {
        const dropCount = Math.floor(value * 10);
        ctx.fillStyle = '#2196F3';

        for (let i = 0; i < dropCount; i++) {
            const x = 50 + (i * 20);
            const y = 50 + (Math.sin(Date.now() * 0.001 + i) * 20);
            ctx.beginPath();
            ctx.arc(x, y, 5, 0, 2 * Math.PI);
            ctx.fill();
        }

        ctx.fillStyle = '#ffffff';
        ctx.font = '14px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Gocce d\'Acqua', 150, 170);
    }

    drawBrightnessChange(ctx, value) {
        const brightness = value;
        ctx.fillStyle = `rgba(255, 255, 0, ${brightness})`;
        ctx.fillRect(50, 50, 200, 100);

        ctx.fillStyle = '#ffffff';
        ctx.font = '14px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Cambio Luminosità', 150, 170);
    }

    drawPulseEffect(ctx, value) {
        const pulseSize = 30 + (Math.sin(Date.now() * 0.01 * value) * 20);
        ctx.fillStyle = '#FF5722';
        ctx.beginPath();
        ctx.arc(150, 100, pulseSize, 0, 2 * Math.PI);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.font = '14px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Effetto Pulsazione', 150, 170);
    }

    drawFlameEffect(ctx, value) {
        const particleCount = Math.floor(value * 20);
        for (let i = 0; i < particleCount; i++) {
            const x = 150 + (Math.random() - 0.5) * 100;
            const y = 150 - (Math.random() * 80);
            const size = Math.random() * 5 + 2;

            ctx.fillStyle = `hsl(${Math.random() * 60}, 100%, 50%)`;
            ctx.beginPath();
            ctx.arc(x, y, size, 0, 2 * Math.PI);
            ctx.fill();
        }

        ctx.fillStyle = '#ffffff';
        ctx.font = '14px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Effetto Fiamma', 150, 170);
    }

    drawMistEffect(ctx, value) {
        const density = value;
        ctx.fillStyle = `rgba(230, 243, 255, ${density * 0.5})`;
        ctx.fillRect(0, 0, 300, 200);

        ctx.fillStyle = '#ffffff';
        ctx.font = '14px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Effetto Nebbia', 150, 170);
    }

    drawDayNightCycle(ctx, value) {
        const dayColor = [135, 206, 235]; // Sky blue
        const nightColor = [25, 25, 112]; // Midnight blue

        const r = Math.floor(dayColor[0] + (nightColor[0] - dayColor[0]) * (1 - value));
        const g = Math.floor(dayColor[1] + (nightColor[1] - dayColor[1]) * (1 - value));
        const b = Math.floor(dayColor[2] + (nightColor[2] - dayColor[2]) * (1 - value));

        ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
        ctx.fillRect(0, 0, 300, 200);

        // Sole/Luna
        ctx.fillStyle = value > 0.5 ? '#FFD700' : '#F0F0F0';
        ctx.beginPath();
        ctx.arc(250, 50, 20, 0, 2 * Math.PI);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.font = '14px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Ciclo Giorno/Notte', 150, 170);
    }

    drawWaveAnimation(ctx, value) {
        const amplitude = value * 30;
        const frequency = 0.02;

        ctx.strokeStyle = '#00BCD4';
        ctx.lineWidth = 3;
        ctx.beginPath();

        for (let x = 0; x < 300; x++) {
            const y = 100 + Math.sin(x * frequency + Date.now() * 0.005) * amplitude;
            if (x === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.font = '14px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Animazione Onde', 150, 170);
    }

    drawParticleBurst(ctx, value) {
        const particleCount = Math.floor(value * 15);
        const time = Date.now() * 0.001;

        for (let i = 0; i < particleCount; i++) {
            const angle = (i / particleCount) * Math.PI * 2;
            const distance = (Math.sin(time + i) * 0.5 + 0.5) * 50;
            const x = 150 + Math.cos(angle) * distance;
            const y = 100 + Math.sin(angle) * distance;

            ctx.fillStyle = `hsl(${(i * 30) % 360}, 70%, 50%)`;
            ctx.beginPath();
            ctx.arc(x, y, 3, 0, 2 * Math.PI);
            ctx.fill();
        }

        ctx.fillStyle = '#ffffff';
        ctx.font = '14px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Esplosione Particelle', 150, 170);
    }

    drawDefaultAnimation(ctx, value) {
        ctx.fillStyle = '#666666';
        ctx.fillRect(50, 50, 200, 100);

        ctx.fillStyle = '#ffffff';
        ctx.font = '14px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Animazione Generica', 150, 110);
    }

    updateFinalPreview() {
        const ctx = this.previewCanvases.final;
        if (!ctx) return;

        ctx.clearRect(0, 0, 800, 600);

        // Disegna lo sfondo basato sul template
        this.drawTemplateBackground(ctx);

        // Disegna tutti gli elementi animati
        this.drawAllAnimations(ctx);

        // Disegna le informazioni sui sensori
        this.drawSensorInfo(ctx);
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
    }

    drawMinimalistBackground(ctx) {
        ctx.fillStyle = '#f5f5f5';
        ctx.fillRect(0, 0, 800, 600);

        // Linea centrale
        ctx.strokeStyle = '#cccccc';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(400, 0);
        ctx.lineTo(400, 600);
        ctx.stroke();
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
        for (let i = 0; i < 3; i++) {
            ctx.beginPath();
            for (let x = 0; x < 800; x++) {
                const y = 100 + i * 100 + Math.sin(x * 0.01 + Date.now() * 0.001) * 20;
                if (x === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
            }
            ctx.stroke();
        }
        ctx.globalAlpha = 1;
    }

    drawAllAnimations(ctx) {
        // Disegna le animazioni per ogni sensore nella posizione appropriata
        const positions = {
            temperature: { x: 100, y: 100 },
            humidity: { x: 300, y: 100 },
            light: { x: 500, y: 100 },
            audio: { x: 700, y: 100 }
        };

        Object.entries(this.sensorsConfig).forEach(([sensor, config]) => {
            if (config.animation) {
                ctx.save();
                ctx.translate(positions[sensor].x, positions[sensor].y);
                const value = this.getSensorValue(sensor);
                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = 100;
                tempCanvas.height = 100;
                const tempCtx = tempCanvas.getContext('2d');

                this.drawAnimation(tempCtx, sensor, config.animation, value, config);
                ctx.drawImage(tempCanvas, -50, -50);
                ctx.restore();
            }
        });
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

    normalizeValue(value, min, max) {
        return Math.max(0, Math.min(1, (value - min) / (max - min)));
    }

    getCurrentSensorFromStep() {
        const sensors = ['', '', '', 'temp', 'humidity', 'light', 'audio'];
        return sensors[this.currentStep] || '';
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
            case 4:
            case 5:
            case 6:
                const sensor = this.getCurrentSensorFromStep();
                const sensorKey = this.getSensorKey(sensor);
                return this.sensorsConfig[sensorKey].animation;
            case 7:
                return true;
            default:
                return false;
        }
    }

    onStepChange() {
        // Carica le animazioni per il sensore corrente
        if (this.currentStep >= 3 && this.currentStep <= 6) {
            const sensor = this.getCurrentSensorFromStep();
            this.renderAnimations(sensor);
        }

        // Aggiorna l'anteprima finale
        if (this.currentStep === 7) {
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
            const animationName = config.animation ?
                this.availableAnimations[sensor]?.[config.animation]?.name || config.animation :
                'Nessuna';

            sensorSummary.innerHTML = `
                <h4>${sensorIcon} ${sensor.charAt(0).toUpperCase() + sensor.slice(1)}</h4>
                <p>Range: ${config.min} - ${config.max}</p>
                <p>Animazione: ${animationName}</p>
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
    const sliders = ['final-temp-slider', 'final-humidity-slider', 'final-light-slider', 'final-audio-slider'];
    const values = ['final-temp-value', 'final-humidity-value', 'final-light-value', 'final-audio-value'];

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