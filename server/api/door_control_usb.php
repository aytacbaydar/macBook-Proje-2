
<?php
// CORS başlıkları
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

// OPTIONS isteklerini işle
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

// Config dosyasını dahil et
require_once '../config.php';

// JSON verilerini al
function getJsonData() {
    $json = file_get_contents('php://input');
    $data = json_decode($json, true);
    
    if (json_last_error() !== JSON_ERROR_NONE) {
        errorResponse('Geçersiz JSON formatı');
    }
    
    return $data;
}

// Hata yanıtı gönder
function errorResponse($message, $code = 400) {
    http_response_code($code);
    echo json_encode(['success' => false, 'message' => $message]);
    exit();
}

// Yetkilendirme kontrolü
function authorize() {
    $headers = getallheaders();
    $authHeader = $headers['Authorization'] ?? '';
    
    if (empty($authHeader) || !preg_match('/Bearer\s+(.*)$/i', $authHeader, $matches)) {
        errorResponse('Yetkilendirme token\'ı gerekli', 401);
    }
    
    $token = $matches[1];
    
    try {
        $conn = getConnection();
        $stmt = $conn->prepare("SELECT * FROM users WHERE token = ?");
        $stmt->execute([$token]);
        $user = $stmt->fetch();
        
        if (!$user) {
            errorResponse('Geçersiz token', 401);
        }
        
        return $user;
    } catch (Exception $e) {
        errorResponse('Veritabanı hatası', 500);
    }
}

// Arduino ile seri haberleşme fonksiyonu
function controlArduinoDoor($action, $classroom, $student_name = 'Manual') {
    // Arduino'nun bağlı olduğu seri port
    // Windows: COM3, COM4 vb.
    // Linux/Mac: /dev/ttyUSB0, /dev/ttyACM0 vb.
    $serial_ports = [
        '/dev/ttyACM0',    // Linux/Mac için Arduino Uno
        '/dev/ttyUSB0',    // Linux için USB-Serial
        'COM3',            // Windows için (değiştirilebilir)
        'COM4',            // Windows için alternatif
    ];
    
    $connected_port = null;
    
    // Mevcut portları kontrol et
    foreach ($serial_ports as $port) {
        if (file_exists($port) || (strtoupper(substr(PHP_OS, 0, 3)) === 'WIN' && strpos($port, 'COM') === 0)) {
            $connected_port = $port;
            break;
        }
    }
    
    if (!$connected_port) {
        error_log("Arduino bulunamadı - kontrol edilen portlar: " . implode(', ', $serial_ports));
        return [
            'success' => false, 
            'message' => 'Arduino bulunamadı (USB bağlantısını kontrol edin)'
        ];
    }
    
    try {
        // Seri port ayarları (Linux/Mac için)
        if (strtoupper(substr(PHP_OS, 0, 3)) !== 'WIN') {
            // Linux/Mac seri port konfigürasyonu
            exec("stty -F {$connected_port} cs8 9600 ignbrk -brkint -icrnl -imaxbel -opost -onlcr -isig -icanon -iexten -echo -echoe -echok -echoctl -echoke noflsh -ixon -crtscts");
        }
        
        // Seri porta bağlan
        $serial = fopen($connected_port, "r+b");
        
        if (!$serial) {
            return [
                'success' => false, 
                'message' => "Seri port açılamadı: {$connected_port}"
            ];
        }
        
        // Arduino'ya JSON komutu gönder
        $command = json_encode([
            'action' => $action,
            'classroom' => $classroom,
            'student_name' => $student_name,
            'timestamp' => date('Y-m-d H:i:s')
        ]) . "\n";
        
        fwrite($serial, $command);
        
        // Arduino'dan yanıt bekle (maksimum 3 saniye)
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
            usleep(10000); // 10ms bekle
        }
        
        fclose($serial);
        
        if (empty($response)) {
            return [
                'success' => false, 
                'message' => 'Arduino\'dan yanıt alınamadı'
            ];
        }
        
        // Arduino yanıtını parse et
        $arduino_response = json_decode(trim($response), true);
        
        if (json_last_error() !== JSON_ERROR_NONE) {
            error_log("Arduino'dan geçersiz JSON: " . $response);
            return [
                'success' => false, 
                'message' => 'Arduino\'dan geçersiz yanıt'
            ];
        }
        
        error_log("Arduino yanıtı: " . print_r($arduino_response, true));
        
        return [
            'success' => $arduino_response['success'] ?? true,
            'message' => $arduino_response['message'] ?? 'Kapı kontrolü tamamlandı',
            'serial_port' => $connected_port,
            'door_status' => $arduino_response['status'] ?? 'unknown'
        ];
        
    } catch (Exception $e) {
        error_log("Arduino seri haberleşme hatası: " . $e->getMessage());
        
        return [
            'success' => false, 
            'message' => 'Arduino haberleşme hatası: ' . $e->getMessage()
        ];
    }
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    try {
        // Kullanıcıyı doğrula
        $user = authorize();
        
        // JSON verilerini al
        $data = getJsonData();
        
        // Gerekli alanları kontrol et
        if (!isset($data['action']) || !isset($data['classroom'])) {
            errorResponse('action ve classroom alanları zorunludur');
        }
        
        $action = $data['action']; // 'open_door' veya 'close_door'
        $classroom = $data['classroom'];
        $student_name = $data['student_name'] ?? 'Manual';
        $timestamp = $data['timestamp'] ?? date('Y-m-d H:i:s');
        
        // Arduino ile kapı kontrolü
        $result = controlArduinoDoor($action, $classroom, $student_name);
        
        if ($result['success']) {
            // Başarılı kapı kontrolü logu kaydet
            $conn = getConnection();
            
            // Kapı kontrol tablosunu oluştur (yoksa)
            $createTableSQL = "
                CREATE TABLE IF NOT EXISTS door_control_log (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    action ENUM('open_door', 'close_door') NOT NULL,
                    classroom VARCHAR(100) NOT NULL,
                    student_name VARCHAR(255),
                    teacher_id INT NOT NULL,
                    serial_port VARCHAR(100),
                    timestamp DATETIME NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    INDEX idx_classroom (classroom),
                    INDEX idx_timestamp (timestamp)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            ";
            $conn->exec($createTableSQL);
            
            // Log kaydet
            $logStmt = $conn->prepare("
                INSERT INTO door_control_log (action, classroom, student_name, teacher_id, serial_port, timestamp) 
                VALUES (?, ?, ?, ?, ?, ?)
            ");
            $logStmt->execute([
                $action,
                $classroom,
                $student_name,
                $user['id'],
                $result['serial_port'] ?? 'unknown',
                $timestamp
            ]);
            
            echo json_encode($result);
        } else {
            echo json_encode($result);
        }
        
    } catch (Exception $e) {
        error_log("Door control hatası: " . $e->getMessage());
        errorResponse('Sunucu hatası oluştu', 500);
    }
} else {
    errorResponse('Sadece POST istekleri kabul edilir', 405);
}
?>
