# animations.py
import pygame, random, math

# Static star positions cache
_STAR_POS = []
_STAR_SIZE = (0, 0)
_NUM_STARS = 200
# Cloud storage
_CLOUDS = []

# Bright overlay for high brightness
def draw_bright_overlay(surface):
    w, h = surface.get_size()
    overlay = pygame.Surface((w, h), pygame.SRCALPHA)
    overlay.fill((255, 255, 255, 100))
    surface.blit(overlay, (0, 0))

# Temperature-based overlays
def draw_snow(surface, t):
    """Piccole particelle bianche che cadono lentamente"""
    w, h = surface.get_size()
    layer = pygame.Surface((w, h), pygame.SRCALPHA)
    for i in range(120):
        x = (i * 30 + t * 50) % (w + 100) - 50
        y = (i * 25 + t * 30) % (h + 100) - 50
        r = random.randint(1, 4)
        pygame.draw.circle(layer, (255, 255, 255, 200), (int(x), int(y)), r)
    surface.blit(layer, (0, 0))

# Initialize clouds with smooth parameters
def init_clouds(w, h):
    global _CLOUDS
    if not _CLOUDS or _CLOUDS[0].get('w') != w or _CLOUDS[0].get('h') != h:
        _CLOUDS.clear()
        num_clouds = 6
        for _ in range(num_clouds):
            x0 = random.uniform(-100, w + 100)
            y0 = random.uniform(h * 0.1, h * 0.4)
            base_scale = random.uniform(1.5, 2.5)
            amp = random.uniform(0.2, 0.5)
            freq = random.uniform(0.1, 0.3)
            phase = random.uniform(0, 2 * math.pi)
            speed = random.uniform(10, 30)
            _CLOUDS.append({
                'x0': x0,
                'y0': y0,
                'base_scale': base_scale,
                'amp': amp,
                'freq': freq,
                'phase': phase,
                'speed': speed,
                'w': w,
                'h': h
            })

# Clouds overlay with smooth scaling and movement
def draw_clouds(surface, t, dark=False, scale_mult=1.0):
    """Nuvole grandi lisce e in movimento; dark=True per pioggia; scale_mult per ingrandimento"""
    w, h = surface.get_size()
    init_clouds(w, h)
    layer = pygame.Surface((w, h), pygame.SRCALPHA)
    for c in _CLOUDS:
        x = (c['x0'] + c['speed'] * t) % (w + 200) - 100
        y = c['y0'] + math.sin(t * 0.5 + c['phase']) * 10
        dynamic_scale = c['base_scale'] + c['amp'] * math.sin(t * c['freq'] + c['phase'])
        r = int(h * 0.05 * dynamic_scale * scale_mult)
        color = (180, 180, 180, 200) if dark else (230, 230, 230, 220)
        # disegno nuvola
        pygame.draw.circle(layer, color, (int(x), int(y)), r)
        pygame.draw.circle(layer, color, (int(x + r * 0.8), int(y + r * 0.2)), int(r * 1.2))
        pygame.draw.circle(layer, color, (int(x - r * 0.8), int(y + r * 0.2)), int(r * 1.2))
    surface.blit(layer, (0, 0))

