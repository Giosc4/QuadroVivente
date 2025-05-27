# animations.py
import pygame, random, math

# Static caches
_STAR_POS = []
_STAR_SIZE = (0, 0)
_NUM_STARS = 200
_CLOUDS = []
_LEAVES = []
_TWIGS = []
_FLOWERS = []
_AUDIO_BUFFER = []
_AUDIO_STEP   = 4  
_BIRDS = []
_NUM_BIRDS = 12


# Bright overlay for high brightness
def draw_bright_overlay(surface):
    w, h = surface.get_size()
    overlay = pygame.Surface((w, h), pygame.SRCALPHA)
    overlay.fill((255, 255, 255, 100))
    surface.blit(overlay, (0, 0))

def draw_snow(surface, t):
    """Fiocchi di neve esagonali che cadono lentamente."""
    w, h = surface.get_size()
    layer = pygame.Surface((w, h), pygame.SRCALPHA)
    flake_count = 500  # numero di fiocchi

    for i in range(flake_count):
        # posizione animata verso il basso
        x = (i * 30 + t * 50) % (w + 100) - 50
        y = (i * 25 + t * 30) % (h + 100) - 50

        # dimensione del fiocco
        size = random.uniform(4, 8)
        # fase personale per rotazione
        phase = (i * 0.5 + t) % (2 * math.pi)

        # disegna 6 punte
        for k in range(6):
            angle = phase + k * (math.pi / 3)
            x2 = x + math.cos(angle) * size
            y2 = y + math.sin(angle) * size
            pygame.draw.line(layer, (255, 255, 255, 200), (x, y), (x2, y2), 1)

        # piccolo dettaglio centrale (opzionale)
        pygame.draw.circle(layer, (255, 255, 255, 200), (int(x), int(y)), 1)

    surface.blit(layer, (0, 0))

# Initialize clouds
def init_clouds(w, h):
    global _CLOUDS
    if not _CLOUDS or _CLOUDS[0].get('w') != w or _CLOUDS[0].get('h') != h:
        _CLOUDS.clear()
        for _ in range(6):
            x0 = random.uniform(-100, w + 100)
            y0 = random.uniform(h * 0.1, h * 0.4)
            base_scale = random.uniform(1.5, 2.5)
            amp = random.uniform(0.2, 0.5)
            freq = random.uniform(0.1, 0.3)
            phase = random.uniform(0, 2 * math.pi)
            speed = random.uniform(10, 30)
            _CLOUDS.append({'x0': x0, 'y0': y0,
                            'base_scale': base_scale, 'amp': amp,
                            'freq': freq, 'phase': phase,
                            'speed': speed, 'w': w, 'h': h})

# Clouds overlay
def draw_clouds(surface, t, dark=False, scale_mult=1.0):
    w, h = surface.get_size()
    init_clouds(w, h)
    layer = pygame.Surface((w, h), pygame.SRCALPHA)
    for c in _CLOUDS:
        x = (c['x0'] + c['speed'] * t) % (w + 200) - 100
        y = c['y0'] + math.sin(t * 0.5 + c['phase']) * 10
        dyn = c['base_scale'] + c['amp'] * math.sin(t * c['freq'] + c['phase'])
        r = int(h * 0.05 * dyn * scale_mult)
        color = (180, 180, 180, 200) if dark else (230, 230, 230, 220)
        for dx, dy, sr in [(0,0,r),(int(r*0.8),int(r*0.2),int(r*1.2)),(-int(r*0.8),int(r*0.2),int(r*1.2))]:
            pygame.draw.circle(layer, color, (int(x+dx), int(y+dy)), sr)
    surface.blit(layer, (0, 0))

