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

btnFS.onclick = () => {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen();
    btnFS.textContent = '× Esci Fullscreen';
  } else {
    document.exitFullscreen();
    btnFS.textContent = '▶ Fullscreen';
  }
};

let latest = { h:0, t:0, l:0, a:0 };

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
  document.body.classList.remove('temp-cold','temp-warm','temp-hot');
  if (t < 14) {
    document.body.classList.add('temp-cold');
    onTempBelow14(t);
  }
  else if (t <= 24) {
    document.body.classList.add('temp-warm');
    onTempBetween14And24(t);
  }
  else {
    document.body.classList.add('temp-hot');
    onTempAbove24(t);
  }
}

function handleHumidity(h) {
  document.body.classList.remove('hum-dry','hum-normal','hum-humid');
  if (h < 34) {
    document.body.classList.add('hum-dry');
    onHumBelow34(h);
  }
  else if (h <= 74) {
    document.body.classList.add('hum-normal');
    onHumBetween35And74(h);
  }
  else {
    document.body.classList.add('hum-humid');
    onHumAbove75(h);
  }
}

function handleLuminosity(l) {
  document.body.classList.remove('lum-dark','lum-medium','lum-bright');
  if (l < 170) {
    document.body.classList.add('lum-dark');
    onLumBelow170(l);
  }
  else if (l <= 599) {
    document.body.classList.add('lum-medium');
    onLumBetween171And599(l);
  }
  else {
    document.body.classList.add('lum-bright');
    onLumAbove600(l);
  }
}

function handleNoise(raw) {
  // raw ∈ [0, 2048] (valore assoluto centrato dal DHT-sketch)
  // normalizzo fra 0 e 1 in base al massimo possibile
  const norm = Math.min(1, Math.max(0, raw / 2048));

  // pulisco le classi CSS precedenti
  document.body.classList.remove('noise-quiet', 'noise-medium', 'noise-loud');

  // suddivido in tre fasce: silenzioso, normale, rumoroso
  if (raw < 200) {                      // sotto ~200 → quasi silenzioso
    document.body.classList.add('noise-quiet');
    onNoiseQuiet(raw, norm);
  }
  else if (raw <= 800) {               // tra 200 e 800 → livello “medio”
    document.body.classList.add('noise-medium');
    onNoiseMedium(raw, norm);
  }
  else {                               // sopra 800 → piuttosto rumoroso
    document.body.classList.add('noise-loud');
    onNoiseLoud(raw, norm);
  }
}

function onNoiseQuiet(raw, norm) {
  // TODO: comportamento per ambiente silenzioso
  // raw: 0–2048, norm: 0.0–1.0
  console.log(`Rumore basso: raw=${raw}, norm=${norm.toFixed(2)}`);
}

function onNoiseMedium(raw, norm) {
  // TODO: comportamento per rumore “di fondo” normale
  console.log(`Rumore medio: raw=${raw}, norm=${norm.toFixed(2)}`);
}

function onNoiseLoud(raw, norm) {
  // TODO: comportamento per ambiente molto rumoroso
  console.log(`Rumore alto: raw=${raw}, norm=${norm.toFixed(2)}`);
}
// ——————————————————————
// CALLBACK DI LANDING
// ——————————————————————

function onTempBelow14(t) {
  // TODO: personalizza comportamento a freddo estremo
  console.log('Temp <14°C:', t);
}

function onTempBetween14And24(t) {
  // TODO: personalizza comportamento temperatura “confortevole”
  console.log('Temp 14-24°C:', t);
}

function onTempAbove24(t) {
  // TODO: personalizza comportamento caldo
  console.log('Temp >24°C:', t);
}

function onHumBelow34(h) {
  // TODO: personalizza comportamento aria secca
  console.log('Umidità <34%:', h);
}

function onHumBetween35And74(h) {
  // TODO: personalizza comportamento umidità normale
  console.log('Umidità 35-74%:', h);
}

function onHumAbove75(h) {
  // TODO: personalizza comportamento umidità elevata
  console.log('Umidità >75%:', h);
}

function onLumBelow170(l) {
  // TODO: personalizza comportamento bassa luminosità
  console.log('Lum <170:', l);
}

function onLumBetween171And599(l) {
  // TODO: personalizza comportamento luminosità media
  console.log('Lum 171-599:', l);
}

function onLumAbove600(l) {
  // TODO: personalizza comportamento alta luminosità
  console.log('Lum >600:', l);
}

function onNoiseChange(norm) {
  // norm ∈ [0,1]; TODO: personalizza comportamento in funzione del rumore
  console.log('Rumore normalizzato:', norm);
}

// ——————————————————————
// DRAW (la tua grafica “base”)
// ——————————————————————

function draw() {
  ctx.clearRect(0, 0, W, H);
  // …la tua grafica originale sul canvas, se vuoi tenerla…
  requestAnimationFrame(draw);
}
draw();
