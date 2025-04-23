# main.py
import serial
import time
import re
import sys
import pygame
import animations

# Configurazione seriale
PORT = 'COM5'
BAUD = 9600

# Regex per umidità, temperatura, luminosità e opzionale Audio
PATTERN = re.compile(
    r"Umidita':\s*([\d\.]+)\s*%\s+"
    r"Temperatura:\s*([\d\.]+)\s*C\s+"
    r"Luminosita':\s*(\d+)"
    r"(?:\s+Audio:\s*(\d+))?"
)

def main():
    # Setup seriale
    try:
        ser = serial.Serial(PORT, BAUD, timeout=1)
        time.sleep(2)  # attesa reset Arduino
    except Exception as e:
        print("Errore apertura seriale:", e)
        sys.exit(1)

    # Init Pygame
    pygame.init()
    W, H = 900, 600
    screen = pygame.display.set_mode((W, H))
    clock = pygame.time.Clock()
    font = pygame.font.SysFont(None, 24)

    start = time.time()
    last_update = 0.0
    display_text = ""

    # Valori di default
    humidity = 0.0
    temperature = 0.0
    brightness = 0
    audio_raw = 512  # bias di mezzo per il MAX9814

    running = True
    while running:
        t = time.time() - start

        for ev in pygame.event.get():
            if ev.type == pygame.QUIT:
                running = False

        # Lettura seriale
        line = ser.readline().decode('utf-8', errors='ignore').strip()
        m = PATTERN.search(line)
        if m:
            humidity = float(m.group(1))
            temperature = float(m.group(2))
            brightness = int(m.group(3))
            if m.group(4) is not None:
                audio_raw = int(m.group(4))

        # Aggiorna testo ogni secondo
        if t - last_update >= 1.0:
            display_text = (
                f"Umidità: {humidity:.1f}%   "
                f"Temp: {temperature:.1f}°C   "
                f"Lum: {brightness}   "
                f"Audio: {audio_raw}"
            )
            last_update = t

        # Calcolo ampiezza normalizzata per l’onda sonora [-1, +1]
        amp = (audio_raw - 512) / 512.0

        # Disegna scena con tutti i parametri, incluso amp
        animations.draw_scene(screen, humidity, temperature, brightness, t, amp)

        # Stampa valori in basso a sinistra
        text_surface = font.render(display_text, True, (255, 255, 255))
        screen.blit(text_surface, (10, H - text_surface.get_height() - 10))

        pygame.display.flip()
        clock.tick()  # loop continuo

    ser.close()
    pygame.quit()

if __name__ == '__main__':
    main()
