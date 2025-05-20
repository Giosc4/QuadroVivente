#!/usr/bin/env python3
import requests
import random
import time

# Endpoint del tuo Flask sul Pi
SERVER_URL = "http://192.168.1.100:5000/dati"

# Intervallo tra un invio e l'altro (in secondi)
INTERVAL = 1.0

def generate_random_payload():
    return {
        "h": round(random.uniform(30.0, 90.0), 1),     # Umidità 30.0–90.0%
        "t": round(random.uniform(10.0, 35.0), 1),     # Temperatura 10.0–35.0°C
        "l": random.randint(0, 1023),                  # Luminosità 0–1023
        "a": random.randint(0, 1023)                   # Audio peak-to-peak 0–1023
    }

def main():
    print(f"Inizio invii finti a {SERVER_URL} ogni {INTERVAL}s")
    while True:
        payload = generate_random_payload()
        try:
            resp = requests.post(SERVER_URL, json=payload, timeout=1)
            if resp.ok:
                print(f"[OK]  Inviati: {payload}")
            else:
                print(f"[ERR] HTTP {resp.status_code}: {resp.text}")
        except Exception as e:
            print(f"[EXC] {e}")
        time.sleep(INTERVAL)

if __name__ == "__main__":
    main()
