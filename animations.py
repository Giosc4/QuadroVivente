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
    '''Sole stilizzato con raggi opachi, posizionato più verso il centro'''
    w, h = surface.get_size()
    layer = pygame.Surface((w, h), pygame.SRCALPHA)
    radius = min(w, h) // 10
    # aumentiamo il margine per posizionarlo più lontano dal bordo
    margin_x = radius * 2
    margin_y = radius 
    cx = w - radius - margin_x
    cy = radius + margin_y
    # disegno il sole
    pygame.draw.circle(layer, (255, 220, 50, 220), (cx, cy), radius)
    # disegno i raggi opachi
    for i in range(8):
        angle = i * (2 * math.pi / 8) + t * 0.2
        sx = cx + math.cos(angle) * (radius + 5)
        sy = cy + math.sin(angle) * (radius + 5)
        ex = cx + math.cos(angle) * (radius + 20)
        ey = cy + math.sin(angle) * (radius + 20)
        pygame.draw.line(layer, (255, 220, 50, 150), (sx, sy), (ex, ey), 4)
    surface.blit(layer, (0, 0), special_flags=pygame.BLEND_RGBA_ADD)


def init_leaves(w, h):
    global _LEAVES
    min_y = h * 0.4
    if not _LEAVES or _LEAVES[0].get('w') != w or _LEAVES[0].get('h') != h:
        _LEAVES.clear()
        for _ in range(15):  # meno foglie
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
            _LEAVES.append({
                'x0': x0, 'y0': y0,
                'angle': angle, 'speed': speed,
                'size': size, 'angle_offset': angle_offset,
                'drift_amp': drift_amp, 'drift_freq': drift_freq,
                'w': w, 'h': h
            })

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
        for _ in range(5):  # meno fiori
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

def draw_dry(surface, t):
    w, h = surface.get_size()
    min_y = h * 0.4
    init_leaves(w, h)
    init_twigs(w, h)
    init_flowers(w, h)
    layer = pygame.Surface((w, h), pygame.SRCALPHA)

    # Foglie (stile originale)
    for leaf in _LEAVES:
        dx = math.cos(leaf['angle'])*leaf['speed']*t
        dy = math.sin(leaf['angle'])*leaf['speed']*t
        drift = math.sin(t*leaf['drift_freq'])*leaf['drift_amp']
        perp_x = -math.sin(leaf['angle'])*drift
        perp_y =  math.cos(leaf['angle'])*drift
        x = (leaf['x0']+dx+perp_x)%w
        y_raw = leaf['y0']+dy+perp_y
        y = max(y_raw, min_y)
        size = int(leaf['size'])
        surf = pygame.Surface((size*2,size), pygame.SRCALPHA)
        pygame.draw.ellipse(surf, (139,69,19,200), (0,0,size*2,size))
        rot = leaf['angle_offset']*math.sin(t)
        surf = pygame.transform.rotate(surf, rot)
        lw, lh = surf.get_size()
        layer.blit(surf, (x-lw/2, y-lh/2))

    # Rametti (stile originale con branch)
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

    surface.blit(layer, (0,0))



# Rain overlay
def draw_rain(surface, t):
    draw_clouds(surface, t, dark=True, scale_mult=1.1)
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

# Main draw function
def draw_scene(surface, humidity, temperature, brightness, t):
    w,h = surface.get_size()
    ice = (180,220,255)
    sunbg = (255,220,100)
    night = (10,10,30)
    if brightness < 50 and 5<temperature<30:
        bg = night
    else:
        if temperature<=14:
            bg=ice
        elif temperature>=25:
            bg=sunbg
        else:
            ratio=(temperature-14)/(25-14)
            bg=tuple(int(ice[i]+(sunbg[i]-ice[i])*ratio) for i in range(3))
    surface.fill(bg)
    if 50<=brightness<170:
        alpha=int((170-brightness)/120*150)
        d=pygame.Surface((w,h),pygame.SRCALPHA)
        d.fill((0,0,0,alpha))
        surface.blit(d,(0,0))
    if temperature<=14:
        draw_snow(surface,t)
    elif temperature<=24:
        draw_clouds(surface,t)
    else:
        draw_sun(surface,t)
    if humidity<35:
        draw_dry(surface,t)
    elif humidity<=85:
        draw_clouds(surface,t)
    else:
        draw_rain(surface,t)
    if brightness<170:
        draw_stars(surface,t)
    elif brightness>600:
        draw_bright_overlay(surface)

# main.py remains unchanged
