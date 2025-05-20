# server.py
from flask import Flask, render_template, request
from flask_socketio import SocketIO, emit

app = Flask(__name__)
socketio = SocketIO(app, cors_allowed_origins="*")

# Variabili condivise
latest = {"h": 0, "t": 0, "l": 0, "a": 0}

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/dati', methods=['POST'])
def ricevi_dati():
    data = request.get_json()
    # aggiorna i valori correnti
    latest.update({
        "h": float(data.get("h", latest["h"])),
        "t": float(data.get("t", latest["t"])),
        "l": int(data.get("l", latest["l"])),
        "a": int(data.get("a", latest["a"]))
    })
    # manda l’aggiornamento a tutti i client connessi
    socketio.emit('update', latest)
    return {"status": "ok"}

if __name__ == '__main__':
    # usa eventlet per il supporto websocket
    socketio.run(app, host='0.0.0.0', port=5000)