# Sun overlay for high temperature
def draw_sun(surface, t):
    '''Sole stilizzato con raggi più piccoli.'''
    w, h = surface.get_size()
    layer = pygame.Surface((w, h), pygame.SRCALPHA)
    radius = min(w, h) // 10

    # posiziona il sole
    margin_x = radius * 2
    margin_y = radius
    cx = w - radius - margin_x
    cy = radius + margin_y
    pygame.draw.circle(layer, (255, 220, 50, 220), (cx, cy), radius)

    # raggi più corti e sottili
    ray_count = 8
    inner = radius + 5           # inizio raggio
    outer = radius + 10          # fine raggio ridotta (prima era +20)
    ray_width = 2                # spessore dimezzato (prima 4)
    for i in range(ray_count):
        angle = i * (2 * math.pi / ray_count) + t * 0.2
        sx = cx + math.cos(angle) * inner
        sy = cy + math.sin(angle) * inner
        ex = cx + math.cos(angle) * outer
        ey = cy + math.sin(angle) * outer
        pygame.draw.line(layer, (255, 220, 50, 150), (sx, sy), (ex, ey), ray_width)

    surface.blit(layer, (0, 0), special_flags=pygame.BLEND_RGBA_ADD)


def init_leaves(w, h):
    global _LEAVES
    min_y = h * 0.4
    if not _LEAVES or _LEAVES[0].get('w') != w or _LEAVES[0].get('h') != h:
        _LEAVES.clear()
        for _ in range(10):
            side = random.choice(['left','right'])
            x0 = 0 if side=='left' else w
            y0 = random.uniform(min_y, h)
            base_angle = 0 if side=='left' else math.pi
            angle = base_angle + random.uniform(-math.pi/6, math.pi/6)
            speed = random.uniform(50,100)
            size = random.uniform(12,24)
            angle_offset = random.uniform(-45,45)
            drift_amp = random.uniform(10,30)
            drift_freq = random.uniform(0.5,1.5)
            vert_amp = random.uniform(10, 20)          # ampiezza oscillazione verticale
            vert_freq = random.uniform(0.3, 0.8)       # frequenza oscillazione verticale
            vert_phase = random.uniform(0, 2*math.pi)  # fase iniziale
            _LEAVES.append({
                'x0': x0, 'y0': y0,
                'angle': angle, 'speed': speed,
                'size': size, 'angle_offset': angle_offset,
                'drift_amp': drift_amp, 'drift_freq': drift_freq,
                'vert_amp': vert_amp, 'vert_freq': vert_freq, 'vert_phase': vert_phase,
                'w': w, 'h': h
            })

