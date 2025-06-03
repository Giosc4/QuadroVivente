// static/js/Screen.js

const socket = io();
const canvas = document.getElementById('scene');
const ctx = canvas.getContext('2d');

let W = canvas.width = window.innerWidth;
let H = canvas.height = window.innerHeight;
window.addEventListener('resize', () => {
  W = canvas.width = window.innerWidth;
  H = canvas.height = window.innerHeight;
});

// Ultimi valori dai sensori
let latest = { h: 0, t: 0, l: 0, a: 0 };
let initialized = false;

// Particelle e oggetti di scena
const clouds = Array.from({ length: 6 }, () => ({
  x: Math.random() * W,
  y: Math.random() * H * 0.1 + H * 0.1,
  baseW: 150 + Math.random() * 50,
  baseH: 50 + Math.random() * 20,
  speed: 0.2 + Math.random() * 0.1,
  color: '#FFF',
  w: 0, h: 0,
  rainDrops: [],
  snowFlakes: []
}));
const birds = Array.from({ length: 5 }, () => ({
  x: Math.random() * W,
  y: Math.random() * H * 0.4 + H * 0.1,
  speed: 1 + Math.random() * 0.5,
  phase: Math.random() * Math.PI * 2,
  flapSpeed: 0.005 + Math.random() * 0.005
}));

// Stelle fisse con "twinkle"
let stars = [];

const sampleSpacing = 2;                    // pixel tra un campione e l’altro
let maxSamples = Math.ceil(W / sampleSpacing);
let waveData = [];

window.addEventListener('resize', () => {
  W = canvas.width = window.innerWidth;
  H = canvas.height = window.innerHeight;
  maxSamples = Math.ceil(W / sampleSpacing);
  if (waveData.length > maxSamples) {
    waveData = waveData.slice(waveData.length - maxSamples);
  }
});

// ——— Configurazione onde “oceano” ———
let audioAmp = 0;   // ampiezza dinamica dall’audio

// tre layer di onde con frequenze, velocità e pesi diversi
const waves = [
  { wavelength: 300, speed: 0.02, weight: 0.6, phase: 0 },
  { wavelength: 200, speed: 0.015, weight: 0.4, phase: Math.PI / 2 },
  { wavelength: 100, speed: 0.01, weight: 0.4, phase: Math.PI }
];

// Mapping utility
function map(v, a, b, c, d) {
  return c + (d - c) * ((v - a) / (b - a));
}

// Inizializza scena
function initScene() {
  // crea 50 stelle fisse con raggio e twinkle casuale
  stars = Array.from({ length: 50 }, () => ({
    x: Math.random() * W,
    y: Math.random() * H * 0.5,
    r: Math.random() * 1.5 + 0.5,
    twinkleSpeed: (Math.random() * 0.02 + 0.01) * (Math.random() < 0.5 ? 1 : -1)
  }));

  // adatta nuvole ai sensori
  clouds.forEach(c => {
    let factor = map(latest.h, 35, 75, 0.8, 1.2);
    if (latest.h < 35) factor = 0.8;
    else if (latest.h > 75) factor = 2.0;
    if (latest.t <= 14) factor = Math.max(factor, 1.5);
    c.w = c.baseW * factor;
    c.h = c.baseH * factor;
    c.color = (latest.h > 75 || latest.t <= 14) ? '#AAA' : '#FFF';

    if (latest.h > 75) {
      c.rainDrops = Array.from({ length: 12 }, () => ({
        x: c.x - c.w * 0.4 + Math.random() * c.w * 1.8,
        y: c.y + c.h * 0.3,
        len: 15 + Math.random() * 10,
        speed: 2 + Math.random() * 2
      }));
    } else c.rainDrops = [];

    if (latest.t <= 14) {
      c.snowFlakes = Array.from({ length: 12 }, () => ({
        x: c.x - c.w * 0.4 + Math.random() * c.w * 1.8,
        y: c.y + c.h * 0.3,
        size: 2 + Math.random() * 3,
        speed: 1 + Math.random() * 1
      }));
    } else c.snowFlakes = [];
  });

}

socket.on('update', data => {
  latest = data;
  if (!initialized) {
    initScene();
    initialized = true;
  }
  // ampiezza positiva 0..H*0.2
  const globalWaveScale = 1.5; // tuning: >1 alza, <1 abbassa
  audioAmp = map(latest.a, 0, 2048, 0, H * 0.2) * globalWaveScale;
});

