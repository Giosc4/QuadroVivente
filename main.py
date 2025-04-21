# main.py
import serial, time, re, sys
import pygame
import animations

# Configurazione seriale
PORT = 'COM5'
BAUD = 9600
PATTERN = re.compile(
    r"Umidita':\s*([\d\.]+)\s*%\s+Temperatura:\s*([\d\.]+)\s*C\s+Luminosita':\s*(\d+)"
)

def main():
    # Setup seriale
    try:
        ser = serial.Serial(PORT, BAUD, timeout=1)
        time.sleep(2)
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
        else:
            humidity = temperature = brightness = 0

        # Aggiorna testo ogni secondo
        if t - last_update >= 1.0:
            display_text = f"Umidità: {humidity:.1f}%   Temp: {temperature:.1f}°C   Lum: {brightness}"
            last_update = t

        # Disegna scena unica
        animations.draw_scene(screen, humidity, temperature, brightness, t)

        # Stampa valori in basso a sinistra
        text_surface = font.render(display_text, True, (255, 255, 255))
        text_rect = text_surface.get_rect()
        screen.blit(text_surface, (10, H - text_rect.height - 10))

        pygame.display.flip()
        clock.tick()  # aggiornamento continuo

    ser.close()
    pygame.quit()

if __name__ == '__main__':
    main()
