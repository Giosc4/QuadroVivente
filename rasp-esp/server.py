from flask import Flask, render_template, request, jsonify, send_from_directory
from flask_socketio import SocketIO, emit
import json
import os
import socket
import subprocess
from datetime import datetime, timedelta
import threading
import time
import uuid

app = Flask(__name__)
app.config['SECRET_KEY'] = 'quadriviventi_secret_key_2025'

socketio = SocketIO(app, cors_allowed_origins="*")

# Struttura dati per gestire multipli ESP e quadri
# Format: {device_id: {location: str, mac_address: str, data_history: [], last_update: datetime, ip_address: str, rssi: int}}
connected_devices = {}
# Format: {quadro_id: {name: str, device_id: str, template: str, sensors_config: {}, created_at: datetime}}
quadri_config = {}

# Configurazione per mantenere dati degli ultimi 3 minuti
DATA_RETENTION_MINUTES = 3
DATA_FILE = 'device_data.json'
QUADRI_FILE = 'quadri_config.json'

def load_quadri_config():
    """Carica la configurazione dei quadri dal file JSON"""
    global quadri_config
    if os.path.exists(QUADRI_FILE):
        try:
            with open(QUADRI_FILE, 'r', encoding='utf-8') as f:
                data = json.load(f)
                for quadro_id, quadro_data in data.items():
                    if 'created_at' in quadro_data:
                        quadro_data['created_at'] = datetime.fromisoformat(quadro_data['created_at'])
                quadri_config = data
                print(f"Caricati {len(quadri_config)} quadri dal file di configurazione")
        except Exception as e:
            print(f"Errore nel caricamento quadri: {e}")
            quadri_config = {}

def save_quadri_config():
    """Salva la configurazione dei quadri nel file JSON"""
    try:
        data_to_save = {}
        for quadro_id, quadro_data in quadri_config.items():
            data_copy = quadro_data.copy()
            if 'created_at' in data_copy:
                data_copy['created_at'] = data_copy['created_at'].isoformat()
            data_to_save[quadro_id] = data_copy
        
        with open(QUADRI_FILE, 'w', encoding='utf-8') as f:
            json.dump(data_to_save, f, indent=2, ensure_ascii=False)
        print(f"Salvati {len(data_to_save)} quadri nel file di configurazione")
    except Exception as e:
        print(f"Errore nel salvataggio quadri: {e}")

def load_device_data():
    """Carica i dati salvati dal file JSON"""
    global connected_devices
    if os.path.exists(DATA_FILE):
        try:
            with open(DATA_FILE, 'r', encoding='utf-8') as f:
                data = json.load(f)
                # Converti le stringhe datetime in oggetti datetime
                for device_id, device_data in data.items():
                    if 'last_update' in device_data:
                        device_data['last_update'] = datetime.fromisoformat(device_data['last_update'])
                    if 'data_history' in device_data:
                        for entry in device_data['data_history']:
                            if 'timestamp' in entry:
                                entry['timestamp'] = datetime.fromisoformat(entry['timestamp'])
                connected_devices = data
                print(f"Caricati {len(connected_devices)} dispositivi dal file dati")
        except Exception as e:
            print(f"Errore nel caricamento dei dati: {e}")
            connected_devices = {}

def save_device_data():
    """Salva i dati nel file JSON"""
    try:
        # Converti datetime in stringhe per la serializzazione JSON
        data_to_save = {}
        for device_id, device_data in connected_devices.items():
            data_copy = device_data.copy()
            if 'last_update' in data_copy:
                data_copy['last_update'] = data_copy['last_update'].isoformat()
            if 'data_history' in data_copy:
                history_copy = []
                for entry in data_copy['data_history']:
                    entry_copy = entry.copy()
                    if 'timestamp' in entry_copy:
                        entry_copy['timestamp'] = entry_copy['timestamp'].isoformat()
                    history_copy.append(entry_copy)
                data_copy['data_history'] = history_copy
            data_to_save[device_id] = data_copy
        
        with open(DATA_FILE, 'w', encoding='utf-8') as f:
            json.dump(data_to_save, f, indent=2, ensure_ascii=False)
    except Exception as e:
        print(f"Errore nel salvataggio dei dati: {e}")

