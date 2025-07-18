#!/usr/bin/env python3
import os
import json
import subprocess
import socket
import threading
import time
import uuid
from datetime import datetime, timedelta
from flask import Flask, render_template, request, jsonify, send_from_directory, redirect, send_file
from flask_socketio import SocketIO, emit
from flask_cors import CORS
from datetime import datetime, timedelta

# Soglia oltre cui considerare il device offline
ONLINE_THRESHOLD = timedelta(seconds=3)

# =========== CONFIG ==========
DATA_RETENTION_MINUTES = 3
DATA_FILE = 'device_data.json'
QUADRI_FILE = 'quadri_config.json'

global connected_devices

# =========== FLASK & SOCKETIO ==========
app = Flask(__name__, static_folder='static')
app.config['SECRET_KEY'] = 'quadriviventi_secret_key_2025'
CORS(app)
socketio = SocketIO(app, cors_allowed_origins='*')

# =========== DATA STORAGE ==========
connected_devices = {}
quadri_config = {}

# =========== LOAD & SAVE ==========
def load_json(filepath, iso_dates=False):
    if not os.path.exists(filepath):
        return {}
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            data = json.load(f)
            if iso_dates:
                for v in data.values():
                    if 'created_at' in v:
                        v['created_at'] = datetime.fromisoformat(v['created_at'])
                    if 'last_update' in v:
                        v['last_update'] = datetime.fromisoformat(v['last_update'])
                    if 'data_history' in v:
                        for e in v['data_history']:
                            e['timestamp'] = datetime.fromisoformat(e['timestamp'])
        return data
    except Exception as e:
        print(f"Errore nel caricamento di {filepath}: {e}")
        return {}

def save_json(filepath, data, iso_dates=False):
    try:
        dump = {}
        for k, v in data.items():
            copy = v.copy()
            if iso_dates:
                if 'created_at' in copy:
                    copy['created_at'] = copy['created_at'].isoformat()
                if 'last_update' in copy:
                    copy['last_update'] = copy['last_update'].isoformat()
                if 'data_history' in copy:
                    copy['data_history'] = [
                        {**e, 'timestamp': e['timestamp'].isoformat()} for e in copy['data_history']
                    ]
            dump[k] = copy
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(dump, f, indent=2, ensure_ascii=False)
    except Exception as e:
        print(f"Errore nel salvataggio di {filepath}: {e}")

# =========== DATA CLEANUP ==========
def cleanup_old_data():
    cutoff = datetime.now() - timedelta(minutes=DATA_RETENTION_MINUTES)
    for did, d in connected_devices.items():
        if 'data_history' in d:
            original_len = len(d['data_history'])
            d['data_history'] = [entry for entry in d['data_history'] if entry['timestamp'] > cutoff]
            if len(d['data_history']) < original_len:
                print(f"Cleaned {original_len - len(d['data_history'])} entries for {did}")

def periodic_cleanup():
    while True:
        cleanup_old_data()
        save_json(DATA_FILE, connected_devices, iso_dates=True)
        time.sleep(30)

# =========== AP SETUP ==========
def setup_access_point():
    if os.geteuid() != 0:
        print("Access Point setup requires root privileges.")
        return

    ap_conf = {'ssid': 'QuadroVivente_AP', 'passphrase': 'quadro2025'}

    hostapd_conf = f"""
interface=wlan0
driver=nl80211
ssid={ap_conf['ssid']}
hw_mode=g
channel=7
macaddr_acl=0
auth_algs=1
ignore_broadcast_ssid=0
wpa=2
wpa_passphrase={ap_conf['passphrase']}
wpa_key_mgmt=WPA-PSK
rsn_pairwise=CCMP
"""
    try:
        with open('/etc/hostapd/hostapd.conf', 'w') as f:
            f.write(hostapd_conf)

        subprocess.run('systemctl unmask hostapd && systemctl enable hostapd && systemctl restart hostapd', shell=True)
        print("Access Point configured.")
    except Exception as e:
        print(f"Errore nella configurazione dell'Access Point: {e}")

# =========== ROUTES ==========
@app.route('/')
def home():
    return render_template('home.html')

@app.route('/home')
def home_redirect():
    return redirect('/')

@app.route('/templates/create_paint.html')
def create_quadro():
    devices = {}
    for device_id, device_data in connected_devices.items():
        if 'data_history' in device_data and len(device_data['data_history']) > 0:
            latest_data = device_data['data_history'][-1]
            devices[device_id] = {
                'name': device_data.get('name', device_id),
                'data': {
                    't': latest_data.get('temperature', 0),
                    'h': latest_data.get('humidity', 0),
                    'l': latest_data.get('light', 0),
                    'a': latest_data.get('audio', 0)
                }
            }

    return render_template('create_paint.html', devices=devices)

