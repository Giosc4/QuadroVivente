#include <Arduino.h>
#include <DHT.h>

// === CONFIGURAZIONE PIN ===
// DHT11
#define DHTPIN    4        // GPIO4
#define DHTTYPE   DHT11
// Microfono MAX9814 analogico
const int MIC_PIN = 36;    // GPIO35 (ADC1_CH7)
// Fotoresistenza (LDR)
const int LDR_PIN = 34;    // GPIO34 (ADC1_CH6)

DHT dht(DHTPIN, DHTTYPE);

void setup() {
  Serial.begin(115200);
  dht.begin();
  // I pin analogici non richiedono pinMode(), ma non fa male
  pinMode(MIC_PIN, INPUT);
  pinMode(LDR_PIN, INPUT);
  delay(1000);
  Serial.println("Inizio letture sensori...");
}

void loop() {
  // --- Lettura DHT11 ---
  float h = dht.readHumidity();
  float t = dht.readTemperature();


  // --- Lettura fotoresistenza (LDR) ---
  int ldrRaw = analogRead(LDR_PIN);      // 0–4095
  float ldrVolt = ldrRaw * (3.3 / 4095); // converte in volt

  // --- Lettura MAX9814 (microfono) ---
  long sum = 0;
  const int samples = 20;
  for (int i = 0; i < samples; i++) {
    sum += analogRead(MIC_PIN);
  }
  float micAvg = sum / float(samples);

  // ——— Stampa con etichette ———
  Serial.print("Temp: ");
    Serial.print(t, 1);        // 1 cifra decimale
    Serial.print(" °C  |  ");
  Serial.print("Umid: ");
    Serial.print(h, 1);
    Serial.print(" %  |  ");
  Serial.print("Luce (raw): ");
    Serial.print(ldrRaw);
    Serial.print("  |  ");
    Serial.print(" V  |  ");
  Serial.print("Rumore: ");
    Serial.println(micAvg, 0); // valore intero

  delay(1000);
}
