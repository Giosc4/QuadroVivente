#include <DHT.h>

// === CONFIGURAZIONE PIN ===
#define DHTPIN   2      // pin DATA del DHT11
#define DHTTYPE  DHT11  // tipo di sensore DHT
#define LDRPIN   A0     // pin analogico per la fotoresistenza

DHT dht(DHTPIN, DHTTYPE);

void setup() {
  Serial.begin(9600);
  dht.begin();
  Serial.println("Inizio letture: Umidita', Temperatura, Luminosita'");
}

void loop() {
  delay(20);  // intervallo minimo consigliato per DHT11

  // --- Letture DHT11 ---
  float h  = dht.readHumidity();
  float tC = dht.readTemperature();      // gradi Celsius
  float tF = dht.readTemperature(true);  // gradi Fahrenheit

  // Controllo errori DHT11
  if (isnan(h) || isnan(tC)) {
    Serial.println("Errore di lettura dal DHT11!");
  } else {
    // --- Lettura LDR ---
    int ldrRaw = analogRead(LDRPIN);  
    // ldrRaw varia da 0 (0 V) a 1023 (5 V)

    // Stampa su Serial Monitor
    Serial.print("Umidita': ");
    Serial.print(h, 1);
    Serial.print(" %   ");

    Serial.print("Temperatura: ");
    Serial.print(tC, 1);
    Serial.print(" C   ");

    Serial.print("Luminosita': ");
    Serial.print(ldrRaw);
    Serial.println(" (70-950)");
  }

  // opzionale: se vuoi anche Fahrenheit
  // Serial.print(" ~ ");
  // Serial.print(tF, 1);
  // Serial.println(" F");

}
