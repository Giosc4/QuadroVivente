#!/usr/bin/env python3
from flask import Flask, render_template, request
from flask_socketio import SocketIO

# dico a Flask dove sono i file static e i template
app = Flask(
    __name__,
    static_folder='static',
    template_folder='Templates'
)
app.config['SECRET_KEY'] = '272727'

# abilito WebSocket
socketio = SocketIO(app, cors_allowed_origins="*")

# stato corrente dei sensori
latest = {"h": 0.0, "t": 0.0, "l": 0, "a": 0}

@app.route('/')
def home():
    # renderizza Templates/Screen.html
    return render_template('Screen.html')

@app.route('/dati', methods=['POST'])
def ricevi_dati():
    data = request.get_json(force=True)
    try:
        h = float(data.get("h", latest["h"]))
        t = float(data.get("t", latest["t"]))
        l = int(data.get("l", latest["l"]))
        a = int(data.get("a", latest["a"]))
    except (TypeError, ValueError):
        return {"status": "error", "message": "Formato dati non valido"}, 400

    latest.update(h=h, t=t, l=l, a=a)
    socketio.emit('update', latest)
    return {"status": "ok"}

if __name__ == '__main__':
    # ascolta su tutte le interfacce, porta 8000
    socketio.run(app, host='0.0.0.0', port=8000, debug=True)
