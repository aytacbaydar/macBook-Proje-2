@echo off
echo Arduino Bridge Server Baslatiliyor...
echo.
echo Bu dosyayi 77.245.149.70 IP'li bilgisayarda calistirin
echo Arduino COM5 portunda bagli olmali
echo.
C:\xampp\php\php.exe -S 0.0.0.0:8080 arduino_bridge_local.php
pause
@echo off
echo Arduino Bridge Server Başlatılıyor...
echo IP: 77.245.149.70
echo Port: 8080
echo Arduino Port: COM5
echo.

cd /d "%~dp0server"
C:\xampp\php\php.exe -S 0.0.0.0:8080 arduino_bridge_local.php

pause