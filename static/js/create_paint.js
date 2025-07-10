// ============================================================================
// ADVANCED QUADRO CREATOR - Sistema Avanzato di Creazione Quadri
// ============================================================================

class AdvancedQuadroCreator {
    constructor() {
        this.currentStep = 1;
        this.totalSteps = 4;
        this.socket = null;
        this.selectedDevice = null;
        this.quadroName = '';
        this.triggers = [];
        this.currentEditingTrigger = null;
        this.sensorData = { temperature: 20, humidity: 50, light: 2000, audio: 500 };
        this.charts = {};
        this.previewCanvas = null;
        this.previewCtx = null;
        this.animationId = null;
        this.layers = [];
        this.assets = {
            images: [],
            shapes: [],
            backgrounds: []
        };
        this.isPreviewPlaying = true;
        
        this.init();
    }

    init() {
        this.setupSocket();
        this.setupEventListeners();
        this.initializeCharts();
        this.setupPreviewCanvas();
        this.loadAssets();
        this.updateUI();
        this.startPreviewLoop();
    }

    setupSocket() {
        if (typeof io !== 'undefined') {
            this.socket = io();
            this.socket.on('device_data_update', (data) => {
                this.updateSensorData(data);
            });
        }
    }

    setupEventListeners() {
        // Simulation sliders
        ['temp', 'humidity', 'light', 'audio'].forEach(sensor => {
            const slider = document.getElementById(`sim-${sensor}`);
            const valueDisplay = document.getElementById(`sim-${sensor}-value`);
            
            if (slider && valueDisplay) {
                slider.addEventListener('input', (e) => {
                    const value = parseFloat(e.target.value);
                    const unit = this.getSensorUnit(sensor);
                    valueDisplay.textContent = `${value}${unit}`;
                    this.updateSimulatedSensorData(sensor, value);
                });
            }
        });

        // Modal close on outside click
        window.addEventListener('click', (event) => {
            if (event.target.classList.contains('modal')) {
                this.closeAllModals();
            }
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                this.closeAllModals();
            }
        });
    }

    initializeCharts() {
        const chartConfigs = {
            'temp-chart': {
                label: 'Temperatura (°C)',
                borderColor: 'rgb(255, 107, 107)',
                backgroundColor: 'rgba(255, 107, 107, 0.1)',
                min: 0,
                max: 40
            },
            'humidity-chart': {
                label: 'Umidità (%)',
                borderColor: 'rgb(78, 205, 196)',
                backgroundColor: 'rgba(78, 205, 196, 0.1)',
                min: 0,
                max: 100
            },
            'light-chart': {
                label: 'Luce',
                borderColor: 'rgb(255, 217, 61)',
                backgroundColor: 'rgba(255, 217, 61, 0.1)',
                min: 0,
                max: 4095
            },
            'audio-chart': {
                label: 'Audio',
                borderColor: 'rgb(168, 230, 207)',
                backgroundColor: 'rgba(168, 230, 207, 0.1)',
                min: 0,
                max: 4095
            }
        };

        Object.entries(chartConfigs).forEach(([canvasId, config]) => {
            const canvas = document.getElementById(canvasId);
            if (canvas) {
                this.charts[canvasId] = new Chart(canvas, {
                    type: 'line',
                    data: {
                        labels: [],
                        datasets: [{
                            label: config.label,
                            data: [],
                            borderColor: config.borderColor,
                            backgroundColor: config.backgroundColor,
                            borderWidth: 2,
                            fill: true,
                            tension: 0.4,
                            pointRadius: 0,
                            pointHoverRadius: 4
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        interaction: {
                            intersect: false,
                            mode: 'index'
                        },
                        scales: {
                            x: {
                                display: false
                            },
                            y: {
                                min: config.min,
                                max: config.max,
                                grid: {
                                    color: 'rgba(102, 126, 234, 0.1)'
                                }
                            }
                        },
                        plugins: {
                            legend: {
                                display: true,
                                position: 'top'
                            }
                        },
                        animation: {
                            duration: 0
                        }
                    }
                });
            }
        });
    }

    setupPreviewCanvas() {
        this.previewCanvas = document.getElementById('preview-canvas');
        if (this.previewCanvas) {
            this.previewCtx = this.previewCanvas.getContext('2d');
        }
    }

    startPreviewLoop() {
        const animate = () => {
            if (this.isPreviewPlaying) {
                this.renderPreview();
            }
            this.animationId = requestAnimationFrame(animate);
        };
        animate();
    }

    loadAssets() {
        // Load default assets
        this.assets.images = [
            { id: 'leaf1', name: 'Foglia 1', url: '/static/assets/leaf1.svg', type: 'svg' },
            { id: 'leaf2', name: 'Foglia 2', url: '/static/assets/leaf2.svg', type: 'svg' },
            { id: 'bird1', name: 'Uccello 1', url: '/static/assets/bird1.svg', type: 'svg' },
            { id: 'cloud1', name: 'Nuvola 1', url: '/static/assets/cloud1.svg', type: 'svg' },
            { id: 'star1', name: 'Stella 1', url: '/static/assets/star1.svg', type: 'svg' },
            { id: 'flower1', name: 'Fiore 1', url: '/static/assets/flower1.svg', type: 'svg' }
        ];

        this.assets.shapes = [
            { id: 'circle', name: 'Cerchio', type: 'circle' },
            { id: 'square', name: 'Quadrato', type: 'rectangle' },
            { id: 'triangle', name: 'Triangolo', type: 'triangle' },
            { id: 'hexagon', name: 'Esagono', type: 'polygon' },
            { id: 'star', name: 'Stella', type: 'star' },
            { id: 'heart', name: 'Cuore', type: 'heart' }
        ];

        this.assets.backgrounds = [
            { id: 'nature', name: 'Natura', gradient: ['#87CEEB', '#98FB98'] },
            { id: 'sunset', name: 'Tramonto', gradient: ['#FF7E5F', '#FEB47B'] },
            { id: 'ocean', name: 'Oceano', gradient: ['#2E86AB', '#A23B72'] },
            { id: 'space', name: 'Spazio', gradient: ['#0F0F23', '#2E1065'] },
            { id: 'forest', name: 'Foresta', gradient: ['#134E5E', '#71B280'] },
            { id: 'fire', name: 'Fuoco', gradient: ['#FC466B', '#3F5EFB'] }
        ];
    }

    updateSensorData(data) {
        if (data.device_id !== this.selectedDevice) return;

        // Update sensor values
        this.sensorData = {
            temperature: data.data.temperature,
            humidity: data.data.humidity,
            light: data.data.light,
            audio: data.data.audio
        };

        // Update charts
        this.updateCharts();
        
        // Check triggers
        this.checkTriggers();
    }

    updateSimulatedSensorData(sensor, value) {
        const sensorMap = {
            'temp': 'temperature',
            'humidity': 'humidity',
            'light': 'light',
            'audio': 'audio'
        };

        this.sensorData[sensorMap[sensor]] = value;
        this.updateCharts();
        this.checkTriggers();
    }

    updateCharts() {
        const now = new Date().toLocaleTimeString();
        const maxDataPoints = 20;

        Object.entries(this.charts).forEach(([chartId, chart]) => {
            const sensor = chartId.split('-')[0];
            let value;

            switch(sensor) {
                case 'temp':
                    value = this.sensorData.temperature;
                    break;
                case 'humidity':
                    value = this.sensorData.humidity;
                    break;
                case 'light':
                    value = this.sensorData.light;
                    break;
                case 'audio':
                    value = this.sensorData.audio;
                    break;
            }

            chart.data.labels.push(now);
            chart.data.datasets[0].data.push(value);

            if (chart.data.labels.length > maxDataPoints) {
                chart.data.labels.shift();
                chart.data.datasets[0].data.shift();
            }

            chart.update('none');
        });
    }

    checkTriggers() {
        this.triggers.forEach(trigger => {
            if (this.evaluateTrigger(trigger)) {
                this.executeTrigger(trigger);
            }
        });
    }

    evaluateTrigger(trigger) {
        const sensorValue = this.sensorData[trigger.sensor];
        
        switch(trigger.condition) {
            case 'range':
                return sensorValue >= trigger.minValue && sensorValue <= trigger.maxValue;
            case 'above':
                return sensorValue > trigger.minValue;
            case 'below':
                return sensorValue < trigger.maxValue;
            case 'equals':
                return Math.abs(sensorValue - trigger.minValue) < 0.1;
            default:
                return false;
        }
    }

    executeTrigger(trigger) {
        // Execute trigger action based on type
        switch(trigger.actionType) {
            case 'image':
                this.executeImageAction(trigger);
                break;
            case 'background':
                this.executeBackgroundAction(trigger);
                break;
            case 'shape':
                this.executeShapeAction(trigger);
                break;
            case 'text':
                this.executeTextAction(trigger);
                break;
            case 'effect':
                this.executeEffectAction(trigger);
                break;
        }
    }

    executeImageAction(trigger) {
        // Add image to canvas with specified parameters
        const layer = {
            id: `layer_${Date.now()}`,
            type: 'image',
            trigger: trigger.id,
            asset: trigger.config.asset,
            position: trigger.config.position,
            size: trigger.config.size,
            quantity: trigger.config.quantity,
            animation: trigger.animation,
            active: true,
            startTime: Date.now()
        };

        this.addLayer(layer);
    }

    executeBackgroundAction(trigger) {
        const layer = {
            id: `bg_${Date.now()}`,
            type: 'background',
            trigger: trigger.id,
            background: trigger.config.background,
            active: true,
            startTime: Date.now()
        };

        this.addLayer(layer);
    }

    executeShapeAction(trigger) {
        const layer = {
            id: `shape_${Date.now()}`,
            type: 'shape',
            trigger: trigger.id,
            shape: trigger.config.shape,
            position: trigger.config.position,
            size: trigger.config.size,
            color: trigger.config.color,
            animation: trigger.animation,
            active: true,
            startTime: Date.now()
        };

        this.addLayer(layer);
    }

    executeTextAction(trigger) {
        const layer = {
            id: `text_${Date.now()}`,
            type: 'text',
            trigger: trigger.id,
            text: trigger.config.text,
            position: trigger.config.position,
            font: trigger.config.font,
            color: trigger.config.color,
            animation: trigger.animation,
            active: true,
            startTime: Date.now()
        };

        this.addLayer(layer);
    }

    executeEffectAction(trigger) {
        // Apply visual effects to the canvas
        const layer = {
            id: `effect_${Date.now()}`,
            type: 'effect',
            trigger: trigger.id,
            effect: trigger.config.effect,
            intensity: trigger.config.intensity,
            active: true,
            startTime: Date.now()
        };

        this.addLayer(layer);
    }

    addLayer(layer) {
        this.layers.push(layer);
        this.updateLayersPanel();
    }

    removeLayer(layerId) {
        this.layers = this.layers.filter(layer => layer.id !== layerId);
        this.updateLayersPanel();
    }

    updateLayersPanel() {
        const layersList = document.getElementById('layers-list');
        if (!layersList) return;

        layersList.innerHTML = '';

        this.layers.forEach((layer, index) => {
            const layerElement = document.createElement('div');
            layerElement.className = 'layer-item';
            layerElement.innerHTML = `
                <div class="layer-info">
                    <div class="layer-name">${this.getLayerDisplayName(layer)}</div>
                    <div class="layer-type">${layer.type}</div>
                </div>
                <div class="layer-controls">
                    <button class="layer-control-btn" onclick="quadroCreator.toggleLayerVisibility('${layer.id}')" title="Mostra/Nascondi">
                        ${layer.active ? '👁️' : '🙈'}
                    </button>
                    <button class="layer-control-btn" onclick="quadroCreator.moveLayerUp('${layer.id}')" title="Sposta su">
                        ⬆️
                    </button>
                    <button class="layer-control-btn" onclick="quadroCreator.moveLayerDown('${layer.id}')" title="Sposta giù">
                        ⬇️
                    </button>
                    <button class="layer-control-btn" onclick="quadroCreator.removeLayer('${layer.id}')" title="Elimina">
                        🗑️
                    </button>
                </div>
            `;
            layersList.appendChild(layerElement);
        });
    }

    getLayerDisplayName(layer) {
        switch(layer.type) {
            case 'image':
                return layer.asset?.name || 'Immagine';
            case 'background':
                return layer.background?.name || 'Sfondo';
            case 'shape':
                return layer.shape?.name || 'Forma';
            case 'text':
                return layer.text?.substring(0, 20) || 'Testo';
            case 'effect':
                return layer.effect?.name || 'Effetto';
            default:
                return 'Layer';
        }
    }

    toggleLayerVisibility(layerId) {
        const layer = this.layers.find(l => l.id === layerId);
        if (layer) {
            layer.active = !layer.active;
            this.updateLayersPanel();
        }
    }

    moveLayerUp(layerId) {
        const index = this.layers.findIndex(l => l.id === layerId);
        if (index > 0) {
            [this.layers[index], this.layers[index - 1]] = [this.layers[index - 1], this.layers[index]];
            this.updateLayersPanel();
        }
    }

    moveLayerDown(layerId) {
        const index = this.layers.findIndex(l => l.id === layerId);
        if (index < this.layers.length - 1) {
            [this.layers[index], this.layers[index + 1]] = [this.layers[index + 1], this.layers[index]];
            this.updateLayersPanel();
        }
    }

    renderPreview() {
        if (!this.previewCtx) return;

        const canvas = this.previewCanvas;
        const ctx = this.previewCtx;

        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Render layers in order
        this.layers.filter(layer => layer.active).forEach(layer => {
            this.renderLayer(ctx, layer);
        });
    }

    renderLayer(ctx, layer) {
        const now = Date.now();
        const elapsed = (now - layer.startTime) / 1000;

        ctx.save();

        // Apply animations
        if (layer.animation && layer.animation.type !== 'none') {
            this.applyAnimation(ctx, layer, elapsed);
        }

        // Render based on layer type
        switch(layer.type) {
            case 'background':
                this.renderBackground(ctx, layer);
                break;
            case 'image':
                this.renderImage(ctx, layer);
                break;
            case 'shape':
                this.renderShape(ctx, layer);
                break;
            case 'text':
                this.renderText(ctx, layer);
                break;
            case 'effect':
                this.renderEffect(ctx, layer);
                break;
        }

        ctx.restore();
    }

    applyAnimation(ctx, layer, elapsed) {
        const anim = layer.animation;
        const progress = this.calculateAnimationProgress(elapsed, anim);

        switch(anim.type) {
            case 'fade':
                ctx.globalAlpha = this.easeValue(progress, anim.easing);
                break;
            case 'slide':
                const slideX = this.easeValue(progress, anim.easing) * 100;
                ctx.translate(slideX, 0);
                break;
            case 'bounce':
                const bounceY = Math.sin(elapsed * 10) * 20 * this.easeValue(progress, anim.easing);
                ctx.translate(0, bounceY);
                break;
            case 'rotate':
                const angle = elapsed * Math.PI * 2;
                ctx.translate(canvas.width / 2, canvas.height / 2);
                ctx.rotate(angle);
                ctx.translate(-canvas.width / 2, -canvas.height / 2);
                break;
            case 'scale':
                const scale = 0.5 + 0.5 * this.easeValue(progress, anim.easing);
                ctx.translate(canvas.width / 2, canvas.height / 2);
                ctx.scale(scale, scale);
                ctx.translate(-canvas.width / 2, -canvas.height / 2);
                break;
            case 'float':
                const floatY = Math.sin(elapsed * 2) * 10;
                const floatX = Math.cos(elapsed * 1.5) * 5;
                ctx.translate(floatX, floatY);
                break;
        }
    }

    calculateAnimationProgress(elapsed, animation) {
        const duration = animation.duration || 1;
        let progress = elapsed / duration;

        if (animation.loop === 'infinite') {
            progress = progress % 1;
        } else if (animation.loop === 'ping-pong') {
            progress = progress % 2;
            if (progress > 1) progress = 2 - progress;
        } else if (animation.loop === 'count') {
            const count = animation.count || 1;
            progress = Math.min(progress, count) % 1;
        } else {
            progress = Math.min(progress, 1);
        }

        return progress;
    }

    easeValue(t, easing) {
        switch(easing) {
            case 'linear':
                return t;
            case 'ease-in':
                return t * t;
            case 'ease-out':
                return 1 - (1 - t) * (1 - t);
            case 'ease-in-out':
                return t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t);
            case 'bounce':
                return this.bounceEase(t);
            case 'elastic':
                return this.elasticEase(t);
            default:
                return t;
        }
    }

    bounceEase(t) {
        if (t < 1/2.75) {
            return 7.5625 * t * t;
        } else if (t < 2/2.75) {
            return 7.5625 * (t -= 1.5/2.75) * t + 0.75;
        } else if (t < 2.5/2.75) {
            return 7.5625 * (t -= 2.25/2.75) * t + 0.9375;
        } else {
            return 7.5625 * (t -= 2.625/2.75) * t + 0.984375;
        }
    }

    elasticEase(t) {
        return t === 0 ? 0 : t === 1 ? 1 : 
            -Math.pow(2, 10 * (t - 1)) * Math.sin((t - 1.1) * 5 * Math.PI);
    }

    renderBackground(ctx, layer) {
        const canvas = this.previewCanvas;
        const bg = layer.background;

        if (bg.gradient) {
            const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
            gradient.addColorStop(0, bg.gradient[0]);
            gradient.addColorStop(1, bg.gradient[1]);
            ctx.fillStyle = gradient;
        } else {
            ctx.fillStyle = bg.color || '#000000';
        }

        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    renderImage(ctx, layer) {
        // Placeholder for image rendering
        const x = layer.position?.x || 100;
        const y = layer.position?.y || 100;
        const size = layer.size || 50;

        ctx.fillStyle = '#4A90E2';
        ctx.fillRect(x, y, size, size);
        
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('IMG', x + size/2, y + size/2 + 4);
    }

    renderShape(ctx, layer) {
        const x = layer.position?.x || 200;
        const y = layer.position?.y || 200;
        const size = layer.size || 30;
        const color = layer.color || '#FF6B6B';

        ctx.fillStyle = color;
        
        switch(layer.shape?.type) {
            case 'circle':
                ctx.beginPath();
                ctx.arc(x, y, size, 0, 2 * Math.PI);
                ctx.fill();
                break;
            case 'rectangle':
                ctx.fillRect(x - size/2, y - size/2, size, size);
                break;
            case 'triangle':
                ctx.beginPath();
                ctx.moveTo(x, y - size);
                ctx.lineTo(x - size, y + size);
                ctx.lineTo(x + size, y + size);
                ctx.closePath();
                ctx.fill();
                break;
            default:
                ctx.fillRect(x - size/2, y - size/2, size, size);
        }
    }

    renderText(ctx, layer) {
        const x = layer.position?.x || 300;
        const y = layer.position?.y || 300;
        const text = layer.text || 'Testo';
        const font = layer.font || '20px Arial';
        const color = layer.color || '#333333';

        ctx.fillStyle = color;
        ctx.font = font;
        ctx.textAlign = 'center';
        ctx.fillText(text, x, y);
    }

    renderEffect(ctx, layer) {
        // Placeholder for effects
        const intensity = layer.intensity || 0.5;
        
        switch(layer.effect?.type) {
            case 'blur':
                ctx.filter = `blur(${intensity * 10}px)`;
                break;
            case 'brightness':
                ctx.filter = `brightness(${intensity * 2})`;
                break;
            case 'contrast':
                ctx.filter = `contrast(${intensity * 2})`;
                break;
        }
    }

    // Navigation Methods
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
        switch(this.currentStep) {
            case 1:
                return this.selectedDevice && document.getElementById('quadro-name').value.trim();
            case 2:
                return true; // Always can proceed from triggers step
            case 3:
                return true; // Always can proceed from preview step
            case 4:
                return true;
            default:
                return false;
        }
    }

    onStepChange() {
        switch(this.currentStep) {
            case 2:
                // Start charts and real-time data
                break;
            case 3:
                // Update preview
                this.updateLayersPanel();
                break;
            case 4:
                // Generate final summary
                this.generateFinalSummary();
                break;
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
        const saveBtn = document.getElementById('save-btn');

        prevBtn.disabled = this.currentStep === 1;
        nextBtn.disabled = !this.canProceedToNextStep();

        if (this.currentStep === this.totalSteps) {
            nextBtn.style.display = 'none';
            saveBtn.style.display = 'block';
        } else {
            nextBtn.style.display = 'block';
            saveBtn.style.display = 'none';
        }
    }

    generateFinalSummary() {
        const summaryContainer = document.getElementById('final-summary');
        if (!summaryContainer) return;

        const summaryHTML = `
            <div class="summary-item">
                <h4>📱 Dispositivo</h4>
                <p>${this.selectedDevice || 'Nessuno selezionato'}</p>
            </div>
            <div class="summary-item">
                <h4>🎯 Trigger Configurati</h4>
                <p>${this.triggers.length} trigger attivi</p>
            </div>
            <div class="summary-item">
                <h4>📚 Layer Creati</h4>
                <p>${this.layers.length} layer nel quadro</p>
            </div>
            <div class="summary-item">
                <h4>⚙️ Configurazione</h4>
                <p>Sistema pronto per l'attivazione</p>
            </div>
        `;

        summaryContainer.innerHTML = summaryHTML;
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

    // Modal Management
    closeAllModals() {
        document.querySelectorAll('.modal').forEach(modal => {
            modal.style.display = 'none';
        });
    }

    // Public Methods for Global Access
    selectDevice(deviceId) {
        this.selectedDevice = deviceId;
        document.querySelectorAll('.device-card').forEach(card => {
            card.classList.remove('selected');
        });
        event.target.closest('.device-card').classList.add('selected');
        this.updateUI();
    }

    addTrigger() {
        this.currentEditingTrigger = null;
        this.openTriggerModal();
    }

    editTrigger(triggerId) {
        this.currentEditingTrigger = this.triggers.find(t => t.id === triggerId);
        this.openTriggerModal();
    }

    openTriggerModal() {
        document.getElementById('trigger-modal').style.display = 'block';
        this.populateTriggerModal();
    }

    closeTriggerModal() {
        document.getElementById('trigger-modal').style.display = 'none';
        this.currentEditingTrigger = null;
    }

    populateTriggerModal() {
        if (this.currentEditingTrigger) {
            // Populate with existing trigger data
            const trigger = this.currentEditingTrigger;
            document.getElementById('trigger-sensor').value = trigger.sensor;
            document.getElementById('trigger-condition').value = trigger.condition;
            document.getElementById('trigger-min').value = trigger.minValue;
            document.getElementById('trigger-max').value = trigger.maxValue;
            document.getElementById('trigger-duration').value = trigger.duration || 0;
        } else {
            // Reset form for new trigger
            document.getElementById('trigger-sensor').value = 'temperature';
            document.getElementById('trigger-condition').value = 'range';
            document.getElementById('trigger-min').value = '';
            document.getElementById('trigger-max').value = '';
            document.getElementById('trigger-duration').value = 0;
        }
        
        this.selectActionType('image'); // Default action type
    }

    selectActionType(type) {
        document.querySelectorAll('.action-type-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-type="${type}"]`).classList.add('active');
        
        this.populateActionConfig(type);
    }

    populateActionConfig(type) {
        const configContent = document.getElementById('action-config-content');
        
        switch(type) {
            case 'image':
                configContent.innerHTML = this.getImageConfigHTML();
                break;
            case 'background':
                configContent.innerHTML = this.getBackgroundConfigHTML();
                break;
            case 'shape':
                configContent.innerHTML = this.getShapeConfigHTML();
                break;
            case 'text':
                configContent.innerHTML = this.getTextConfigHTML();
                break;
            case 'effect':
                configContent.innerHTML = this.getEffectConfigHTML();
                break;
        }
    }

    getImageConfigHTML() {
        return `
            <div class="form-row">
                <div class="form-group">
                    <label>Immagine:</label>
                    <select id="action-image">
                        ${this.assets.images.map(img => 
                            `<option value="${img.id}">${img.name}</option>`
                        ).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label>Dimensione:</label>
                    <input type="number" id="action-size" min="10" max="200" value="50">
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Quantità:</label>
                    <input type="number" id="action-quantity" min="1" max="50" value="1">
                </div>
                <div class="form-group">
                    <label>Posizione:</label>
                    <select id="action-position">
                        <option value="center">Centro</option>
                        <option value="top">Alto</option>
                        <option value="bottom">Basso</option>
                        <option value="left">Sinistra</option>
                        <option value="right">Destra</option>
                        <option value="random">Casuale</option>
                    </select>
                </div>
            </div>
            <div class="form-group">
                <label>
                    <input type="checkbox" id="action-movement"> Movimento (come foglie che cadono)
                </label>
            </div>
        `;
    }

    getBackgroundConfigHTML() {
        return `
            <div class="form-row">
                <div class="form-group">
                    <label>Sfondo:</label>
                    <select id="action-background">
                        ${this.assets.backgrounds.map(bg => 
                            `<option value="${bg.id}">${bg.name}</option>`
                        ).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label>Modalità:</label>
                    <select id="action-bg-mode">
                        <option value="replace">Sostituisci</option>
                        <option value="overlay">Sovrapponi</option>
                        <option value="blend">Miscela</option>
                    </select>
                </div>
            </div>
        `;
    }

    getShapeConfigHTML() {
        return `
            <div class="form-row">
                <div class="form-group">
                    <label>Forma:</label>
                    <select id="action-shape">
                        ${this.assets.shapes.map(shape => 
                            `<option value="${shape.id}">${shape.name}</option>`
                        ).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label>Colore:</label>
                    <input type="color" id="action-color" value="#FF6B6B">
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Dimensione:</label>
                    <input type="number" id="action-shape-size" min="10" max="200" value="30">
                </div>
                <div class="form-group">
                    <label>Posizione:</label>
                    <select id="action-shape-position">
                        <option value="center">Centro</option>
                        <option value="top">Alto</option>
                        <option value="bottom">Basso</option>
                        <option value="left">Sinistra</option>
                        <option value="right">Destra</option>
                        <option value="random">Casuale</option>
                    </select>
                </div>
            </div>
        `;
    }

    getTextConfigHTML() {
        return `
            <div class="form-row">
                <div class="form-group">
                    <label>Testo:</label>
                    <input type="text" id="action-text" placeholder="Inserisci il testo...">
                </div>
                <div class="form-group">
                    <label>Font Size:</label>
                    <input type="number" id="action-font-size" min="10" max="100" value="20">
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Colore:</label>
                    <input type="color" id="action-text-color" value="#333333">
                </div>
                <div class="form-group">
                    <label>Posizione:</label>
                    <select id="action-text-position">
                        <option value="center">Centro</option>
                        <option value="top">Alto</option>
                        <option value="bottom">Basso</option>
                    </select>
                </div>
            </div>
        `;
    }

    getEffectConfigHTML() {
        return `
            <div class="form-row">
                <div class="form-group">
                    <label>Effetto:</label>
                    <select id="action-effect">
                        <option value="blur">Sfocatura</option>
                        <option value="brightness">Luminosità</option>
                        <option value="contrast">Contrasto</option>
                        <option value="particle">Sistema Particelle</option>
                        <option value="glitch">Effetto Glitch</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Intensità:</label>
                    <input type="range" id="action-intensity" min="0" max="1" step="0.1" value="0.5">
                </div>
            </div>
        `;
    }

    saveTrigger() {
        const triggerData = this.collectTriggerData();
        
        if (this.currentEditingTrigger) {
            // Update existing trigger
            Object.assign(this.currentEditingTrigger, triggerData);
        } else {
            // Add new trigger
            triggerData.id = `trigger_${Date.now()}`;
            this.triggers.push(triggerData);
        }
        
        this.updateTriggersDisplay();
        this.closeTriggerModal();
    }

    collectTriggerData() {
        const sensor = document.getElementById('trigger-sensor').value;
        const condition = document.getElementById('trigger-condition').value;
        const minValue = parseFloat(document.getElementById('trigger-min').value) || 0;
        const maxValue = parseFloat(document.getElementById('trigger-max').value) || 100;
        const duration = parseFloat(document.getElementById('trigger-duration').value) || 0;
        
        const actionType = document.querySelector('.action-type-btn.active').dataset.type;
        
        // Collect action-specific configuration
        const config = this.collectActionConfig(actionType);
        
        // Collect animation settings
        const animation = {
            type: document.getElementById('animation-type').value,
            easing: document.getElementById('animation-easing').value,
            duration: parseFloat(document.getElementById('animation-duration').value) || 1,
            loop: document.getElementById('animation-loop').value,
            count: parseInt(document.getElementById('animation-count').value) || 1
        };
        
        return {
            sensor,
            condition,
            minValue,
            maxValue,
            duration,
            actionType,
            config,
            animation
        };
    }

    collectActionConfig(actionType) {
        const config = {};
        
        switch(actionType) {
            case 'image':
                config.asset = this.assets.images.find(img => img.id === document.getElementById('action-image').value);
                config.size = parseInt(document.getElementById('action-size').value);
                config.quantity = parseInt(document.getElementById('action-quantity').value);
                config.position = document.getElementById('action-position').value;
                config.movement = document.getElementById('action-movement').checked;
                break;
                
            case 'background':
                config.background = this.assets.backgrounds.find(bg => bg.id === document.getElementById('action-background').value);
                config.mode = document.getElementById('action-bg-mode').value;
                break;
                
            case 'shape':
                config.shape = this.assets.shapes.find(shape => shape.id === document.getElementById('action-shape').value);
                config.color = document.getElementById('action-color').value;
                config.size = parseInt(document.getElementById('action-shape-size').value);
                config.position = document.getElementById('action-shape-position').value;
                break;
                
            case 'text':
                config.text = document.getElementById('action-text').value;
                config.fontSize = parseInt(document.getElementById('action-font-size').value);
                config.color = document.getElementById('action-text-color').value;
                config.position = document.getElementById('action-text-position').value;
                break;
                
            case 'effect':
                config.effect = { type: document.getElementById('action-effect').value };
                config.intensity = parseFloat(document.getElementById('action-intensity').value);
                break;
        }
        
        return config;
    }

    updateTriggersDisplay() {
        const triggersList = document.getElementById('triggers-list');
        if (!triggersList) return;

        triggersList.innerHTML = '';

        this.triggers.forEach(trigger => {
            const triggerElement = document.createElement('div');
            triggerElement.className = 'trigger-item';
            triggerElement.innerHTML = `
                <div class="trigger-header">
                    <div class="trigger-title">
                        ${this.getTriggerDisplayName(trigger)}
                    </div>
                    <div class="trigger-actions">
                        <button class="btn btn-sm btn-secondary" onclick="quadroCreator.editTrigger('${trigger.id}')">
                            ✏️ Modifica
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="quadroCreator.deleteTrigger('${trigger.id}')">
                            🗑️
                        </button>
                    </div>
                </div>
                <div class="trigger-summary">
                    ${this.getTriggerSummary(trigger)}
                </div>
                <div class="trigger-preview">
                    Anteprima azione: ${trigger.actionType}
                </div>
            `;
            triggersList.appendChild(triggerElement);
        });
    }

    getTriggerDisplayName(trigger) {
        const sensorNames = {
            'temperature': '🌡️ Temperatura',
            'humidity': '💧 Umidità',
            'light': '💡 Luce',
            'audio': '🔊 Audio'
        };
        return sensorNames[trigger.sensor] || trigger.sensor;
    }

    getTriggerSummary(trigger) {
        let summary = `${trigger.condition} `;
        if (trigger.condition === 'range') {
            summary += `${trigger.minValue} - ${trigger.maxValue}`;
        } else if (trigger.condition === 'above') {
            summary += `> ${trigger.minValue}`;
        } else if (trigger.condition === 'below') {
            summary += `< ${trigger.maxValue}`;
        }
        
        if (trigger.duration > 0) {
            summary += ` per ${trigger.duration}s`;
        }
        
        return summary;
    }

    deleteTrigger(triggerId) {
        this.triggers = this.triggers.filter(t => t.id !== triggerId);
        this.updateTriggersDisplay();
    }

    pausePreview() {
        this.isPreviewPlaying = !this.isPreviewPlaying;
        const btn = event.target;
        btn.textContent = this.isPreviewPlaying ? '⏸️ Pausa' : '▶️ Play';
    }

    resetPreview() {
        this.layers = [];
        this.updateLayersPanel();
    }

    testAllTriggers() {
        this.triggers.forEach(trigger => {
            this.executeTrigger(trigger);
        });
    }

    async saveQuadro() {
        this.quadroName = document.getElementById('quadro-name').value.trim();
        
        if (!this.quadroName) {
            alert('Inserisci un nome per il quadro');
            return;
        }

        if (!this.selectedDevice) {
            alert('Seleziona un dispositivo');
            return;
        }

        const loadingOverlay = document.getElementById('loading-overlay');
        loadingOverlay.style.display = 'flex';

        try {
            const quadroConfig = {
                name: this.quadroName,
                device_id: this.selectedDevice,
                triggers: this.triggers,
                layers: this.layers,
                settings: {
                    auto_start: document.getElementById('auto-start').checked,
                    public_share: document.getElementById('public-share').checked
                }
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
            loadingOverlay.style.display = 'none';
        }
    }
}

// Initialize the creator when the DOM is ready
let quadroCreator;

document.addEventListener('DOMContentLoaded', function() {
    quadroCreator = new AdvancedQuadroCreator();
});

// Global functions for HTML event handlers
function selectDevice(deviceId) {
    quadroCreator.selectDevice(deviceId);
}

function nextStep() {
    quadroCreator.nextStep();
}

function previousStep() {
    quadroCreator.previousStep();
}

function addTrigger() {
    quadroCreator.addTrigger();
}

function closeTriggerModal() {
    quadroCreator.closeTriggerModal();
}

function selectActionType(type) {
    quadroCreator.selectActionType(type);
}

function saveTrigger() {
    quadroCreator.saveTrigger();
}

function closeAssetModal() {
    document.getElementById('asset-modal').style.display = 'none';
}

function pausePreview() {
    quadroCreator.pausePreview();
}

function resetPreview() {
    quadroCreator.resetPreview();
}

function testAllTriggers() {
    quadroCreator.testAllTriggers();
}

function saveQuadro() {
    quadroCreator.saveQuadro();
}

// ============================================================================
// ADVANCED FEATURES EXTENSION
// ============================================================================

// Add these methods to the AdvancedQuadroCreator class
AdvancedQuadroCreator.prototype.initializeAdvancedFeatures = function() {
    this.audioContext = null;
    this.audioAnalyser = null;
    this.audioData = null;
    this.sequencer = new AnimationSequencer();
    this.shaderEffects = new ShaderEffects();
    this.triggerTimers = new Map();
    
    this.setupAudioAnalysis();
    this.setupWebGL();
};

// Audio Analysis for FFT/Spectrum
AdvancedQuadroCreator.prototype.setupAudioAnalysis = function() {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices.getUserMedia({ audio: true, video: false })
            .then(stream => {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
                this.audioAnalyser = this.audioContext.createAnalyser();
                const source = this.audioContext.createMediaStreamSource(stream);
                
                source.connect(this.audioAnalyser);
                this.audioAnalyser.fftSize = 256;
                this.audioData = new Uint8Array(this.audioAnalyser.frequencyBinCount);
                
                console.log('Audio analysis initialized');
            })
            .catch(err => {
                console.log('Audio access denied:', err);
            });
    }
};

// WebGL Shader Effects
AdvancedQuadroCreator.prototype.setupWebGL = function() {
    try {
        const canvas = document.createElement('canvas');
        this.webglCtx = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        if (this.webglCtx) {
            console.log('WebGL initialized for shader effects');
        }
    } catch (e) {
        console.log('WebGL not supported');
    }
};

// Enhanced Trigger Evaluation with Timers
AdvancedQuadroCreator.prototype.evaluateTriggerAdvanced = function(trigger) {
    const sensorValue = this.sensorData[trigger.sensor];
    const conditionMet = this.evaluateBasicCondition(trigger, sensorValue);
    
    if (trigger.duration > 0) {
        const triggerId = trigger.id;
        const now = Date.now();
        
        if (conditionMet) {
            if (!this.triggerTimers.has(triggerId)) {
                this.triggerTimers.set(triggerId, now);
                return false; // Not ready yet
            } else {
                const elapsed = (now - this.triggerTimers.get(triggerId)) / 1000;
                return elapsed >= trigger.duration;
            }
        } else {
            this.triggerTimers.delete(triggerId);
            return false;
        }
    }
    
    return conditionMet;
};

AdvancedQuadroCreator.prototype.evaluateBasicCondition = function(trigger, sensorValue) {
    switch(trigger.condition) {
        case 'range':
            return sensorValue >= trigger.minValue && sensorValue <= trigger.maxValue;
        case 'above':
            return sensorValue > trigger.minValue;
        case 'below':
            return sensorValue < trigger.maxValue;
        case 'equals':
            return Math.abs(sensorValue - trigger.minValue) < 0.1;
        default:
            return false;
    }
};

// Audio-Reactive Animations
AdvancedQuadroCreator.prototype.updateAudioReactiveElements = function() {
    if (!this.audioAnalyser || !this.audioData) return;
    
    this.audioAnalyser.getByteFrequencyData(this.audioData);
    
    // Calculate audio features
    const bass = this.getAverageFrequency(0, 4);
    const mid = this.getAverageFrequency(4, 16);
    const treble = this.getAverageFrequency(16, 32);
    const volume = this.getAverageFrequency(0, 32);
    
    // Update audio-reactive layers
    this.layers.forEach(layer => {
        if (layer.audioReactive) {
            this.applyAudioReactivity(layer, { bass, mid, treble, volume });
        }
    });
};

AdvancedQuadroCreator.prototype.getAverageFrequency = function(start, end) {
    let sum = 0;
    for (let i = start; i < end && i < this.audioData.length; i++) {
        sum += this.audioData[i];
    }
    return sum / (end - start);
};

AdvancedQuadroCreator.prototype.applyAudioReactivity = function(layer, audioFeatures) {
    const sensitivity = layer.audioSensitivity || 1;
    
    switch(layer.audioReactiveType) {
        case 'scale':
            layer.currentScale = 1 + (audioFeatures.volume / 255) * sensitivity;
            break;
        case 'rotation':
            layer.currentRotation = (layer.currentRotation || 0) + (audioFeatures.bass / 255) * sensitivity;
            break;
        case 'color':
            layer.currentHue = (audioFeatures.mid / 255) * 360;
            break;
        case 'movement':
            layer.audioOffset = {
                x: (audioFeatures.treble / 255) * 50 * sensitivity,
                y: (audioFeatures.bass / 255) * 50 * sensitivity
            };
            break;
    }
};

// Dynamic Text System
AdvancedQuadroCreator.prototype.updateDynamicText = function(layer) {
    if (!layer.dynamicText) return layer.text;
    
    let dynamicText = layer.dynamicText.template;
    
    // Replace sensor placeholders
    dynamicText = dynamicText.replace(/\{temp\}/g, this.sensorData.temperature.toFixed(1));
    dynamicText = dynamicText.replace(/\{humidity\}/g, this.sensorData.humidity.toFixed(1));
    dynamicText = dynamicText.replace(/\{light\}/g, this.sensorData.light.toString());
    dynamicText = dynamicText.replace(/\{audio\}/g, this.sensorData.audio.toString());
    
    // Replace time placeholders
    const now = new Date();
    dynamicText = dynamicText.replace(/\{time\}/g, now.toLocaleTimeString());
    dynamicText = dynamicText.replace(/\{date\}/g, now.toLocaleDateString());
    
    // Replace computed values
    if (dynamicText.includes('{status}')) {
        const status = this.computeEnvironmentStatus();
        dynamicText = dynamicText.replace(/\{status\}/g, status);
    }
    
    return dynamicText;
};

AdvancedQuadroCreator.prototype.computeEnvironmentStatus = function() {
    const temp = this.sensorData.temperature;
    const humidity = this.sensorData.humidity;
    
    if (temp > 30 && humidity > 70) return 'Caldo e Umido';
    if (temp < 10) return 'Freddo';
    if (humidity > 80) return 'Molto Umido';
    if (this.sensorData.light < 500) return 'Buio';
    return 'Ottimale';
};

// Animation Sequencer Class
class AnimationSequencer {
    constructor() {
        this.sequences = new Map();
        this.activeSequences = new Map();
    }
    
    createSequence(layerId, keyframes) {
        this.sequences.set(layerId, {
            keyframes,
            duration: this.calculateTotalDuration(keyframes)
        });
    }
    
    calculateTotalDuration(keyframes) {
        return keyframes.reduce((total, kf) => total + (kf.duration || 1), 0);
    }
    
    startSequence(layerId) {
        if (this.sequences.has(layerId)) {
            this.activeSequences.set(layerId, {
                startTime: Date.now(),
                currentKeyframe: 0
            });
        }
    }
    
    updateSequence(layerId, layer) {
        if (!this.activeSequences.has(layerId)) return;
        
        const sequence = this.sequences.get(layerId);
        const activeSeq = this.activeSequences.get(layerId);
        const elapsed = (Date.now() - activeSeq.startTime) / 1000;
        
        const result = this.interpolateKeyframes(sequence.keyframes, elapsed);
        
        // Apply interpolated values to layer
        Object.assign(layer, result);
        
        // Check if sequence is complete
        if (elapsed >= sequence.duration) {
            if (layer.sequenceLoop) {
                this.startSequence(layerId); // Restart
            } else {
                this.activeSequences.delete(layerId);
            }
        }
    }
    
    interpolateKeyframes(keyframes, elapsed) {
        let currentTime = 0;
        
        for (let i = 0; i < keyframes.length - 1; i++) {
            const current = keyframes[i];
            const next = keyframes[i + 1];
            const duration = next.time - current.time;
            
            if (elapsed >= currentTime && elapsed <= currentTime + duration) {
                const progress = (elapsed - currentTime) / duration;
                return this.interpolateProperties(current, next, progress);
            }
            
            currentTime += duration;
        }
        
        return keyframes[keyframes.length - 1];
    }
    
    interpolateProperties(from, to, progress) {
        const result = {};
        
        ['x', 'y', 'scale', 'rotation', 'opacity'].forEach(prop => {
            if (from[prop] !== undefined && to[prop] !== undefined) {
                result[prop] = from[prop] + (to[prop] - from[prop]) * progress;
            }
        });
        
        return result;
    }
}

// Shader Effects Class
class ShaderEffects {
    constructor() {
        this.effects = {
            glitch: this.createGlitchEffect,
            blur: this.createBlurEffect,
            distortion: this.createDistortionEffect,
            chromaticAberration: this.createChromaticAberrationEffect
        };
    }
    
    applyEffect(ctx, effectName, intensity, canvas) {
        if (this.effects[effectName]) {
            return this.effects[effectName](ctx, intensity, canvas);
        }
    }
    
    createGlitchEffect(ctx, intensity, canvas) {
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        
        // Apply glitch effect
        for (let i = 0; i < data.length; i += 4) {
            if (Math.random() < intensity * 0.01) {
                // Red channel shift
                data[i] = data[i + Math.floor(Math.random() * 100) * 4] || data[i];
                // Green channel shift
                data[i + 1] = data[i + 1 + Math.floor(Math.random() * 100) * 4] || data[i + 1];
            }
        }
        
        ctx.putImageData(imageData, 0, 0);
    }
    
    createBlurEffect(ctx, intensity, canvas) {
        ctx.filter = `blur(${intensity * 10}px)`;
    }
    
    createDistortionEffect(ctx, intensity, canvas) {
        // Implement wave distortion using mathematical transformation
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const newImageData = ctx.createImageData(canvas.width, canvas.height);
        
        for (let y = 0; y < canvas.height; y++) {
            for (let x = 0; x < canvas.width; x++) {
                const wave = Math.sin(y * 0.01 + Date.now() * 0.001) * intensity * 10;
                const sourceX = Math.floor(x + wave);
                const sourceY = y;
                
                if (sourceX >= 0 && sourceX < canvas.width) {
                    const sourceIndex = (sourceY * canvas.width + sourceX) * 4;
                    const targetIndex = (y * canvas.width + x) * 4;
                    
                    newImageData.data[targetIndex] = imageData.data[sourceIndex];
                    newImageData.data[targetIndex + 1] = imageData.data[sourceIndex + 1];
                    newImageData.data[targetIndex + 2] = imageData.data[sourceIndex + 2];
                    newImageData.data[targetIndex + 3] = imageData.data[sourceIndex + 3];
                }
            }
        }
        
        ctx.putImageData(newImageData, 0, 0);
    }
    
    createChromaticAberrationEffect(ctx, intensity, canvas) {
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        
        const offset = intensity * 5;
        
        // Shift red and blue channels
        for (let y = 0; y < canvas.height; y++) {
            for (let x = 0; x < canvas.width; x++) {
                const index = (y * canvas.width + x) * 4;
                
                // Red channel shift
                const redX = Math.min(canvas.width - 1, x + offset);
                const redIndex = (y * canvas.width + redX) * 4;
                
                // Blue channel shift
                const blueX = Math.max(0, x - offset);
                const blueIndex = (y * canvas.width + blueX) * 4;
                
                data[index] = imageData.data[redIndex];     // Red
                data[index + 2] = imageData.data[blueIndex + 2]; // Blue
            }
        }
        
        ctx.putImageData(imageData, 0, 0);
    }
}

// Enhanced Rendering with Advanced Features
AdvancedQuadroCreator.prototype.renderLayerAdvanced = function(ctx, layer) {
    const now = Date.now();
    const elapsed = (now - layer.startTime) / 1000;

    ctx.save();

    // Update sequenced animations
    if (layer.useSequencer) {
        this.sequencer.updateSequence(layer.id, layer);
    }

    // Apply audio reactivity
    if (layer.audioReactive) {
        this.updateAudioReactiveElements();
    }

    // Apply transformations
    this.applyLayerTransformations(ctx, layer, elapsed);

    // Render based on layer type with enhanced features
    switch(layer.type) {
        case 'background':
            this.renderBackgroundAdvanced(ctx, layer);
            break;
        case 'image':
            this.renderImageAdvanced(ctx, layer);
            break;
        case 'shape':
            this.renderShapeAdvanced(ctx, layer);
            break;
        case 'text':
            this.renderTextAdvanced(ctx, layer);
            break;
        case 'effect':
            this.renderEffectAdvanced(ctx, layer);
            break;
        case 'particle':
            this.renderParticleSystem(ctx, layer, elapsed);
            break;
    }

    ctx.restore();
};

AdvancedQuadroCreator.prototype.applyLayerTransformations = function(ctx, layer, elapsed) {
    const canvas = this.previewCanvas;
    
    // Get current transformation values
    const x = layer.currentX || layer.x || 0;
    const y = layer.currentY || layer.y || 0;
    const scale = layer.currentScale || layer.scale || 1;
    const rotation = layer.currentRotation || layer.rotation || 0;
    const opacity = layer.currentOpacity !== undefined ? layer.currentOpacity : (layer.opacity !== undefined ? layer.opacity : 1);
    
    // Apply audio offset if present
    if (layer.audioOffset) {
        ctx.translate(layer.audioOffset.x, layer.audioOffset.y);
    }
    
    // Apply transformations
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.rotate(rotation);
    ctx.globalAlpha = opacity;
};

AdvancedQuadroCreator.prototype.renderTextAdvanced = function(ctx, layer) {
    const text = layer.dynamicText ? this.updateDynamicText(layer) : layer.text;
    const font = layer.font || '20px Arial';
    const color = layer.currentHue !== undefined ? 
        `hsl(${layer.currentHue}, 70%, 50%)` : (layer.color || '#333333');

    ctx.fillStyle = color;
    ctx.font = font;
    ctx.textAlign = 'center';
    ctx.fillText(text, 0, 0);
};

AdvancedQuadroCreator.prototype.renderParticleSystem = function(ctx, layer, elapsed) {
    if (!layer.particles) {
        layer.particles = this.initializeParticles(layer);
    }
    
    this.updateParticles(layer.particles, elapsed);
    this.drawParticles(ctx, layer.particles);
};

AdvancedQuadroCreator.prototype.initializeParticles = function(layer) {
    const particles = [];
    const count = layer.particleCount || 50;
    
    for (let i = 0; i < count; i++) {
        particles.push({
            x: Math.random() * this.previewCanvas.width,
            y: Math.random() * this.previewCanvas.height,
            vx: (Math.random() - 0.5) * 2,
            vy: (Math.random() - 0.5) * 2,
            life: 1,
            maxLife: 1 + Math.random() * 2,
            size: 2 + Math.random() * 4,
            color: layer.particleColor || '#ffffff'
        });
    }
    
    return particles;
};

AdvancedQuadroCreator.prototype.updateParticles = function(particles, elapsed) {
    particles.forEach(particle => {
        particle.x += particle.vx;
        particle.y += particle.vy;
        particle.life -= 0.016; // Assuming 60fps
        
        if (particle.life <= 0) {
            // Respawn particle
            particle.x = Math.random() * this.previewCanvas.width;
            particle.y = Math.random() * this.previewCanvas.height;
            particle.life = particle.maxLife;
        }
    });
};

AdvancedQuadroCreator.prototype.drawParticles = function(ctx, particles) {
    particles.forEach(particle => {
        ctx.save();
        ctx.globalAlpha = particle.life / particle.maxLife;
        ctx.fillStyle = particle.color;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size, 0, 2 * Math.PI);
        ctx.fill();
        ctx.restore();
    });
};

// Initialize advanced features when creator is ready
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(() => {
        if (quadroCreator) {
            quadroCreator.initializeAdvancedFeatures();
        }
    }, 1000);
});