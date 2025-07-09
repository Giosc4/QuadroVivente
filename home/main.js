// ============================================================================
// HOME PAGE - GESTIONE QUADRI VIVENTI
// Sistema per visualizzare, filtrare e gestire i quadri creati
// ============================================================================

class QuadriManager {
    constructor() {
        this.socket = null;
        this.quadri = [];
        this.devices = {};
        this.filteredQuadri = [];
        this.currentFilter = 'all';
        this.currentView = 'grid';
        this.currentPreview = null;
        this.updateCount = 0;
        this.searchTerm = '';
        this.previewCanvas = null;
        this.previewCtx = null;
        this.animationId = null;
        this.favorites = JSON.parse(localStorage.getItem('quadri_favorites') || '[]');
        
        this.init();
    }

    init() {
        this.setupSocket();
        this.setupEventListeners();
        this.setupPreviewCanvas();
        this.loadData();
        this.startUpdateCounter();
        this.setupPeriodicRefresh();
    }

    setupSocket() {
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
        // Gestione chiusura modali
        window.addEventListener('click', (event) => {
            if (event.target.classList.contains('modal')) {
                this.closeModals();
            }
        });

        // Gestione tasti
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                this.closeModals();
            }
        });

        // Auto-save favorites
        window.addEventListener('beforeunload', () => {
            this.saveFavorites();
        });
    }

    setupPreviewCanvas() {
        this.previewCanvas = document.getElementById('preview-canvas');
        if (this.previewCanvas) {
            this.previewCtx = this.previewCanvas.getContext('2d');
        }
    }

    async loadData() {
        try {
            // Carica quadri e dispositivi in parallelo
            const [quadriResponse, devicesResponse] = await Promise.all([
                fetch('/api/quadri'),
                fetch('/api/devices')
            ]);

            if (quadriResponse.ok) {
                this.quadri = await quadriResponse.json();
            }

            if (devicesResponse.ok) {
                this.devices = await devicesResponse.json();
            }

            this.updateStats();
            this.renderQuadri();
            this.renderDevices();
            this.hideLoadingState();

        } catch (error) {
            console.error('Errore nel caricamento dei dati:', error);
            this.showError('Errore nel caricamento dei dati');
        }
    }

    hideLoadingState() {
        const loadingElement = document.querySelector('.loading-quadri');
        if (loadingElement) {
            loadingElement.style.display = 'none';
        }
    }

    updateStats() {
        const quadriCount = this.quadri.length;
        const devicesCount = Object.keys(this.devices).length;
        
        document.getElementById('quadri-count').textContent = quadriCount;
        document.getElementById('devices-count').textContent = devicesCount;
        document.getElementById('updates-count').textContent = this.updateCount;
    }

    renderQuadri() {
        this.applyFilters();
        
        const container = document.getElementById('quadri-grid');
        const emptyState = document.getElementById('empty-state');
        
        if (this.filteredQuadri.length === 0) {
            container.innerHTML = '';
            emptyState.style.display = 'block';
            return;
        }

        emptyState.style.display = 'none';
        
        container.innerHTML = this.filteredQuadri.map(quadro => this.createQuadroCard(quadro)).join('');
        
        // Aggiungi event listeners per ogni card
        this.attachQuadroEventListeners();
    }

    createQuadroCard(quadro) {
        const device = this.devices[quadro.device_id];
        const isOnline = device && device.data_count > 0;
        const isFavorite = this.favorites.includes(quadro.id);
        const lastUpdate = device ? new Date(device.last_update).toLocaleString() : 'Mai';

        return `
            <div class="quadro-card ${isFavorite ? 'favorite' : ''}" data-quadro-id="${quadro.id}">
                <div class="quadro-preview">
                    <canvas width="350" height="200" id="canvas-${quadro.id}"></canvas>
                    <div class="status-indicator ${isOnline ? 'online' : 'offline'}"></div>
                </div>
                <div class="quadro-info">
                    <div class="quadro-title">${quadro.name}</div>
                    <div class="quadro-device">
                        📱 ${device ? device.location : 'Dispositivo non trovato'}
                    </div>
                    <div class="quadro-stats">
                        <div class="quadro-stat">
                            <span class="value">${device ? device.data_count : 0}</span>
                            <span class="label">Dati</span>
                        </div>
                        <div class="quadro-stat">
                            <span class="value">${quadro.animation_count || 0}</span>
                            <span class="label">Animazioni</span>
                        </div>
                        <div class="quadro-stat">
                            <span class="value">${isOnline ? 'Online' : 'Offline'}</span>
                            <span class="label">Stato</span>
                        </div>
                        <div class="quadro-stat">
                            <span class="value">${this.getTimeSince(quadro.created_at)}</span>
                            <span class="label">Creato</span>
                        </div>
                    </div>
                </div>
                <div class="quadro-actions">
                    <button class="action-btn primary" onclick="viewQuadroFullscreen('${quadro.id}')">
                        🔍 Visualizza
                    </button>
                    <button class="action-btn" onclick="previewQuadro('${quadro.id}')">
                        👁️ Anteprima
                    </button>
                    <button class="action-btn favorite ${isFavorite ? 'active' : ''}" onclick="toggleFavorite('${quadro.id}')">
                        ${isFavorite ? '★' : '☆'}
                    </button>
                    <button class="action-btn danger" onclick="deleteQuadro('${quadro.id}')">
                        🗑️
                    </button>
                </div>
            </div>
        `;
    }

    attachQuadroEventListeners() {
        // Aggiungi listener per il click sulle card
        document.querySelectorAll('.quadro-card').forEach(card => {
            card.addEventListener('click', (e) => {
                if (!e.target.classList.contains('action-btn')) {
                    const quadroId = card.dataset.quadroId;
                    this.previewQuadro(quadroId);
                }
            });
        });

        // Inizializza i canvas per ogni quadro
        this.filteredQuadri.forEach(quadro => {
            this.initializeQuadroCanvas(quadro);
        });
    }

    initializeQuadroCanvas(quadro) {
        const canvas = document.getElementById(`canvas-${quadro.id}`);
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        this.drawQuadroPreview(ctx, quadro);
    }

    drawQuadroPreview(ctx, quadro) {
        const device = this.devices[quadro.device_id];
        
        // Pulisci il canvas
        ctx.clearRect(0, 0, 350, 200);
        
        // Sfondo
        ctx.fillStyle = '#001122';
        ctx.fillRect(0, 0, 350, 200);
        
        if (device && device.data_count > 0) {
            // Simula l'anteprima del quadro con dati reali
            this.drawQuadroContent(ctx, quadro, device);
        } else {
            // Mostra stato offline
            ctx.fillStyle = '#666666';
            ctx.font = '16px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('Dispositivo Offline', 175, 100);
        }
    }

    drawQuadroContent(ctx, quadro, device) {
        // Esempio di rendering basato sul template del quadro
        const template = quadro.template || 'naturale';
        
        switch(template) {
            case 'naturale':
                this.drawNaturalPreview(ctx, device);
                break;
            case 'geometrico':
                this.drawGeometricPreview(ctx, device);
                break;
            case 'minimalista':
                this.drawMinimalistPreview(ctx, device);
                break;
            case 'acquatico':
                this.drawAquaticPreview(ctx, device);
                break;
            default:
                this.drawDefaultPreview(ctx, device);
        }
    }

    drawNaturalPreview(ctx, device) {
        // Cielo sfumato
        const gradient = ctx.createLinearGradient(0, 0, 0, 120);
        gradient.addColorStop(0, '#87CEEB');
        gradient.addColorStop(1, '#98FB98');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 350, 120);
        
        // Montagne
        ctx.fillStyle = '#8B4513';
        ctx.beginPath();
        ctx.moveTo(0, 120);
        ctx.lineTo(80, 80);
        ctx.lineTo(160, 100);
        ctx.lineTo(240, 70);
        ctx.lineTo(320, 90);
        ctx.lineTo(350, 85);
        ctx.lineTo(350, 120);
        ctx.closePath();
        ctx.fill();
        
        // Terra
        ctx.fillStyle = '#228B22';
        ctx.fillRect(0, 120, 350, 80);
        
        // Sole/Luna basato sulla luce
        const lightLevel = device.data_count > 0 ? 0.7 : 0.3;
        ctx.fillStyle = lightLevel > 0.5 ? '#FFD700' : '#F0F0F0';
        ctx.beginPath();
        ctx.arc(300, 30, 15, 0, 2 * Math.PI);
        ctx.fill();
    }

    drawGeometricPreview(ctx, device) {
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(0, 0, 350, 200);
        
        // Forme geometriche colorate
        const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FECA57'];
        
        for (let i = 0; i < 5; i++) {
            ctx.fillStyle = colors[i];
            const x = 50 + i * 50;
            const y = 70;
            const size = 30 + Math.sin(Date.now() * 0.001 + i) * 5;
            
            if (i % 2 === 0) {
                ctx.fillRect(x - size/2, y - size/2, size, size);
            } else {
                ctx.beginPath();
                ctx.arc(x, y, size/2, 0, 2 * Math.PI);
                ctx.fill();
            }
        }
    }

    drawMinimalistPreview(ctx, device) {
        ctx.fillStyle = '#f5f5f5';
        ctx.fillRect(0, 0, 350, 200);
        
        // Linee minimaliste
        ctx.strokeStyle = '#333333';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(175, 0);
        ctx.lineTo(175, 200);
        ctx.stroke();
        
        ctx.beginPath();
        ctx.moveTo(0, 100);
        ctx.lineTo(350, 100);
        ctx.stroke();
        
        // Elemento centrale
        ctx.fillStyle = '#667eea';
        ctx.beginPath();
        ctx.arc(175, 100, 20, 0, 2 * Math.PI);
        ctx.fill();
    }

    drawAquaticPreview(ctx, device) {
        // Acqua sfumata
        const gradient = ctx.createLinearGradient(0, 0, 0, 200);
        gradient.addColorStop(0, '#87CEEB');
        gradient.addColorStop(1, '#000080');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 350, 200);
        
        // Onde
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.3;
        
        for (let i = 0; i < 2; i++) {
            ctx.beginPath();
            for (let x = 0; x < 350; x++) {
                const y = 80 + i * 40 + Math.sin(x * 0.02 + Date.now() * 0.001) * 10;
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
        for (let i = 0; i < 5; i++) {
            const x = 50 + i * 60;
            const y = 150 + Math.sin(Date.now() * 0.002 + i) * 20;
            ctx.beginPath();
            ctx.arc(x, y, 5, 0, 2 * Math.PI);
            ctx.fill();
        }
    }

    drawDefaultPreview(ctx, device) {
        ctx.fillStyle = '#2a2a2a';
        ctx.fillRect(0, 0, 350, 200);
        
        ctx.fillStyle = '#ffffff';
        ctx.font = '16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Quadro Personalizzato', 175, 100);
    }

    renderDevices() {
        const container = document.getElementById('devices-status');
        
        if (Object.keys(this.devices).length === 0) {
            container.innerHTML = '<div class="loading">Nessun dispositivo connesso</div>';
            return;
        }

        container.innerHTML = Object.entries(this.devices).map(([id, device]) => {
            const isOnline = device.data_count > 0;
            const lastUpdate = device.last_update ? new Date(device.last_update).toLocaleString() : 'Mai';
            
            return `
                <div class="device-status-card">
                    <div class="device-header">
                        <div class="device-name">${id}</div>
                        <div class="device-status ${isOnline ? 'online' : 'offline'}">
                            ${isOnline ? '🟢 Online' : '🔴 Offline'}
                        </div>
                    </div>
                    <div class="device-location">📍 ${device.location}</div>
                    <div class="device-sensors">
                        <div class="sensor-reading">
                            <span class="sensor-icon">🌡️</span>
                            <span class="sensor-value">-- °C</span>
                        </div>
                        <div class="sensor-reading">
                            <span class="sensor-icon">💧</span>
                            <span class="sensor-value">-- %</span>
                        </div>
                        <div class="sensor-reading">
                            <span class="sensor-icon">💡</span>
                            <span class="sensor-value">--</span>
                        </div>
                        <div class="sensor-reading">
                            <span class="sensor-icon">🔊</span>
                            <span class="sensor-value">--</span>
                        </div>
                    </div>
                    <div style="margin-top: 10px; font-size: 0.8em; color: #718096;">
                        Ultimo aggiornamento: ${lastUpdate}
                    </div>
                </div>
            `;
        }).join('');
    }

    handleDeviceUpdate(data) {
        this.updateCount++;
        
        // Aggiorna le letture del dispositivo nella UI
        const deviceCards = document.querySelectorAll('.device-status-card');
        deviceCards.forEach(card => {
            const deviceName = card.querySelector('.device-name').textContent;
            if (deviceName === data.device_id) {
                const sensors = card.querySelectorAll('.sensor-value');
                sensors[0].textContent = `${data.data.temperature.toFixed(1)}°C`;
                sensors[1].textContent = `${data.data.humidity.toFixed(1)}%`;
                sensors[2].textContent = data.data.light.toString();
                sensors[3].textContent = data.data.audio.toString();
            }
        });
        
        // Aggiorna l'anteprima se è aperta
        if (this.currentPreview) {
            this.updatePreviewCanvas();
        }
        
        // Aggiorna le stats
        this.updateStats();
    }

    applyFilters() {
        let filtered = [...this.quadri];

        // Filtro per ricerca
        if (this.searchTerm) {
            filtered = filtered.filter(quadro => 
                quadro.name.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
                (this.devices[quadro.device_id] && 
                 this.devices[quadro.device_id].location.toLowerCase().includes(this.searchTerm.toLowerCase()))
            );
        }

        // Filtro per categoria
        switch(this.currentFilter) {
            case 'active':
                filtered = filtered.filter(quadro => {
                    const device = this.devices[quadro.device_id];
                    return device && device.data_count > 0;
                });
                break;
            case 'recent':
                filtered = filtered.filter(quadro => {
                    const created = new Date(quadro.created_at);
                    const now = new Date();
                    const diffDays = (now - created) / (1000 * 60 * 60 * 24);
                    return diffDays <= 7;
                });
                break;
            case 'favorite':
                filtered = filtered.filter(quadro => this.favorites.includes(quadro.id));
                break;
        }

        this.filteredQuadri = filtered;
    }

    previewQuadro(quadroId) {
        const quadro = this.quadri.find(q => q.id === quadroId);
        if (!quadro) return;

        this.currentPreview = quadro;
        
        // Popola il modal
        document.getElementById('preview-title').textContent = quadro.name;
        document.getElementById('preview-device').textContent = 
            this.devices[quadro.device_id] ? this.devices[quadro.device_id].location : 'Dispositivo non trovato';
        
        // Imposta il pulsante fullscreen
        document.getElementById('view-fullscreen-btn').onclick = () => {
            this.viewQuadroFullscreen(quadroId);
        };
        
        // Aggiorna l'anteprima
        this.updatePreviewCanvas();
        
        // Mostra il modal
        document.getElementById('preview-modal').style.display = 'block';
        
        // Avvia l'animazione
        this.startPreviewAnimation();
    }

    updatePreviewCanvas() {
        if (!this.currentPreview || !this.previewCtx) return;

        const device = this.devices[this.currentPreview.device_id];
        
        this.previewCtx.clearRect(0, 0, 600, 400);
        
        // Scala il disegno per il canvas più grande
        this.previewCtx.save();
        this.previewCtx.scale(600/350, 400/200);
        this.drawQuadroContent(this.previewCtx, this.currentPreview, device);
        this.previewCtx.restore();
        
        // Aggiorna i valori dei sensori
        if (device) {
            document.getElementById('preview-temp').textContent = '20.5°C';
            document.getElementById('preview-humidity').textContent = '65%';
            document.getElementById('preview-light').textContent = '1250';
            document.getElementById('preview-audio').textContent = '850';
        }
    }

    startPreviewAnimation() {
        const animate = () => {
            if (this.currentPreview) {
                this.updatePreviewCanvas();
                this.animationId = requestAnimationFrame(animate);
            }
        };
        animate();
    }

    stopPreviewAnimation() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }

    closeModals() {
        document.querySelectorAll('.modal').forEach(modal => {
            modal.style.display = 'none';
        });
        this.currentPreview = null;
        this.stopPreviewAnimation();
    }

    viewQuadroFullscreen(quadroId) {
        window.location.href = `/quadro/${quadroId}`;
    }

    async deleteQuadro(quadroId) {
        const quadro = this.quadri.find(q => q.id === quadroId);
        if (!quadro) return;

        // Mostra modal di conferma
        document.getElementById('delete-modal').style.display = 'block';
        
        document.getElementById('confirm-delete-btn').onclick = async () => {
            try {
                const response = await fetch(`/api/quadri/${quadroId}`, {
                    method: 'DELETE'
                });

                if (response.ok) {
                    this.quadri = this.quadri.filter(q => q.id !== quadroId);
                    this.renderQuadri();
                    this.updateStats();
                    this.closeModals();
                } else {
                    alert('Errore nell\'eliminazione del quadro');
                }
            } catch (error) {
                console.error('Errore:', error);
                alert('Errore di connessione');
            }
        };
    }

    toggleFavorite(quadroId) {
        const index = this.favorites.indexOf(quadroId);
        if (index === -1) {
            this.favorites.push(quadroId);
        } else {
            this.favorites.splice(index, 1);
        }
        
        this.saveFavorites();
        this.renderQuadri();
    }

    saveFavorites() {
        localStorage.setItem('quadri_favorites', JSON.stringify(this.favorites));
    }

    startUpdateCounter() {
        setInterval(() => {
            this.updateCount = 0;
            this.updateStats();
        }, 60000); // Reset ogni minuto
    }

    setupPeriodicRefresh() {
        // Ricarica i dati ogni 30 secondi
        setInterval(() => {
            this.loadData();
        }, 30000);
    }

    getTimeSince(dateString) {
        const now = new Date();
        const date = new Date(dateString);
        const diffMs = now - date;
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        
        if (diffDays === 0) return 'Oggi';
        if (diffDays === 1) return 'Ieri';
        if (diffDays < 7) return `${diffDays}g fa`;
        if (diffDays < 30) return `${Math.floor(diffDays/7)}s fa`;
        return `${Math.floor(diffDays/30)}m fa`;
    }

    showError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.textContent = message;
        errorDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #f56565;
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 15px rgba(245, 101, 101, 0.3);
            z-index: 1001;
            animation: slideIn 0.3s ease-out;
        `;
        
        document.body.appendChild(errorDiv);
        
        setTimeout(() => {
            errorDiv.remove();
        }, 5000);
    }
}

// ============================================================================
// FUNZIONI GLOBALI
// ============================================================================

let quadriManager;

// Inizializzazione
document.addEventListener('DOMContentLoaded', function() {
    quadriManager = new QuadriManager();
});

// Filtri e ricerca
function setFilter(filter) {
    quadriManager.currentFilter = filter;
    
    // Aggiorna l'interfaccia
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`[data-filter="${filter}"]`).classList.add('active');
    
    quadriManager.renderQuadri();
}

function setView(view) {
    quadriManager.currentView = view;
    
    // Aggiorna l'interfaccia
    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`[data-view="${view}"]`).classList.add('active');
    
    // Aggiorna la griglia
    const grid = document.getElementById('quadri-grid');
    if (view === 'list') {
        grid.classList.add('list-view');
    } else {
        grid.classList.remove('list-view');
    }
}

function filterQuadri() {
    quadriManager.searchTerm = document.getElementById('search-input').value;
    quadriManager.renderQuadri();
}

// Gestione dispositivi
function toggleDevicesPanel() {
    const panel = document.getElementById('devices-panel');
    panel.classList.toggle('active');
}

function refreshDevices() {
    quadriManager.loadData();
}

function exportDevicesConfig() {
    const config = {
        devices: quadriManager.devices,
        timestamp: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = 'devices_config.json';
    a.click();
    
    URL.revokeObjectURL(url);
}

// Gestione quadri
function previewQuadro(quadroId) {
    quadriManager.previewQuadro(quadroId);
}

function viewQuadroFullscreen(quadroId) {
    quadriManager.viewQuadroFullscreen(quadroId);
}

function deleteQuadro(quadroId) {
    quadriManager.deleteQuadro(quadroId);
}

function toggleFavorite(quadroId) {
    quadriManager.toggleFavorite(quadroId);
}

function editQuadro() {
    if (quadriManager.currentPreview) {
        window.location.href = `/quadri_nuovi?edit=${quadriManager.currentPreview.id}`;
    }
}

// Gestione modali
function closePreviewModal() {
    document.getElementById('preview-modal').style.display = 'none';
    quadriManager.currentPreview = null;
    quadriManager.stopPreviewAnimation();
}

function closeDeviceModal() {
    document.getElementById('device-modal').style.display = 'none';
}

function closeDeleteModal() {
    document.getElementById('delete-modal').style.display = 'none';
}

// Funzioni di utilità
function showDeviceModal() {
    document.getElementById('device-modal').style.display = 'block';
    renderDetailedDevices();
}

function renderDetailedDevices() {
    const container = document.getElementById('device-list-detailed');
    
    container.innerHTML = Object.entries(quadriManager.devices).map(([id, device]) => {
        const isOnline = device.data_count > 0;
        const lastUpdate = device.last_update ? new Date(device.last_update).toLocaleString() : 'Mai';
        
        return `
            <div class="device-detailed-card">
                <div class="device-detailed-header">
                    <h4>${id}</h4>
                    <div class="device-status ${isOnline ? 'online' : 'offline'}">
                        ${isOnline ? '🟢 Online' : '🔴 Offline'}
                    </div>
                </div>
                <div class="device-detailed-info">
                    <div class="device-info-item">
                        <h5>Posizione</h5>
                        <p>${device.location}</p>
                    </div>
                    <div class="device-info-item">
                        <h5>Dati Ricevuti</h5>
                        <p>${device.data_count || 0} campioni</p>
                    </div>
                    <div class="device-info-item">
                        <h5>Ultimo Aggiornamento</h5>
                        <p>${lastUpdate}</p>
                    </div>
                    <div class="device-info-item">
                        <h5>Quadri Collegati</h5>
                        <p>${quadriManager.quadri.filter(q => q.device_id === id).length}</p>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// Animazioni automatiche per i canvas
setInterval(() => {
    if (quadriManager && quadriManager.filteredQuadri) {
        quadriManager.filteredQuadri.forEach(quadro => {
            const canvas = document.getElementById(`canvas-${quadro.id}`);
            if (canvas && canvas.offsetParent !== null) { // Solo se visibile
                const ctx = canvas.getContext('2d');
                quadriManager.drawQuadroPreview(ctx, quadro);
            }
        });
    }
}, 100); // Aggiorna ogni 100ms per animazioni fluide