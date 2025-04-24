# main_random.py

import random
import time
import pygame
import animations

def main():
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

        # Genera nuovi dati casuali ogni secondo
        if t - last_update >= 1.0:
            humidity    = random.uniform(20.0, 100.0)     # da 20% a 80%
            temperature = random.uniform(10.0, 30.0)     # da 15°C a 30°C
            brightness  = random.randint(100, 800)        # 0–1023 tipico A/D
            audio_raw   = random.randint(100, 800)        # 0–1023 per MAX9814

            display_text = (
                f"Umidità: {humidity:.1f}%   "
                f"Temp: {temperature:.1f}°C   "
                f"Lum: {brightness}   "
                f"Audio: {audio_raw}"
            )
            last_update = t

        # Calcolo ampiezza normalizzata per l’onda sonora [-1, +1]
        amp = (audio_raw - 512) / 512.0

        # Disegna scena con tutti i parametri
        animations.draw_scene(screen, humidity, temperature, brightness, t, amp)

        # Stampa valori in basso a sinistra
        text_surface = font.render(display_text, True, (255, 255, 255))
        screen.blit(text_surface, (10, H - text_surface.get_height() - 10))

        pygame.display.flip()
        
        clock.tick()  # loop continuo

        #time.sleep(0.1)  

    pygame.quit()

if __name__ == '__main__':
    main()
