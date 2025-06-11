
@echo off
echo Arduino Bridge Server Baslatiliyor...
echo.
echo Bu dosyayi 192.168.0.30 IP'li bilgisayarda calistirin
echo Arduino COM5 portunda bagli olmali
echo.
php -S 0.0.0.0:8080 arduino_bridge_local.php
pause