# Heat rays overlay
def draw_heat(surface, t):
    """Raggi caldi e pulsanti"""
    w, h = surface.get_size()
    center = (w // 2, h // 2)
    layer = pygame.Surface((w, h), pygame.SRCALPHA)
    for i in range(8):
        radius = 60 + math.sin(t * 2 + i) * 25
        alpha = int(130 * (1 - i / 8))
        pygame.draw.circle(layer, (255, 120, 0, alpha), center, int(radius), 3)
    surface.blit(layer, (0, 0), special_flags=pygame.BLEND_RGBA_ADD)

# Dry overlay
def draw_dry(surface):
    """Crepe e petali secchi marroncini (statici)"""
    w, h = surface.get_size()
    layer = pygame.Surface((w, h), pygame.SRCALPHA)
    for _ in range(25):
        x = random.randint(0, w)
        y = random.randint(0, h)
        length = random.randint(10, 30)
        angle = random.uniform(-math.pi / 2, math.pi / 2)
        x2 = x + math.cos(angle) * length
        y2 = y + math.sin(angle) * length
        pygame.draw.line(layer, (139, 69, 19), (x, y), (x2, y2), 2)
    surface.blit(layer, (0, 0))

# Rain overlay reusing and darkening same clouds
def draw_rain(surface, t):
    """Pioggia realistica: nuvole esistenti scure e leggermente ingrandite"""
    # darken and enlarge existing clouds by 10%
    draw_clouds(surface, t, dark=True, scale_mult=1.1)
    # rain drops
    w, h = surface.get_size()
    layer = pygame.Surface((w, h), pygame.SRCALPHA)
    for i in range(150):
        x = random.uniform(0, w)
        y = (random.uniform(0, h) + t * 500) % h
        length = random.uniform(15, 25)
        angle = math.radians(80) + random.uniform(-0.05, 0.05)
        x2 = x + math.cos(angle) * length
        y2 = y + math.sin(angle) * length
        pygame.draw.line(layer, (180, 180, 255, 200), (x, y), (x2, y2), 2)
        if y2 > h - 12:
            pygame.draw.circle(layer, (200, 200, 255, 150), (int(x2), h - 6), 4)
    surface.blit(layer, (0, 0))

# Stars overlay
def draw_stars(surface, t):
    """Stelle fisse che brillano"""
    global _STAR_POS, _STAR_SIZE
    w, h = surface.get_size()
    if _STAR_SIZE != (w, h) or not _STAR_POS:
        _STAR_POS = [(random.randint(0, w), random.randint(0, h)) for _ in range(_NUM_STARS)]
        _STAR_SIZE = (w, h)
    layer = pygame.Surface((w, h), pygame.SRCALPHA)
    for idx, (x, y) in enumerate(_STAR_POS):
        brightness = int((0.5 + 0.5 * math.sin(t + idx * 0.1)) * 255)
        pygame.draw.circle(layer, (255, 255, 255, brightness), (x, y), 2)
    surface.blit(layer, (0, 0))

# Main draw function
def draw_scene(surface, humidity, temperature, brightness, t):
    """
    Quadro vivente con:
      - temperatura: neve/clouds/caldo
      - umidità: secco/clouds/pioggia
      - luminosità: stelle o overlay brillante
      - sfondo notte a basse luminosità
    """
    w, h = surface.get_size()
    # determine background
    ice = (180, 220, 255)
    sun = (255, 220, 100)
    night = (10, 10, 30)
    if brightness < 170 and 5 < temperature < 30:
        bg = night
    else:
        if temperature <= 14:
            bg = ice
        elif temperature >= 25:
            bg = sun
        else:
            ratio = (temperature - 14) / (25 - 14)
            bg = tuple(int(ice[i] + (sun[i] - ice[i]) * ratio) for i in range(3))
    surface.fill(bg)

    # Darken background se brightness basso
    if brightness < 170:
        dark_alpha = int((1 - brightness / 170) * 200)
        dark_layer = pygame.Surface((w, h), pygame.SRCALPHA)
        dark_layer.fill((0, 0, 0, dark_alpha))
        surface.blit(dark_layer, (0, 0))

    # Temperature overlay
    if temperature <= 14:
        draw_snow(surface, t)
    elif temperature <= 24:
        draw_clouds(surface, t)
    else:
        draw_heat(surface, t)

    # Humidity overlay
    if humidity < 45:
        draw_dry(surface)
    elif humidity <= 85:
        draw_clouds(surface, t)
    else:
        draw_rain(surface, t)

    # Brightness overlay
    if brightness < 170:
        draw_stars(surface, t)
    elif brightness > 600:
        draw_bright_overlay(surface)

# main.py rimane invariato