def setup_mdns():
    """Configura mDNS per permettere la risoluzione di raspberrypi.local"""
    try:
        # Verifica se avahi-daemon è installato
        result = subprocess.run(['which', 'avahi-daemon'], capture_output=True, text=True)
        if result.returncode == 0:
            print("✓ Avahi-daemon trovato, mDNS dovrebbe funzionare")
            
            # Verifica se il servizio è attivo
            result = subprocess.run(['systemctl', 'is-active', 'avahi-daemon'], capture_output=True, text=True)
            if result.stdout.strip() == 'active':
                print("✓ Servizio Avahi attivo")
            else:
                print("⚠ Servizio Avahi non attivo, provo ad avviarlo...")
                subprocess.run(['sudo', 'systemctl', 'start', 'avahi-daemon'], capture_output=True)
        else:
            print("⚠ Avahi-daemon non installato, installazione automatica...")
            subprocess.run(['sudo', 'apt', 'update'], capture_output=True)
            subprocess.run(['sudo', 'apt', 'install', '-y', 'avahi-daemon'], capture_output=True)
            subprocess.run(['sudo', 'systemctl', 'enable', 'avahi-daemon'], capture_output=True)
            subprocess.run(['sudo', 'systemctl', 'start', 'avahi-daemon'], capture_output=True)
            print("✓ Avahi-daemon installato e avviato")
            
    except Exception as e:
        print(f"⚠ Errore nella configurazione mDNS: {e}")

def get_server_ip():
    """Ottiene l'IP del server dinamicamente"""
    try:
        # Prova a ottenere l'IP dell'interfaccia wlan0 (hotspot)
        result = subprocess.run(['ip', 'addr', 'show', 'wlan0'], capture_output=True, text=True)
        if result.returncode == 0:
            lines = result.stdout.split('\n')
            for line in lines:
                if 'inet ' in line and not '127.0.0.1' in line:
                    ip = line.split('inet ')[1].split('/')[0].strip()
                    return ip
        
        # Fallback: ottieni IP principale
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            s.connect(("8.8.8.8", 80))
            return s.getsockname()[0]
    except Exception:
        return "192.168.4.1"  # IP di fallback

def test_mdns_resolution():
    """Testa se la risoluzione mDNS funziona"""
    try:
        import socket
        result = socket.gethostbyname('raspberrypi.local')
        print(f"✓ mDNS resolution test: raspberrypi.local -> {result}")
        return True
    except Exception as e:
        print(f"⚠ mDNS resolution test failed: {e}")
        return False
    """Rimuove i dati più vecchi di 3 minuti"""
    current_time = datetime.now()
    cutoff_time = current_time - timedelta(minutes=DATA_RETENTION_MINUTES)
    
    for device_id, device_data in connected_devices.items():
        if 'data_history' in device_data:
            # Filtra i dati mantenendo solo quelli degli ultimi 3 minuti
            original_count = len(device_data['data_history'])
            device_data['data_history'] = [
                entry for entry in device_data['data_history']
                if entry.get('timestamp', current_time) > cutoff_time
            ]
            cleaned_count = len(device_data['data_history'])
            if original_count > cleaned_count:
                print(f"Rimossi {original_count - cleaned_count} dati vecchi per {device_id}")

def periodic_cleanup():
    """Funzione che viene eseguita periodicamente per pulire i dati vecchi"""
    while True:
        cleanup_old_data()
        save_device_data()
        time.sleep(30)  # Pulizia ogni 30 secondi

# ============================================================================
# ROTTE PER LE PAGINE WEB
# ============================================================================

