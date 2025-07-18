#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <DHT.h>

// =========== CONFIGURAZIONE WIFI ===========
const char* ssid = "QuadroVivente_AP";
const char* password = "quadro2025";

// =========== CONFIGURAZIONE SERVER ===========
const char* serverHost = "192.168.4.1";  // IP Raspberry Pi AP
const uint16_t serverPort = 8000;
const char* endpoint = "/api/data";

// =========== CONFIGURAZIONE SENSORI ===========
#define DHTPIN 22
#define DHTTYPE DHT11
DHT dht(DHTPIN, DHTTYPE);
const int MIC_PIN = 36;  // MAX9814 ADC1_CH0
const int LDR_PIN = 34;  // ADC1_CH6

// =========== DEVICE ID ===========
String deviceID = "Esp_Giovanni";

// =========== INTERVALLI ===========
const unsigned long FAST_INTERVAL = 225;   // ms: audio + luminosità
const unsigned long SLOW_INTERVAL = 1000;  // ms: DHT11

// =========== PARAMETRI CAMPIONAMENTO AUDIO ===========
const int NUM_SAMPLES = 100;
const unsigned long SAMPLE_PERIOD_US = 200;

// =========== VARIABILI GLOBALI ===========
unsigned long lastFastSend = 0;
unsigned long lastSlowSend = 0;

// =====================================================
void setup() {
  Serial.begin(115200);
  delay(2000);

  // Inizializza sensori
  dht.begin();
  deviceID.replace(":", "");

  Serial.println("========================================");
  Serial.println("    QUADRI VIVENTI - ESP32 CLIENT");
  Serial.println("========================================");
  Serial.println("Device ID: " + deviceID);
  Serial.println("Server: http://" + String(serverHost) + ":" + serverPort + endpoint);
  Serial.println("========================================");

  connectToWiFi();
  registerDevice();
  printDeviceInfo();
}

void loop() {
  unsigned long now = millis();

  // Invio rapidi: audio + luminosità
  if (now - lastFastSend >= FAST_INTERVAL) {
    sendFastData();
    lastFastSend = now;
  }

  // Invio lenti: umidità + temperatura
  if (now - lastSlowSend >= SLOW_INTERVAL) {
    sendSlowData();
    lastSlowSend = now;
  }

  delay(10);  // riduce utilizzo CPU
}

// -----------------------------------------------------
void connectToWiFi() {
  WiFi.begin(ssid, password);
  Serial.print("Connessione al WiFi");
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 10) {
    delay(1000);
    Serial.print(".");
    attempts++;
  }
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nWiFi connesso!");
    Serial.println("IP: " + WiFi.localIP().toString());
  } else {
    Serial.println("\nErrore connessione WiFi");
  }
}

void registerDevice() {
  if (WiFi.status() != WL_CONNECTED) return;

  HTTPClient http;
  String url = String("http://") + serverHost + ":" + serverPort + "/api/device_register";
  http.begin(url);
  http.addHeader("Content-Type", "application/json");

  StaticJsonDocument<200> doc;
  doc["device_id"] = deviceID;
  doc["mac_address"] = WiFi.macAddress();
  doc["ip_address"] = WiFi.localIP().toString();
  doc["rssi"] = WiFi.RSSI();

  String payload;
  serializeJson(doc, payload);
  int code = http.POST(payload);
  if (code > 0) {
    Serial.println("Registrazione: " + String(code));
  } else {
    Serial.println("Errore registrazione: " + String(code));
  }
  http.end();
}

void printDeviceInfo() {
  Serial.println("========== DEVICE INFO ==========");
  Serial.println("ID: " + deviceID);
  Serial.println("MAC: " + WiFi.macAddress());
  Serial.println("IP : " + WiFi.localIP().toString());
  Serial.println("RSSI: " + String(WiFi.RSSI()) + " dBm");
  Serial.println("Uptime: " + String(millis() / 1000) + " s");
  Serial.println("================================");
}

// -----------------------------------------------------
// Campionamento raw audio
void readAudioRaw(int* buffer) {
  unsigned long start = micros();
  for (int i = 0; i < NUM_SAMPLES; i++) {
    buffer[i] = analogRead(MIC_PIN);
    while (micros() - start < (unsigned long)(i + 1) * SAMPLE_PERIOD_US) {}
  }
}

// Invio audio + luminosità
void sendFastData() {
  if (WiFi.status() != WL_CONNECTED) return;

  // Lettura
  int light = analogRead(LDR_PIN);
  int audioSamples[NUM_SAMPLES];
  readAudioRaw(audioSamples);

  // Serializzazione JSON
  StaticJsonDocument<1024> doc;
  doc["device_id"] = deviceID;
  doc["l"] = light;
  JsonArray arr = doc.createNestedArray("audio_raw");
  for (int i = 0; i < NUM_SAMPLES; i++) arr.add(audioSamples[i]);

  postJson(doc);
}

// Invio umidità + temperatura
void sendSlowData() {
  if (WiFi.status() != WL_CONNECTED) return;

  float h = dht.readHumidity();
  float t = dht.readTemperature();
  if (isnan(h)) h = 0.0;
  if (isnan(t)) t = 0.0;

  StaticJsonDocument<256> doc;
  doc["device_id"] = deviceID;
  doc["h"] = h;
  doc["t"] = t;

  postJson(doc);
}

template<size_t N>
void postJson(const StaticJsonDocument<N>& doc) {
  HTTPClient http;
  String url = String("http://") + serverHost + ":" + serverPort + endpoint;
  http.begin(url);
  http.addHeader("Content-Type", "application/json");

  String payload;
  serializeJson(doc, payload);
  int code = http.POST(payload);
  if (code <= 0) {
    Serial.println("HTTP error: " + String(code));
  } else if (code != 200) {
    Serial.println("Server response: " + String(code));
    Serial.println(http.getString());
  }
  http.end();
}