function drawBackground() {
  const lightFactor = getAmbientLightFactor();
  const r = Math.floor(0 + lightFactor * (135 - 0));   // da #001d3d a #87CEEB
  const g = Math.floor(29 + lightFactor * (206 - 29));
  const b = Math.floor(61 + lightFactor * (235 - 61));
  ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
  ctx.fillRect(0, 0, W, H);
}


function drawStars() {
  const lightFactor = getAmbientLightFactor();
  if (lightFactor < 0.3) {
    stars.forEach(s => {
      s.r += s.twinkleSpeed;
      if (s.r <= 0.5 || s.r >= 2) s.twinkleSpeed *= -1;
      const baseAlpha = map(s.r, 0.5, 2, 0.3, 1);
      const visibility = map(lightFactor, 0, 0.3, 1, 0); // scompare gradualmente con la luce
      ctx.fillStyle = `rgba(255,255,255,${baseAlpha * visibility})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    });
  }
}
// Calcola fattore di luce ambiente da 0 (notte) a 1 (giorno pieno)
function getAmbientLightFactor() {
  return map(Math.min(latest.l, 1000), 0, 1000, 0, 1); // clamp massimo a 1000
}


function drawSunOrSnow() {
  const lightFactor = getAmbientLightFactor();

  // Mostra il sole solo se fa caldo e c'è abbastanza luce
  if (latest.t >= 25 && lightFactor > 0.4) {
    const x = W * 0.8, y = H * 0.2, r = 50;
    ctx.fillStyle = `rgba(255, 215, 0, ${lightFactor})`; // sole più tenue se poca luce
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Mostra fiocchi di neve se fa freddo
  if (latest.t <= 14) {
    const alpha = map(lightFactor, 0, 1, 1, 0); // la neve sparisce con la luce
    ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
    for (let i = 0; i < 5; i++) {
      const sx = Math.random() * W;
      const sy = Math.random() * (H - 200);
      const sz = 2 + Math.random() * 3;
      ctx.beginPath();
      ctx.arc(sx, sy, sz, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}


function drawClouds() {
  clouds.forEach(c => {
    c.x += c.speed;
    if (c.x - c.w > W) c.x = -c.w;
    ctx.fillStyle = c.color;
    ctx.beginPath();
    ctx.ellipse(c.x, c.y, c.w * 0.3, c.h * 0.8, 0, Math.PI * 0.5, Math.PI * 1.5);
    ctx.ellipse(c.x + c.w * 0.4, c.y - c.h * 0.2, c.w * 0.35, c.h * 0.75, 0, 0, Math.PI * 2);
    ctx.ellipse(c.x + c.w * 0.8, c.y, c.w * 0.3, c.h * 0.8, 0, Math.PI * 1.5, Math.PI * 0.5);
    ctx.closePath();
    ctx.fill();
    c.rainDrops.forEach(d => {
      d.y += d.speed;
      if (d.y + d.len > H - 200) d.y = c.y + c.h * 0.3;
      ctx.strokeStyle = 'rgba(174,194,224,0.7)';
      ctx.beginPath();
      ctx.moveTo(d.x, d.y);
      ctx.lineTo(d.x, d.y + d.len);
      ctx.stroke();
    });
  });
}

function drawLeaves() {
  if (latest.h < 35) {
    ctx.fillStyle = '#8B4513';
    for (let i = 0; i < 5; i++) {
      const x = Math.random() * W;
      const y = Math.random() * (H - 200);
      const sz = 5 + Math.random() * 5;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(Math.random() * Math.PI);
      ctx.beginPath();
      ctx.ellipse(0, 0, sz, sz / 3, Math.PI / 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
}

function drawBirds() {
  // tolta la condizione isDay; mantieni solo quella di comfort o rimuovila del tutto
  const comfyTemp = latest.t >= 15 && latest.t <= 24;
  const comfyHum = latest.h >= 36 && latest.h <= 75;
  if (comfyTemp && comfyHum) {
    birds.forEach(b => {
      b.x += b.speed;
      if (b.x > W + 50) b.x = -50;

      // ampiezza di volo “flap”
      const y = b.y + Math.sin(Date.now() * b.flapSpeed * 2 + b.phase) * 10;

      // dimensioni e “apertura alare”
      const wingSpan = 20 + 10 * Math.sin(Date.now() * b.flapSpeed + b.phase);
      const wingHeight = 10;

      // colore diverso di notte
      const isNight = latest.l <= 200;
      ctx.strokeStyle = isNight ? 'rgba(200,200,200,0.8)' : '#333';
      ctx.lineWidth = 2;

      // ala sinistra
      ctx.beginPath();
      ctx.moveTo(b.x, y);
      ctx.quadraticCurveTo(
        b.x - wingSpan * 0.5,
        y - wingHeight,
        b.x - wingSpan,
        y
      );
      ctx.stroke();

      // ala destra
      ctx.beginPath();
      ctx.moveTo(b.x, y);
      ctx.quadraticCurveTo(
        b.x + wingSpan * 0.5,
        y - wingHeight,
        b.x + wingSpan,
        y
      );
      ctx.stroke();
    });
  }
}


function drawWaves() {
  const baseY = H - 170; // lascia 10px di mare in basso

  waves.forEach(w => {
    w.phase += w.speed;
    const ampLayer = audioAmp * w.weight;

    // contorno onda
    ctx.beginPath();
    for (let x = 0; x <= W; x += 1) {
      const theta = (x / w.wavelength) * Math.PI * 2 + w.phase;
      const y = baseY - Math.sin(theta) * ampLayer;
      x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    // chiudi verso il fondo per riempire acqua
    ctx.lineTo(W, H);
    ctx.lineTo(0, H);
    ctx.closePath();

    // styling
    const alpha = 0.4 * w.weight;
    const grad = ctx.createLinearGradient(0, baseY - ampLayer, 0, H);
    grad.addColorStop(0, `rgba(0,191,255,${alpha})`);
    grad.addColorStop(1, `rgba(0,0,139,${alpha})`);
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.strokeStyle = `rgba(255,255,255,${0.6 * w.weight})`;
    ctx.lineWidth = 1.5 * w.weight;
    ctx.stroke();
  });
}

function drawValues() {
  const padding = 10;
  const lineHeight = 20;
  const txtX = padding;
  const txtYStart = H - 150 + padding;
  ctx.font = '16px sans-serif';
  ctx.fillStyle = '#FFF';
  ctx.fillText(`Humidity: ${latest.h} %`, txtX, txtYStart);
  ctx.fillText(`Temperature: ${latest.t} °C`, txtX, txtYStart + lineHeight);
  ctx.fillText(`Brightness: ${latest.l}`, txtX, txtYStart + lineHeight * 2);
  ctx.fillText(`Audio: ${latest.a}`, txtX, txtYStart + lineHeight * 3);

  ctx.font = '14px sans-serif';
  ctx.fillStyle = '#FFD700';
  ctx.fillText('Author:', txtX, H - 30);
  ctx.fillText('giovannimaria.savoca@studio.unibo.it', txtX, H - 10);

}

function drawPrecip() {
  clouds.forEach(c => {
    // pioggia
    c.rainDrops.forEach(d => {
      d.y += d.speed;
      if (d.y > H) d.y = c.y + c.h * 0.3;
      ctx.strokeStyle = 'rgba(174,194,224,0.7)';
      ctx.beginPath();
      ctx.moveTo(d.x, d.y);
      ctx.lineTo(d.x, d.y + d.len);
      ctx.stroke();
    });
    // neve
    c.snowFlakes.forEach(f => {
      f.y += f.speed;
      if (f.y > H) f.y = c.y + c.h * 0.3;
      ctx.fillStyle = '#FFF';
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.size, 0, Math.PI * 2);
      ctx.fill();
    });
  });
}


function draw() {
  ctx.clearRect(0, 0, W, H);
  drawBackground();
  drawStars();
  const precip = latest.h > 75 || latest.t <= 14;
  if (precip) {
    drawSunOrSnow();
    drawPrecip();      // pioggia/neve
  } else {
    drawClouds();
  }
  drawLeaves();

  // qui: UCCELLI sempre
  drawBirds();

  drawClouds();       // se vuoi che nuvole coprano leggermente gli uccelli
  drawWaves();
  drawValues();
  requestAnimationFrame(draw);
}


draw();
