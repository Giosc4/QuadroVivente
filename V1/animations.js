// animations.js
// Traduzione delle animazioni da Python/Pygame a JavaScript con p5.js
// Modalità globale p5.js

const Animations = (() => {
    // Cache statiche
    let starPos = [];
    let starSize = { w: 0, h: 0 };
    const NUM_STARS = 200;
    let clouds = [];
    let leaves = [];
    let twigs = [];
    let flowers = [];
    let audioBuffer = [];
    const AUDIO_STEP = 4;
  
    // Normalize audioLevel (0..1023) to [-1..+1]
    function normalizeAudio(raw) {
      return (raw - 512) / 512;
    }
  
    // Bright overlay
    function drawBrightOverlay(g) {
      g.push();
      g.noStroke();
      g.fill(255, 255, 255, 100);
      g.rect(0, 0, g.width, g.height);
      g.pop();
    }
  
    // Snow overlay
    function drawSnow(g, t) {
      let layer = createGraphics(g.width, g.height);
      layer.clear();
      layer.noStroke();
      for (let i = 0; i < 120; i++) {
        let x = (i * 30 + t * 50) % (g.width + 100) - 50;
        let y = (i * 25 + t * 30) % (g.height + 100) - 50;
        let r = random(1, 4);
        layer.fill(255, 255, 255, 200);
        layer.circle(x, y, r * 2);
      }
      g.image(layer, 0, 0);
    }
  
    // Initialize clouds data
    function initClouds() {
      if (clouds.length === 0 || clouds[0].w !== width) {
        clouds = [];
        for (let i = 0; i < 6; i++) {
          clouds.push({
            x0: random(-100, width + 100),
            y0: random(height * 0.1, height * 0.4),
            baseScale: random(1.5, 2.5),
            amp: random(0.2, 0.5),
            freq: random(0.1, 0.3),
            phase: random(0, TWO_PI),
            speed: random(10, 30),
            w: width,
            h: height
          });
        }
      }
    }
  
    // Clouds overlay
    function drawClouds(g, t, dark = false, scaleMult = 1.0) {
      initClouds();
      let layer = createGraphics(g.width, g.height);
      layer.clear();
      layer.noStroke();
      for (let c of clouds) {
        let x = (c.x0 + c.speed * t) % (g.width + 200) - 100;
        let y = c.y0 + sin(t * 0.5 + c.phase) * 10;
        let dyn = c.baseScale + c.amp * sin(t * c.freq + c.phase);
        let r = int(g.height * 0.05 * dyn * scaleMult);
        let alpha = dark ? 200 : 220;
        let gray = dark ? 180 : 230;
        layer.fill(gray, gray, gray, alpha);
        [[0,0,r],[r*0.8, r*0.2, r*1.2],[-r*0.8, r*0.2, r*1.2]].forEach(([dx, dy, sr]) => {
          layer.circle(x + dx, y + dy, sr * 2);
        });
      }
      g.image(layer, 0, 0);
    }
  
    // Sun overlay
    function drawSun(g, t) {
      let layer = createGraphics(g.width, g.height);
      layer.clear();
      let radius = min(g.width, g.height) / 10;
      let marginX = radius * 2;
      let marginY = radius;
      let cx = g.width - radius - marginX;
      let cy = radius + marginY;
      layer.noStroke();
      layer.fill(255, 220, 50, 220);
      layer.circle(cx, cy, radius * 2);
      layer.stroke(255, 220, 50, 150);
      layer.strokeWeight(4);
      for (let i = 0; i < 8; i++) {
        let angle = i * (TWO_PI / 8) + t * 0.2;
        let sx = cx + cos(angle) * (radius + 5);
        let sy = cy + sin(angle) * (radius + 5);
        let ex = cx + cos(angle) * (radius + 20);
        let ey = cy + sin(angle) * (radius + 20);
        layer.line(sx, sy, ex, ey);
      }
      g.push();
      g.blendMode(ADD);
      g.image(layer, 0, 0);
      g.pop();
    }
  
    // Init leaves, twigs, flowers for dry overlay
    function initLeaves() {
      let minY = height * 0.4;
      if (leaves.length === 0 || leaves[0].w !== width) {
        leaves = [];
        for (let i = 0; i < 10; i++) {
          let side = random(['left','right']);
          leaves.push({
            x0: side === 'left' ? 0 : width,
            y0: random(minY, height),
            angle: (side === 'left' ? 0 : PI) + random(-PI/6, PI/6),
            speed: random(50, 100),
            size: random(12, 24),
            angleOffset: random(-45, 45),
            driftAmp: random(10, 30),
            driftFreq: random(0.5, 1.5),
            vertAmp: random(10, 20),
            vertFreq: random(0.3, 0.8),
            vertPhase: random(0, TWO_PI),
            w: width
          });
        }
      }
    }
  
    function initTwigs() {
      let minY = height * 0.4;
      if (twigs.length === 0 || twigs[0].w !== width) {
        twigs = [];
        for (let i = 0; i < 7; i++) {
          let side = random(['left','right']);
          let angleBase = side === 'left' ? 0 : PI;
          let length = random(30, 60);
          let branches = [];
          for (let j = 0; j < int(random(1, 3)); j++) {
            branches.push({
              angle: angleBase + random(-PI/6, PI/6),
              length: length * random(0.3, 0.6)
            });
          }
          twigs.push({
            x0: side === 'left' ? 0 : width,
            y0: random(minY, height),
            angle: angleBase + random(-PI/8, PI/8),
            speed: random(20, 50),
            length,
            thickness: int(random(2, 4)),
            branches,
            w: width
          });
        }
      }
    }
  
    function initFlowers() {
      let minY = height * 0.4;
      if (flowers.length === 0 || flowers[0].w !== width) {
        flowers = [];
        for (let i = 0; i < 8; i++) {
          flowers.push({
            x0: random(['left','right']) === 'left' ? 0 : width,
            y0: random(minY, height),
            petals: int(random(5, 7)),
            radius: random(10, 20),
            petalW: random(6, 12),
            petalH: random(4, 10),
            centerR: random(3, 6),
            freq: random(0.5, 1.0),
            phase: random(0, TWO_PI),
            drift: random(-30, 30),
            angle: random(0, TWO_PI),
            w: width
          });
        }
      }
    }
  
    // Dry overlay (leaves, twigs, flowers)
    function drawDry(g, t) {
      initLeaves(); initTwigs(); initFlowers();
      let layer = createGraphics(g.width, g.height);
      layer.clear();
      // Leaves
      layer.noStroke();
      for (let leaf of leaves) {
        let dx = cos(leaf.angle) * leaf.speed * t;
        let dy = sin(leaf.angle) * leaf.speed * t;
        let drift = sin(t * leaf.driftFreq) * leaf.driftAmp;
        let px = dx + leaf.x0 + (-sin(leaf.angle) * drift);
        let py = dy + leaf.y0 + (cos(leaf.angle) * drift) + sin(t * leaf.vertFreq + leaf.vertPhase) * leaf.vertAmp;
        layer.push();
        layer.translate(px, py);
        layer.rotate(radians(leaf.angleOffset * sin(t)));
        layer.fill(139, 69, 19, 200);
        layer.ellipse(0, 0, leaf.size * 2, leaf.size);
        layer.pop();
      }
      // Twigs
      layer.stroke(101, 67, 33, 220);
      layer.strokeWeight(1);
      for (let twig of twigs) {
        let dx = cos(twig.angle) * twig.speed * t;
        let dy = sin(twig.angle) * twig.speed * t;
        let sx = twig.x0 + dx;
        let sy = twig.y0 + dy;
        layer.line(sx, sy, sx + cos(twig.angle) * twig.length, sy + sin(twig.angle) * twig.length);
        for (let b of twig.branches) {
          layer.line(sx + cos(twig.angle) * twig.length, sy + sin(twig.angle) * twig.length,
                     sx + cos(b.angle) * b.length, sy + sin(b.angle) * b.length);
        }
      }
      // Flowers
      for (let f of flowers) {
        let fx = (f.x0 + sin(t * f.freq + f.phase) * f.drift) % g.width;
        let fy = f.y0;
        for (let i = 0; i < f.petals; i++) {
          let ang = f.angle + i * (TWO_PI / f.petals) + t * 0.1;
          let px = fx + cos(ang) * f.radius;
          let py = fy + sin(ang) * f.radius;
          layer.push();
          layer.translate(px, py);
          layer.rotate(ang);
          layer.fill(205, 133, 63, 180);
          layer.ellipse(0, 0, f.petalW, f.petalH);
          layer.pop();
        }
        layer.noStroke();
        layer.fill(139, 69, 19, 220);
        layer.circle(fx, fy, f.centerR * 2);
      }
      g.image(layer, 0, 0);
    }
  
    // Rain overlay
    function drawRain(g, t) {
      drawClouds(g, t, true, 1.1);
      let layer = createGraphics(g.width, g.height);
      layer.clear();
      layer.stroke(180, 180, 255, 200);
      layer.strokeWeight(2);
      for (let i = 0; i < 150; i++) {
        let x = random(0, g.width);
        let y = (random(0, g.height) + t * 500) % g.height;
        let length = random(15, 25);
        let ang = radians(80) + random(-0.05, 0.05);
        let x2 = x + cos(ang) * length;
        let y2 = y + sin(ang) * length;
        layer.line(x, y, x2, y2);
        if (y2 > g.height - 12) {
          layer.noStroke();
          layer.fill(200, 200, 255, 150);
          layer.circle(x2, g.height - 6, 4);
        }
      }
      g.image(layer, 0, 0);
    }
  
    // Stars overlay
    function drawStars(g, t) {
      if (starSize.w !== g.width || starSize.h !== g.height || starPos.length === 0) {
        starPos = Array.from({ length: NUM_STARS }, () => ({ x: random(0, g.width), y: random(0, g.height) }));
        starSize = { w: g.width, h: g.height };
      }
      g.noStroke();
      for (let i = 0; i < NUM_STARS; i++) {
        let { x, y } = starPos[i];
        let br = (0.5 + 0.5 * sin(t + i * 0.1)) * 255;
        g.fill(255, 255, 255, br);
        g.circle(x, y, 2);
      }
    }
  
    // Sea wave overlay based on audio
    function drawSeaWave(g, rawAmp, t) {
      let amp = rawAmp;
      let w = g.width;
      let h = g.height;
      let midY = h * 0.75;
      let H = h * 0.15;
      let nPts = floor(w / AUDIO_STEP) + 1;
      if (audioBuffer.length !== nPts) {
        audioBuffer = Array(nPts).fill(0);
      }
      audioBuffer.push(amp);
      if (audioBuffer.length > nPts) audioBuffer.shift();
      let points = audioBuffer.map((a, i) => ({ x: i * AUDIO_STEP, y: midY - a * H }));
      let layer = createGraphics(w, h);
      layer.noStroke();
      layer.fill(30, 144, 255);
      layer.beginShape();
      layer.vertex(0, h);
      for (let p of points) layer.vertex(p.x, p.y);
      layer.vertex(w, h);
      layer.endShape(CLOSE);
      layer.stroke(255, 255, 255, 200);
      layer.noFill();
      layer.beginShape();
      for (let p of points) layer.vertex(p.x, p.y);
      layer.endShape();
      g.image(layer, 0, 0);
    }
  
    // Main drawScene
    function drawScene(humidity, temperature, brightness, t, rawAmp) {
      let g = this; // assume called in global p5 instance
      // background color
      let ice = color(180, 220, 255);
      let sunbg = color(255, 220, 100);
      let night = color(10, 10, 30);
      let bg;
      if (brightness < 50 && temperature > 5 && temperature < 30) {
        bg = night;
      } else if (temperature <= 14) {
        bg = ice;
      } else if (temperature >= 25) {
        bg = sunbg;
      } else {
        let ratio = (temperature - 14) / (25 - 14);
        bg = lerpColor(ice, sunbg, ratio);
      }
      background(bg);
      // twilight shading
      if (brightness >= 50 && brightness < 170) {
        let alpha = ((170 - brightness) / 120) * 150;
        push();
        noStroke();
        fill(0, 0, 0, alpha);
        rect(0, 0, width, height);
        pop();
      }
      // temperature overlays
      if (temperature <= 14) drawSnow(window, t);
      else if (temperature <= 24) drawClouds(window, t);
      else drawSun(window, t);
      // humidity overlays
      if (humidity < 35) drawDry(window, t);
      else if (humidity <= 85) drawClouds(window, t);
      else drawRain(window, t);
      // stars / bright overlay
      if (brightness < 170) drawStars(window, t);
      else if (brightness > 600) drawBrightOverlay(window);
      // sea wave
      drawSeaWave(window, rawAmp, t);
    }
  
    return { drawScene, normalizeAudio };
  })();
  