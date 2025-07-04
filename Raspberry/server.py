from flask import Flask, render_template, request, jsonify
from flask_socketio import SocketIO, emit
import json
import os
from datetime import datetime, timedelta
from collections import deque
import time

app = Flask(__name__, template_folder='Templates')
app.config['SECRET_KEY'] = '272727'

socketio = SocketIO(app, cors_allowed_origins="*")

# File per il salvataggio persistente
DATA_FILE = 'device_data.json'
PAINTINGS_FILE = 'paintings.json'

# Strutture dati principali
devices = {}  # {device_id: {name, location, data, history, last_seen}}
paintings = {}  # {painting_id: {name, devices, theme, layout, created_at}}

def load_data():
    """Carica i dati persistenti da file JSON"""
    global devices, paintings
    
    # Carica dispositivi
    if os.path.exists(DATA_FILE):
        try:
            with open(DATA_FILE, 'r') as f:
                devices = json.load(f)
                # Converte le liste in deque per la gestione degli ultimi 3 minuti
                for device_id in devices:
                    if 'history' in devices[device_id]:
                        devices[device_id]['history'] = deque(
                            devices[device_id]['history'], 
                            maxlen=180  # 3 minuti * 60 secondi (assuming 1 reading per second)
                        )
        except:
            devices = {}
    
    # Carica quadri
    if os.path.exists(PAINTINGS_FILE):
        try:
            with open(PAINTINGS_FILE, 'r') as f:
                paintings = json.load(f)
        except:
            paintings = {}

def save_data():
    """Salva i dati persistenti su file JSON"""
    # Salva dispositivi (converte deque in liste per JSON)
    devices_to_save = {}
    for device_id, device in devices.items():
        devices_to_save[device_id] = device.copy()
        if 'history' in device:
            devices_to_save[device_id]['history'] = list(device['history'])
    
    with open(DATA_FILE, 'w') as f:
        json.dump(devices_to_save, f, indent=2, default=str)
    
    # Salva quadri
    with open(PAINTINGS_FILE, 'w') as f:
        json.dump(paintings, f, indent=2, default=str)

def clean_old_data():
    """Rimuove i dati più vecchi di 3 minuti"""
    cutoff_time = datetime.now() - timedelta(minutes=3)
    
    for device_id in devices:
        if 'history' in devices[device_id]:
            # La deque si gestisce automaticamente con maxlen
            # Rimuovi solo i record troppo vecchi se esistono
            history = devices[device_id]['history']
            while history and datetime.fromisoformat(history[0]['timestamp']) < cutoff_time:
                history.popleft()

# Carica i dati all'avvio
load_data()

@app.route('/')
def home():
    """Pagina principale con lista dispositivi e quadri"""
    return render_template('home.html', devices=devices, paintings=paintings)

@app.route('/create')
def create_painting():
    """Pagina per creare un nuovo quadro"""
    return render_template('create.html', devices=devices)

@app.route('/view/<item_id>')
def view_item(item_id):
    """Visualizza un quadro o un singolo dispositivo a schermo intero"""
    # Controlla se è un quadro
    if item_id in paintings:
        painting = paintings[item_id]
        return render_template('view.html', 
                             painting=painting, 
                             painting_id=item_id,
                             devices=devices,
                             is_painting=True)
    
    # Controlla se è un dispositivo singolo
    elif item_id in devices:
        device = devices[item_id]
        return render_template('view.html', 
                             device=device,
                             device_id=item_id,
                             is_painting=False)
    
    return "Elemento non trovato", 404

@app.route('/dati', methods=['POST'])
def ricevi_dati():
    """Riceve i dati dagli ESP32"""
    try:
        data = request.get_json(force=True)
        device_id = data.get("id")
        
        if not device_id:
            return {"status": "error", "message": "Device ID missing"}, 400
        
        # Inizializza il dispositivo se nuovo
        if device_id not in devices:
            devices[device_id] = {
                "name": f"ESP32-{device_id}",
                "location": "Sconosciuta",
                "data": {"h": 0.0, "t": 0.0, "l": 0, "a": 0},
                "history": deque(maxlen=180),  # 3 minuti di dati
                "last_seen": None
            }
        
        # Aggiorna i dati attuali
        current_time = datetime.now().isoformat()
        devices[device_id]["data"] = {
            "h": float(data.get("h", 0)),
            "t": float(data.get("t", 0)),
            "l": int(data.get("l", 0)),
            "a": int(data.get("a", 0))
        }
        devices[device_id]["last_seen"] = current_time
        
        # Aggiungi alla cronologia
        history_entry = devices[device_id]["data"].copy()
        history_entry["timestamp"] = current_time
        devices[device_id]["history"].append(history_entry)
        
        # Pulisci dati vecchi e salva
        clean_old_data()
        save_data()
        
        # Notifica i client WebSocket
        socketio.emit('device_update', {
            'device_id': device_id,
            'data': devices[device_id]["data"],
            'timestamp': current_time
        })
        
        return {"status": "ok"}
        
    except Exception as e:
        print(f"Errore nel ricevere dati: {e}")
        return {"status": "error", "message": str(e)}, 500

@app.route('/api/paintings', methods=['POST'])
def create_painting_api():
    """API per creare un nuovo quadro"""
    try:
        data = request.get_json()
        painting_id = f"painting_{int(time.time())}"
        
        paintings[painting_id] = {
            "name": data.get("name", "Quadro Senza Nome"),
            "devices": data.get("devices", []),
            "theme": data.get("theme", "natura"),
            "layout": data.get("layout", "grid"),
            "created_at": datetime.now().isoformat()
        }
        
        save_data()
        
        return jsonify({"success": True, "painting_id": painting_id})
        
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/paintings/<painting_id>', methods=['DELETE'])
def delete_painting_api(painting_id):
    """API per eliminare un quadro"""
    try:
        if painting_id in paintings:
            del paintings[painting_id]
            save_data()
            return jsonify({"success": True})
        else:
            return jsonify({"success": False, "error": "Quadro non trovato"}), 404
            
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/devices/<device_id>/location', methods=['PUT'])
def update_device_location(device_id):
    """API per aggiornare la posizione di un dispositivo"""
    try:
        data = request.get_json()
        location = data.get("location", "")
        name = data.get("name", "")
        
        if device_id not in devices:
            return jsonify({"success": False, "error": "Dispositivo non trovato"}), 404
        
        if location:
            devices[device_id]["location"] = location
        if name:
            devices[device_id]["name"] = name
            
        save_data()
        
        return jsonify({"success": True})
        
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/devices/<device_id>/history')
def get_device_history(device_id):
    """API per ottenere la cronologia di un dispositivo"""
    if device_id not in devices:
        return jsonify({"error": "Dispositivo non trovato"}), 404
    
    history = list(devices[device_id].get("history", []))
    return jsonify({"device_id": device_id, "history": history})

@socketio.on('connect')
def handle_connect():
    """Quando un client si connette, invia i dati iniziali"""
    emit('initial_data', {
        'devices': devices,
        'paintings': paintings
    })

@socketio.on('request_device_data')
def handle_device_request(data):
    """Richiesta dati specifici di un dispositivo"""
    device_id = data.get('device_id')
    if device_id in devices:
        emit('device_data', {
            'device_id': device_id,
            'device': devices[device_id]
        })

if __name__ == '__main__':
    # Avvia il server
    print("🎨 Quadro Vivente Server in avvio...")
    print("📡 Dispositivi caricati:", len(devices))
    print("🖼️ Quadri caricati:", len(paintings))
    socketio.run(app, host='0.0.0.0', port=8000, debug=True)