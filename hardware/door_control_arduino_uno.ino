// Arduino Uno Kapı Kontrol Sistemi
// Bu kod Arduino Uno için optimize edilmiştir
// Seri haberleşme: 9600 baud rate
// Kapı kontrolü: Röle modülü ile

#include <ArduinoJson.h>

// Pin tanımlamaları
const int RELAY_PIN = 7;     // Röle kontrol pini
const int LED_PIN = 13;      // Durum LED'i (Arduino Uno'da dahili LED)
const int STATUS_LED = 11;   // Harici durum LED'i (opsiyonel)

// Kapı durumu
bool door_open = false;
unsigned long last_action_time = 0;

void setup() {
  // Seri haberleşme başlat
  Serial.begin(9600);

  // Pin modlarını ayarla
  pinMode(RELAY_PIN, OUTPUT);
  pinMode(LED_PIN, OUTPUT);
  pinMode(STATUS_LED, OUTPUT);

  // Başlangıç durumu - kapı kapalı
  digitalWrite(RELAY_PIN, LOW);
  digitalWrite(LED_PIN, LOW);
  digitalWrite(STATUS_LED, LOW);

  // Başlangıç mesajı
  Serial.println("{\"success\":true,\"message\":\"Arduino Uno Kapi Kontrol Hazir\",\"port\":\"COM5\"}");
}

void loop() {
  // Seri portan gelen verileri oku
  while (Serial.available()) {
    char inChar = (char)Serial.read();
    if (inChar == '\n') {
      static String inputString;
      processCommand(inputString);
      inputString = "";
    } else {
      static String inputString;
      inputString += inChar;
    }
  }
  delay(100);
}

void processCommand(String command) {
  // JSON parse et
  DynamicJsonDocument doc(1024);
  DeserializationError error = deserializeJson(doc, command);

  if (error) {
    Serial.println("{\"success\":false,\"message\":\"Gecersiz JSON formatı\"}");
    return;
  }

  String action = doc["action"];
  String classroom = doc["classroom"];
  String student_name = doc["student_name"];

  if (action == "open_door") {
    openDoor();
    Serial.println("{\"success\":true,\"message\":\"Kapi acildi\",\"status\":\"open\",\"classroom\":\"" + classroom + "\",\"student\":\"" + student_name + "\"}");
  }
  else if (action == "close_door") {
    closeDoor();
    Serial.println("{\"success\":true,\"message\":\"Kapi kapatildi\",\"status\":\"closed\",\"classroom\":\"" + classroom + "\"}");
  }
  else if (action == "status") {
    String status = door_open ? "open" : "closed";
    Serial.println("{\"success\":true,\"door_status\":\"" + status + "\",\"uptime\":" + String(millis()) + "}");
  }
  else {
    Serial.println("{\"success\":false,\"message\":\"Gecersiz komut: " + action + "\"}");
  }
}

void openDoor() {
  door_open = true;
  last_action_time = millis();

  digitalWrite(RELAY_PIN, HIGH);  // Röleyi aktifleştir
  digitalWrite(LED_PIN, HIGH);    // Built-in LED'i yak
  digitalWrite(STATUS_LED, HIGH); // Harici durum LED'ini yak (opsiyonel)
}

void closeDoor() {
  door_open = false;

  digitalWrite(RELAY_PIN, LOW);   // Röleyi deaktifleştir
  digitalWrite(LED_PIN, LOW);     // Built-in LED'i söndür
  digitalWrite(STATUS_LED, LOW); // Harici durum LED'ini söndür (opsiyonel)
}