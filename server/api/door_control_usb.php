
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

// Local Arduino Bridge ile haberleşme
function tryLocalArduinoBridge($action, $classroom, $student_name) {
    try {
        $bridge_data = [
            'action' => $action,
            'classroom' => $classroom,
            'student_name' => $student_name,
            'timestamp' => date('Y-m-d H:i:s')
        ];
        
        $context = stream_context_create([
            'http' => [
                'method' => 'POST',
                'header' => 'Content-Type: application/json',
                'content' => json_encode($bridge_data),
                'timeout' => 10
            ]
        ]);
        
        $response = @file_get_contents(LOCAL_ARDUINO_BRIDGE_URL, false, $context);
        
        if ($response === false) {
            return [
                'success' => false,
                'message' => 'Local Arduino bridge\'e ulaşılamadı'
            ];
        }
        
        $result = json_decode($response, true);
        if (json_last_error() !== JSON_ERROR_NONE) {
            return [
                'success' => false,
                'message' => 'Local bridge\'den geçersiz yanıt'
            ];
        }
        
        error_log("Local Arduino bridge başarılı: " . $response);
        return $result;
        
    } catch (Exception $e) {
        error_log("Local Arduino bridge hatası: " . $e->getMessage());
        return [
            'success' => false,
            'message' => 'Local bridge bağlantı hatası: ' . $e->getMessage()
        ];
    }
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

// Local Arduino Bridge URL'si (Arduino'nuz local bilgisayarda ise)
define('LOCAL_ARDUINO_BRIDGE_URL', 'http://YOUR_LOCAL_IP:8080'); // IP'nizi buraya yazın

// Arduino ile seri haberleşme fonksiyonu
function controlArduinoDoor($action, $classroom, $student_name = 'Manual') {
    error_log("Arduino kontrol fonksiyonu çağrıldı - Action: $action, Classroom: $classroom, Student: $student_name");
    
    // Önce local bridge'i dene
    $bridge_result = tryLocalArduinoBridge($action, $classroom, $student_name);
    if ($bridge_result['success']) {
        return $bridge_result;
    }
    
    error_log("Local bridge başarısız, direct connection deneniyor...");
    
    // Arduino'nun bağlı olduğu seri port
    // Windows: COM3, COM4 vb.
    // Linux/Mac: /dev/ttyUSB0, /dev/ttyACM0 vb.
    $serial_ports = [
        '/dev/ttyACM0',    // Linux/Mac için Arduino Uno
        '/dev/ttyUSB0',    // Linux için USB-Serial
        '/dev/ttyACM1',    // Alternatif Linux port
        'COM3',            // Windows için (değiştirilebilir)
        'COM4',            // Windows için alternatif
        'COM5',            // Windows alternatif
    ];
    
    $connected_port = null;
    $available_ports = [];
    
    // Mevcut portları kontrol et ve kaydet
    foreach ($serial_ports as $port) {
        if (file_exists($port)) {
            $available_ports[] = $port;
            if (!$connected_port) {
                $connected_port = $port;
            }
        } elseif (strtoupper(substr(PHP_OS, 0, 3)) === 'WIN' && strpos($port, 'COM') === 0) {
            // Windows için COM port kontrolü daha detaylı olmalı
            $available_ports[] = $port . " (Windows - kontrol edilemez)";
            if (!$connected_port) {
                $connected_port = $port;
            }
        }
    }
    
    error_log("Mevcut portlar: " . implode(', ', $available_ports));
    
    if (!$connected_port) {
        $error_msg = "Arduino bulunamadı. Kontrol edilen portlar: " . implode(', ', $serial_ports);
        error_log($error_msg);
        return [
            'success' => false, 
            'message' => 'Arduino bulunamadı (USB bağlantısını kontrol edin)',
            'debug_info' => [
                'checked_ports' => $serial_ports,
                'available_ports' => $available_ports,
                'os' => PHP_OS
            ]
        ];
    }
    
    try {
        error_log("Seri port bağlantısı deneniyor: $connected_port");
        
        // Seri port ayarları (Linux/Mac için)
        if (strtoupper(substr(PHP_OS, 0, 3)) !== 'WIN') {
            // Linux/Mac seri port konfigürasyonu
            $stty_command = "stty -F {$connected_port} cs8 9600 ignbrk -brkint -icrnl -imaxbel -opost -onlcr -isig -icanon -iexten -echo -echoe -echok -echoctl -echoke noflsh -ixon -crtscts 2>&1";
            $stty_output = [];
            $stty_return = 0;
            exec($stty_command, $stty_output, $stty_return);
            
            if ($stty_return !== 0) {
                error_log("STTY konfigürasyon hatası: " . implode("\n", $stty_output));
            } else {
                error_log("STTY konfigürasyonu başarılı");
            }
        }
        
        // Seri porta bağlan
        error_log("fopen ile seri port açılıyor...");
        $serial = fopen($connected_port, "r+b");
        
        if (!$serial) {
            $error_msg = "Seri port açılamadı: {$connected_port}. PHP error: " . error_get_last()['message'];
            error_log($error_msg);
            return [
                'success' => false, 
                'message' => "Seri port açılamadı: {$connected_port}",
                'debug_info' => [
                    'port' => $connected_port,
                    'php_error' => error_get_last(),
                    'permissions' => is_readable($connected_port) && is_writable($connected_port)
                ]
            ];
        }
        
        error_log("Seri port başarıyla açıldı: $connected_port");
        
        // Arduino'ya JSON komutu gönder
        $command = json_encode([
            'action' => $action,
            'classroom' => $classroom,
            'student_name' => $student_name,
            'timestamp' => date('Y-m-d H:i:s')
        ]) . "\n";
        
        error_log("Arduino'ya gönderilen komut: " . trim($command));
        
        $bytes_written = fwrite($serial, $command);
        if ($bytes_written === false || $bytes_written === 0) {
            fclose($serial);
            return [
                'success' => false, 
                'message' => 'Arduino\'ya komut gönderilemedi'
            ];
        }
        
        error_log("Arduino'ya $bytes_written byte gönderildi");
        
        // Buffer'ı temizle
        fflush($serial);
        
        // Arduino'dan yanıt bekle (maksimum 5 saniye)
        $start_time = time();
        $response = '';
        $timeout = 5;
        
        error_log("Arduino'dan yanıt bekleniyor ($timeout saniye)...");
        
        while ((time() - $start_time) < $timeout) {
            $char = fgetc($serial);
            if ($char !== false) {
                $response .= $char;
                if ($char === "\n") {
                    break;
                }
            }
            usleep(50000); // 50ms bekle (daha az CPU kullanımı)
        }
        
        fclose($serial);
        
        error_log("Arduino'dan alınan ham yanıt: '" . $response . "'");
        
        if (empty($response)) {
            return [
                'success' => false, 
                'message' => 'Arduino\'dan yanıt alınamadı (timeout)',
                'debug_info' => [
                    'timeout' => $timeout,
                    'port' => $connected_port,
                    'command_sent' => trim($command)
                ]
            ];
        }
        
        // Arduino yanıtını parse et
        $trimmed_response = trim($response);
        $arduino_response = json_decode($trimmed_response, true);
        
        if (json_last_error() !== JSON_ERROR_NONE) {
            error_log("Arduino'dan geçersiz JSON: " . $trimmed_response);
            error_log("JSON hata: " . json_last_error_msg());
            
            // Basit yanıt olarak kabul et
            return [
                'success' => true,
                'message' => 'Arduino komutu gönderildi (yanıt: ' . $trimmed_response . ')',
                'serial_port' => $connected_port,
                'raw_response' => $trimmed_response
            ];
        }
        
        error_log("Arduino JSON yanıtı: " . print_r($arduino_response, true));
        
        return [
            'success' => $arduino_response['success'] ?? true,
            'message' => $arduino_response['message'] ?? 'Kapı kontrolü tamamlandı',
            'serial_port' => $connected_port,
            'door_status' => $arduino_response['status'] ?? 'unknown'
        ];
        
    } catch (Exception $e) {
        error_log("Arduino seri haberleşme hatası: " . $e->getMessage());
        error_log("Hata detayı: " . $e->getTraceAsString());
        
        return [
            'success' => false, 
            'message' => 'Arduino haberleşme hatası: ' . $e->getMessage(),
            'debug_info' => [
                'exception' => $e->getMessage(),
                'file' => $e->getFile(),
                'line' => $e->getLine(),
                'port' => $connected_port ?? 'unknown'
            ]
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
        error_log("Door control ana hatası: " . $e->getMessage());
        error_log("Hata stack trace: " . $e->getTraceAsString());
        
        // Detaylı hata bilgisi dön
        http_response_code(500);
        echo json_encode([
            'success' => false, 
            'message' => 'Sunucu hatası: ' . $e->getMessage(),
            'debug_info' => [
                'error_type' => get_class($e),
                'file' => $e->getFile(),
                'line' => $e->getLine(),
                'request_data' => $data ?? null
            ]
        ]);
        exit();
    }
} else {
    errorResponse('Sadece POST istekleri kabul edilir', 405);
}
?>
