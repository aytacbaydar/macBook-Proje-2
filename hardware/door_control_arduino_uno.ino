
// Arduino Uno Kapı Kontrol Sistemi
// Bu kod Arduino Uno için optimize edilmiştir
// Seri haberleşme: 9600 baud rate
// Kapı kontrolü: Röle modülü ile

// Pin tanımlamaları
const int RELAY_PIN = 7;     // Röle kontrol pini
const int LED_PIN = 13;      // Durum LED'i (Arduino Uno'da dahili LED)
const int STATUS_LED = 11;   // Harici durum LED'i (opsiyonel)

// Kapı durumu
bool door_open = false;
unsigned long last_action_time = 0;
String inputString = "";
bool stringComplete = false;

void setup() {
  // Seri haberleşme başlat
  Serial.begin(9600);
  while (!Serial) {
    ; // Serial port bağlantısını bekle
  }

  // Pin modlarını ayarla
  pinMode(RELAY_PIN, OUTPUT);
  pinMode(LED_PIN, OUTPUT);
  pinMode(STATUS_LED, OUTPUT);

  // Başlangıç durumu - kapı kapalı
  digitalWrite(RELAY_PIN, LOW);
  digitalWrite(LED_PIN, LOW);
  digitalWrite(STATUS_LED, LOW);

  // Başlangıç mesajı
  Serial.println("{\"success\":true,\"message\":\"Arduino Uno Kapi Kontrol Hazir\",\"port\":\"COM5\",\"version\":\"1.0\"}");
  
  // String alma için rezerve et
  inputString.reserve(200);
}

void loop() {
  // Seri portan gelen verileri oku
  if (stringComplete) {
    processCommand(inputString);
    // String'i temizle
    inputString = "";
    stringComplete = false;
  }
  
  // Otomatik kapı kapama (30 saniye sonra)
  if (door_open && (millis() - last_action_time > 30000)) {
    closeDoor();
    Serial.println("{\"success\":true,\"message\":\"Kapi otomatik kapatildi\",\"status\":\"closed\",\"reason\":\"timeout\"}");
  }
  
  delay(100);
}

void serialEvent() {
  while (Serial.available()) {
    char inChar = (char)Serial.read();
    
    if (inChar == '\n') {
      stringComplete = true;
    } else {
      inputString += inChar;
    }
  }
}

void processCommand(String command) {
  // Basit JSON parse (ArduinoJson kütüphanesi olmadan)
  command.trim();
  
  if (command.indexOf("\"action\":\"open_door\"") > -1) {
    String classroom = extractJsonValue(command, "classroom");
    String student_name = extractJsonValue(command, "student_name");
    
    openDoor();
    Serial.println("{\"success\":true,\"message\":\"Kapi acildi\",\"status\":\"open\",\"classroom\":\"" + classroom + "\",\"student\":\"" + student_name + "\",\"timestamp\":" + String(millis()) + "}");
  }
  else if (command.indexOf("\"action\":\"close_door\"") > -1) {
    String classroom = extractJsonValue(command, "classroom");
    
    closeDoor();
    Serial.println("{\"success\":true,\"message\":\"Kapi kapatildi\",\"status\":\"closed\",\"classroom\":\"" + classroom + "\",\"timestamp\":" + String(millis()) + "}");
  }
  else if (command.indexOf("\"action\":\"status\"") > -1) {
    String status = door_open ? "open" : "closed";
    Serial.println("{\"success\":true,\"door_status\":\"" + status + "\",\"uptime\":" + String(millis()) + ",\"last_action\":" + String(last_action_time) + "}");
  }
  else {
    Serial.println("{\"success\":false,\"message\":\"Gecersiz komut\",\"received\":\"" + command + "\"}");
  }
}

String extractJsonValue(String json, String key) {
  String searchKey = "\"" + key + "\":\"";
  int startIndex = json.indexOf(searchKey);
  
  if (startIndex == -1) {
    return "";
  }
  
  startIndex += searchKey.length();
  int endIndex = json.indexOf("\"", startIndex);
  
  if (endIndex == -1) {
    return "";
  }
  
  return json.substring(startIndex, endIndex);
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
