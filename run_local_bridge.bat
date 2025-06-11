
@echo off
echo Arduino Bridge Server Baslatiliyor...
echo IP: 77.245.149.70
echo Port: 8080  
echo Arduino Port: COM5
echo.

REM Doğru dizine git
cd /d "%~dp0server"

REM PHP sunucusunu başlat
C:\xampp\php\php.exe -S 0.0.0.0:8080 arduino_bridge_local.php

echo.
echo Bridge server durduruldu.
pause
