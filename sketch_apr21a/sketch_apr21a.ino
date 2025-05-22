#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <DHT.h>

// === CONFIGURAZIONE WIFI ===
const char* ssid     = "FASTWEB-FC8569";
const char* password = "Bertoloni_Gang";

// === CONFIGURAZIONE PIN E SENSORI ===
// DHT11
#define DHTPIN    4        // GPIO4 
#define DHTTYPE   DHT11
DHT dht(DHTPIN, DHTTYPE);

// Microfono MAX9814 analogico
const int MIC_PIN = 36;    // GPIO36 (ADC1_CH0)
// Fotoresistenza (LDR)
const int LDR_PIN = 34;    // GPIO34 (ADC1_CH6)

// === SERVER RASPBERRY ===
const char* serverIP = "192.168.1.179";
const uint16_t serverPort = 8000;
const char* endpoint = "/dati";

void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("Inizio configurazione...");

  // Avvia DHT
  dht.begin();

  // Connessione Wi-Fi
  WiFi.begin(ssid, password);
  Serial.print("Connessione a WiFi ");
  Serial.print(ssid);
  Serial.print(" ...");
  uint8_t retry = 0;
  while (WiFi.status() != WL_CONNECTED && retry < 20) {
    delay(500);
    Serial.print(".");
    retry++;
  }
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nWiFi connesso!");
    Serial.print("IP locale: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("\nErrore di connessione WiFi");
  }
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    // tenta di riconnetterti
    WiFi.reconnect();
    delay(1000);
    return;
  }

  // --- Letture sensori ---
  float h = dht.readHumidity();
  float t = dht.readTemperature();

  int ldrRaw = analogRead(LDR_PIN);      
  long sum = 0;
  const int samples = 20;
  for (int i = 0; i < samples; i++) {
    sum += analogRead(MIC_PIN);
  }
  float micAvg = sum / float(samples);

  // --- Prepara JSON ---
  StaticJsonDocument<200> doc;
  doc["h"] = isnan(h) ? 0.0 : h;
  doc["t"] = isnan(t) ? 0.0 : t;
  doc["l"] = ldrRaw;
  doc["a"] = int(micAvg);

  String jsonBuffer;
  serializeJson(doc, jsonBuffer);

  // --- Invia POST ---
  HTTPClient http;
  String url = String("http://") + serverIP + ":" + serverPort + endpoint;
  http.begin(url);
  http.addHeader("Content-Type", "application/json");

  int httpCode = http.POST(jsonBuffer);
  if (httpCode > 0) {
    Serial.print("POST "); Serial.print(url);
    Serial.print(" -> codice: "); Serial.println(httpCode);
    String payload = http.getString();
    Serial.print("Risposta: "); Serial.println(payload);
  } else {
    Serial.print("Errore HTTP POST: ");
    Serial.println(http.errorToString(httpCode).c_str());
  }
  http.end();

  // --- Debug su seriale ---
  Serial.print("Temp: "); Serial.print(t, 1);  Serial.print(" °C  |  ");
  Serial.print("Umid: "); Serial.print(h, 1);  Serial.print(" %  |  ");
  Serial.print("LDR raw: "); Serial.print(ldrRaw);  Serial.print("  |  ");
  Serial.print("Mic avg: "); Serial.println(micAvg, 0);

  delay(1000);
}
