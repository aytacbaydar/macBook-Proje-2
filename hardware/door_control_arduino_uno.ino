
#include <SoftwareSerial.h>
#include <ArduinoJson.h>

// ESP8266 WiFi modülü için SoftwareSerial (Arduino Uno'da)
SoftwareSerial esp8266(2, 3); // RX, TX

// Güvenlik token
const String SECURITY_TOKEN = "KIMYA_DOOR_CONTROL_2024";

// GPIO pinleri (Arduino Uno pin mapping)
const int RELAY_PIN = 7;        // Röle kontrolü için
const int LED_PIN = 13;         // Durum LED'i (built-in LED)
const int BUZZER_PIN = 8;       // Buzzer

// Kapı durumu
bool doorOpen = false;
unsigned long doorOpenTime = 0;
const unsigned long AUTO_CLOSE_TIME = 5000; // 5 saniye otomatik kapanma

void setup() {
  Serial.begin(9600);
  esp8266.begin(9600);
  
  // Pin konfigürasyonu
  pinMode(RELAY_PIN, OUTPUT);
  pinMode(LED_PIN, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  
  // Başlangıç durumu
  digitalWrite(RELAY_PIN, LOW);   // Kapı kapalı
  digitalWrite(LED_PIN, LOW);     // LED kapalı
  digitalWrite(BUZZER_PIN, LOW);
  
  Serial.println("Arduino Uno Kapı Kontrol Sistemi Başlatılıyor...");
  
  // ESP8266 WiFi modülünü başlat
  initWiFi();
  
  // Başlangıç sesi
  playStartupSound();
  
  Serial.println("Sistem hazır!");
}

void loop() {
  // ESP8266'dan gelen verileri kontrol et
  if (esp8266.available()) {
    String data = esp8266.readStringUntil('\n');
    data.trim();
    
    if (data.length() > 0) {
      Serial.println("ESP8266'dan veri: " + data);
      processCommand(data);
    }
  }
  
  // Serial Monitor'dan gelen komutları kontrol et (test için)
  if (Serial.available()) {
    String command = Serial.readStringUntil('\n');
    command.trim();
    
    if (command == "OPEN") {
      openDoor();
    } else if (command == "CLOSE") {
      closeDoor();
    } else if (command == "STATUS") {
      String status = doorOpen ? "OPEN" : "CLOSED";
      Serial.println("Kapı durumu: " + status);
    }
  }
  
  // Otomatik kapı kapanma kontrolü
  if (doorOpen && (millis() - doorOpenTime > AUTO_CLOSE_TIME)) {
    closeDoor();
    Serial.println("Kapı otomatik olarak kapatıldı");
  }
  
  delay(100);
}

void initWiFi() {
  Serial.println("ESP8266 WiFi modülü başlatılıyor...");
  
  // ESP8266'yı reset et
  esp8266.println("AT+RST");
  delay(2000);
  
  // WiFi modunu ayarla
  esp8266.println("AT+CWMODE=1");
  delay(1000);
  
  // WiFi ağına bağlan (WiFi bilgilerinizi buraya girin)
  esp8266.println("AT+CWJAP=\"YOUR_WIFI_SSID\",\"YOUR_WIFI_PASSWORD\"");
  delay(5000);
  
  // Multiple connection modu
  esp8266.println("AT+CIPMUX=1");
  delay(1000);
  
  // Web sunucuyu başlat
  esp8266.println("AT+CIPSERVER=1,5000");
  delay(1000);
  
  Serial.println("WiFi kurulumu tamamlandı");
}

void processCommand(String data) {
  // HTTP request'i parse et
  if (data.indexOf("POST /door") >= 0) {
    // POST isteğinden JSON'u çıkar
    int jsonStart = data.indexOf("{");
    int jsonEnd = data.lastIndexOf("}");
    
    if (jsonStart >= 0 && jsonEnd >= 0) {
      String jsonData = data.substring(jsonStart, jsonEnd + 1);
      
      // JSON parse (basit parsing)
      if (jsonData.indexOf("\"action\":\"open_door\"") >= 0) {
        openDoor();
        sendHttpResponse("200", "{\"success\":true,\"message\":\"Kapı açıldı\",\"status\":\"open\"}");
      } else if (jsonData.indexOf("\"action\":\"close_door\"") >= 0) {
        closeDoor();
        sendHttpResponse("200", "{\"success\":true,\"message\":\"Kapı kapatıldı\",\"status\":\"closed\"}");
      } else {
        sendHttpResponse("400", "{\"success\":false,\"message\":\"Geçersiz action\"}");
      }
    }
  } else if (data.indexOf("GET /status") >= 0) {
    String status = doorOpen ? "open" : "closed";
    String response = "{\"success\":true,\"door_status\":\"" + status + "\",\"uptime\":" + String(millis()) + "}";
    sendHttpResponse("200", response);
  }
}

void sendHttpResponse(String statusCode, String jsonResponse) {
  String httpResponse = "HTTP/1.1 " + statusCode + " OK\r\n";
  httpResponse += "Content-Type: application/json\r\n";
  httpResponse += "Access-Control-Allow-Origin: *\r\n";
  httpResponse += "Content-Length: " + String(jsonResponse.length()) + "\r\n";
  httpResponse += "\r\n";
  httpResponse += jsonResponse;
  
  // ESP8266 üzerinden yanıt gönder
  esp8266.println("AT+CIPSEND=0," + String(httpResponse.length()));
  delay(100);
  esp8266.print(httpResponse);
  delay(100);
  esp8266.println("AT+CIPCLOSE=0");
}

void openDoor() {
  doorOpen = true;
  doorOpenTime = millis();
  
  digitalWrite(RELAY_PIN, HIGH);  // Röleyi aktifleştir
  digitalWrite(LED_PIN, HIGH);    // LED'i yak
  
  // Kapı açılma sesi
  playOpenSound();
  
  Serial.println("Kapı açıldı!");
}

void closeDoor() {
  doorOpen = false;
  
  digitalWrite(RELAY_PIN, LOW);   // Röleyi deaktifleştir
  digitalWrite(LED_PIN, LOW);     // LED'i söndür
  
  // Kapı kapanma sesi
  playCloseSound();
  
  Serial.println("Kapı kapatıldı!");
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
