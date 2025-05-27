#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <DHT.h>

// === CONFIGURAZIONE WIFI ===
const char* ssid     = "FASTWEB-FC8569";
const char* password = "Bertoloni_Gang";

// === DHT11 su GPIO0 ===
#define DHTPIN    0
#define DHTTYPE   DHT11
DHT dht(DHTPIN, DHTTYPE);

// === SENSORI ANALOGICI ===
// Microfono MAX9814 analogico su GPIO36 (ADC1_CH0)
const int MIC_PIN    = 36;
const int MIC_OFFSET = 2048;    // punto medio ADC 0–4095
// Fotoresistenza (LDR) su GPIO34 (ADC1_CH6)
const int LDR_PIN    = 34;

// === SERVER RASPBERRY (se ti serve mantenere il POST) ===
const char*    serverIP   = "192.168.1.179";
const uint16_t serverPort = 8000;
const char*    endpoint   = "/dati";

// Parametri di campionamento per il plot
const int NUM_SAMPLES = 200;               // numero di punti per frame
const unsigned long SAMPLE_PERIOD_US = 200; // intervallo tra campioni (µs) → 5 kHz

void setup() {
  Serial.begin(115200);
  delay(1000);
  dht.begin();

  // Connetti Wi-Fi (opzionale, serve solo se usi il POST)
  WiFi.begin(ssid, password);
  uint8_t retry = 0;
  while (WiFi.status() != WL_CONNECTED && retry < 20) {
    delay(500);
    retry++;
  }
}

void loop() {
  // 1) ACQUISIZIONE DELLA FORMA D’ONDA
  unsigned long t0 = micros();
  int lastMicVal = 0;
  for (int i = 0; i < NUM_SAMPLES; i++) {
    int micRaw      = analogRead(MIC_PIN);
    int micCentered = micRaw - MIC_OFFSET;        // –2048…+2047
    int micVal      = abs(micCentered);           // 0…2048
    lastMicVal      = micVal;
    Serial.println(micVal);                       // SOLO IL NUMERO per il Plotter
    // sincronizzazione al sample rate
    while (micros() - t0 < (unsigned long)(i + 1) * SAMPLE_PERIOD_US) {
      ; 
    }
  }
  delay(50); // pausa breve tra i frame

  // 2) LETTURA DEGLI ALTRI SENSORI
  float h      = dht.readHumidity();
  float t      = dht.readTemperature();
  int   ldrRaw = analogRead(LDR_PIN);

  // 3) (OPZIONALE) INVIO JSON AL SERVER
  if (WiFi.status() == WL_CONNECTED) {
    StaticJsonDocument<200> doc;
    doc["h"] = isnan(h) ? 0.0 : h;
    doc["t"] = isnan(t) ? 0.0 : t;
    doc["l"] = ldrRaw;
    doc["a"] = lastMicVal;
    String jsonBuffer;
    serializeJson(doc, jsonBuffer);

    HTTPClient http;
    String url = String("http://") + serverIP + ":" + serverPort + endpoint;
    http.begin(url);
    http.addHeader("Content-Type", "application/json");
    http.POST(jsonBuffer);
    http.end();
  }

  // 4) DEBUG NEL SERIAL MONITOR (righe che iniziano con “#” non rompono il Plotter)
  Serial.print("# Temp: ");   Serial.print(t,1);    Serial.print(" °C | ");
  Serial.print("Umid: ");     Serial.print(h,1);    Serial.print(" % | ");
  Serial.print("LDR: ");      Serial.print(ldrRaw);  Serial.print(" | ");
  Serial.print("Mic val: ");  Serial.print(lastMicVal);
  Serial.println();

  // 5) Attendi 1 s prima del prossimo ciclo completo
  delay(1000);
}
