import serial
import pygame
import time
import re
import sys

def main():
    # --- Configurazione seriale ---
    porta    = 'COM5'    # la tua porta Arduino
    baudrate = 9600

    try:
        ser = serial.Serial(porta, baudrate, timeout=1)
        time.sleep(2)  # attesa reset Arduino
    except serial.SerialException as e:
        print(f"Errore apertura seriale: {e}")
        sys.exit(1)

    # regex per parsare la riga proveniente da Arduino
    pattern = re.compile(
        r"Umidita':\s*([\d\.]+)\s*%\s+Temperatura:\s*([\d\.]+)\s*C\s+Luminosita':\s*(\d+)"
    )

    # --- Inizializzazione Pygame ---
    pygame.init()
    W, H = 800, 600
    screen = pygame.display.set_mode((W, H))
    pygame.display.set_caption("Quadro Vivente")
    clock = pygame.time.Clock()

    # variabili di stato iniziali
    humidity = 0.0
    tempC    = 0.0
    lightRaw = 0

    running = True
    while running:
        # gestione chiusura finestra
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                running = False

        # lettura seriale non‐bloccante
        raw = ser.readline().decode('utf-8', errors='ignore').strip()
        m = pattern.search(raw)
        if m:
            humidity = float(m.group(1))
            tempC    = float(m.group(2))
            lightRaw = int(m.group(3))

        # mappatura valori sui canali RGB
        # Temperatura: da 0–50°C → R 0–255
        # Umidità:      da 0–100%  → G 0–255
        # Luminosità:   da 0–1023  → B 0–255
        r = int(max(0, min(50, tempC))    / 50   * 255)
        g = int(max(0, min(100, humidity)) / 100  * 255)
        b = int(max(0, min(1023, lightRaw))/ 1023 * 255)

        # disegno sfondo
        screen.fill((r, g, b))

        # cerchio centrale: raggio proporzionale alla luminosità
        max_radius = min(W, H) // 4
        radius = int(lightRaw / 1023 * max_radius)
        # colore inverso per contrasto
        inv_color = (255 - r, 255 - g, 255 - b)
        pygame.draw.circle(screen, inv_color, (W // 2, H // 2), radius)

        # aggiorna display e framerate
        pygame.display.flip()
        clock.tick(30)

    # pulizia
    ser.close()
    pygame.quit()

if __name__ == "__main__":
    main()
