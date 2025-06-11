
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
    // Raspberry Pi veya Arduino'ya HTTP isteği gönder
    $hardware_url = "http://192.168.1.100:5000/door"; // Raspberry Pi IP'si
    
    $post_data = json_encode([
        'action' => $action,
        'classroom' => $classroom,
        'security_token' => 'YOUR_SECURITY_TOKEN' // Güvenlik için
    ]);
    
    $context = stream_context_create([
        'http' => [
            'method' => 'POST',
            'header' => 'Content-Type: application/json',
            'content' => $post_data,
            'timeout' => 3 // 3 saniye timeout
        ]
    ]);
    
    try {
        $response = file_get_contents($hardware_url, false, $context);
        
        if ($response === FALSE) {
            return ['success' => false, 'message' => 'Hardware bağlantısı başarısız'];
        }
        
        $result = json_decode($response, true);
        return [
            'success' => true, 
            'message' => $result['message'] ?? 'Kapı kontrolü tamamlandı'
        ];
        
    } catch (Exception $e) {
        // Hardware bağlantısı yoksa simülasyon yap
        error_log("Hardware bağlantı hatası: " . $e->getMessage());
        
        // Simülasyon için başarılı yanıt döndür
        return [
            'success' => true, 
            'message' => 'Simülasyon: Kapı ' . ($action == 'open_door' ? 'açıldı' : 'kapatıldı')
        ];
    }
}
?>
