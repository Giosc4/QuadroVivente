// ============================================================================
// HOME PAGE - GESTIONE QUADRI VIVENTI 
// Sistema per visualizzare, gestire ed eliminare i quadri creati
// ============================================================================

class QuadriManager {
    constructor() {
        this.quadri = [];
        this.devices = {};
        this.filteredQuadri = [];
        this.favorites = this.loadFavorites();

        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadData();
        this.setupPeriodicRefresh();
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

    async loadData() {
        try {
            console.log('Caricamento dati...');

            // Carica quadri e dispositivi in parallelo
            const [quadriResponse, devicesResponse] = await Promise.all([
                fetch('/api/quadri'),
                fetch('/api/devices')
            ]);

            if (quadriResponse.ok) {
                this.quadri = await quadriResponse.json();
                this.filteredQuadri = [...this.quadri];
                console.log('Quadri caricati:', this.quadri);
            } else {
                console.error('Errore nel caricamento quadri:', quadriResponse.status);
            }

            if (devicesResponse.ok) {
                this.devices = await devicesResponse.json();
                console.log('Dispositivi caricati:', this.devices);
            } else {
                console.error('Errore nel caricamento dispositivi:', devicesResponse.status);
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
    }

    renderQuadri() {
        const container = document.getElementById('quadri-grid');
        const emptyState = document.getElementById('empty-state');

        if (this.filteredQuadri.length === 0) {
            container.innerHTML = '';
            emptyState.style.display = 'block';
            return;
        }

        emptyState.style.display = 'none';
        container.innerHTML = this.filteredQuadri.map(quadro => this.createQuadroCard(quadro)).join('');
    }

    createQuadroCard(quadro) {
        const device = this.devices[quadro.device_id];
        const isOnline = device && device.data_count > 0;
        const isFavorite = this.favorites.includes(quadro.id);

        return `
            <div class="quadro-card ${isFavorite ? 'favorite' : ''}" data-quadro-id="${quadro.id}">
                <div class="quadro-info">
                    <div class="quadro-title">${quadro.name}</div>
                    <div class="quadro-device">
                        📱 ${device ? device.location : 'Dispositivo non trovato'}
                    </div>
                    <div class="quadro-status">
                        <span class="status-indicator ${isOnline ? 'online' : 'offline'}"></span>
                        <span class="status-text">${isOnline ? 'Online' : 'Offline'}</span>
                    </div>
                    <div class="quadro-stats">
                        <div class="quadro-stat">
                            <span class="value">${device ? device.data_count : 0}</span>
                            <span class="label">Dati Ricevuti</span>
                        </div>
                        <div class="quadro-stat">
                            <span class="value">${this.countTriggers(quadro.triggers)}</span>
                            <span class="label">Trigger Attivi</span>
                        </div>
                        <div class="quadro-stat">
                            <span class="value">${this.getTimeSince(quadro.created_at)}</span>
                            <span class="label">Creato</span>
                        </div>
                        <div class="quadro-stat">
                            <button class="favorite-btn ${isFavorite ? 'active' : ''}" onclick="toggleFavorite('${quadro.id}')">
                                ${isFavorite ? '★' : '☆'}
                            </button>
                        </div>
                    </div>
                </div>
                <div class="quadro-actions">
                    <button class="action-btn primary" onclick="viewQuadroFullscreen('${quadro.id}')">
                        🔍 Visualizza
                    </button>
                    <button class="action-btn" onclick="editQuadro('${quadro.id}')">
                        ✏️ Modifica
                    </button>
                    <button class="action-btn danger" onclick="deleteQuadro('${quadro.id}')">
                        🗑️ Elimina
                    </button>
                </div>
            </div>
        `;
    }

    countTriggers(triggers) {
        if (!triggers) return 0;
        return Object.values(triggers).reduce((total, sensorTriggers) => {
            return total + (sensorTriggers ? sensorTriggers.length : 0);
        }, 0);
    }

    renderDevices() {
        const container = document.getElementById('devices-status');
        if (!container) return;

        if (Object.keys(this.devices).length === 0) {
            container.innerHTML = '<div class="loading">Nessun dispositivo connesso</div>';
            return;
        }

        container.innerHTML = Object.entries(this.devices).map(([id, device]) => {
            const isOnline = device.data_count > 0;

            return `
                <div class="device-status-card">
                    <div class="device-header">
                        <div class="device-name">${id}</div>
                        <div class="device-status ${isOnline ? 'online' : 'offline'}">
                            ${isOnline ? '🟢 Online' : '🔴 Offline'}
                        </div>
                    </div>
                    <div class="device-location">📍 ${device.location}</div>
                    <div class="device-info">
                        <div class="device-info-item">
                            <span>📊 Dati ricevuti: ${device.data_count || 0}</span>
                        </div>
                        <div class="device-info-item">
                            <span>🎨 Quadri collegati: ${this.quadri.filter(q => q.device_id === id).length}</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    handleDeviceUpdate(data) {
        // Aggiorna lo stato dei dispositivi
        if (this.devices[data.device_id]) {
            this.devices[data.device_id].data_count = (this.devices[data.device_id].data_count || 0) + 1;
            this.devices[data.device_id].last_update = new Date().toISOString();
        }

        // Aggiorna le stats e ricarica la vista
        this.updateStats();
        this.renderQuadri();
        this.renderDevices();
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
                    // Rimuovi dai favoriti se presente
                    this.favorites = this.favorites.filter(id => id !== quadroId);
                    this.saveFavorites();
                    
                    // Rimuovi dalla lista
                    this.quadri = this.quadri.filter(q => q.id !== quadroId);
                    this.filteredQuadri = this.filteredQuadri.filter(q => q.id !== quadroId);
                    
                    this.renderQuadri();
                    this.updateStats();
                    this.closeModals();
                    
                    this.showSuccess('Quadro eliminato con successo');
                } else {
                    this.showError('Errore nell\'eliminazione del quadro');
                }
            } catch (error) {
                console.error('Errore:', error);
                this.showError('Errore di connessione');
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

    loadFavorites() {
        try {
            return JSON.parse(localStorage.getItem('quadri_favorites') || '[]');
        } catch {
            return [];
        }
    }

    saveFavorites() {
        try {
            localStorage.setItem('quadri_favorites', JSON.stringify(this.favorites));
        } catch (error) {
            console.error('Errore nel salvare i preferiti:', error);
        }
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
        if (diffDays < 30) return `${Math.floor(diffDays / 7)}s fa`;
        return `${Math.floor(diffDays / 30)}m fa`;
    }

    closeModals() {
        document.querySelectorAll('.modal').forEach(modal => {
            modal.style.display = 'none';
        });
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
        setTimeout(() => errorDiv.remove(), 5000);
    }

    showSuccess(message) {
        const successDiv = document.createElement('div');
        successDiv.className = 'success-message';
        successDiv.textContent = message;
        successDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #48bb78;
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 15px rgba(72, 187, 120, 0.3);
            z-index: 1001;
            animation: slideIn 0.3s ease-out;
        `;

        document.body.appendChild(successDiv);
        setTimeout(() => successDiv.remove(), 3000);
    }
}

// ============================================================================
// FUNZIONI GLOBALI
// ============================================================================

let quadriManager;

// Inizializzazione
document.addEventListener('DOMContentLoaded', function () {
    quadriManager = new QuadriManager();
});

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
function viewQuadroFullscreen(quadroId) {
    window.location.href = `/quadro/${quadroId}`;
}

function editQuadro(quadroId) {
    window.location.href = `/templates/create_paint.html?edit=${quadroId}`;
}

function deleteQuadro(quadroId) {
    quadriManager.deleteQuadro(quadroId);
}

function toggleFavorite(quadroId) {
    quadriManager.toggleFavorite(quadroId);
}

// Gestione modali
function closeDeviceModal() {
    document.getElementById('device-modal').style.display = 'none';
}

function closeDeleteModal() {
    document.getElementById('delete-modal').style.display = 'none';
}

function showDeviceModal() {
    document.getElementById('device-modal').style.display = 'block';
    renderDetailedDevices();
}

function renderDetailedDevices() {
    const container = document.getElementById('device-list-detailed');

    container.innerHTML = Object.entries(quadriManager.devices).map(([id, device]) => {
        const isOnline = device.data_count > 0;
        const lastUpdate = device.last_update 
            ? new Date(device.last_update).toLocaleString() 
            : 'Mai';

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

// Debug helper
window.debugHome = function() {
    console.log('=== DEBUG HOME PAGE ===');
    if (quadriManager) {
        console.log('Quadri caricati:', quadriManager.quadri.length);
        console.log('Dispositivi:', Object.keys(quadriManager.devices).length);
        console.log('Preferiti:', quadriManager.favorites);
    }
};

console.log('🏠 Home page  caricata e pronta');