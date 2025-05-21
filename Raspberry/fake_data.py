#!/usr/bin/env python3
import time
import random
import requests
import argparse

parser = argparse.ArgumentParser(
    description="Simula ESP32: invia dati finti al server"
)
parser.add_argument(
    '-u', '--url',
    default="http://127.0.0.1:8000/dati",
    help="URL completo per il POST (es. http://localhost:8000/dati)"
)
parser.add_argument(
    '-i', '--interval',
    type=float,
    default=1.0,
    help="Intervallo di invio in secondi"
)
args = parser.parse_args()

SERVER_URL = args.url
INTERVAL  = args.interval

def genera_valori_sensor():
    return {
        "h": round(random.uniform(30.0, 90.0), 1),
        "t": round(random.uniform(10.0, 35.0), 1),
        "l": random.randint(0, 1023),
        "a": random.randint(0, 1023)
    }

def invia_dati(payload):
    try:
        r = requests.post(SERVER_URL, json=payload, timeout=2)
        if r.ok:
            print(f"[OK]  {payload}")
        else:
            print(f"[ERR] HTTP {r.status_code}: {r.text}")
    except requests.RequestException as e:
        print(f"[EXC] {e}")

def main():
    print(f"Inizio invii a {SERVER_URL} ogni {INTERVAL}s")
    while True:
        dati = genera_valori_sensor()
        invia_dati(dati)
        time.sleep(INTERVAL)

if __name__ == "__main__":
    main()