@app.route('/quadro/<quadro_id>')
def view_quadro(quadro_id):
    if quadro_id not in quadri_config:
        return "Quadro non trovato", 404
    
    quadro = quadri_config[quadro_id]
    device_id = quadro.get('device_id', '')
    device_data = connected_devices.get(device_id, {})
    
    return render_template('quadro.html', 
                         quadro_id=quadro_id,
                         quadro_name=quadro.get('name', 'Quadro Vivente'),
                         device_id=device_id,
                         template=quadro.get('template', 'naturale'),
                         sensors_config=json.dumps(quadro.get('sensors_config', {})))

@app.route('/config')
def config():
    return render_template('config.html')

# =========== API ENDPOINTS ==========
@app.route('/api/data', methods=['POST'])
@app.route('/api/receive_data', methods=['POST'])
def receive_data():
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data received'}), 400

        device_id = data.get('device_id') or data.get('id')
        if not device_id:
            return jsonify({'error': 'Missing device_id'}), 400


        # se è un nuovo device, inizializza struttura
        if device_id not in connected_devices:
            connected_devices[device_id] = {
                'name': device_id,
                'location': data.get('location', f'Posizione_{device_id}'),
                'created_at': datetime.now(),
                'data_history': []
            }
        device = connected_devices[device_id]

        # prendi l'ultimo valore da history se esiste
        prev = device['data_history'][-1] if device['data_history'] else {}
        prev_temp  = prev.get('temperature', 0.0)
        prev_hum   = prev.get('humidity',    0.0)
        prev_light = prev.get('light',       0)
        prev_audio = prev.get('audio',       0)

        # prendi solo i dati appena ricevuti
        temperature = float(data.get('temperature', data.get('t'))) if data.get('temperature', data.get('t')) is not None else None
        humidity    = float(data.get('humidity',    data.get('h'))) if data.get('humidity',    data.get('h')) is not None else None
        light       = int(data.get('light',         data.get('l'))) if data.get('light',       data.get('l')) is not None else None
        audio       = int(data.get('audio', data.get('a', data.get('n')))) if data.get('audio', data.get('a', data.get('n'))) is not None else None



        # crea la nuova entry
        timestamp = datetime.now()
        data_entry = {
            'timestamp':   timestamp,
            'temperature': temperature,
            'humidity':    humidity,
            'light':       light,
            'audio':       audio
        }

        # aggiorna history: append e trim a ultimi 10
        device['data_history'].append(data_entry)
        device['data_history'] = device['data_history'][-10:]
        device['last_update'] = timestamp

        # salva su file
        save_json(DATA_FILE, connected_devices, iso_dates=True)

        # emetti via WebSocket
        emit_entry = {
            'temperature': temperature,
            'humidity':    humidity,
            'light':       light,
            'audio':       audio,
            'timestamp':   timestamp.isoformat()
        }
        socketio.emit('device_data_update', {
            'device_id': device_id,
            'data': emit_entry
        })

        print(f"Dati ricevuti da {device_id}: "
              f"T={temperature:.1f}°C, H={humidity:.1f}%, "
              f"L={light}, A={audio}")
        return jsonify({'status': 'success'}), 200

    except Exception as e:
        print(f"Errore nella ricezione dati: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/device_register', methods=['POST'])
def api_device_register():
    data = request.get_json() or {}
    device_id = data.get('device_id')
    if not device_id:
        return jsonify({'error': 'Missing device_id'}), 400

    # crea o aggiorna i metadati del device
    d = connected_devices.get(device_id, {
        'name': device_id,
        'created_at': datetime.now(),
        'data_history': []
    })
    # salva metadati di rete
    for field in ('mac_address', 'ip_address', 'rssi'):
        if field in data:
            d[field] = data[field]
    # se è nuovo, aggiungilo
    connected_devices[device_id] = d
    save_json(DATA_FILE, connected_devices, iso_dates=True)

    return jsonify({'status':'success','message':'Device registered'}), 200


@app.route('/api/devices', methods=['GET'])
def get_devices():
    now = datetime.now()
    devices_out = {}

    for device_id, device_data in connected_devices.items():
        last = device_data.get('last_update')
        # calcola online/offline
        is_online = False
        if isinstance(last, datetime):
            is_online = (now - last) <= ONLINE_THRESHOLD

        devices_out[device_id] = {
            'name':         device_data.get('name', device_id),
            'online':       is_online,
            'last_update':  last.isoformat() if isinstance(last, datetime) else None,
            'data_count':   len(device_data.get('data_history', [])),
            'created_at':   device_data.get('created_at').isoformat() if isinstance(device_data.get('created_at'), datetime) else None
        }

    return jsonify(devices_out), 200

@app.route("/api/device_data")
def api_device_data():
    device_id = request.args.get("device_id")
    if not device_id:
        return jsonify({"error": "missing device_id"}), 400
    device = connected_devices.get(device_id)
    if not device or not device.get("data_history"):
        return jsonify({"error": "device not found"}), 404
    # Prendi l'ultimo dato disponibile
    data = device["data_history"][-1]
    return jsonify({
        "temperature": data.get("temperature", 0),
        "humidity": data.get("humidity", 0),
        "light": data.get("light", 0),
        "audio": data.get("audio", 0)
    })


@app.route('/api/quadri', methods=['GET'])
def get_quadri():
    quadri = []
    for quadro_id, quadro_data in quadri_config.items():
        quadri.append({
            'id': quadro_id,
            'name': quadro_data.get('name', 'Quadro Senza Nome'),
            'device_id': quadro_data.get('device_id', ''),
            'template': quadro_data.get('template', 'naturale'),
            'created_at': quadro_data.get('created_at', datetime.now().isoformat()),
            'sensors_config': quadro_data.get('sensors_config', {})
        })
    
    return jsonify(quadri)

@app.route('/api/quadri', methods=['POST'])
def create_quadro_api():
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data received'}), 400
        
        quadro_id = str(uuid.uuid4())
        quadro_data = {
            'id': quadro_id,
            'name': data.get('name', 'Quadro Senza Nome'),
            'device_id': data.get('device_id', ''),
            'template': data.get('template', 'naturale'),
            'triggers': data.get('triggers', []),
            'layers': data.get('layers', []),
            'sensors_config': data.get('sensors_config', {}),
            'settings': data.get('settings', {}),
            'created_at': datetime.now().isoformat()
        }
        
        quadri_config[quadro_id] = quadro_data
        save_json(QUADRI_FILE, quadri_config, iso_dates=False)
        
        return jsonify({
            'status': 'success',
            'quadro_id': quadro_id,
            'message': 'Quadro creato con successo'
        }), 200
        
    except Exception as e:
        print(f"Errore nella creazione del quadro: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/quadri/<quadro_id>', methods=['GET'])
def get_quadro(quadro_id):
    quadro = quadri_config.get(quadro_id)
    if not quadro:
        return jsonify({'error': 'Quadro non trovato'}), 404
    return jsonify(quadro), 200

@app.route('/api/quadri/<quadro_id>', methods=['DELETE'])
def delete_quadro(quadro_id):
    try:
        if quadro_id in quadri_config:
            del quadri_config[quadro_id]
            save_json(QUADRI_FILE, quadri_config, iso_dates=False)
            return jsonify({'status': 'success', 'message': 'Quadro eliminato'}), 200
        else:
            return jsonify({'error': 'Quadro non trovato'}), 404
    except Exception as e:
        print(f"Errore nell'eliminazione del quadro: {e}")
        return jsonify({'error': str(e)}), 500

# =========== SOCKET.IO ==========
@socketio.on('connect')
def handle_connect():
    print(f"Client connected: {request.sid}")

@socketio.on('disconnect')
def handle_disconnect():
    print(f"Client disconnected: {request.sid}")

# =========== STATIC FILES ==========
@app.route('/static/<path:filename>')
def serve_static(filename):
    return send_from_directory('static', filename)

# =========== SERVER START ==========
if __name__ == '__main__':
    # Carica i dati esistenti
    quadri_config = load_json(QUADRI_FILE, iso_dates=False)

    # Avvia il thread di pulizia periodica
    cleanup_thread = threading.Thread(target=periodic_cleanup, daemon=True)
    cleanup_thread.start()

    # Determina l'IP del server
    # IP fisso dell'Access Point
    ip = '192.168.4.1'
    print(f"Server running at http://{ip}:8000")
    
    print(f"Server running at http://{ip}:8000")
    print(f"Access Point SSID: QuadroVivente_AP")
    print(f"Access Point Password: quadro2025")
    
    socketio.run(app, host='192.168.4.1', port=8000, debug=True)