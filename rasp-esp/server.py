#!/usr/bin/env python3
import os
import json
import subprocess
import socket
import threading
import time
import uuid
from datetime import datetime, timedelta
from flask import Flask, render_template, request, jsonify, send_from_directory, redirect
from flask_socketio import SocketIO, emit

# =========== CONFIG ==========
DATA_RETENTION_MINUTES = 3
DATA_FILE = 'device_data.json'
QUADRI_FILE = 'quadri_config.json'
AP_CONFIG_FILE = 'ap_config.json'

# =========== FLASK & SOCKETIO ==========
app = Flask(__name__, static_folder='static')
app.config['SECRET_KEY'] = 'quadriviventi_secret_key_2025'
socketio = SocketIO(app, cors_allowed_origins='*')

# =========== DATA STORAGE ==========
connected_devices = {}
quadri_config = {}

# =========== LOAD & SAVE ==========
def load_json(filepath, iso_dates=False):
    if not os.path.exists(filepath):
        return {}
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


def save_json(filepath, data, iso_dates=False):
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

# =========== DATA CLEANUP ==========
def cleanup_old_data():
    cutoff = datetime.now() - timedelta(minutes=DATA_RETENTION_MINUTES)
    for did, d in connected_devices.items():
        original_len = len(d.get('data_history', []))
        d['data_history'] = [entry for entry in d.get('data_history', []) if entry['timestamp'] > cutoff]
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

    if os.path.exists(AP_CONFIG_FILE):
        with open(AP_CONFIG_FILE, 'r') as f:
            ap_conf = json.load(f)
    else:
        ap_conf = {'ssid': 'QuadriViventi_WiFi', 'passphrase': 'quadriviventi2025'}

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
    with open('/etc/hostapd/hostapd.conf', 'w') as f:
        f.write(hostapd_conf)

    subprocess.run('systemctl unmask hostapd && systemctl enable hostapd && systemctl restart hostapd', shell=True)
    print("Access Point configured.")

# =========== ROUTES ==========
@app.route('/')
def home():
    return render_template('home.html')

# Add other routes and APIs here (as previously implemented)...

# =========== SOCKET.IO ==========
@socketio.on('connect')
def handle_connect():
    print(f"Client connected: {request.sid}")

@socketio.on('disconnect')
def handle_disconnect():
    print(f"Client disconnected: {request.sid}")

# =========== SERVER START ==========
if __name__ == '__main__':
    setup_access_point()

    connected_devices = load_json(DATA_FILE, iso_dates=True)
    quadri_config = load_json(QUADRI_FILE, iso_dates=True)

    threading.Thread(target=periodic_cleanup, daemon=True).start()

    ip = socket.gethostbyname(socket.gethostname())
    print(f"Server running at http://{ip}:8000")
    socketio.run(app, host='0.0.0.0', port=8000)
