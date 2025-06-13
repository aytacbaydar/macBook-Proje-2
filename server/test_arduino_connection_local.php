
<?php
// Local Arduino bağlantı test dosyası
// Bu dosya sadece local development için kullanılır

error_reporting(E_ALL);
ini_set('display_errors', 1);

echo "<h2>Local Arduino USB Bağlantı Testi</h2>";

// Windows COM portları için özel kontrol
$windows_ports = ['COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8'];
$linux_ports = ['/dev/ttyACM0', '/dev/ttyUSB0', '/dev/ttyACM1'];

echo "<h3>Platform: " . PHP_OS . "</h3>";

if (strtoupper(substr(PHP_OS, 0, 3)) === 'WIN') {
    echo "<h3>Windows COM Port Tarama:</h3>";
    echo "<ul>";
    
    foreach ($windows_ports as $port) {
        echo "<li><strong>$port</strong>: ";
        
        try {
            // Windows'ta COM port test etme
            $serial = @fopen($port, "r+b");
            
            if ($serial) {
                echo "✅ Açılabilir - Test ediliyor...";
                
                // Test komutu gönder
                $test_command = json_encode([
                    'action' => 'status',
                    'classroom' => 'TEST',
                    'student_name' => 'Test'
                ]) . "\n";
                
                $bytes = fwrite($serial, $test_command);
                fflush($serial);
                
                if ($bytes > 0) {
                    echo " ($bytes byte gönderildi)";
                    
                    // Kısa yanıt bekle
                    $response = '';
                    $start_time = time();
                    
                    while ((time() - $start_time) < 2) {
                        $char = fgetc($serial);
                        if ($char !== false) {
                            $response .= $char;
                            if ($char === "\n") break;
                        }
                        usleep(50000);
                    }
                    
                    if (!empty($response)) {
                        echo "<br>&nbsp;&nbsp;📥 Yanıt: " . htmlspecialchars(trim($response));
                    } else {
                        echo "<br>&nbsp;&nbsp;⏳ Yanıt alınamadı";
                    }
                }
                
                fclose($serial);
            } else {
                echo "❌ Açılamadı";
            }
        } catch (Exception $e) {
            echo "❌ Hata: " . $e->getMessage();
        }
        
        echo "</li>";
    }
    
    echo "</ul>";
    
} else {
    echo "<h3>Linux Port Tarama (Sınırlı):</h3>";
    echo "<p style='color: orange;'>⚠️ Sunucuda open_basedir kısıtlaması var. Port erişimi engellenmiş.</p>";
    
    echo "<h3>Alternatif Çözümler:</h3>";
    echo "<ul>";
    echo "<li>Arduino'yu doğrudan sunucuya bağlayın (fiziksel erişim gerekli)</li>";
    echo "<li>Raspberry Pi gibi ara cihaz kullanın</li>";
    echo "<li>Network tabanlı Arduino ESP8266/ESP32 kullanın</li>";
    echo "<li>Arduino'yu local bilgisayarda çalıştırıp API bridge yapın</li>";
    echo "</ul>";
}

echo "<h3>Önerilen Çözüm: Local Bridge API</h3>";
echo "<p>Arduino'nuz local bilgisayarda (COM5) bağlı olduğu için, local bir bridge service oluşturabiliriz:</p>";
echo "<ol>";
echo "<li>Local bilgisayarınızda PHP server çalıştırın</li>";
echo "<li>Bu server Arduino ile konuşur</li>";
echo "<li>Ana sunucu bu local API'yi çağırır</li>";
echo "</ol>";

?>
