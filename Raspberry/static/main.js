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

let humidity = 0, temperature = 0, brightness = 0, audio = 0;

btnFS.onclick = () => {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen();
    btnFS.textContent = '× Esci Fullscreen';
  } else {
    document.exitFullscreen();
    btnFS.textContent = '▶ Fullscreen';
  }
};

socket.on('update', data => {
  humidity    = data.h;
  temperature = data.t;
  brightness  = data.l;
  audio       = data.a;
});

function draw() {
  ctx.clearRect(0, 0, W, H);

  const lum = Math.min(255, brightness / 4);
  ctx.fillStyle = `rgb(${lum}, ${lum}, ${255 - lum})`;
  ctx.fillRect(0, 0, W, H);

  const amp = Math.min(1, audio / 512);
  const radius = 50 + amp * 100;
  ctx.beginPath();
  ctx.arc(W/2, H/2, radius, 0, 2 * Math.PI);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.fill();

  ctx.fillStyle = 'white';
  ctx.font = '20px sans-serif';
  ctx.fillText(`Umidità: ${humidity.toFixed(1)}%`, 20, 30);
  ctx.fillText(`Temp: ${temperature.toFixed(1)}°C`, 20, 60);
  ctx.fillText(`Lumi: ${brightness}`, 20, 90);
  ctx.fillText(`Audio: ${audio}`, 20, 120);

  requestAnimationFrame(draw);
}

draw();
