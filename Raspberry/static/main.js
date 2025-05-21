// —————————————————————————
// QUADRO VIVENTE CREATIVE CANVAS
// —————————————————————————
const socket = io();
const canvas = document.getElementById('scene');
const ctx    = canvas.getContext('2d');
const btnFS  = document.getElementById('fs-btn');

let W = canvas.width = window.innerWidth;
let H = canvas.height = window.innerHeight;
window.addEventListener('resize', () => {
  W = canvas.width = window.innerWidth;
  H = canvas.height = window.innerHeight;
});

// Fullscreen toggle
btnFS.onclick = () => {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen();
    btnFS.textContent = '× Esci Fullscreen';
  } else {
    document.exitFullscreen();
    btnFS.textContent = '▶ Fullscreen';
  }
};

// Stato sensori
let latest = { h:0, t:0, l:0, a:0 };

// Variabili visive
let palette = ['#fff','#f0f','#0ff'];   // cambierà con la temperatura
let particles = [];
let maxParticles = 100;
let noiseAmp = 0;

// Ricevo i dati
socket.on('update', data => {
  latest = data;
  handleTemperature(data.t);
  handleHumidity(data.h);
  handleLuminosity(data.l);
  handleNoise(data.a);
});

// ——————————————————————
// HANDLER PRINCIPALI
// ——————————————————————

function handleTemperature(t) {
  if (t < 14)      onTempBelow14(t);
  else if (t <= 24) onTempBetween14And24(t);
  else              onTempAbove24(t);
}

function handleHumidity(h) {
  if (h < 34)      onHumBelow34(h);
  else if (h <= 74) onHumBetween35And74(h);
  else              onHumAbove75(h);
}

function handleLuminosity(l) {
  if (l < 170)      onLumBelow170(l);
  else if (l <= 599) onLumBetween171And599(l);
  else               onLumAbove600(l);
}

function handleNoise(a) {
  noiseAmp = Math.min(1, Math.max(0, a / 1023));
  onNoiseChange(noiseAmp);
}

// ——————————————————————
// CALLBACK DI LANDING (creativo!)
// ——————————————————————

function onTempBelow14(t) {
  // Palette fredda: blu-giallo-neutro
  palette = ['#001f3f','#0074D9','#7FDBFF'];
}

function onTempBetween14And24(t) {
  // Palette temperata: verdi caldi
  palette = ['#3D9970','#2ECC40','#01FF70'];
}

function onTempAbove24(t) {
  // Palette calda: rossi-arancio-giallo
  palette = ['#FF4136','#FF851B','#FFDC00'];
}

function onHumBelow34(h) {
  // Aria secca: poche particelle, lente
  maxParticles = 50;
}

function onHumBetween35And74(h) {
  // Umidità normale: particelle moderate
  maxParticles = 150;
}

function onHumAbove75(h) {
  // Umidità alta: nuvole di particelle dense
  maxParticles = 300;
}

function onLumBelow170(l) {
  // Scuro: sfondo quasi nero
  document.body.style.background = '#000012';
}

function onLumBetween171And599(l) {
  // Medio: sfondo grigio-blu
  document.body.style.background = '#101840';
}

function onLumAbove600(l) {
  // Molto luminoso: sfondo chiarissimo
  document.body.style.background = '#eef6ff';
}

function onNoiseChange(norm) {
  // ampiezza ondulatoria delle particelle
  noiseAmp = norm;
}

// ——————————————————————
// PARTICELLE IN PERSISTENZA —————————————————

class Particle {
  constructor() {
    this.reset();
  }
  reset() {
    this.x = Math.random() * W;
    this.y = Math.random() * H;
    this.size = 2 + Math.random() * 4;
    this.speed = 0.2 + Math.random() * 1;
    this.color = palette[Math.floor(Math.random()*palette.length)];
    this.life = 0;
    this.maxLife = 200 + Math.random()*200;
  }
  update() {
    // si muove in verticale oscillando in X
    this.life++;
    this.y -= this.speed + noiseAmp*3;
    this.x += Math.sin(this.life*0.05) * noiseAmp*2;
    if (this.y < -10 || this.life > this.maxLife) this.reset();
  }
  draw() {
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0,2*Math.PI);
    ctx.fillStyle = this.color;
    ctx.fill();
  }
}

// ——————————————————————
// LOOP DI ANIMAZIONE —————————————————

function draw() {
  // semi-trail: fondo leggermente trasparente
  ctx.fillStyle = 'rgba(0,0,0,0.1)';
  ctx.fillRect(0,0,W,H);

  // Regola numero particelle
  while(particles.length < maxParticles) {
    particles.push(new Particle());
  }
  // Disegna particelle
  particles.forEach(p => {
    p.update();
    p.draw();
  });

  // Cerchio centrale che pulsa col rumore
  const R = 50 + noiseAmp * 150;
  ctx.beginPath();
  ctx.arc(W/2, H/2, R, 0, 2*Math.PI);
  ctx.strokeStyle = palette[1];
  ctx.lineWidth = 4;
  ctx.stroke();

  requestAnimationFrame(draw);
}

draw();
