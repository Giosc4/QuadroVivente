
# main.py
import serial, time, re, sys
import pygame
import animations

# Configurazione seriale
PORT = 'COM5'
BAUD = 9600
PATTERN = re.compile(r"Umidita':\s*([\d\.]+)\s*%\s+Temperatura:\s*([\d\.]+)\s*C\s+Luminosita':\s*(\d+)")


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
    W,H = 900, 600
    screen = pygame.display.set_mode((W,H))
    clock = pygame.time.Clock()
    start = time.time()

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

        # Disegna scena unica
        animations.draw_scene(screen, humidity, temperature, brightness, t)

        pygame.display.flip()
        clock.tick()  # aggiornamento continuo

    ser.close()
    pygame.quit()

if __name__ == '__main__':
    main()
