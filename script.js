
let port = null;
let reader = null;
let keepReading = false;

const textDecoder = new TextDecoder();
let sensorData = {
    temperature: 0,
    humidity: 0,
    light: 0,
    audioLevel: 0
};

// --- Funzione per connettersi alla porta seriale ---
async function connectSerial() {
    const btn = document.getElementById('connect-btn');

    // 1) Se la porta è già aperta, esci senza fare nulla
    if (port && port.readable) {
        console.warn('La porta seriale è già aperta.');
        return;
    }

    // 2) Controllo supporto API
    if (!('serial' in navigator)) {
        console.error('Web Serial API non supportata da questo browser.');
        return;
    }

    try {
        // 3) Richiesta permesso utente e apertura
        port = await navigator.serial.requestPort();
        await port.open({ baudRate: 9600 });

        // 4) Disabilita il bottone e aggiorna etichetta
        btn.textContent = 'Connesso';
        btn.disabled = true;

        // 5) Avvia il loop di lettura
        reader = port.readable.getReader();
        keepReading = true;
        readLoop();

    } catch (err) {
        // Gestisci l’errore specifico di porta già aperta
        if (err.name === 'InvalidStateError') {
            console.warn('Impossibile aprire: porta già aperta.');
        } else {
            console.error('Errore durante la connessione seriale:', err);
        }
    }
}

// --- Loop asincrono di lettura seriale ---
async function readLoop() {
    let buffer = '';

    while (keepReading) {
        try {
            const { value, done } = await reader.read();
            if (done) break;          // lo stream è stato chiuso

            // Accumula i dati e spezza per linee
            buffer += textDecoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop();     // l’ultimo frammento, potenzialmente incompleto

            for (let line of lines) {
                parseSensorLine(line.trim());
            }

        } catch (err) {
            console.error('Errore durante la lettura seriale:', err);
            break;
        }
    }

    // Rilascio il reader quando finisce
    if (reader) {
        reader.releaseLock();
    }
}

// --- Parsing di una linea di dati sensore ---
function parseSensorLine(line) {
    // Estrae i numeri (interi o decimali) dalla stringa
    const nums = line.match(/[-+]?\d*\.?\d+/g);
    if (!nums || nums.length < 4) return;

    sensorData.temperature = parseFloat(nums[0]);
    sensorData.humidity = parseFloat(nums[1]);
    sensorData.light = parseFloat(nums[2]);
    sensorData.audioLevel = parseFloat(nums[3]);
}

function setup() {
    const canvas = createCanvas(800, 600);
    canvas.parent('visualizer-container');
    frameRate(30);
    textFont('sans-serif');
  }
  

function draw() {
    // Background in base alla luminosità
    const bg = map(sensorData.light, 0, 1023, 0, 255);
    background(bg);

    // Testo temperatura/umidità
    fill(0);
    textSize(20);
    text(`Temp: ${sensorData.temperature.toFixed(1)} °C`, 20, 30);
    text(`Umidità: ${sensorData.humidity.toFixed(1)} %`, 20, 60);

    // Barra livello audio
    const w = map(sensorData.audioLevel, 0, 1023, 0, width);
    fill(50, 150, 250);
    rect(20, 100, w, 20);

    Animations.drawScene(
        sensorData.humidity,
        sensorData.temperature,
        sensorData.light,
        millis() / 1000,
        Animations.normalizeAudio(sensorData.audioLevel)
    );
}


// --- Evento click sul bottone ---
document
    .getElementById('connect-btn')
    .addEventListener('click', connectSerial);
