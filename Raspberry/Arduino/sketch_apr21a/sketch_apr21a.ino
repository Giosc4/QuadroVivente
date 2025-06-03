#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <DHT.h>

// === CONFIGURAZIONE WIFI ===
const char* ssid     = "Giosca";
const char* password = "GiovPass";

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
const char*    serverIP   = "172.20.10.3";
const uint16_t serverPort = 8000;
const char*    endpoint   = "/dati";

void setup() {
  Serial.begin(115200);
  delay(1000);
  dht.begin();

  // Mostro a video il tentativo di connessione
  Serial.print("Connecting to Wi-Fi \"");
  Serial.print(ssid);
  Serial.println("\" ...");

  WiFi.begin(ssid, password);

  uint8_t retry = 0;
  while (WiFi.status() != WL_CONNECTED && retry < 20) {
    delay(500);
    Serial.print(".");   // punto per ogni tentativo
    retry++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println();  // salto di riga dopo i puntini
    Serial.print("Wi-Fi connected. IP address: ");
    Serial.println(WiFi.localIP());
  }
  else {
    Serial.println();  // salto di riga dopo i puntini
    Serial.println("Failed to connect to Wi-Fi.");
  }
}

void loop() {
  // 1) LETTURA IMMEDIATA DEL MICROFONO
  int micRaw      = analogRead(MIC_PIN);
  int micCentered = micRaw - MIC_OFFSET;      // –2048…+2047
  int micVal      = abs(micCentered);         // 0…2048

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
    doc["a"] = micVal;
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
  Serial.print("Mic val: ");  Serial.print(micVal);
  Serial.println();

  // 5) Attendi 1 s prima del prossimo ciclo completo
  delay(1000);
}
