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

// Fullscreen toggle
const btnFS = document.getElementById('fs-btn');
btnFS.addEventListener('click', () => {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen();
    btnFS.textContent = '× Esci Fullscreen';
  } else {
    document.exitFullscreen();
    btnFS.textContent = '▶ Fullscreen';
  }
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

// Onde audio
let waves = [];
const maxWaves = 5;
const waveFreq = 0.02;

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

  // prima onda iniziale, attiva
  const initialAmp = map(latest.a, 0, 2048, 50, 200);
  waves = [{ amp: initialAmp, offset: 0, x: W, isActive: true }];
}

// Ricezione dati sensore
socket.on('update', data => {
  latest = data;
  if (!initialized) {
    initScene();
    initialized = true;
  } else {
    // nuova onda statica
    const baseAmp = map(latest.a, 0, 2048, 50, 200);
    const variedAmp = baseAmp * (0.5 + Math.random());
    waves.push({ amp: variedAmp, offset: 0, x: W, isActive: false });
    if (waves.length > maxWaves) waves.shift();
  }
});

// DISEGNI
function drawBackground() {
  ctx.fillStyle = latest.l <= 200 ? '#001d3d' : '#87CEEB';
  ctx.fillRect(0, 0, W, H);
}

function drawStars() {
  if (latest.l <= 200) {
    stars.forEach(s => {
      s.r += s.twinkleSpeed;
      if (s.r <= 0.5 || s.r >= 2) s.twinkleSpeed *= -1;
      const alpha = map(s.r, 0.5, 2, 0.3, 1);
      ctx.fillStyle = `rgba(255,255,255,${alpha})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    });
  }
}

function drawSunOrSnow() {
  if (latest.t >= 25) {
    const x = W * 0.8, y = H * 0.2, r = 50;
    ctx.fillStyle = '#FFD700';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  } else if (latest.t <= 14) {
    ctx.fillStyle = '#FFF';
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
  const comfyTemp = latest.t >= 15 && latest.t <= 24;
  const comfyHum = latest.h >= 36 && latest.h <= 75;
  const isDay = latest.l > 200;
  if (isDay && comfyTemp && comfyHum) {
    birds.forEach(b => {
      b.x += b.speed;
      if (b.x > W + 50) b.x = -50;
      const y = b.y + Math.sin(Date.now() * b.flapSpeed * 2 + b.phase) * 10;
      ctx.fillStyle = '#333';
      ctx.beginPath();
      ctx.moveTo(b.x, y);
      ctx.lineTo(b.x - 10, y + 5);
      ctx.lineTo(b.x + 10, y + 5);
      ctx.closePath();
      ctx.fill();
    });
  }
}

function drawWaves() {
  // gradient per estetica onde
  const grad = ctx.createLinearGradient(0, H - 220, 0, H);
  grad.addColorStop(0, 'rgba(30,144,255,0.4)');
  grad.addColorStop(1, 'rgba(0,0,139,0.4)');

  ctx.fillStyle = grad;
  ctx.strokeStyle = '#1E90FF';
  ctx.lineWidth = 2;

  waves.forEach((w, j) => {
    // solo la prima onda (isActive) cambia offset
    if (w.isActive) w.offset += 0.02;
    // tutte scorrono verso sinistra
    w.x -= 2;

    ctx.beginPath();
    const y0 = H - 150 - j * 30 + Math.sin((0 - w.x) * waveFreq + w.offset) * w.amp;
    ctx.moveTo(0, y0);
    for (let px = 0; px <= W; px += 10) {
      const y = H - 150 - j * 30 + Math.sin((px - w.x) * waveFreq + w.offset) * w.amp;
      ctx.lineTo(px, y);
    }
    ctx.lineTo(W, H);
    ctx.lineTo(0, H);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  });

  ctx.lineWidth = 1;
}

function drawValues() {
  const padding = 10;
  const lineHeight = 20;
  const txtX = padding;
  const txtYStart = H - 200 + padding;
  ctx.font = '16px sans-serif';
  ctx.fillStyle = '#FFF';
  ctx.fillText(`Umidità: ${latest.h}`, txtX, txtYStart);
  ctx.fillText(`Temperatura: ${latest.t}`, txtX, txtYStart + lineHeight);
  ctx.fillText(`Luminosità: ${latest.l}`, txtX, txtYStart + lineHeight * 2);
  ctx.fillText(`Audio: ${latest.a}`, txtX, txtYStart + lineHeight * 3);

  ctx.font = '14px sans-serif';
  ctx.fillStyle = '#FFD700';
  ctx.fillText('Progetto creato da Giovanni', txtX, H - 30);
  ctx.fillText('giovannimaria.savoca@studio.unibo.it', txtX, H - 10);

}

function draw() {
  ctx.clearRect(0, 0, W, H);
  drawBackground();
  drawStars();
  const precip = latest.h > 75 || latest.t <= 14;
  if (precip) {
    drawSunOrSnow();
    drawClouds();
  } else {
    drawClouds();
    drawSunOrSnow();
  }
  drawLeaves();
  drawBirds();
  drawWaves();
  drawValues();
  requestAnimationFrame(draw);
}

draw();
