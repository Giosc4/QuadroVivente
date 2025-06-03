#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <DHT.h>

// =========== CREDENZIALI WI-FI ===========
const char* ssid1 = "Giosca";
const char* pass1 = "GiovPass";

const char* ssid2 = "FASTWEB-FC8569";
const char* pass2 = "Bertoloni_Gang";

// =========== DHT11 su GPIO0 ===========
#define DHTPIN  0
#define DHTTYPE DHT11
DHT dht(DHTPIN, DHTTYPE);

// =========== SENSORI ANALOGICI ===========
const int MIC_PIN    = 36;   // MAX9814 sul pin 36 (ADC1_CH0)
const int MIC_OFFSET = 2048; // offset medio 0–4095
const int LDR_PIN    = 34;   // LDR su pin 34 (ADC1_CH6)

// =========== SERVER RASPBERRY (POST JSON) ===========
const char*    serverIP   = "192.168.1.179";
const uint16_t serverPort = 8000;
const char*    endpoint   = "/dati";

// Parametri di campionamento per il plot
const int            NUM_SAMPLES      = 200;            // campioni per frame
const unsigned long SAMPLE_PERIOD_US = 200;             // intervallo µs → 5 kHz

void setup() {
  Serial.begin(115200);
  delay(1000);
  dht.begin();

  // —————— PROVO PRIMA LA WI-FI “PRIMARIA” ——————
  WiFi.begin(ssid1, pass1);
  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < 10000) {
    delay(500);
  }
  if (WiFi.status() == WL_CONNECTED) {
    Serial.print("Wi-Fi: ");
    Serial.print(ssid1);
    Serial.print(" IP=");
    Serial.println(WiFi.localIP());
  }
  else {
    // —————— SE FALLISCE, PROVO “SECONDARIA” ——————
    WiFi.begin(ssid2, pass2);
    start = millis();
    while (WiFi.status() != WL_CONNECTED && millis() - start < 10000) {
      delay(500);
    }
    if (WiFi.status() == WL_CONNECTED) {
      Serial.print("Wi-Fi: ");
      Serial.print(ssid2);
      Serial.print(" IP=");
      Serial.println(WiFi.localIP());
    }
    else {
      Serial.println("Wi-Fi: nessuna connessione.");
    }
  }
}

void loop() {
  // ========== 1) ACQUISIZIONE FORMA D’ONDA ==========
  unsigned long t0      = micros();
  int           lastMic = 0;
  for (int i = 0; i < NUM_SAMPLES; i++) {
    int raw = analogRead(MIC_PIN);
    int v   = abs(raw - MIC_OFFSET);
    lastMic = v;
    Serial.println(v);  // solo valore per il Plotter
    while (micros() - t0 < (unsigned long)(i + 1) * SAMPLE_PERIOD_US) {
      ;
    }
  }
  delay(50);

  // ========== 2) LETTURA DHT11 E LDR ==========
  float h   = dht.readHumidity();
  float t   = dht.readTemperature();
  int   ldr = analogRead(LDR_PIN);

  // ========== 3) INVIO JSON AL SERVER (se connesso) ==========
  if (WiFi.status() == WL_CONNECTED) {
    StaticJsonDocument<200> doc;
    doc["h"] = isnan(h) ? 0.0 : h;
    doc["t"] = isnan(t) ? 0.0 : t;
    doc["l"] = ldr;
    doc["a"] = lastMic;
    String jsonBuffer;
    serializeJson(doc, jsonBuffer);

    HTTPClient http;
    String url = String("http://") + serverIP + ":" + serverPort + endpoint;
    http.begin(url);
    http.addHeader("Content-Type", "application/json");
    http.POST(jsonBuffer);
    http.end();
  }

  // ========== 4) DEBUG SU SERIAL MONITOR ==========
  // Uso printf per una singola riga compatta
  Serial.printf("T=%.1f°C H=%.1f%% LDR=%d MIC=%d\n", 
                t, isnan(h) ? 0.0 : h, ldr, lastMic);

  // ========== 5) ATTENDO 1 s ==========
  delay(1000);
}
