// Connessione Socket.IO
const socket = io();

// Variabili globali
let devices = {};
let paintings = {};

// Inizializzazione quando la pagina è caricata
document.addEventListener('DOMContentLoaded', function () {
    console.log('🎨 Quadro Vivente - Interfaccia caricata');

    // Setup modal handlers
    setupModals();

    // Setup form handlers
    setupForms();

    // Richiedi dati iniziali
    socket.emit('request_initial_data');
});

// === GESTIONE SOCKET.IO ===

socket.on('connect', function () {
    console.log('✅ Connesso al server');
    updateConnectionStatus(true);
});

socket.on('disconnect', function () {
    console.log('❌ Disconnesso dal server');
    updateConnectionStatus(false);
});

socket.on('initial_data', function (data) {
    console.log('📦 Dati iniziali ricevuti:', data);
    devices = data.devices || {};
    paintings = data.paintings || {};

    updateDeviceCounters();
    updateAllDeviceStatus();
});

socket.on('device_update', function (data) {
    console.log('📊 Aggiornamento dispositivo:', data);

    const deviceId = data.device_id;
    const deviceData = data.data;
    const timestamp = data.timestamp;

    // Aggiorna i dati locali
    if (devices[deviceId]) {
        devices[deviceId].data = deviceData;
        devices[deviceId].last_seen = timestamp;
    }

    // Aggiorna l'interfaccia
    updateDeviceCard(deviceId, deviceData, timestamp);
    updateDeviceStatus(deviceId, true);
});

// === AGGIORNAMENTO INTERFACCIA ===

function updateDeviceCard(deviceId, data, timestamp) {
    // Aggiorna i valori dei sensori
    const tempElement = document.getElementById(`temp-${deviceId}`);
    const humidityElement = document.getElementById(`humidity-${deviceId}`);
    const lightElement = document.getElementById(`light-${deviceId}`);
    const audioElement = document.getElementById(`audio-${deviceId}`);
    const lastSeenElement = document.getElementById(`lastseen-${deviceId}`);

    if (tempElement) tempElement.textContent = `${data.t.toFixed(1)}°C`;
    if (humidityElement) humidityElement.textContent = `${data.h.toFixed(1)}%`;
    if (lightElement) lightElement.textContent = data.l;
    if (audioElement) audioElement.textContent = data.a;

    if (lastSeenElement && timestamp) {
        const date = new Date(timestamp);
        lastSeenElement.textContent = `🕐 ${date.toLocaleTimeString()}`;
    }

    // Effetto di aggiornamento
    const card = document.querySelector(`[data-device-id="${deviceId}"]`);
    if (card) {
        card.classList.add('updating');
        setTimeout(() => card.classList.remove('updating'), 500);
    }
}

function updateDeviceStatus(deviceId, isOnline) {
    const statusElement = document.getElementById(`status-${deviceId}`);
    if (statusElement) {
        statusElement.className = `status-indicator ${isOnline ? 'status-online' : 'status-offline'}`;
    }
}

function updateAllDeviceStatus() {
    const now = new Date();

    Object.keys(devices).forEach(deviceId => {
        const device = devices[deviceId];
        const lastSeen = device.last_seen ? new Date(device.last_seen) : null;
        const isOnline = lastSeen && (now - lastSeen) < 60000; // Online se ultimo aggiornamento < 1 minuto

        updateDeviceStatus(deviceId, isOnline);
    });
}

function updateDeviceCounters() {
    const devicesCount = document.getElementById('devices-count');
    const paintingsCount = document.getElementById('paintings-count');

    if (devicesCount) devicesCount.textContent = Object.keys(devices).length;
    if (paintingsCount) paintingsCount.textContent = Object.keys(paintings).length;
}

