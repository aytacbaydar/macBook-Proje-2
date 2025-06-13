
<?php
// Kapı kontrolü API'si
require_once '../config.php';

// Türkiye saat dilimini ayarla
date_default_timezone_set('Europe/Istanbul');

// CORS başlıkları
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Content-Type: application/json; charset=UTF-8");

// OPTIONS isteğini yönet
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
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
        
        // Kapı kontrolü logu kaydet
        $conn = getConnection();
        
        // Kapı kontrol tablosunu oluştur (yoksa)
        $createTableSQL = "
            CREATE TABLE IF NOT EXISTS door_control_log (
                id INT AUTO_INCREMENT PRIMARY KEY,
                action ENUM('open_door', 'close_door') NOT NULL,
                classroom VARCHAR(100) NOT NULL,
                student_name VARCHAR(255),
                teacher_id INT NOT NULL,
                timestamp DATETIME NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_classroom (classroom),
                INDEX idx_timestamp (timestamp)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ";
        $conn->exec($createTableSQL);
        
        // Log kaydet
        $logStmt = $conn->prepare("
            INSERT INTO door_control_log (action, classroom, student_name, teacher_id, timestamp) 
            VALUES (:action, :classroom, :student_name, :teacher_id, :timestamp)
        ");
        $logStmt->bindParam(':action', $action);
        $logStmt->bindParam(':classroom', $classroom);
        $logStmt->bindParam(':student_name', $student_name);
        $logStmt->bindParam(':teacher_id', $user['id']);
        $logStmt->bindParam(':timestamp', $timestamp);
        $logStmt->execute();
        
        // Kapı kontrolü simülasyonu (gerçek hardware entegrasyonu için)
        $hardware_response = controlClassroomDoor($action, $classroom);
        
        if ($hardware_response['success']) {
            successResponse([
                'action' => $action,
                'classroom' => $classroom,
                'timestamp' => $timestamp,
                'hardware_status' => $hardware_response['message']
            ], 'Kapı kontrolü başarılı');
        } else {
            errorResponse('Hardware hatası: ' . $hardware_response['message'], 500);
        }
        
    } catch (PDOException $e) {
        error_log("Veritabanı hatası: " . $e->getMessage());
        errorResponse('Kapı kontrolü kaydedilemedi: ' . $e->getMessage(), 500);
    } catch (Exception $e) {
        error_log("Genel hata: " . $e->getMessage());
        errorResponse('Kapı kontrolü sırasında hata: ' . $e->getMessage(), 500);
    }
} else {
    errorResponse('Sadece POST istekleri kabul edilir', 405);
}

// Hardware kontrol fonksiyonu
function controlClassroomDoor($action, $classroom) {
    // ESP8266 NodeMCU cihazlarının IP adresleri (sınıfa göre)
    $esp8266_ips = [
        'A101' => '192.168.1.101', // A101 sınıfı ESP8266 IP'si
        'A102' => '192.168.1.102', // A102 sınıfı ESP8266 IP'si
        'B201' => '192.168.1.103', // B201 sınıfı ESP8266 IP'si
        'default' => '192.168.1.100' // Varsayılan ESP8266 IP'si
    ];
    
    // Sınıfa göre ESP8266 IP adresini belirle
    $esp_ip = $esp8266_ips[$classroom] ?? $esp8266_ips['default'];
    $hardware_url = "http://{$esp_ip}:5000/door";
    
    $post_data = json_encode([
        'action' => $action,
        'classroom' => $classroom,
        'security_token' => 'KIMYA_DOOR_CONTROL_2024' // Güvenlik token'ı
    ]);
    
    $context = stream_context_create([
        'http' => [
            'method' => 'POST',
            'header' => 'Content-Type: application/json',
            'content' => $post_data,
            'timeout' => 5 // 5 saniye timeout (WiFi gecikmeleri için)
        ]
    ]);
    
    try {
        error_log("ESP8266'ya istek gönderiliyor: {$hardware_url} - Action: {$action}");
        
        $response = file_get_contents($hardware_url, false, $context);
        
        if ($response === FALSE) {
            // HTTP durum kodunu kontrol et
            $http_response_header_info = $http_response_header ?? [];
            error_log("ESP8266 bağlantı hatası - Headers: " . print_r($http_response_header_info, true));
            
            return [
                'success' => false, 
                'message' => "ESP8266 ({$esp_ip}) bağlantısı başarısız"
            ];
        }
        
        $result = json_decode($response, true);
        
        if (json_last_error() !== JSON_ERROR_NONE) {
            error_log("ESP8266'dan geçersiz JSON yanıtı: " . $response);
            return [
                'success' => false, 
                'message' => 'ESP8266\'dan geçersiz yanıt'
            ];
        }
        
        error_log("ESP8266 yanıtı: " . print_r($result, true));
        
        return [
            'success' => $result['success'] ?? true, 
            'message' => $result['message'] ?? 'Kapı kontrolü tamamlandı',
            'esp_ip' => $esp_ip,
            'door_status' => $result['status'] ?? 'unknown'
        ];
        
    } catch (Exception $e) {
        error_log("ESP8266 kontrol hatası: " . $e->getMessage());
        
        // Simülasyon modu (test için)
        return [
            'success' => true, 
            'message' => "Simülasyon: Kapı " . ($action == 'open_door' ? 'açıldı' : 'kapatıldı') . " (ESP8266: {$esp_ip})",
            'simulation' => true
        ];
    }
}
?>
