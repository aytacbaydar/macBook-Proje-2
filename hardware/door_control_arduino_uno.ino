#include <ArduinoJson.h>

// Pin tanımlamaları
const int RELAY_PIN = 7;        // Röle kontrolü için dijital pin 7
const int LED_PIN = 13;         // Built-in LED (pin 13)
const int BUZZER_PIN = 8;       // Buzzer için dijital pin 8

// Kapı durumu
bool doorOpen = false;
unsigned long doorOpenTime = 0;
const unsigned long AUTO_CLOSE_TIME = 5000; // 5 saniye otomatik kapanma

// Seri haberleşme için buffer
String inputString = "";
boolean stringComplete = false;

void setup() {
  // Seri haberleşmeyi başlat
  Serial.begin(9600);

  // Pin konfigürasyonu
  pinMode(RELAY_PIN, OUTPUT);
  pinMode(LED_PIN, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);

  // Başlangıç durumu
  digitalWrite(RELAY_PIN, LOW);   // Kapı kapalı
  digitalWrite(LED_PIN, LOW);     // LED kapalı
  digitalWrite(BUZZER_PIN, LOW);

  // Başlangıç mesajı
  Serial.println("{\"status\":\"ready\",\"message\":\"Arduino Uno Kapı Kontrol Sistemi Hazır\"}");

  // Başlangıç sesi
  playStartupSound();

  // Input string'i reserve et
  inputString.reserve(200);
}

void loop() {
  // Seri portan gelen verileri oku
  while (Serial.available()) {
    char inChar = (char)Serial.read();
    inputString += inChar;

    if (inChar == '\n') {
      stringComplete = true;
    }
  }

  // Komut geldiğinde işle
  if (stringComplete) {
    processCommand(inputString);
    inputString = "";
    stringComplete = false;
  }

  // Otomatik kapı kapanma kontrolü
  if (doorOpen && (millis() - doorOpenTime > AUTO_CLOSE_TIME)) {
    closeDoor();
    Serial.println("{\"status\":\"auto_closed\",\"message\":\"Kapı otomatik olarak kapatıldı\"}");
  }

  delay(100);
}

void processCommand(String command) {
  // JSON parse et
  DynamicJsonDocument doc(1024);
  DeserializationError error = deserializeJson(doc, command);

  if (error) {
    Serial.println("{\"success\":false,\"message\":\"Geçersiz JSON formatı\"}");
    return;
  }

  String action = doc["action"];
  String classroom = doc["classroom"];
  String student_name = doc["student_name"];

  if (action == "open_door") {
    openDoor();
    Serial.println("{\"success\":true,\"message\":\"Kapı açıldı\",\"status\":\"open\",\"classroom\":\"" + classroom + "\",\"student\":\"" + student_name + "\"}");
  } 
  else if (action == "close_door") {
    closeDoor();
    Serial.println("{\"success\":true,\"message\":\"Kapı kapatıldı\",\"status\":\"closed\",\"classroom\":\"" + classroom + "\"}");
  }
  else if (action == "status") {
    String status = doorOpen ? "open" : "closed";
    Serial.println("{\"success\":true,\"door_status\":\"" + status + "\",\"uptime\":" + String(millis()) + "}");
  }
  else {
    Serial.println("{\"success\":false,\"message\":\"Geçersiz komut: " + action + "\"}");
  }
}

void openDoor() {
  doorOpen = true;
  doorOpenTime = millis();

  digitalWrite(RELAY_PIN, HIGH);  // Röleyi aktifleştir
  digitalWrite(LED_PIN, HIGH);    // LED'i yak

  // Kapı açılma sesi
  playOpenSound();
}

void closeDoor() {
  doorOpen = false;

  digitalWrite(RELAY_PIN, LOW);   // Röleyi deaktifleştir
  digitalWrite(LED_PIN, LOW);     // LED'i söndür

  // Kapı kapanma sesi
  playCloseSound();
}

void playStartupSound() {
  // Sistem başlangıç melodisi
  tone(BUZZER_PIN, 1000, 200);
  delay(250);
  tone(BUZZER_PIN, 1500, 200);
  delay(250);
  tone(BUZZER_PIN, 2000, 200);
}

void playOpenSound() {
  // Kapı açılma sesi
  tone(BUZZER_PIN, 800, 100);
  delay(150);
  tone(BUZZER_PIN, 1200, 100);
}

void playCloseSound() {
  // Kapı kapanma sesi
  tone(BUZZER_PIN, 1200, 100);
  delay(150);
  tone(BUZZER_PIN, 800, 100);
}