
<?php
// Arduino bağlantı test dosyası
// Bu dosyayı tarayıcıdan çalıştırabilirsiniz: /server/test_arduino_connection.php

error_reporting(E_ALL);
ini_set('display_errors', 1);

echo "<h2>Arduino USB Bağlantı Testi</h2>";

// Test edilecek seri portlar
$serial_ports = [
    '/dev/ttyACM0',    // Linux/Mac için Arduino Uno
    '/dev/ttyUSB0',    // Linux için USB-Serial
    '/dev/ttyACM1',    // Alternatif Linux port
    'COM3',            // Windows için
    'COM4',            // Windows için alternatif
    'COM5',            // Windows alternatif
];

echo "<h3>Port Tarama:</h3>";
echo "<ul>";

$available_ports = [];
foreach ($serial_ports as $port) {
    $exists = file_exists($port);
    $readable = $exists ? is_readable($port) : false;
    $writable = $exists ? is_writable($port) : false;
    
    echo "<li><strong>$port</strong>: ";
    if ($exists) {
        echo "✅ Var";
        if ($readable && $writable) {
            echo " (R/W)";
            $available_ports[] = $port;
        } elseif ($readable) {
            echo " (Sadece okuma)";
        } elseif ($writable) {
            echo " (Sadece yazma)";
        } else {
            echo " (İzin yok)";
        }
    } else {
        echo "❌ Yok";
    }
    echo "</li>";
}

echo "</ul>";

if (empty($available_ports)) {
    echo "<p style='color: red;'>❌ Hiç Arduino bulunamadı!</p>";
    echo "<h3>Çözüm Önerileri:</h3>";
    echo "<ul>";
    echo "<li>Arduino USB kablosunu kontrol edin</li>";
    echo "<li>Arduino'nun açık olduğundan emin olun</li>";
    echo "<li>Port izinlerini kontrol edin: <code>sudo chmod 666 /dev/ttyACM0</code></li>";
    echo "<li>Windows'ta Device Manager'dan COM portunu kontrol edin</li>";
    echo "</ul>";
} else {
    echo "<h3>Arduino Bağlantı Testi:</h3>";
    
    foreach ($available_ports as $port) {
        echo "<h4>$port testi:</h4>";
        
        try {
            $serial = fopen($port, "r+b");
            
            if ($serial) {
                echo "✅ Seri port açıldı<br>";
                
                // Test komutu gönder
                $test_command = json_encode([
                    'action' => 'status',
                    'classroom' => 'TEST',
                    'student_name' => 'Test',
                    'timestamp' => date('Y-m-d H:i:s')
                ]) . "\n";
                
                echo "📤 Test komutu gönderiliyor: " . htmlspecialchars(trim($test_command)) . "<br>";
                
                $bytes = fwrite($serial, $test_command);
                fflush($serial);
                
                if ($bytes > 0) {
                    echo "✅ $bytes byte gönderildi<br>";
                    
                    // Yanıt bekle
                    echo "⏳ Arduino'dan yanıt bekleniyor...<br>";
                    
                    $start_time = time();
                    $response = '';
                    
                    while ((time() - $start_time) < 3) {
                        $char = fgetc($serial);
                        if ($char !== false) {
                            $response .= $char;
                            if ($char === "\n") {
                                break;
                            }
                        }
                        usleep(100000); // 100ms
                    }
                    
                    if (!empty($response)) {
                        echo "✅ Arduino yanıtı: " . htmlspecialchars(trim($response)) . "<br>";
                        
                        $json_response = json_decode(trim($response), true);
                        if (json_last_error() === JSON_ERROR_NONE) {
                            echo "✅ Geçerli JSON yanıtı alındı<br>";
                        } else {
                            echo "⚠️ JSON parse hatası: " . json_last_error_msg() . "<br>";
                        }
                    } else {
                        echo "❌ Arduino'dan yanıt alınamadı (timeout)<br>";
                    }
                } else {
                    echo "❌ Komut gönderilemedi<br>";
                }
                
                fclose($serial);
            } else {
                echo "❌ Seri port açılamadı<br>";
            }
            
        } catch (Exception $e) {
            echo "❌ Hata: " . $e->getMessage() . "<br>";
        }
        
        echo "<hr>";
    }
}

echo "<h3>Sistem Bilgileri:</h3>";
echo "<ul>";
echo "<li><strong>PHP Sürümü:</strong> " . PHP_VERSION . "</li>";
echo "<li><strong>İşletim Sistemi:</strong> " . PHP_OS . "</li>";
echo "<li><strong>Platform:</strong> " . php_uname() . "</li>";
echo "</ul>";
?>
