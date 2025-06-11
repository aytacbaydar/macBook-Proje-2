
# ESP8266 NodeMCU V3 Kapı Kontrol Sistemi

Bu sistem, ESP8266 NodeMCU V3 mikrokontrolcüsü kullanarak sınıf kapılarını uzaktan kontrol etmenizi sağlar.

## Gerekli Malzemeler

1. **NodeMCU V3 ESP8266** - Ana mikrokontrolcü
2. **5V Röle Modülü** - Kapı kilit mekanizması kontrolü için
3. **Buzzer (3-5V)** - Ses uyarıları için (opsiyonel)
4. **LED** - Durum göstergesi (NodeMCU'da built-in LED var)
5. **Jumper Kablolar** - Bağlantılar için
6. **Breadboard** - Devre kurulumu için

## Pin Bağlantıları

```
NodeMCU Pin  ->  Bağlantı
D1 (GPIO5)   ->  Röle Sinyal Pini
D2 (GPIO4)   ->  Buzzer (+) Pini
D4 (GPIO2)   ->  Built-in LED (otomatik)
VIN          ->  Röle VCC (5V)
GND          ->  Röle GND, Buzzer (-) GND
```

## Arduino IDE Kurulumu

1. **Arduino IDE**'yi indirin ve kurun
2. **ESP8266 Board Package**'ı ekleyin:
   - File > Preferences > Additional Board Manager URLs
   - Bu URL'yi ekleyin: `http://arduino.esp8266.com/stable/package_esp8266com_index.json`
   - Tools > Board > Board Manager > "esp8266" arayın ve kurun

3. **Gerekli Kütüphaneleri** yükleyin:
   - Tools > Manage Libraries
   - Aşağıdaki kütüphaneleri arayın ve yükleyin:
     - `ArduinoJson by Benoit Blanchon`
     - `ESP8266WiFi` (genellikle otomatik gelir)

## Kod Yükleme

1. `door_control_esp8266.ino` dosyasını Arduino IDE'de açın
2. **WiFi bilgilerini** güncelleyin:
   ```cpp
   const char* ssid = "YOUR_WIFI_SSID";        // WiFi ağ adınız
   const char* password = "YOUR_WIFI_PASSWORD"; // WiFi şifreniz
   ```

3. **Güvenlik token**'ı güncelleyin:
   ```cpp
   const String SECURITY_TOKEN = "KIMYA_DOOR_CONTROL_2024";
   ```

4. **Board ayarlarını** yapın:
   - Tools > Board > NodeMCU 1.0 (ESP-12E Module)
   - Tools > Port > (NodeMCU'nuzun bağlı olduğu port)

5. Kodu NodeMCU'ya yükleyin (Upload butonuna basın)

## IP Adresi Ayarları

1. NodeMCU açıldığında Serial Monitor'den IP adresini not alın
2. PHP backend'de `door_control.php` dosyasındaki IP adreslerini güncelleyin:
   ```php
   $esp8266_ips = [
       'A101' => '192.168.1.101', // A101 sınıfı NodeMCU IP'si
       'A102' => '192.168.1.102', // A102 sınıfı NodeMCU IP'si
       // Kendi sınıflarınızı ekleyin
   ];
   ```

## Test Etme

1. **Serial Monitor**'ü açın (Tools > Serial Monitor, 115200 baud)
2. NodeMCU'nun IP adresini not alın
3. Web tarayıcısında `http://[ESP_IP_ADRESI]:5000` adresine gidin
4. Test butonları ile kapıyı açıp kapatmayı deneyin

## Güvenlik Notları

- **Güvenlik token**'ını mutlaka değiştirin
- **WiFi şifrenizi** güçlü tutun
- NodeMCU'yu **güvenli bir yere** monte edin
- **Röle bağlantılarını** dikkatli yapın (yüksek voltaj tehlikeli olabilir)

## Sorun Giderme

### WiFi Bağlanamıyor
- SSID ve şifrenin doğru olduğundan emin olun
- WiFi ağının 2.4GHz olduğundan emin olun (5GHz desteklenmez)
- Serial Monitor'den hata mesajlarını kontrol edin

### Kapı Çalışmıyor
- Röle bağlantılarını kontrol edin
- Serial Monitor'den komutların gelip gelmediğini kontrol edin
- Röle LED'inin yanıp sönmediğini kontrol edin

### HTTP İstekleri Çalışmıyor
- NodeMCU IP adresinin PHP kodunda doğru olduğundan emin olun
- Güvenlik token'ının eşleştiğinden emin olun
- Network bağlantısını kontrol edin

## Özellikler

- ✅ **WiFi üzerinden uzaktan kontrol**
- ✅ **Otomatik kapı kapanma** (5 saniye)
- ✅ **Ses uyarıları** (buzzer ile)
- ✅ **Durum LED'i**
- ✅ **Web arayüzü** (test için)
- ✅ **CORS desteği**
- ✅ **Güvenlik token** kontrolü
- ✅ **WiFi yeniden bağlanma**
- ✅ **JSON API**

## API Endpoints

- `POST /door` - Kapı kontrolü
- `GET /status` - Sistem durumu
- `GET /` - Web arayüzü
