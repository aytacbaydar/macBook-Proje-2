
# Arduino Uno Kapı Kontrol Sistemi Bağlantısı

## Pin Bağlantıları

```
Arduino Uno Pin  ->  Bağlantı
Pin 7           ->  Röle Sinyal Pini (IN)
Pin 8           ->  Buzzer (+) Pini  
Pin 13          ->  Built-in LED (otomatik)
5V              ->  Röle VCC (5V)
GND             ->  Röle GND, Buzzer (-) GND
```

## Görsel Bağlantı Şeması

```
     Arduino Uno
    ┌─────────────┐
    │    USB      │
    ├─────────────┤
    │ RESET  AREF │
    │ 3.3V   GND  │
    │ 5V     13   │════► Built-in LED
    │ GND    12   │
    │ GND    ~11  │
    │ VIN    ~10  │
    │         ~9  │
    │         8   │════► Buzzer +
    │         7   │════► Röle IN
    │         ~6  │
    │         ~5  │
    │         4   │
    │         ~3  │
    │         2   │
    │ A0      TX► │
    │ A1      RX◄ │
    │ A2      1   │
    │ A3      0   │
    └─────────────┘
         │
         ▼ 5V & GND
    ┌─────────────┐
    │ Röle Modülü │
    │  VCC GND IN │
    │   │   │   │ │
    │  ╔╧═══╧═══╧╗│
    │  ║ RELAY   ║│
    │  ╚═════════╝│
    │   COM NC NO │ ──► Kapı Kilidi
    └─────────────┘
```

## Gerekli Kütüphaneler

Arduino IDE'de şu kütüphaneyi yükleyin:
- **ArduinoJson** (by Benoit Blanchon)

## Kurulum Adımları

1. Arduino Uno'yu USB ile bilgisayara bağlayın
2. `door_control_arduino_uno.ino` kodunu Arduino IDE'de açın
3. **ArduinoJson** kütüphanesini yükleyin
4. Kodu Arduino'ya yükleyin
5. Seri port numarasını not alın (Tools > Port)
6. PHP backend'de seri port ayarlarını güncelleyin

## Seri Port Ayarları

- **Windows**: COM3, COM4, vb.
- **Linux**: /dev/ttyACM0, /dev/ttyUSB0
- **Mac**: /dev/tty.usbmodem14101, vb.

## Avantajları

✅ **WiFi kurulumu gerekmez**
✅ **Daha güvenilir bağlantı**
✅ **Anlık haberleşme**
✅ **Basit kurulum**
✅ **Arduino Uno daha ucuz**

## Dezavantajları

❌ **USB kablosu ile bağlı kalma zorunluluğu**
❌ **Uzaktan kontrol yok**
❌ **Fiziksel bağlantı gerekli**
