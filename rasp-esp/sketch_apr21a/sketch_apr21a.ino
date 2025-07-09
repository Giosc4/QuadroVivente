#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <DHT.h>

// =========== CONFIGURAZIONE WIFI ===========
const char *ssid = "QuadriViventi_WiFi";
const char *password = "quadriviventi2025";

// =========== CONFIGURAZIONE SERVER ===========
const char *serverHost = "raspberrypi.local";
const uint16_t serverPort = 8000;
const char *endpoint = "/api/device_data";

// =========== CONFIGURAZIONE SENSORI ===========
#define DHTPIN 4
#define DHTTYPE DHT11
DHT dht(DHTPIN, DHTTYPE);

const int MIC_PIN = 36;      // MAX9814 sul pin 36 (ADC1_CH0)
const int MIC_OFFSET = 2048; // offset medio 0–4095
const int LDR_PIN = 34;      // LDR su pin 34 (ADC1_CH6)

// =========== IDENTIFICAZIONE DISPOSITIVO ===========
String deviceID;
String deviceLocation = "Esp_Giovanni"; // Puoi cambiare questa stringa

// =========== PARAMETRI CAMPIONAMENTO ===========
const int NUM_SAMPLES = 100;
const unsigned long SAMPLE_PERIOD_US = 200;
const unsigned long SEND_INTERVAL = 1000; // Invia dati ogni 1 secondo

// =========== VARIABILI GLOBALI ===========
unsigned long lastSendTime = 0;
int connectionAttempts = 0;
const int MAX_CONNECTION_ATTEMPTS = 5;

void setup()
{
  Serial.begin(115200);
  delay(1000);

  // Inizializza sensori
  dht.begin();

  // Genera ID dispositivo univoco basato su MAC address
  deviceID = "ESP32_" + WiFi.macAddress();
  deviceID.replace(":", "");

  Serial.println("========================================");
  Serial.println("    QUADRI VIVENTI - ESP32 CLIENT");
  Serial.println("========================================");
  Serial.println("Device ID: " + deviceID);
  Serial.println("Location: " + deviceLocation);
  Serial.println("========================================");

  // Connetti al WiFi
  connectToWiFi();

  // Registra il dispositivo al server
  registerDevice();
}

void loop()
{
  // Verifica connessione WiFi
  if (WiFi.status() != WL_CONNECTED)
  {
    Serial.println("WiFi disconnesso, tentativo di riconnessione...");
    connectToWiFi();
  }

  // Invia dati ogni SEND_INTERVAL millisecondi
  if (millis() - lastSendTime >= SEND_INTERVAL)
  {
    readAndSendSensorData();
    lastSendTime = millis();
  }

  delay(50);
}

void connectToWiFi()
{
  WiFi.begin(ssid, password);
  connectionAttempts = 0;

  Serial.print("Connessione al WiFi");

  while (WiFi.status() != WL_CONNECTED && connectionAttempts < MAX_CONNECTION_ATTEMPTS)
  {
    delay(1000);
    Serial.print(".");
    connectionAttempts++;
  }

  if (WiFi.status() == WL_CONNECTED)
  {
    Serial.println();
    Serial.println("WiFi connesso!");
    Serial.println("IP address: " + WiFi.localIP().toString());
    Serial.println("RSSI: " + String(WiFi.RSSI()) + " dBm");
  }
  else
  {
    Serial.println();
    Serial.println("ERRORE: Impossibile connettersi al WiFi");
    Serial.println("Riprovo tra 10 secondi...");
    delay(10000);
  }
}

void registerDevice()
{
  if (WiFi.status() != WL_CONNECTED)
  {
    return;
  }

  HTTPClient http;
  String url = String("http://") + serverHost + ":" + serverPort + "/api/device_register";

  http.begin(url);
  http.addHeader("Content-Type", "application/json");

  // Crea JSON per registrazione
  StaticJsonDocument<200> doc;
  doc["device_id"] = deviceID;
  doc["mac_address"] = WiFi.macAddress();
  doc["location"] = deviceLocation;
  doc["ip_address"] = WiFi.localIP().toString();
  doc["rssi"] = WiFi.RSSI();

  String jsonBuffer;
  serializeJson(doc, jsonBuffer);

  int httpResponseCode = http.POST(jsonBuffer);

  if (httpResponseCode > 0)
  {
    String response = http.getString();
    Serial.println("Registrazione dispositivo:");
    Serial.println("Response code: " + String(httpResponseCode));
    Serial.println("Response: " + response);
  }
  else
  {
    Serial.println("Errore nella registrazione: " + String(httpResponseCode));
  }

  http.end();
}

