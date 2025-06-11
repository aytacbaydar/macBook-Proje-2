
# Arduino Uno Röle Modülü Bağlantı Şeması

## Gerekli Malzemeler
- Arduino Uno R3
- 5V Röle Modülü (1 kanal)
- Jumper kablolar (Erkek-Erkek, Erkek-Dişi)
- Breadboard (opsiyonel)
- Elektronik kapı kilidi (12V/24V)

## Bağlantı Tablosu

| Arduino Uno Pin | Röle Modülü Pin | Açıklama |
|----------------|-----------------|----------|
| Pin 7          | IN              | Röle kontrol sinyali |
| 5V             | VCC             | Güç kaynağı (+5V) |
| GND            | GND             | Toprak (0V) |

## Röle Çıkış Bağlantıları

| Röle Terminal | Bağlantı | Açıklama |
|---------------|----------|----------|
| COM           | Kapı kilidi (+) | Ortak terminal |
| NO            | Kapı kilidi (-) | Normal Open (Normalde açık) |
| NC            | Kullanılmaz     | Normal Close (Normalde kapalı) |

## Görsel Şema

```
Arduino Uno                        Röle Modülü
┌──────────────┐                  ┌─────────────┐
│ DIGITAL PWM  │                  │ RÖLE MODÜLÜ │
│ 13  12  ~11  │                  │             │
│ GND PWR      │                  │ VCC ●───────┼─── 5V
│ AREF    ~10  │                  │ GND ●───────┼─── GND  
│ A0       ~9  │                  │ IN  ●───────┼─── Pin 7
│ A1        8  │                  │             │
│ A2       ~7──┼──────────────────┼─── IN       │
│ A3       ~6  │                  │             │
│ A4       ~5  │                  │ ┌─────────┐ │
│ A5        4  │                  │ │  RÖLE   │ │
│          ~3  │                  │ │ ┌─────┐ │ │
│           2  │                  │ │ │ LED │ │ │
│ TX→       1  │                  │ │ └─────┘ │ │
│ RX←       0  │                  │ └─────────┘ │
│              │                  │             │
│ POWER        │                  │ COM●  NC●  NO● │
│ 5V  ●────────┼──────────────────┼─── VCC     │ │
│ GND ●────────┼──────────────────┼─── GND     │ │
└──────────────┘                  └─────────────┘
                                       │     │
                                       ▼     ▼
                                  ┌─────────────┐
                                  │ KAPI KİLİDİ │
                                  │   (+) (-)   │
                                  │ ┌─────────┐ │
                                  │ │12V/24V  │ │
                                  │ │ELEKTRONİK│ │
                                  │ │  KİLİT  │ │
                                  │ └─────────┘ │
                                  └─────────────┘
```

## Önemli Güvenlik Notları

⚠️ **UYARI**: Röle yüksek voltaj (220V) ile çalışabilir. Güvenlik önlemlerini alın!

1. **Güç Kaynağı**: Arduino 5V, röle modülü 5V ile çalışır
2. **Kapı Kilidi**: Genellikle 12V veya 24V elektronik kilit kullanılır
3. **İzolasyon**: Röle, Arduino'yu yüksek voltajdan izole eder
4. **Bağlantı**: COM ve NO terminallerini kullanın (NC değil)

## Test Adımları

1. **Bağlantıları kontrol edin**
2. **Arduino kodunu yükleyin**
3. **Serial Monitor'ü açın** (9600 baud)
4. **Test komutları gönderin**:
   - `OPEN` - Kapıyı aç
   - `CLOSE` - Kapıyı kapat

## Kod Örneği

```cpp
const int RELAY_PIN = 7;

void setup() {
  pinMode(RELAY_PIN, OUTPUT);
  digitalWrite(RELAY_PIN, LOW); // Röle kapalı
  Serial.begin(9600);
  Serial.println("Kapı kontrol sistemi hazır");
}

void loop() {
  if (Serial.available()) {
    String command = Serial.readString();
    command.trim();
    
    if (command == "OPEN") {
      digitalWrite(RELAY_PIN, HIGH); // Röle açık - Kapı açılır
      Serial.println("Kapı açıldı");
    }
    else if (command == "CLOSE") {
      digitalWrite(RELAY_PIN, LOW); // Röle kapalı - Kapı kapanır
      Serial.println("Kapı kapandı");
    }
  }
}
```

## Sorun Giderme

### Röle Çalışmıyor
- Bağlantıları kontrol edin
- 5V güç kaynağını kontrol edin
- Röle modülündeki LED'in yanıp sönmediğini kontrol edin

### Kapı Açılmıyor
- Kapı kilidinin voltajını kontrol edin (12V/24V)
- COM ve NO bağlantılarını kontrol edin
- Röle kapasitesini kontrol edin (yeterli akım taşıyabiliyor mu?)

### Arduino Resetleniyor
- Güç kaynağı yetersiz olabilir
- USB kablosu ile güç yetersizse harici 5V adaptör kullanın
