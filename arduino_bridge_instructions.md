
# Arduino Bridge Kurulum Talimatları

## Adım 1: Local Bilgisayarınızda (77.245.149.70)

1. Bu projeyi local bilgisayarınıza indirin/kopyalayın
2. Arduino'nun COM5'te bağlı olduğundan emin olun
3. `run_local_bridge.bat` dosyasını çift tıklayarak çalıştırın
4. Veya manuel olarak:
   ```cmd
   cd server
   php -S 0.0.0.0:8080 arduino_bridge_local.php
   ```

## Adım 2: Test

Local bridge çalıştıktan sonra şu URL'leri test edin:

### Status Test (Local):
http://77.245.149.70:8080

### Status Test (Replit'ten):
https://www.kimyaogreniyorum.com/server/test_local_bridge.php

## Beklenen Sonuçlar

Local bridge çalışırsa şu yanıtı alacaksınız:
```json
{
  "status": "running",
  "message": "Local Arduino Bridge Server (77.245.149.70)",
  "platform": "Windows",
  "version": "x.x.x",
  "arduino_port": "COM5"
}
```

## Troubleshooting

- Bridge çalışmıyorsa: PHP'nin PATH'te olduğundan emin olun
- Arduino bulunamıyorsa: COM5'in doğru port olduğunu kontrol edin
- Network hatası alırsanız: Firewall ayarlarını kontrol edin