void readAndSendSensorData()
{
  // ========== LETTURA SENSORI ==========

  // Lettura audio (campionamento)
  int audioLevel = readAudioLevel();

  // Lettura DHT11
  float humidity = dht.readHumidity();
  float temperature = dht.readTemperature();

  // Lettura LDR
  int lightLevel = analogRead(LDR_PIN);

  // Verifica validità dati DHT11
  if (isnan(humidity))
    humidity = 0.0;
  if (isnan(temperature))
    temperature = 0.0;

  // ========== INVIO DATI AL SERVER ==========
  sendDataToServer(temperature, humidity, lightLevel, audioLevel);

  // ========== DEBUG SU SERIALE ==========
  Serial.printf("T=%.1f°C H=%.1f%% L=%d A=%d | WiFi: %ddBm\n",
                temperature, humidity, lightLevel, audioLevel, WiFi.RSSI());
}

int readAudioLevel()
{
  int maxValue = 0;
  unsigned long startTime = micros();

  // Campiona per un breve periodo e trova il valore massimo
  for (int i = 0; i < NUM_SAMPLES; i++)
  {
    int raw = analogRead(MIC_PIN);
    int value = abs(raw - MIC_OFFSET);

    if (value > maxValue)
    {
      maxValue = value;
    }

    // Attendi il prossimo campione
    while (micros() - startTime < (unsigned long)(i + 1) * SAMPLE_PERIOD_US)
    {
      // Attesa attiva
    }
  }

  return maxValue;
}

void sendDataToServer(float temperature, float humidity, int light, int audio)
{
  if (WiFi.status() != WL_CONNECTED)
  {
    Serial.println("WiFi non connesso, impossibile inviare dati");
    return;
  }

  HTTPClient http;
  String url = String("http://") + serverHost + ":" + serverPort + "/api/device_data";

  http.begin(url);
  http.addHeader("Content-Type", "application/json");

  // Crea JSON con tutti i dati
  StaticJsonDocument<300> doc;
  doc["id"] = deviceID;
  doc["location"] = deviceLocation;
  doc["mac_address"] = WiFi.macAddress();
  doc["timestamp"] = millis();
  doc["t"] = temperature;
  doc["h"] = humidity;
  doc["l"] = light;
  doc["a"] = audio;
  doc["rssi"] = WiFi.RSSI();
  doc["ip"] = WiFi.localIP().toString();

  String jsonBuffer;
  serializeJson(doc, jsonBuffer);

  int httpResponseCode = http.POST(jsonBuffer);

  if (httpResponseCode > 0)
  {
    if (httpResponseCode == 200)
    {
      // Successo - non stampare per non intasare il seriale
    }
    else
    {
      Serial.println("Server response: " + String(httpResponseCode));
    }
  }
  else
  {
    Serial.println("Errore HTTP: " + String(httpResponseCode));
    Serial.println("Errore: " + http.errorToString(httpResponseCode));
  }

  http.end();
}

// Funzione per aggiornare la posizione del dispositivo
void updateDeviceLocation(String newLocation)
{
  deviceLocation = newLocation;
  Serial.println("Posizione aggiornata: " + deviceLocation);

  // Ri-registra il dispositivo con la nuova posizione
  registerDevice();
}

// Funzione per ottenere informazioni sul dispositivo
void printDeviceInfo()
{
  Serial.println("========== DEVICE INFO ==========");
  Serial.println("Device ID: " + deviceID);
  Serial.println("Location: " + deviceLocation);
  Serial.println("MAC Address: " + WiFi.macAddress());
  Serial.println("IP Address: " + WiFi.localIP().toString());
  Serial.println("RSSI: " + String(WiFi.RSSI()) + " dBm");
  Serial.println("Uptime: " + String(millis() / 1000) + " secondi");
  Serial.println("================================");
}