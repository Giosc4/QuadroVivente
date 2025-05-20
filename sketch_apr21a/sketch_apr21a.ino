#include <WiFi.h>
#include <HTTPClient.h>
#include <DHT.h>

// === CONFIGURAZIONE WI-FI ===
const char* SSID     = "Giosca";        // ← sostituisci con il nome della tua rete
const char* PASSWORD = "GiovPass";    // ← sostituisci con la password

// URL del tuo Raspberry Pi (Flask su porta 5000, endpoint /dati)
const char* serverURL = "http://192.168.1.100:5000/dati";

// === CONFIGURAZIONE SENSORI ===
// DHT11 su P34
#define DHTPIN   34      
#define DHTTYPE  DHT11  

// LDR su P32 (ADC1_CH4)
#define LDRPIN   32     

// MAX9814 su P35 (ADC1_CH7) → consigliato per non usare ADC2 quando c’è il Wi-Fi
#define MICPIN   35      

DHT dht(DHTPIN, DHTTYPE);

void connectWiFi() {
  Serial.print("Connessione a ");
  Serial.print(SSID);
  Serial.print(" … ");
  WiFi.begin(SSID, PASSWORD);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println();
  Serial.print("Connesso! IP: ");
  Serial.println(WiFi.localIP());
}

void sendToPi(float h, float t, int ldr, int audio) {
  if (WiFi.status() != WL_CONNECTED) return;
  HTTPClient http;
  http.begin(serverURL);
  http.addHeader("Content-Type", "application/json");
  // Costruisco JSON semplice
  String payload = "{\"h\": " + String(h,1)
                 + ", \"t\": " + String(t,1)
                 + ", \"l\": " + String(ldr)
                 + ", \"a\": " + String(audio)
                 + "}";
  int code = http.POST(payload);
  // facoltativo: Serial.println(code);
  http.end();
}

void setup() {
  Serial.begin(9600);
  delay(1000);
  connectWiFi();

  dht.begin();
  // Imposto ADC a 10 bit (0–1023)
  analogReadResolution(10);
}

void loop() {
  // --- DHT11 ---
  float h  = dht.readHumidity();
  float tC = dht.readTemperature();
  if (isnan(h) || isnan(tC)) {
    Serial.println("Errore lettura DHT11");
    delay(1000);
    return;
  }

  // --- LDR ---
  int ldrRaw = analogRead(LDRPIN);

  // --- Audio peak-to-peak in 50 ms ---
  unsigned int sigMax = 0, sigMin = 1023;
  unsigned long t0 = millis();
  while (millis() - t0 < 50) {
    unsigned int v = analogRead(MICPIN);
    if (v > sigMax) sigMax = v;
    if (v < sigMin) sigMin = v;
  }
  int peak2peak = sigMax - sigMin;

  // --- Stampa seriale (per debug/Python) ---
  Serial.print("Umidita': ");
  Serial.print(h,1);
  Serial.print(" %   Temperatura: ");
  Serial.print(tC,1);
  Serial.print(" C   Luminosita': ");
  Serial.print(ldrRaw);
  Serial.print("   Audio: ");
  Serial.println(peak2peak);

  // --- Invia al Raspberry Pi ---
  sendToPi(h, tC, ldrRaw, peak2peak);

  delay(1000);
}
