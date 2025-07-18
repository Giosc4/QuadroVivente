#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <DHT.h>

// =========== CONFIGURAZIONE WIFI ===========
const char* ssid = "QuadroVivente_AP";
const char* password = "quadro2025";

// =========== CONFIGURAZIONE SERVER ===========
const char* serverHost = "192.168.4.1";
const uint16_t serverPort = 8000;
const char* endpoint = "/api/data";

// =========== CONFIGURAZIONE SENSORI ===========
#define DHTPIN 22
#define DHTTYPE DHT11
DHT dht(DHTPIN, DHTTYPE);
const int MIC_PIN = 36;  // rumore (ADC1_CH0)
const int LDR_PIN = 34;  // luminosità (ADC1_CH6)

// =========== DEVICE ID ===========
String deviceID = "Esp_Giovanni";

// =========== INTERVALLI ===========
const unsigned long SEND_INTERVAL = 1000;        // 1 secondo per tutti i dati
const unsigned long HEARTBEAT_INTERVAL = 60000;  // 1 minuto per heartbeat

// =========== VARIABILI GLOBALI ===========
unsigned long lastSend = 0;
unsigned long lastHeartbeat = 0;

// -----------------------------------------------------
// Callback eventi WiFi
void onWiFiEvent(WiFiEvent_t event) {
  switch (event) {
    case ARDUINO_EVENT_WIFI_STA_GOT_IP:
      Serial.printf("\n✔ WiFi connesso, IP: %s\n",
                    WiFi.localIP().toString().c_str());
      break;
    case ARDUINO_EVENT_WIFI_STA_DISCONNECTED:
      Serial.println("\n✖ WiFi disconnesso!");
      break;
    default:
      break;
  }
}

void setup() {
  Serial.begin(115200);
  delay(1000);

  // Configura ADC LDR per full‑range (0–3.6 V)
  analogSetPinAttenuation(LDR_PIN, ADC_11db);
  analogSetWidth(12);

  // Inizializza DHT
  dht.begin();
  deviceID.replace(":", "");

  // Header seriale
  Serial.println("========================================");
  Serial.println("    QUADRI VIVENTI - ESP32 CLIENT");
  Serial.println("========================================");
  Serial.println("Device ID: " + deviceID);
  Serial.printf("Server: http://%s:%u%s\n", serverHost, serverPort, endpoint);
  Serial.println("========================================");

  // Registra eventi WiFi
  WiFi.onEvent(onWiFiEvent, ARDUINO_EVENT_WIFI_STA_GOT_IP);
  WiFi.onEvent(onWiFiEvent, ARDUINO_EVENT_WIFI_STA_DISCONNECTED);

  // Connessione iniziale
  connectToWiFi();
  if (WiFi.status() == WL_CONNECTED) {
    registerDevice();
  }
}

void loop() {
  unsigned long now = millis();

  // 1) Heartbeat periodico per mantenere lo stato “online”
  if (now - lastHeartbeat >= HEARTBEAT_INTERVAL) {
    Serial.println("⟳ Heartbeat: re-registrazione device");
    registerDevice();
    lastHeartbeat = now;
  }

  // 2) Se il WiFi è caduto, prova a riconnettere
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("✖ WiFi non connesso, tenterò di ricollegarmi…");
    connectToWiFi();
    if (WiFi.status() == WL_CONNECTED) {
      Serial.println("✔ Riconnesso al WiFi, re-registro device");
      registerDevice();
    } else {
      delay(500);
      return;  // salto l’invio finché non torna il WiFi
    }
  }

  // 3) Invio unificato ogni SEND_INTERVAL
  if (now - lastSend >= SEND_INTERVAL) {
    sendAllData();
    lastSend = now;
  }

  delay(10);
}

// -----------------------------------------------------
void connectToWiFi() {
  if (WiFi.status() == WL_CONNECTED) return;
  Serial.print("Connessione al WiFi");
  WiFi.begin(ssid, password);
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 10) {
    delay(1000);
    Serial.print(".");
    attempts++;
  }
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("\n✖ Errore connessione WiFi");
  }
}

void registerDevice() {
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
  Serial.printf("Registrazione device → HTTP %d (%s)\n",
                code,
                code > 0 ? http.getString().c_str()
                         : http.errorToString(code).c_str());
  http.end();
}

// -----------------------------------------------------
// Legge tutti i sensori e invia un unico JSON
void sendAllData() {
  // Letture sensori
  float h = dht.readHumidity();
  float t = dht.readTemperature();
  if (isnan(h)) h = 0.0;
  if (isnan(t)) t = 0.0;

  int light = analogRead(LDR_PIN);  // ultimo dato luminosità
  int noise = analogRead(MIC_PIN);  // ultimo dato rumore

  Serial.printf(">> Dati: H=%.1f%% T=%.1f°C LDR=%d Noise=%d\n",
                h, t, light, noise);

  // Prepara JSON
  StaticJsonDocument<512> doc;
  doc["device_id"] = deviceID;
  doc["h"] = h;
  doc["t"] = t;
  doc["l"] = light;
  doc["n"] = noise;

  // Invia
  postJson(doc, "ALL");
}

template<size_t N>
void postJson(const StaticJsonDocument<N>& doc, const char* tag) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.printf("  %s SKIP: WiFi non connesso\n", tag);
    return;
  }

  HTTPClient http;
  String url = String("http://") + serverHost + ":" + serverPort + endpoint;
  Serial.printf("  %s → POST %s\n", tag, url.c_str());

  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("Connection", "close", true);
  http.setTimeout(5000);

  String payload;
  serializeJson(doc, payload);

  int code = http.POST(payload);
  if (code > 0) {
    if (code == 200) {
      Serial.printf("    %s OK (200)\n", tag);
    } else {
      Serial.printf("    %s WARN HTTP %d: %s\n",
                    tag, code, http.getString().c_str());
    }
  } else {
    Serial.printf("    %s ERR %d: %s\n",
                  tag, code, http.errorToString(code).c_str());
  }
  http.end();
}
