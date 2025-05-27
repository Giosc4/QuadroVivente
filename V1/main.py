# main.py
import serial
import time
import re
import sys
import pygame
import animations
from collections import deque

# === CONFIGURAZIONE ===
PORT = 'COM5'
BAUD = 9600

# Numero di campioni di audio da tenere in memoria per la media mobile
AUDIO_WINDOW = 30

# Percorso dell'icona da mostrare in alto a sinistra della finestra
ICON_PATH = 'QuadroVivente_logo.png'         # ← sostituisci con il tuo file
GAME_TITLE = 'Quadro virtuale'

# Regex per umidità, temperatura, luminosità e opzionale Audio
PATTERN = re.compile(
    r"Umidita':\s*([\d\.]+)\s*%\s+"
    r"Temperatura:\s*([\d\.]+)\s*C\s+"
    r"Luminosita':\s*(\d+)"
    r"(?:\s+Audio:\s*(\d+))?"
)

def main():
    # --- Setup seriale ---
    try:
        ser = serial.Serial(PORT, BAUD, timeout=1)
        time.sleep(2)  # attesa reset Arduino
    except Exception as e:
        print("Errore apertura seriale:", e)
        sys.exit(1)

    # --- Init Pygame ---
    pygame.init()
    # Dimensione iniziale
    W, H = 900, 600
    # Finestra ridimensionabile
    screen = pygame.display.set_mode((W, H), pygame.RESIZABLE)

    # Imposto titolo e icona della finestra
    pygame.display.set_caption(GAME_TITLE)
    try:
        icon = pygame.image.load(ICON_PATH).convert_alpha()
        pygame.display.set_icon(icon)
    except Exception as e:
        print(f"Impossibile caricare icona '{ICON_PATH}': {e}")

    # --- Carico e scalo il logo per disegnarlo sulla scena ---
    try:
        logo_img = pygame.image.load(ICON_PATH).convert_alpha()
        logo_img = pygame.transform.smoothscale(logo_img, LOGO_SIZE)
    except Exception as e:
        print(f"Impossibile caricare/scalare logo '{ICON_PATH}': {e}")
        logo_img = None

    clock = pygame.time.Clock()
    font = pygame.font.SysFont(None, 24)

    start = time.time()
    last_update = 0.0
    display_text = ""

    # Buffer per media audio (inizializzato a mezzo scala, p.es. 512)
    audio_buffer = deque([512] * AUDIO_WINDOW, maxlen=AUDIO_WINDOW)

    # Valori di default
    humidity = 0.0
    temperature = 0.0
    brightness = 0
    audio_raw = 545  # bias di mezzo per il MAX9814

    running = True
    while running:
        t = time.time() - start

        for ev in pygame.event.get():
            if ev.type == pygame.QUIT:
                running = False

            # Gestione ridimensionamento
            elif ev.type == pygame.VIDEORESIZE:
                W, H = ev.w, ev.h
                screen = pygame.display.set_mode((W, H), pygame.RESIZABLE)

        # --- Lettura seriale ---
        line = ser.readline().decode('utf-8', errors='ignore').strip()
        m = PATTERN.search(line)
        if m:
            humidity    = float(m.group(1))
            temperature = float(m.group(2))
            brightness  = int(m.group(3))
            if m.group(4) is not None:
                audio_raw = int(m.group(4))
            audio_buffer.append(audio_raw)

        # --- Media mobile audio ---
        avg_audio = sum(audio_buffer) / len(audio_buffer)

        # --- Aggiorna testo ogni secondo ---
        if t - last_update >= 1.0:
            display_text = (
                f"Umidità: {humidity:.1f}%   "
                f"Temp: {temperature:.1f}°C   "
                f"Lum: {brightness}   "
                f"Audio_avg({AUDIO_WINDOW}): {avg_audio:.1f}"
            )
            last_update = t

        # --- Normalizzazione per l’onda sonora [-1, +1] ---
        amp = (avg_audio - 512) / 512.0

        # --- Disegna tutto ---
        animations.draw_scene(screen, humidity, temperature, brightness, t, amp)

        # --- Disegna il logo ingrandito in alto a sinistra ---
        if logo_img:
            screen.blit(logo_img, (10, 10))

        # --- Stampa valori in basso a sinistra ---
        text_surface = font.render(display_text, True, (255, 255, 255))
        screen.blit(text_surface, (10, H - text_surface.get_height() - 10))

        pygame.display.flip()
        clock.tick()  # loop continuo

    ser.close()
    pygame.quit()

if __name__ == '__main__':
    main()
