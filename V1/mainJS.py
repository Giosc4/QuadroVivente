# main.py

import serial
import time
import re
import sys
import threading

from flask import Flask, render_template
from flask_socketio import SocketIO, emit

# === CONFIGURAZIONE ===
PORT       = '/dev/ttyACM0'
BAUD       = 9600
PATTERN    = re.compile(
    r"Umidita':\s*([\d\.]+)\s*%\s+"
    r"Temperatura:\s*([\d\.]+)\s*C\s+"
    r"Luminosita':\s*(\d+)"
    r"(?:\s+Audio:\s*(\d+))?"
)

app = Flask(__name__)
socketio = SocketIO(app, cors_allowed_origins="*")

def serial_reader():
    """Thread che legge dalla seriale e manda via WebSocket."""
    try:
        ser = serial.Serial(PORT, BAUD, timeout=1)
        time.sleep(2)  # attesa reset Arduino
    except Exception as e:
        print("Errore apertura seriale:", e)
        sys.exit(1)

    # buffer per media mobile audio
    from collections import deque
    AUDIO_WINDOW = 30
    audio_buf = deque([512]*AUDIO_WINDOW, maxlen=AUDIO_WINDOW)

    while True:
        line = ser.readline().decode('utf-8', errors='ignore').strip()
        m = PATTERN.search(line)
        if m:
            humidity    = float(m.group(1))
            temperature = float(m.group(2))
            brightness  = int(m.group(3))
            audio_raw   = int(m.group(4)) if m.group(4) else 512

            audio_buf.append(audio_raw)
            avg_audio = sum(audio_buf) / len(audio_buf)
            amp = (avg_audio - 512) / 512.0  # normalizzato

            # emetti l’evento al client
            socketio.emit('sensordata', {
                'humidity':    humidity,
                'temperature': temperature,
                'brightness':  brightness,
                'amp':         amp
            })

        # piccolo delay per non saturare CPU/seriale
        time.sleep(0.01)

@app.route('/')
def index():
    return render_template('index.html')

@socketio.on('connect')
def on_connect():
    print('Client connesso')

if __name__ == '__main__':
    # lancio il thread di lettura seriale
    t = threading.Thread(target=serial_reader, daemon=True)
    t.start()
    # apri il browser automaticamente (su Windows / Linux / Mac)
    import webbrowser
    webbrowser.open('http://localhost:5000')
    # avvia il server Flask-SocketIO
    socketio.run(app, host='127.0.0.1', port=5000)