@app.route('/')
def home():
    """Pagina principale - Lista dei quadri disponibili"""
    return render_template('home.html')

@app.route('/quadri_nuovi')
def create_paint_redirect():
    """Redirect alla pagina di creazione quadri"""
    from flask import redirect
    return redirect('/quadri_nuovi/create_paint.html')

@app.route('/quadri_nuovi/create_paint.html')
def create_paint():
    """Pagina per creare nuovi quadri"""
    # Passa i dispositivi disponibili alla pagina
    devices_data = {}
    for device_id, device_info in connected_devices.items():
        latest_data = {'t': 0, 'h': 0, 'l': 0, 'a': 0}
        if device_info.get('data_history'):
            latest = device_info['data_history'][-1]
            latest_data = {
                't': latest.get('temperature', 0),
                'h': latest.get('humidity', 0), 
                'l': latest.get('light', 0),
                'a': latest.get('audio', 0)
            }
        
        devices_data[device_id] = {
            'name': device_id,
            'location': device_info.get('location', 'Posizione non specificata'),
            'data': latest_data,
            'last_update': device_info.get('last_update').isoformat() if device_info.get('last_update') else None
        }
    
    return render_template('create_paint.html', devices=devices_data)

@app.route('/quadro/<quadro_id>')
def view_quadro(quadro_id):
    """Visualizza un quadro specifico a full screen"""
    if quadro_id not in quadri_config:
        return "Quadro non trovato", 404
    
    quadro = quadri_config[quadro_id]
    device_info = connected_devices.get(quadro['device_id'], {})
    
    return render_template('quadro.html', 
                         quadro_id=quadro_id,
                         quadro_name=quadro['name'],
                         device_id=quadro['device_id'],
                         device_location=device_info.get('location', 'Posizione non specificata'),
                         template=quadro.get('template', 'naturale'),
                         sensors_config=quadro.get('sensors_config', {}))

@app.route('/home/home.html')
def home_page():
    """Pagina home"""
    return render_template('home.html')

@app.route('/config')
def config_page():
    """Pagina di configurazione"""
    return render_template('config.html')

# ============================================================================
# ROTTE PER SERVIRE FILE STATICI
# ============================================================================

@app.route('/home/<path:filename>')
def home_static(filename):
    """Serve file statici dalla cartella home"""
    return send_from_directory('templates', filename)

@app.route('/quadri_nuovi/<path:filename>')
def quadri_static(filename):
    """Serve file statici dalla cartella quadri_nuovi"""
    return send_from_directory('templates', filename)

@app.route('/fullscreen/<path:filename>')
def fullscreen_static(filename):
    """Serve file statici dalla cartella fullscreen"""
    return send_from_directory('templates', filename)

@app.route('/static/<path:filename>')
def static_files(filename):
    """Serve file statici generici"""
    return send_from_directory('static', filename)

# ============================================================================
# API PER GESTIRE I DISPOSITIVI
# ============================================================================

