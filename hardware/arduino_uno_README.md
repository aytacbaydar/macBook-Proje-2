
# Arduino Uno Kapı Kontrol Sistemi

Bu sistem, Arduino Uno ve ESP8266 WiFi modülü kullanarak sınıf kapılarını uzaktan kontrol etmenizi sağlar.

## Gerekli Malzemeler

1. **Arduino Uno R3** - Ana mikrokontrolcü
2. **ESP8266 WiFi Modülü (ESP-01)** - WiFi bağlantısı için
3. **5V Röle Modülü** - Kapı kilit mekanizması kontrolü için
4. **Buzzer (3-5V)** - Ses uyarıları için
5. **LED** - Durum göstergesi (Arduino'da built-in LED var)
6. **Jumper Kablolar** - Bağlantılar için
7. **Breadboard** - Devre kurulumu için
8. **3.3V Regülatör** - ESP8266 için (opsiyonel, bazı modüllerde built-in)

## Pin Bağlantıları

### Arduino Uno Pin Mapping:
```
Arduino Pin  ->  Bağlantı
Pin 2        ->  ESP8266 RX
Pin 3        ->  ESP8266 TX
Pin 7        ->  Röle Sinyal Pini
Pin 8        ->  Buzzer (+) Pini
Pin 13       ->  Built-in LED (otomatik)
5V           ->  Röle VCC
3.3V         ->  ESP8266 VCC
GND          ->  ESP8266 GND, Röle GND, Buzzer (-) GND
```

### ESP8266 (ESP-01) Pin Mapping:
```
ESP8266 Pin  ->  Arduino Pin
VCC          ->  3.3V (DİKKAT: 5V DEĞİL!)
GND          ->  GND
RX           ->  Pin 3 (Arduino TX)
TX           ->  Pin 2 (Arduino RX)
CH_PD        ->  3.3V (Pull-up)
GPIO0        ->  3.3V (Pull-up, normal çalışma için)
GPIO2        ->  3.3V (Pull-up)
RST          ->  3.3V (Pull-up)
```

## Bağlantı Şeması

```
     Arduino Uno                ESP8266 (ESP-01)
    ┌─────────────┐            ┌─────────────┐
    │   USB       │            │  TX  RX     │
    ├─────────────┤            │  ┌─┐ ┌─┐    │
    │ 13  12  11  │            │  │ │ │ │    │
    │ GND PWR     │            │  └─┘ └─┘    │
    │ AREF        │            │  GPIO0 VCC  │
    │ A0-A5       │            │  ┌─┐ ┌─┐    │
    │             │            │  │ │ │ │    │
    │ 0(RX) 1(TX) │            │  └─┘ └─┘    │
    │ 2-13        │════════════│  RST GND    │
    └─────────────┘            │  ┌─┐ ┌─┐    │
         │                     │  │ │ │ │    │
         ▼                     │  └─┘ └─┘    │
    ┌─────────────┐            │  CH_PD GPIO2│
    │ Röle Modülü │            └─────────────┘
    │  VCC GND IN │
    │   │   │   │ │
    │  ╔╧═══╧═══╧╗│
    │  ║ RELAY   ║│
    │  ╚═════════╝│
    │   COM NC NO │ ──► Kapı Kilidi
    └─────────────┘
```

## Arduino IDE Kurulumu

1. **Arduino IDE**'yi indirin ve kurun
2. Arduino Uno'yu USB ile bilgisayara bağlayın
3. **Board ayarlarını** yapın:
   - Tools > Board > Arduino Uno
   - Tools > Port > (Arduino'nuzun bağlı olduğu port)

4. **Gerekli Kütüphaneleri** yükleyin:
   - Tools > Manage Libraries
   - `ArduinoJson by Benoit Blanchon` kütüphanesini yükleyin

## Kod Yükleme

1. `door_control_arduino_uno.ino` dosyasını Arduino IDE'de açın
2. **WiFi bilgilerini** ESP8266 kısmında güncelleyin:
   ```cpp
   esp8266.println("AT+CWJAP=\"YOUR_WIFI_SSID\",\"YOUR_WIFI_PASSWORD\"");
   ```

3. **Güvenlik token**'ı gerekirse güncelleyin
4. Kodu Arduino Uno'ya yükleyin (Upload butonuna basın)

## Önemli Notlar

### ESP8266 Voltaj Uyarısı
- **ESP8266 3.3V ile çalışır, 5V VERMEYİN!**
- Arduino'nun 3.3V pinini kullanın
- Gerekirse voltage regülatör kullanın

### WiFi Bağlantısı
- ESP8266'nın WiFi ağına bağlanması 5-10 saniye sürebilir
- Serial Monitor'den bağlantı durumunu takip edin
- Sadece 2.4GHz WiFi ağlarını destekler

## Test Etme

1. **Serial Monitor**'ü açın (Tools > Serial Monitor, 9600 baud)
2. Sistem başlangıç mesajlarını bekleyin
3. Manual test komutları:
   - `OPEN` - Kapıyı aç
   - `CLOSE` - Kapıyı kapat
   - `STATUS` - Kapı durumunu kontrol et

## ESP8266 vs Arduino Uno Karşılaştırması

| Özellik | ESP8266 NodeMCU | Arduino Uno + ESP8266 |
|---------|-----------------|----------------------|
| **WiFi** | Built-in | Harici modül gerekli |
| **Programlama** | Daha kolay | Daha karmaşık |
| **Maliyet** | Daha düşük | Daha yüksek |
| **Güvenilirlik** | İyi | Çok iyi |
| **Kablo sayısı** | Az | Çok |
| **Güç tüketimi** | Düşük | Orta |

## Öneri

Eğer WiFi bağlantısı yaşıyorsanız ve ekstra karmaşıklık istemiyorsanız, **ESP8266 NodeMCU**'yu tercih etmenizi öneririz. Arduino Uno daha çok öğrenme amaçlı veya mevcut Arduino projeleriniz varsa kullanışlıdır.
