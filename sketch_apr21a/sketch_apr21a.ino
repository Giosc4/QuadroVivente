#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <DHT.h>

// === CONFIGURAZIONE WIFI ===
const char* ssid     = "FASTWEB-FC8569";
const char* password = "Bertoloni_Gang";

// === DHT11 su GPIO4 ===
#define DHTPIN    4
#define DHTTYPE   DHT11
DHT dht(DHTPIN, DHTTYPE);

// === SENSORI ANALOGICI ===
// Microfono MAX9814 analogico su GPIO36 (ADC1_CH0)
const int MIC_PIN    = 36;
const int MIC_OFFSET = 2048;    // punto medio ADC 0–4095
// Fotoresistenza (LDR) su GPIO34 (ADC1_CH6)
const int LDR_PIN    = 34;

// === SERVER RASPBERRY ===
const char*    serverIP   = "192.168.1.179";
const uint16_t serverPort = 8000;
const char*    endpoint   = "/dati";

void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("# Inizio configurazione...");

  dht.begin();
  WiFi.begin(ssid, password);
  Serial.print("# Connetto a WiFi "); Serial.println(ssid);
  uint8_t retry = 0;
  while (WiFi.status() != WL_CONNECTED && retry < 20) {
    delay(500);
    Serial.print(".");
    retry++;
  }
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n# WiFi connesso!");
    Serial.print("# IP locale: "); Serial.println(WiFi.localIP());
  } else {
    Serial.println("\n# Errore di connessione WiFi");
  }
}

void loop() {
  // Se perdi il WiFi, tenta di ricollegarti
  if (WiFi.status() != WL_CONNECTED) {
    WiFi.reconnect();
    delay(1000);
    return;
  }

  // --- Letture DHT11 e LDR (una volta per ciclo) ---
  float h      = dht.readHumidity();
  float t      = dht.readTemperature();
  int   ldrRaw = analogRead(LDR_PIN);

  // --- Lettura microfono semplificata ---
  int micRaw   = analogRead(MIC_PIN);
  int micValue = abs(micRaw - MIC_OFFSET);

  // 1) **Serial Plotter**: stampo solo il valore (forma d'onda)
  Serial.println(micValue);

  // 2) Preparo il JSON e invio al server
  StaticJsonDocument<200> doc;
  doc["h"] = isnan(h)      ? 0.0 : h;
  doc["t"] = isnan(t)      ? 0.0 : t;
  doc["l"] = ldrRaw;
  doc["a"] = micValue;
  String jsonBuffer;
  serializeJson(doc, jsonBuffer);

  HTTPClient http;
  String url = String("http://") + serverIP + ":" + serverPort + endpoint;
  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  int httpCode = http.POST(jsonBuffer);
  if (httpCode > 0) {
    Serial.print("# POST OK, codice: ");
    Serial.println(httpCode);
  } else {
    Serial.print("# Errore POST: ");
    Serial.println(http.errorToString(httpCode).c_str());
  }
  http.end();

  // 3) **Serial Monitor** (debug, prefisso `#`)
  Serial.print("# Temp: ");    Serial.print(t,1);    Serial.print(" °C | ");
  Serial.print("Umid: ");      Serial.print(h,1);    Serial.print(" % | ");
  Serial.print("LDR: ");       Serial.print(ldrRaw);  Serial.print(" | ");
  Serial.print("Mic raw: ");   Serial.print(micRaw);  Serial.print(" | ");
  Serial.print("Mic val: ");   Serial.println(micValue);

  // Aspetto un po' prima del ciclo successivo
  delay(100);
}
