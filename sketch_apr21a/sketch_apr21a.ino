#include <DHT.h>

// === CONFIGURAZIONE PIN ===
#define DHTPIN   2      // DATA DHT11
#define DHTTYPE  DHT11  // Tipo sensore DHT
#define LDRPIN   A0     // LDR
#define MICPIN   A4     // OUT MAX9814

DHT dht(DHTPIN, DHTTYPE);

void setup() {
  Serial.begin(9600);
  dht.begin();
}

void loop() {
  // --- Lettura DHT11 ---
  float h  = dht.readHumidity();
  float tC = dht.readTemperature();
  if (isnan(h) || isnan(tC)) {
    Serial.println("Errore di lettura dal DHT11!");
    return;
  }

  // --- Lettura LDR ---
  int ldrRaw = analogRead(LDRPIN);

  // --- Misura audio peak-to-peak (50 ms) ---
  unsigned int signalMax = 0;
  unsigned int signalMin = 1023;
  unsigned long start = millis();
  while (millis() - start < 50) {
    unsigned int v = analogRead(MICPIN);
    if (v > signalMax) signalMax = v;
    if (v < signalMin) signalMin = v;
  }
  unsigned int peakToPeak = signalMax - signalMin;

  // --- Stampa formattata per Python (regex PATTERN) ---
  // Umidita': 77.0 %   Temperatura: 20.8 C   Luminosita': 341   Audio: 232
  Serial.print("Umidita': ");
  Serial.print(h, 1);
  Serial.print(" %   Temperatura: ");
  Serial.print(tC, 1);
  Serial.print(" C   Luminosita': ");
  Serial.print(ldrRaw);
  Serial.print("   Audio: ");
  Serial.println(peakToPeak);

}
