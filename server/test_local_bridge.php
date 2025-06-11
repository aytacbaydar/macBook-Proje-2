
<?php
// Local Bridge Test Sayfası
// Bu sayfa Replit sunucusundan local bridge'i test eder

error_reporting(E_ALL);
ini_set('display_errors', 1);

echo "<h2>Local Arduino Bridge Test</h2>";
echo "<h3>Replit -> Local Bridge (192.168.0.30:8080) Test</h3>";

$bridge_url = 'http://192.168.0.30:8080';

// Status test
echo "<h4>1. Bridge Status Test:</h4>";
try {
    $context = stream_context_create([
        'http' => [
            'method' => 'GET',
            'timeout' => 5
        ]
    ]);
    
    $response = @file_get_contents($bridge_url, false, $context);
    
    if ($response === false) {
        echo "❌ Bridge'e ulaşılamadı. 192.168.0.30:8080 çalışıyor mu?<br>";
        echo "Kontrol edin:<br>";
        echo "- Local bilgisayarda bridge server çalışıyor mu?<br>";
        echo "- IP adresi doğru mu? (192.168.0.30)<br>";
        echo "- Port 8080 açık mı?<br>";
        echo "- Firewall engelliyor mu?<br>";
    } else {
        echo "✅ Bridge bağlantısı başarılı!<br>";
        echo "Yanıt: " . htmlspecialchars($response) . "<br>";
    }
} catch (Exception $e) {
    echo "❌ Hata: " . $e->getMessage() . "<br>";
}

// Arduino test command
echo "<h4>2. Arduino Komut Test:</h4>";
try {
    $test_data = [
        'action' => 'status',
        'classroom' => 'TEST',
        'student_name' => 'Bridge Test'
    ];
    
    $context = stream_context_create([
        'http' => [
            'method' => 'POST',
            'header' => 'Content-Type: application/json',
            'content' => json_encode($test_data),
            'timeout' => 10
        ]
    ]);
    
    $response = @file_get_contents($bridge_url, false, $context);
    
    if ($response === false) {
        echo "❌ Arduino test komutu gönderilemedi<br>";
    } else {
        echo "✅ Arduino test komutu gönderildi!<br>";
        echo "Yanıt: " . htmlspecialchars($response) . "<br>";
        
        $result = json_decode($response, true);
        if ($result) {
            echo "<pre>" . print_r($result, true) . "</pre>";
        }
    }
} catch (Exception $e) {
    echo "❌ Hata: " . $e->getMessage() . "<br>";
}

echo "<hr>";
echo "<h3>Kurulum Adımları:</h3>";
echo "<ol>";
echo "<li>192.168.0.30 IP'li bilgisayarda terminal/cmd açın</li>";
echo "<li>Arduino bridge klasörüne gidin</li>";
echo "<li>Şu komutu çalıştırın: <code>php -S 0.0.0.0:8080 arduino_bridge_local.php</code></li>";
echo "<li>Arduino'nun COM5'te bağlı olduğundan emin olun</li>";
echo "<li>Bu sayfayı yenileyin</li>";
echo "</ol>";

echo "<hr>";
echo "<p><a href='door_control_usb.php'>Manual Kapı Kontrolü Test Et</a></p>";
?>