def draw_dry(surface, t):
    w, h = surface.get_size()
    min_y = h * 0.3 
    init_leaves(w, h)
    init_twigs(w, h)
    init_flowers(w, h)
    layer = pygame.Surface((w, h), pygame.SRCALPHA)

    # Foglie con oscillazione verticale
    for leaf in _LEAVES:
        dx = math.cos(leaf['angle'])*leaf['speed']*t
        dy = math.sin(leaf['angle'])*leaf['speed']*t
        drift = math.sin(t*leaf['drift_freq'])*leaf['drift_amp']
        perp_x = -math.sin(leaf['angle'])*drift
        perp_y =  math.cos(leaf['angle'])*drift
        vert = math.sin(t*leaf['vert_freq'] + leaf['vert_phase'])*leaf['vert_amp']
        x = (leaf['x0'] + dx + perp_x) % w
        y_raw = leaf['y0'] + dy + perp_y + vert
        y = max(y_raw, min_y)
        size = int(leaf['size'])
        surf = pygame.Surface((size*2,size), pygame.SRCALPHA)
        pygame.draw.ellipse(surf, (139,69,19,200), (0,0,size*2,size))
        rot = leaf['angle_offset']*math.sin(t)
        surf = pygame.transform.rotate(surf, rot)
        lw, lh = surf.get_size()
        layer.blit(surf, (x-lw/2, y-lh/2))

    # Rametti (stile originale)
    for twig in _TWIGS:
        dx = math.cos(twig['angle'])*twig['speed']*t
        dy = math.sin(twig['angle'])*twig['speed']*t
        x = (twig['x0']+dx)%w
        y = max(twig['y0']+dy, min_y)
        ex = x + math.cos(twig['angle'])*twig['length']
        ey = y + math.sin(twig['angle'])*twig['length']
        pygame.draw.line(layer, (101,67,33,220), (x,y), (ex,ey), twig['thickness'])
        for b in twig['branches']:
            bx = ex + math.cos(b['angle'])*b['length']
            by = ey + math.sin(b['angle'])*b['length']
            pygame.draw.line(layer, (101,67,33,200), (ex,ey), (bx,by), max(1, twig['thickness']//2))

    # Fiori (stile originale)
    for flower in _FLOWERS:
        x = (flower['x0'] + math.sin(t*flower['freq']+flower['phase'])*flower['drift'])%w
        y = max(flower['y0'], min_y)
        for i in range(flower['petals']):
            ang = flower['angle'] + i*(2*math.pi/flower['petals']) + t*0.1
            px = x + math.cos(ang)*flower['radius']
            py = y + math.sin(ang)*flower['radius']
            petal = pygame.Surface((flower['petal_w'],flower['petal_h']), pygame.SRCALPHA)
            pygame.draw.ellipse(petal, (205,133,63,180),
                                (0,0,flower['petal_w'],flower['petal_h']))
            petal = pygame.transform.rotate(petal, math.degrees(ang))
            pw, ph = petal.get_size()
            layer.blit(petal, (px-pw/2, py-ph/2))
        pygame.draw.circle(layer, (139,69,19,220),
                           (int(x), int(y)), flower['center_r'])

    surface.blit(layer, (0, 0))



def init_twigs(w, h):
    global _TWIGS
    min_y = h * 0.4
    if not _TWIGS or _TWIGS[0].get('w') != w or _TWIGS[0].get('h') != h:
        _TWIGS.clear()
        for _ in range(7):  # meno rami
            side = random.choice(['left','right'])
            x0 = 0 if side=='left' else w
            y0 = random.uniform(min_y, h)
            base_angle = 0 if side=='left' else math.pi
            angle = base_angle + random.uniform(-math.pi/8, math.pi/8)
            speed = random.uniform(20,50)
            length = random.uniform(30,60)
            thickness = random.randint(2,4)
            branches = []
            for _ in range(random.randint(1,2)):
                b_angle = angle + random.uniform(-math.pi/6, math.pi/6)
                b_length = length * random.uniform(0.3,0.6)
                branches.append({'angle':b_angle,'length':b_length})
            _TWIGS.append({
                'x0':x0,'y0':y0,
                'angle':angle,'speed':speed,
                'length':length,'thickness':thickness,
                'branches':branches,
                'w':w,'h':h
            })

def init_flowers(w, h):
    global _FLOWERS
    min_y = h * 0.4
    if not _FLOWERS or _FLOWERS[0].get('w') != w or _FLOWERS[0].get('h') != h:
        _FLOWERS.clear()
        for _ in range(8):  # meno fiori
            side = random.choice(['left','right'])
            x0 = 0 if side=='left' else w
            y0 = random.uniform(min_y, h)
            petals = random.randint(5,7)
            radius = random.uniform(10,20)
            petal_w = int(radius*0.6)
            petal_h = int(radius*0.2)
            center_r = int(radius*0.3)
            freq = random.uniform(0.5,1.0)
            phase = random.uniform(0,2*math.pi)
            drift = random.uniform(-30,30)
            angle = random.uniform(0,2*math.pi)
            _FLOWERS.append({
                'x0':x0,'y0':y0,
                'petals':petals,'radius':radius,
                'petal_w':petal_w,'petal_h':petal_h,'center_r':center_r,
                'freq':freq,'phase':phase,'drift':drift,'angle':angle,
                'w':w,'h':h
            })

# Rain overlay
def draw_rain(surface, t, scale_mult=0.1):
    # disegna le nuvole scure con la scale_mult passata
    draw_clouds(surface, t, dark=True, scale_mult=scale_mult)

    w, h = surface.get_size()
    layer = pygame.Surface((w, h), pygame.SRCALPHA)
    for i in range(150):
        x = random.uniform(0, w)
        y = (random.uniform(0, h) + t * 500) % h
        length = random.uniform(15, 25)
        ang = math.radians(80) + random.uniform(-0.05, 0.05)
        x2 = x + math.cos(ang)*length
        y2 = y + math.sin(ang)*length
        pygame.draw.line(layer, (180,180,255,200), (x,y), (x2,y2),2)
        if y2 > h-12:
            pygame.draw.circle(layer, (200,200,255,150), (int(x2), h-6),4)
    surface.blit(layer, (0, 0))

# Stars overlay
def draw_stars(surface, t):
    global _STAR_POS, _STAR_SIZE
    w, h = surface.get_size()
    if _STAR_SIZE != (w,h) or not _STAR_POS:
        _STAR_POS = [(random.randint(0,w), random.randint(0,h)) for _ in range(_NUM_STARS)]
        _STAR_SIZE = (w,h)
    layer = pygame.Surface((w, h), pygame.SRCALPHA)
    for idx, (x,y) in enumerate(_STAR_POS):
        br = int((0.5+0.5*math.sin(t+idx*0.1))*255)
        pygame.draw.circle(layer, (255,255,255,br), (x,y), 2)
    surface.blit(layer, (0,0))


def draw_sea_wave(surface, amp, t):
    global _AUDIO_BUFFER, _AUDIO_STEP

    w, h = surface.get_size()
    sea_color = (30, 144, 255)
    margin = 60
    H = h * 0.35
    mid_y = h - margin - H

    # 2) AGGIORNO IL BUFFER AUDIO (per scorrere i campioni)
    n_pts = w // _AUDIO_STEP + 1
    if len(_AUDIO_BUFFER) != n_pts:
        _AUDIO_BUFFER = [0.0] * n_pts
    _AUDIO_BUFFER.append(amp)
    if len(_AUDIO_BUFFER) > n_pts:
        _AUDIO_BUFFER.pop(0)

    # 2) disegna l’onda principale (poligono netto)
    pts = [(i * _AUDIO_STEP, mid_y - a * H)
           for i, a in enumerate(_AUDIO_BUFFER)]
    poly = [(0, h)] + pts + [(w, h)]
    pygame.draw.polygon(surface, sea_color, poly)

    # 3) crea un layer per le ripple
    ripple = pygame.Surface((w, h), pygame.SRCALPHA)
    num_layers = 25
    for j in range(num_layers):
        # y di base scende progressivamente verso il fondo
        y_base = mid_y + H * (j / num_layers)
        ripple_amp = H * 0.02  # ampiezza piccole onde
        phase = j * 0.3        # sfasamento per varietà

        line = []
        for i, a in enumerate(_AUDIO_BUFFER):
            x = i * _AUDIO_STEP
            # base modulata dall’amp audio
            y0 = y_base - a * H
            # sovrappongo una sinusoide veloce
            y = y0 + math.sin((x / w) * 10 * math.pi + t * (1 + j*0.1) + phase) * ripple_amp
            line.append((x, y))

        # disegno la ripple: azzurro chiaro semi‐trasparente
        color = (180, 220, 255, 30)
        pygame.draw.lines(ripple, color, False, line, 1)

    # 4) sovrappongo le ripple al mare
    surface.blit(ripple, (0, 0))


def init_birds(w, h):
    """Prepara le rondini con posizione iniziale, velocità e scala casuali."""
    global _BIRDS
    if not _BIRDS or _BIRDS[0].get('w') != w:
        _BIRDS.clear()
        for _ in range(_NUM_BIRDS):
            # partono sia da sinistra che da destra
            side = random.choice(['left','right'])
            x0 = -50 if side == 'left' else w + 50
            # quota tra 20% e 40% dell'altezza
            y0 = random.uniform(h * 0.2, h * 0.4)
            speed = random.uniform(60, 120) * (1 if side=='left' else -1)
            scale = random.uniform(0.6, 1.0)
            phase = random.uniform(0, 2*math.pi)
            _BIRDS.append({'x0': x0, 'y0': y0, 'speed': speed,
                           'scale': scale, 'phase': phase,
                           'w': w, 'h': h})

def draw_birds(surface, t):
    """Disegna le rondini nere: corpo ovale, ali piegate verso l’alto e coda a forcella."""
    w, h = surface.get_size()
    init_birds(w, h)
    black = (0, 0, 0)
    for b in _BIRDS:
        # calcola posizione ciclica orizzontale + lieve ondulazione
        x = (b['x0'] + b['speed'] * t) % (b['w'] + 100) - 50
        y = b['y0'] + math.sin((x / b['w']) * 2*math.pi + b['phase']) * 8

        s = b['scale'] * 20  # dimensione base
        body_w, body_h = s * 0.8, s * 0.3
        wing_w, wing_h = s, s * 0.4
        tail_h = s * 0.5

        # --- corpo: ovale in primo piano
        body_rect = pygame.Rect(0,0, int(body_w), int(body_h))
        body_rect.center = (x, y)
        pygame.draw.ellipse(surface, black, body_rect)

        # --- ali: due triangoli inclinati verso l’alto
        # ala sinistra
        p0 = (x - body_w*0.3, y)
        p1 = (x - wing_w*0.8, y - wing_h)
        p2 = (x - wing_w*0.3, y)
        pygame.draw.polygon(surface, black, [p0, p1, p2])
        # ala destra
        p0 = (x + body_w*0.3, y)
        p1 = (x + wing_w*0.8, y - wing_h)
        p2 = (x + wing_w*0.3, y)
        pygame.draw.polygon(surface, black, [p0, p1, p2])

        # --- coda biforcuta: due piccoli triangoli sporgenti
        tail_base = (x, y + body_h*0.3)
        left_tail = (x - body_w*0.2, y + tail_h)
        right_tail = (x + body_w*0.2, y + tail_h)
        mid_tail = (x, y + tail_h*0.7)
        pygame.draw.polygon(surface, black, [tail_base, left_tail, mid_tail])
        pygame.draw.polygon(surface, black, [tail_base, right_tail, mid_tail])

def draw_scene(surface, humidity, temperature, brightness, t, amp):
    w, h = surface.get_size()
    base_sky = (135, 206, 235)

    # 1) Sfondo cielo
    surface.fill(base_sky)

    # 2) Mare (onde sonore) in sottofondo
    draw_sea_wave(surface, amp, t)

    # 3) Overlay luminosità (full-height)
    if brightness < 170:
        alpha = int((170 - brightness) / 120 * 150)
        dark = pygame.Surface((w, h), pygame.SRCALPHA)
        dark.fill((0, 0, 0, alpha))
        surface.blit(dark, (0, 0))
    elif brightness > 600:
        bright = pygame.Surface((w, h), pygame.SRCALPHA)
        bright.fill((255, 255, 255, 80))
        surface.blit(bright, (0, 0))

    # 4) Preparo un layer per tutti gli effetti “sopra” il mare
    effects = pygame.Surface((w, h), pygame.SRCALPHA)

    #    4a) Neve / Sole / Uccellini
    if temperature <= 14:
        draw_snow(effects, t)
    elif temperature > 25:
        draw_sun(effects, t)
    else:
        draw_birds(effects, t)

    #    4b) Foglie / Nuvole / Pioggia
    if humidity < 35:
        draw_dry(effects, t)
    elif humidity <= 85:
        scale = humidity / 100.0
        draw_clouds(effects, t, dark=False, scale_mult=scale)
    else:
        draw_rain(effects, t, scale_mult=0.85)

    #    4c) Stelle
    if brightness < 170:
        draw_stars(effects, t)

    # 5) Costruisco una maschera che azzera l’alpha **solo** dentro la forma dell’onda
    mask = pygame.Surface((w, h), pygame.SRCALPHA)
    mask.fill((255, 255, 255, 255))  # parti fuori onda → alpha=255

    # Recupero i punti dell’onda esattamente come in draw_sea_wave
    margin = 40
    H = h * 0.25
    mid_y = h - margin - H

    # Assicuriamoci che _AUDIO_BUFFER sia già aggiornato da draw_sea_wave():
    # calcolo i vertici della cresta
    pts = [(i * _AUDIO_STEP, mid_y - a * H)
           for i, a in enumerate(_AUDIO_BUFFER)]
    wave_poly = [(0, h)] + pts + [(w, h)]

    # Nella regione del poligono → alpha = 0 (trasparente)
    pygame.draw.polygon(mask, (255, 255, 255, 0), wave_poly)

    # 6) Applico la maschera al layer effetti
    effects.blit(mask, (0, 0), special_flags=pygame.BLEND_RGBA_MULT)

    # 7) Sovrappongo gli effetti già mascherati
    surface.blit(effects, (0, 0))

    # Fine. Ora tutto ciò che “cade” sotto la linea dell’onda sparisce. 