@app.route('/api/device_register', methods=['POST'])
def register_device():
    """Registra un nuovo dispositivo"""
    try:
        data = request.get_json(force=True)
        device_id = data.get('device_id')
        mac_address = data.get('mac_address')
        location = data.get('location', f'Dispositivo {device_id}')
        ip_address = data.get('ip_address', request.remote_addr)
        rssi = data.get('rssi', 0)
        
        if not device_id or not mac_address:
            return jsonify({"status": "error", "message": "Device ID e MAC address richiesti"}), 400
        
        # Verifica se il dispositivo esiste già
        if device_id in connected_devices:
            # Aggiorna le informazioni
            connected_devices[device_id]['location'] = location
            connected_devices[device_id]['ip_address'] = ip_address
            connected_devices[device_id]['rssi'] = rssi
            connected_devices[device_id]['last_update'] = datetime.now()
            
            print(f"Dispositivo {device_id} aggiornato - Posizione: {location}")
            
            return jsonify({
                "status": "updated",
                "device_id": device_id,
                "location": location
            })
        
        # Inizializza il nuovo dispositivo
        connected_devices[device_id] = {
            'location': location,
            'mac_address': mac_address,
            'ip_address': ip_address,
            'rssi': rssi,
            'data_history': [],
            'last_update': datetime.now()
        }
        
        print(f"Nuovo dispositivo registrato: {device_id} - Posizione: {location}")
        save_device_data()
        
        return jsonify({
            "status": "registered",
            "device_id": device_id,
            "location": location
        })
        
    except Exception as e:
        print(f"Errore nella registrazione dispositivo: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/api/device_data', methods=['POST'])
def receive_device_data():
    """Riceve i dati da un ESP32"""
    try:
        data = request.get_json(force=True)
        
        # Verifica che ci sia un ID dispositivo
        device_id = data.get('id')
        if not device_id:
            return jsonify({"status": "error", "message": "Device ID mancante"}), 400
        
        # Estrai i dati
        location = data.get('location', f'Device_{device_id}')
        temperature = float(data.get('t', 0.0))
        humidity = float(data.get('h', 0.0))
        light = int(data.get('l', 0))
        audio = int(data.get('a', 0))
        rssi = data.get('rssi', 0)
        ip_address = data.get('ip', request.remote_addr)
        
        # Inizializza il dispositivo se nuovo
        if device_id not in connected_devices:
            connected_devices[device_id] = {
                'location': location,
                'mac_address': data.get('mac_address', ''),
                'ip_address': ip_address,
                'rssi': rssi,
                'data_history': [],
                'last_update': datetime.now()
            }
            print(f"Nuovo dispositivo inizializzato: {device_id}")
        
        # Prepara i dati del sensore
        sensor_data = {
            'timestamp': datetime.now(),
            'temperature': temperature,
            'humidity': humidity,
            'light': light,
            'audio': audio,
            'rssi': rssi,
            'ip_address': ip_address
        }
        
        # Aggiungi i dati alla cronologia
        connected_devices[device_id]['data_history'].append(sensor_data)
        connected_devices[device_id]['last_update'] = datetime.now()
        connected_devices[device_id]['location'] = location
        connected_devices[device_id]['rssi'] = rssi
        connected_devices[device_id]['ip_address'] = ip_address
        
        # Pulizia dati vecchi
        cleanup_old_data()
        
        # Notifica tutti i client connessi
        socketio.emit('device_data_update', {
            'device_id': device_id,
            'location': location,
            'data': {
                'timestamp': sensor_data['timestamp'].isoformat(),
                'temperature': temperature,
                'humidity': humidity,
                'light': light,
                'audio': audio,
                'rssi': rssi
            }
        })
        
        return jsonify({"status": "ok", "device_id": device_id})
        
    except Exception as e:
        print(f"Errore nella ricezione dati da {device_id}: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500

# Mantieni compatibilità con il vecchio endpoint
@app.route('/dati', methods=['POST'])
def receive_legacy_data():
    """Endpoint legacy per compatibilità"""
    return receive_device_data()

@app.route('/api/devices', methods=['GET'])
def get_devices():
    """Restituisce la lista dei dispositivi connessi"""
    devices_info = {}
    for device_id, device_data in connected_devices.items():
        devices_info[device_id] = {
            'location': device_data.get('location', 'Posizione non specificata'),
            'last_update': device_data.get('last_update').isoformat() if device_data.get('last_update') else None,
            'data_count': len(device_data.get('data_history', [])),
            'ip_address': device_data.get('ip_address', ''),
            'rssi': device_data.get('rssi', 0),
            'mac_address': device_data.get('mac_address', '')
        }
    return jsonify(devices_info)

@app.route('/api/device/<device_id>/data', methods=['GET'])
def get_device_data(device_id):
    """Restituisce i dati di un dispositivo specifico"""
    if device_id not in connected_devices:
        return jsonify({"error": "Device not found"}), 404
    
    device_data = connected_devices[device_id]
    
    # Prepara i dati per la risposta
    history = []
    for entry in device_data.get('data_history', []):
        history.append({
            'timestamp': entry['timestamp'].isoformat(),
            'temperature': entry.get('temperature', 0),
            'humidity': entry.get('humidity', 0),
            'light': entry.get('light', 0),
            'audio': entry.get('audio', 0),
            'rssi': entry.get('rssi', 0)
        })
    
    return jsonify({
        'device_id': device_id,
        'location': device_data.get('location', 'Posizione non specificata'),
        'last_update': device_data.get('last_update').isoformat() if device_data.get('last_update') else None,
        'data_history': history,
        'ip_address': device_data.get('ip_address', ''),
        'mac_address': device_data.get('mac_address', '')
    })

@app.route('/api/device/<device_id>/latest', methods=['GET'])
def get_latest_data(device_id):
    """Restituisce l'ultimo dato di un dispositivo"""
    if device_id not in connected_devices:
        return jsonify({"error": "Device not found"}), 404
    
    device_data = connected_devices[device_id]
    
    if not device_data.get('data_history'):
        return jsonify({"error": "No data available"}), 404
    
    latest = device_data['data_history'][-1]
    return jsonify({
        'device_id': device_id,
        'location': device_data.get('location', 'Posizione non specificata'),
        'timestamp': latest['timestamp'].isoformat(),
        'temperature': latest.get('temperature', 0),
        'humidity': latest.get('humidity', 0),
        'light': latest.get('light', 0),
        'audio': latest.get('audio', 0),
        'rssi': latest.get('rssi', 0)
    })

# ============================================================================
# API PER GESTIRE I QUADRI
# ============================================================================

@app.route('/api/quadri', methods=['GET'])
def get_quadri():
    """Restituisce la lista dei quadri creati"""
    quadri_list = []
    for quadro_id, quadro_data in quadri_config.items():
        device_info = connected_devices.get(quadro_data['device_id'], {})
        quadri_list.append({
            'id': quadro_id,
            'name': quadro_data['name'],
            'device_id': quadro_data['device_id'],
            'device_location': device_info.get('location', 'Dispositivo non trovato'),
            'template': quadro_data.get('template', 'naturale'),
            'animation_count': len(quadro_data.get('animations', [])),
            'created_at': quadro_data.get('created_at').isoformat() if quadro_data.get('created_at') else None
        })
    return jsonify(quadri_list)

@app.route('/api/quadri', methods=['POST'])
def create_quadro():
    """Crea un nuovo quadro"""
    try:
        data = request.get_json(force=True)
        quadro_name = data.get('name')
        device_id = data.get('device_id')
        template = data.get('template', 'naturale')
        sensors_config = data.get('sensors_config', {})
        
        if not quadro_name or not device_id:
            return jsonify({"status": "error", "message": "Nome quadro e device ID richiesti"}), 400
        
        # Verifica che il dispositivo esista
        if device_id not in connected_devices:
            return jsonify({"status": "error", "message": "Dispositivo non trovato"}), 404
        
        # Genera ID univoco per il quadro
        quadro_id = f"quadro_{int(time.time())}_{str(uuid.uuid4())[:8]}"
        
        # Crea il quadro
        quadri_config[quadro_id] = {
            'name': quadro_name,
            'device_id': device_id,
            'template': template,
            'sensors_config': sensors_config,
            'created_at': datetime.now()
        }
        
        save_quadri_config()
        
        print(f"Nuovo quadro creato: {quadro_name} (ID: {quadro_id}) - Dispositivo: {device_id}")
        
        return jsonify({
            "status": "success",
            "quadro_id": quadro_id,
            "message": f"Quadro '{quadro_name}' creato con successo"
        })
        
    except Exception as e:
        print(f"Errore nella creazione quadro: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/api/quadri/<quadro_id>', methods=['GET'])
def get_quadro(quadro_id):
    """Restituisce i dettagli di un quadro specifico"""
    if quadro_id not in quadri_config:
        return jsonify({"error": "Quadro non trovato"}), 404
    
    quadro_data = quadri_config[quadro_id]
    device_info = connected_devices.get(quadro_data['device_id'], {})
    
    return jsonify({
        'id': quadro_id,
        'name': quadro_data['name'],
        'device_id': quadro_data['device_id'],
        'device_location': device_info.get('location', 'Dispositivo non trovato'),
        'template': quadro_data.get('template', 'naturale'),
        'sensors_config': quadro_data.get('sensors_config', {}),
        'created_at': quadro_data.get('created_at').isoformat() if quadro_data.get('created_at') else None
    })

@app.route('/api/quadri/<quadro_id>', methods=['DELETE'])
def delete_quadro(quadro_id):
    """Elimina un quadro"""
    if quadro_id not in quadri_config:
        return jsonify({"error": "Quadro non trovato"}), 404
    
    quadro_name = quadri_config[quadro_id]['name']
    del quadri_config[quadro_id]
    save_quadri_config()
    
    print(f"Quadro eliminato: {quadro_name} (ID: {quadro_id})")
    
    return jsonify({"status": "success", "message": "Quadro eliminato con successo"})

@app.route('/api/templates', methods=['GET'])
def get_templates():
    """Restituisce i template disponibili per i quadri"""
    templates = {
        'naturale': {
            'name': 'Paesaggio Naturale',
            'description': 'Cielo, montagne, alberi che reagiscono ai sensori',
            'preview': '🌄'
        },
        'geometrico': {
            'name': 'Forme Geometriche',
            'description': 'Cerchi, triangoli e linee animate',
            'preview': '🔷'
        },
        'minimalista': {
            'name': 'Stile Minimalista',
            'description': 'Design pulito con animazioni sottili',
            'preview': '⚪'
        },
        'acquatico': {
            'name': 'Mondo Acquatico',
            'description': 'Oceano, pesci, bolle e onde',
            'preview': '🌊'
        }
    }
    return jsonify(templates)

@app.route('/api/animations', methods=['GET'])
def get_animations():
    """Restituisce le animazioni disponibili per sensore"""
    animations = {
        'temperature': {
            'color_change': {
                'name': 'Cambio Colore',
                'description': 'Cambia colore dal blu (freddo) al rosso (caldo)'
            },
            'size_change': {
                'name': 'Cambio Dimensione',
                'description': 'Elementi più grandi con temperature più alte'
            },
            'flame_effect': {
                'name': 'Effetto Fiamma',
                'description': 'Particelle di fuoco che aumentano con la temperatura'
            }
        },
        'humidity': {
            'water_drops': {
                'name': 'Gocce d\'Acqua',
                'description': 'Più gocce con umidità alta'
            },
            'mist_effect': {
                'name': 'Effetto Nebbia',
                'description': 'Nebbia che si addensa con l\'umidità'
            }
        },
        'light': {
            'brightness_change': {
                'name': 'Cambio Luminosità',
                'description': 'Elementi più luminosi con più luce'
            },
            'day_night_cycle': {
                'name': 'Ciclo Giorno/Notte',
                'description': 'Sfondo che cambia dal giorno alla notte'
            }
        },
        'audio': {
            'pulse_effect': {
                'name': 'Effetto Pulsazione',
                'description': 'Elementi che pulsano con il suono'
            },
            'wave_animation': {
                'name': 'Animazione Onde',
                'description': 'Onde che si propagano con il suono'
            },
            'particle_burst': {
                'name': 'Esplosione Particelle',
                'description': 'Particelle che esplodono con suoni forti'
            }
        }
    }
    return jsonify(animations)

# ============================================================================
# WEBSOCKET EVENTS
# ============================================================================

@socketio.on('connect')
def handle_connect():
    """Quando un client si connette, invia i dati attuali"""
    print(f"Client connesso: {request.sid}")
    
    # Invia i dati attuali di tutti i dispositivi
    for device_id, device_data in connected_devices.items():
        if device_data.get('data_history'):
            latest = device_data['data_history'][-1]
            emit('device_data_update', {
                'device_id': device_id,
                'location': device_data.get('location', 'Posizione non specificata'),
                'data': {
                    'timestamp': latest['timestamp'].isoformat(),
                    'temperature': latest.get('temperature', 0),
                    'humidity': latest.get('humidity', 0),
                    'light': latest.get('light', 0),
                    'audio': latest.get('audio', 0),
                    'rssi': latest.get('rssi', 0)
                }
            })

@socketio.on('disconnect')
def handle_disconnect():
    print(f"Client disconnesso: {request.sid}")

# ============================================================================
# FUNZIONI DI UTILITÀ
# ============================================================================

def print_server_status():
    """Stampa lo stato del server"""
    print("\n" + "="*60)
    print("           QUADRI VIVENTI - SERVER STATUS")
    print("="*60)
    print(f"Dispositivi connessi: {len(connected_devices)}")
    for device_id, device_data in connected_devices.items():
        location = device_data.get('location', 'N/A')
        data_count = len(device_data.get('data_history', []))
        last_update = device_data.get('last_update')
        if last_update:
            last_update_str = last_update.strftime("%H:%M:%S")
        else:
            last_update_str = "Mai"
        print(f"  - {device_id}: {location} ({data_count} dati, ultimo: {last_update_str})")
    
    print(f"Quadri configurati: {len(quadri_config)}")
    for quadro_id, quadro_data in quadri_config.items():
        print(f"  - {quadro_data['name']} (Dispositivo: {quadro_data['device_id']})")
    print("="*60)

# ============================================================================
# AVVIO DEL SERVER
# ============================================================================

if __name__ == '__main__':
    # Configura mDNS
    print("Configurazione mDNS...")
    setup_mdns()
    
    # Ottieni IP del server
    server_ip = get_server_ip()
    
    # Carica i dati esistenti
    print("Caricamento dati esistenti...")
    load_device_data()
    load_quadri_config()
    
    # Avvia il thread per la pulizia periodica dei dati
    print("Avvio thread per pulizia dati...")
    cleanup_thread = threading.Thread(target=periodic_cleanup, daemon=True)
    cleanup_thread.start()
    
    # Stampa lo stato iniziale
    print_server_status()
    
    # Test mDNS
    print("Test risoluzione mDNS...")
    test_mdns_resolution()
    
    # Avvia il server
    print("\n" + "="*60)
    print("           QUADRI VIVENTI - SERVER AVVIATO")
    print("="*60)
    print(f"🌐 Server IP: {server_ip}")
    print(f"🌐 Server Port: 8000")
    print(f"🌐 Interfaccia web: http://{server_ip}:8000")
    print(f"🌐 mDNS hostname: http://raspberrypi.local:8000")
    print(f"🌐 Hotspot WiFi: QuadriViventi_WiFi")
    print(f"🔑 Password WiFi: quadriviventi2025")
    print(f"📱 Endpoint ESP32: http://{server_ip}:8000/api/device_data")
    print(f"📱 Endpoint mDNS: http://raspberrypi.local:8000/api/device_data")
    print("="*60)
    print("Premi Ctrl+C per terminare il server\n")
    
    try:
        socketio.run(app, host='0.0.0.0', port=8000, debug=False)
    except KeyboardInterrupt:
        print("\nChiusura del server...")
        save_device_data()
        save_quadri_config()
        print("Dati salvati. Server terminato.")