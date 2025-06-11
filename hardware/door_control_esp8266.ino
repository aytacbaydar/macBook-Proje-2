
#include <ESP8266WiFi.h>
#include <ESP8266WebServer.h>
#include <ArduinoJson.h>

// WiFi ayarları
const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";

// Güvenlik token
const String SECURITY_TOKEN = "YOUR_SECURITY_TOKEN";

// GPIO pinleri (NodeMCU V3 pin mapping)
const int RELAY_PIN = D1;        // Röle kontrolü için
const int LED_PIN = D4;          // Durum LED'i (built-in LED)
const int BUZZER_PIN = D2;       // Buzzer (opsiyonel)

// Web sunucu port
ESP8266WebServer server(5000);

// Kapı durumu
bool doorOpen = false;
unsigned long doorOpenTime = 0;
const unsigned long AUTO_CLOSE_TIME = 5000; // 5 saniye otomatik kapanma

void setup() {
  Serial.begin(115200);
  
  // Pin konfigürasyonu
  pinMode(RELAY_PIN, OUTPUT);
  pinMode(LED_PIN, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  
  // Başlangıç durumu
  digitalWrite(RELAY_PIN, LOW);   // Kapı kapalı
  digitalWrite(LED_PIN, HIGH);    // LED kapalı (NodeMCU'da HIGH = kapalı)
  digitalWrite(BUZZER_PIN, LOW);
  
  Serial.println("Kapı Kontrol Sistemi Başlatılıyor...");
  
  // WiFi bağlantısı
  WiFi.begin(ssid, password);
  Serial.print("WiFi bağlanıyor");
  
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
    // Bağlantı sırasında LED yanıp sönsün
    digitalWrite(LED_PIN, !digitalRead(LED_PIN));
  }
  
  Serial.println("");
  Serial.println("WiFi bağlandı!");
  Serial.print("IP adresi: ");
  Serial.println(WiFi.localIP());
  
  // LED'i aç (bağlantı başarılı)
  digitalWrite(LED_PIN, LOW);
  
  // Web sunucu rotaları
  server.on("/door", HTTP_POST, handleDoorControl);
  server.on("/status", HTTP_GET, handleStatus);
  server.on("/", HTTP_GET, handleRoot);
  
  // CORS için OPTIONS isteği
  server.on("/door", HTTP_OPTIONS, handleCORS);
  
  server.begin();
  Serial.println("HTTP sunucu başlatıldı (Port: 5000)");
  
  // Başlangıç sesi
  playStartupSound();
}

void loop() {
  server.handleClient();
  
  // Otomatik kapı kapanma kontrolü
  if (doorOpen && (millis() - doorOpenTime > AUTO_CLOSE_TIME)) {
    closeDoor();
    Serial.println("Kapı otomatik olarak kapatıldı");
  }
  
  // WiFi bağlantı kontrolü
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi bağlantısı kesildi, yeniden bağlanıyor...");
    WiFi.reconnect();
    digitalWrite(LED_PIN, HIGH); // LED'i kapat
  }
  
  delay(100);
}

void handleDoorControl() {
  // CORS başlıkları
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  server.sendHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  
  if (server.hasArg("plain")) {
    String body = server.arg("plain");
    
    // JSON parse
    DynamicJsonDocument doc(1024);
    deserializeJson(doc, body);
    
    String action = doc["action"];
    String classroom = doc["classroom"];
    String securityToken = doc["security_token"];
    
    // Güvenlik kontrolü
    if (securityToken != SECURITY_TOKEN) {
      server.send(401, "application/json", "{\"success\": false, \"message\": \"Invalid security token\"}");
      return;
    }
    
    Serial.println("Kapı kontrol isteği alındı:");
    Serial.println("Action: " + action);
    Serial.println("Classroom: " + classroom);
    
    if (action == "open_door") {
      openDoor();
      server.send(200, "application/json", "{\"success\": true, \"message\": \"Kapı açıldı\", \"status\": \"open\"}");
    } 
    else if (action == "close_door") {
      closeDoor();
      server.send(200, "application/json", "{\"success\": true, \"message\": \"Kapı kapatıldı\", \"status\": \"closed\"}");
    } 
    else {
      server.send(400, "application/json", "{\"success\": false, \"message\": \"Geçersiz action\"}");
    }
  } else {
    server.send(400, "application/json", "{\"success\": false, \"message\": \"JSON body gerekli\"}");
  }
}

void handleStatus() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  
  String status = doorOpen ? "open" : "closed";
  String response = "{\"success\": true, \"door_status\": \"" + status + "\", \"ip\": \"" + WiFi.localIP().toString() + "\", \"uptime\": " + String(millis()) + "}";
  
  server.send(200, "application/json", response);
}

void handleRoot() {
  String html = "<html><head><title>Kapı Kontrol Sistemi</title></head>";
  html += "<body><h1>ESP8266 Kapı Kontrol Sistemi</h1>";
  html += "<p>Durum: " + String(doorOpen ? "Açık" : "Kapalı") + "</p>";
  html += "<p>IP: " + WiFi.localIP().toString() + "</p>";
  html += "<p>Uptime: " + String(millis() / 1000) + " saniye</p>";
  html += "<button onclick=\"fetch('/door', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({action: 'open_door', classroom: 'test', security_token: '" + SECURITY_TOKEN + "'})}).then(r=>r.json()).then(d=>alert(d.message))\">Kapıyı Aç</button>";
  html += "<button onclick=\"fetch('/door', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({action: 'close_door', classroom: 'test', security_token: '" + SECURITY_TOKEN + "'})}).then(r=>r.json()).then(d=>alert(d.message))\">Kapıyı Kapat</button>";
  html += "</body></html>";
  
  server.send(200, "text/html", html);
}

void handleCORS() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  server.sendHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  server.send(200, "text/plain", "OK");
}

void openDoor() {
  doorOpen = true;
  doorOpenTime = millis();
  
  digitalWrite(RELAY_PIN, HIGH);  // Röleyi aktifleştir
  digitalWrite(LED_PIN, LOW);     // LED'i yak
  
  // Kapı açılma sesi
  playOpenSound();
  
  Serial.println("Kapı açıldı!");
}

void closeDoor() {
  doorOpen = false;
  
  digitalWrite(RELAY_PIN, LOW);   // Röleyi deaktifleştir
  digitalWrite(LED_PIN, HIGH);    // LED'i söndür
  
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