function updateConnectionStatus(isConnected) {
    // Aggiungi un indicatore di connessione nell'header se non esiste
    let indicator = document.getElementById('connection-indicator');
    if (!indicator) {
        indicator = document.createElement('div');
        indicator.id = 'connection-indicator';
        indicator.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 10px 15px;
            border-radius: 25px;
            font-size: 0.9em;
            font-weight: bold;
            z-index: 1000;
            transition: all 0.3s ease;
        `;
        document.body.appendChild(indicator);
    }

    if (isConnected) {
        indicator.textContent = '🟢 Connesso';
        indicator.style.background = 'rgba(76, 175, 80, 0.9)';
        indicator.style.color = 'white';
    } else {
        indicator.textContent = '🔴 Disconnesso';
        indicator.style.background = 'rgba(244, 67, 54, 0.9)';
        indicator.style.color = 'white';
    }
}

// === GESTIONE MODALI ===

function setupModals() {
    // Modal di modifica dispositivo
    const editModal = document.getElementById('editModal');
    const historyModal = document.getElementById('historyModal');

    // Chiusura modali
    document.querySelectorAll('.close').forEach(closeBtn => {
        closeBtn.onclick = function () {
            closeAllModals();
        };
    });

    // Chiusura cliccando fuori
    window.onclick = function (event) {
        if (event.target.classList.contains('modal')) {
            closeAllModals();
        }
    };
}

function closeAllModals() {
    document.querySelectorAll('.modal').forEach(modal => {
        modal.style.display = 'none';
    });
}

function closeEditModal() {
    document.getElementById('editModal').style.display = 'none';
}

function closeHistoryModal() {
    document.getElementById('historyModal').style.display = 'none';
}

// === GESTIONE FORM ===

function setupForms() {
    const editForm = document.getElementById('editForm');
    if (editForm) {
        editForm.onsubmit = function (e) {
            e.preventDefault();
            saveDeviceChanges();
        };
    }
}

function saveDeviceChanges() {
    const deviceId = document.getElementById('editDeviceId').value;
    const name = document.getElementById('editName').value;
    const location = document.getElementById('editLocation').value;

    if (!deviceId || !name || !location) {
        showNotification('Tutti i campi sono obbligatori', 'error');
        return;
    }

    // Invia aggiornamento al server
    fetch(`/api/devices/${deviceId}/location`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            name: name,
            location: location
        })
    })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // Aggiorna l'interfaccia locale
                if (devices[deviceId]) {
                    devices[deviceId].name = name;
                    devices[deviceId].location = location;
                }

                // Aggiorna elementi DOM
                const nameElement = document.getElementById(`name-${deviceId}`);
                const locationElement = document.getElementById(`location-${deviceId}`);

                if (nameElement) nameElement.textContent = name;
                if (locationElement) locationElement.textContent = `📍 ${location}`;

                showNotification('Dispositivo aggiornato con successo!', 'success');
                closeEditModal();
            } else {
                showNotification('Errore nell\'aggiornamento: ' + data.error, 'error');
            }
        })
        .catch(error => {
            console.error('Errore:', error);
            showNotification('Errore di connessione', 'error');
        });
}

// === FUNZIONI PRINCIPALI ===

function viewPainting(paintingId) {
    window.open(`/view/${paintingId}`, '_blank');
}

function viewSingleDevice(deviceId) {
    window.open(`/view/${deviceId}`, '_blank');
}

function editDevice(deviceId) {
    const device = devices[deviceId];
    if (!device) {
        showNotification('Dispositivo non trovato', 'error');
        return;
    }

    // Popola il form
    document.getElementById('editDeviceId').value = deviceId;
    document.getElementById('editName').value = device.name || `ESP32-${deviceId}`;
    document.getElementById('editLocation').value = device.location || '';

    // Mostra il modal
    document.getElementById('editModal').style.display = 'block';
}

function deletePainting(paintingId) {
    if (!confirm('Sei sicuro di voler eliminare questo quadro? Questa azione non può essere annullata.')) {
        return;
    }

    fetch(`/api/paintings/${paintingId}`, {
        method: 'DELETE'
    })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                showNotification('Quadro eliminato con successo!', 'success');

                // Rimuovi dalla lista locale
                delete paintings[paintingId];

                // Rimuovi dall'interfaccia
                const card = document.querySelector(`[data-painting-id="${paintingId}"]`);
                if (card) {
                    card.style.animation = 'fadeOut 0.5s ease-out';
                    setTimeout(() => {
                        card.remove();
                        updateDeviceCounters();

                        // Se non ci sono più quadri, mostra empty state
                        if (Object.keys(paintings).length === 0) {
                            location.reload();
                        }
                    }, 500);
                }
            } else {
                showNotification('Errore nell\'eliminazione: ' + data.error, 'error');
            }
        })
        .catch(error => {
            console.error('Errore:', error);
            showNotification('Errore di connessione', 'error');
        });
}

function showHistory(deviceId) {
    const device = devices[deviceId];
    if (!device) {
        showNotification('Dispositivo non trovato', 'error');
        return;
    }

    // Mostra il modal
    document.getElementById('historyModal').style.display = 'block';
    document.getElementById('historyContent').innerHTML = '<div class="loading">Caricamento cronologia...</div>';

    // Carica la cronologia
    fetch(`/api/devices/${deviceId}/history`)
        .then(response => response.json())
        .then(data => {
            if (data.history) {
                displayHistory(data.history, device.name);
            } else {
                throw new Error('Cronologia non disponibile');
            }
        })
        .catch(error => {
            console.error('Errore nel caricamento cronologia:', error);
            document.getElementById('historyContent').innerHTML =
                '<div class="loading">Errore nel caricamento della cronologia</div>';
        });
}

function displayHistory(history, deviceName) {
    const container = document.getElementById('historyContent');

    if (!history || history.length === 0) {
        container.innerHTML = '<div class="loading">Nessun dato storico disponibile</div>';
        return;
    }

    let html = `<h3>Cronologia - ${deviceName}</h3>`;
    html += '<div style="margin-bottom: 20px; font-size: 0.9em; opacity: 0.8;">Ultimi 3 minuti di dati</div>';

    // Raggruppa per minuto per una migliore visualizzazione
    const groupedData = groupHistoryByMinute(history);

    Object.keys(groupedData).reverse().forEach(minute => {
        const entries = groupedData[minute];
        const avgData = calculateAverage(entries);

        html += `
            <div class="history-item">
                <div class="history-time">${minute}</div>
                <div class="history-data">
                    <div class="history-value">
                        <div>🌡️</div>
                        <div>${avgData.t.toFixed(1)}°C</div>
                    </div>
                    <div class="history-value">
                        <div>💧</div>
                        <div>${avgData.h.toFixed(1)}%</div>
                    </div>
                    <div class="history-value">
                        <div>💡</div>
                        <div>${avgData.l}</div>
                    </div>
                    <div class="history-value">
                        <div>🔊</div>
                        <div>${avgData.a}</div>
                    </div>
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}

function groupHistoryByMinute(history) {
    const grouped = {};

    history.forEach(entry => {
        const date = new Date(entry.timestamp);
        const minute = date.toLocaleTimeString('it-IT', {
            hour: '2-digit',
            minute: '2-digit'
        });

        if (!grouped[minute]) {
            grouped[minute] = [];
        }
        grouped[minute].push(entry);
    });

    return grouped;
}

function calculateAverage(entries) {
    const sum = entries.reduce((acc, entry) => ({
        t: acc.t + entry.t,
        h: acc.h + entry.h,
        l: acc.l + entry.l,
        a: acc.a + entry.a
    }), { t: 0, h: 0, l: 0, a: 0 });

    const count = entries.length;
    return {
        t: sum.t / count,
        h: sum.h / count,
        l: Math.round(sum.l / count),
        a: Math.round(sum.a / count)
    };
}

function showNotification(message, type = 'info') {
    // Crea o aggiorna la notifica
    let notification = document.getElementById('notification');
    if (!notification) {
        notification = document.createElement('div');
        notification.id = 'notification';
        notification.style.cssText = `
            position: fixed;
            top: 80px;
            right: 20px;
            padding: 15px 20px;
            border-radius: 10px;
            font-weight: bold;
            z-index: 1001;
            transform: translateX(400px);
            transition: all 0.3s ease;
            max-width: 300px;
            word-wrap: break-word;
        `;
        document.body.appendChild(notification);
    }

    // Stile in base al tipo
    const colors = {
        success: 'rgba(76, 175, 80, 0.95)',
        error: 'rgba(244, 67, 54, 0.95)',
        info: 'rgba(33, 150, 243, 0.95)'
    };

    notification.style.background = colors[type] || colors.info;
    notification.style.color = 'white';
    notification.textContent = message;

    // Animazione di entrata
    setTimeout(() => {
        notification.style.transform = 'translateX(0)';
    }, 10);

    // Auto-hide dopo 4 secondi
    setTimeout(() => {
        notification.style.transform = 'translateX(400px)';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 4000);
}

// === AGGIORNAMENTO STATUS PERIODICO ===

// Controlla lo status dei dispositivi ogni 30 secondi
setInterval(updateAllDeviceStatus, 30000);

// === STILI CSS AGGIUNTIVI PER JS ===

// Aggiungi stili per le animazioni
const additionalStyles = document.createElement('style');
additionalStyles.textContent = `
    .updating {
        animation: pulse-update 0.5s ease-out;
    }
    
    @keyframes pulse-update {
        0% { transform: scale(1); }
        50% { transform: scale(1.02); }
        100% { transform: scale(1); }
    }
    
    @keyframes fadeOut {
        from { opacity: 1; transform: translateY(0); }
        to { opacity: 0; transform: translateY(-20px); }
    }
`;
document.head.appendChild(additionalStyles);