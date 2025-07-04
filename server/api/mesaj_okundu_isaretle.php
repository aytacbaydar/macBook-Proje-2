
<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once '../config.php';

// Authorization function
function authorize() {
    $headers = getallheaders();
    $authHeader = $headers['Authorization'] ?? $headers['authorization'] ?? '';
    
    if (empty($authHeader) || substr($authHeader, 0, 7) !== 'Bearer ') {
        http_response_code(401);
        echo json_encode(['error' => 'Token gerekli']);
        exit;
    }
    
    $token = substr($authHeader, 7);
    
    global $pdo;
    $stmt = $pdo->prepare("SELECT * FROM ogrenciler WHERE token = ?");
    $stmt->execute([$token]);
    $user = $stmt->fetch();
    
    if (!$user) {
        http_response_code(401);
        echo json_encode(['error' => 'Geçersiz token']);
        exit;
    }
    
    return $user;
}

try {
    // Authorize user
    $user = authorize();
    
    // Get POST data
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (!isset($input['message_ids']) || !isset($input['ogrenci_id'])) {
        echo json_encode([
            'success' => false,
            'message' => 'Gerekli parametreler eksik'
        ]);
        exit;
    }
    
    $messageIds = $input['message_ids'];
    $ogrenciId = $input['ogrenci_id'];
    
    // Check if user has permission to mark these messages as read
    if ($user['rutbe'] === 'ogrenci' && $user['id'] != $ogrenciId) {
        echo json_encode([
            'success' => false,
            'message' => 'Bu işlem için yetkiniz yok'
        ]);
        exit;
    }
    
    if (!is_array($messageIds) || empty($messageIds)) {
        echo json_encode([
            'success' => false,
            'message' => 'Geçersiz mesaj ID listesi'
        ]);
        exit;
    }
    
    // Create placeholders for prepared statement
    $placeholders = str_repeat('?,', count($messageIds) - 1) . '?';
    
    // Update messages as read
    $sql = "UPDATE soru_mesajlari 
            SET okundu = 1 
            WHERE id IN ($placeholders) 
            AND ogrenci_id = ? 
            AND gonderen_tip = 'ogretmen'";
    
    $stmt = $pdo->prepare($sql);
    
    // Bind parameters
    $params = $messageIds;
    $params[] = $ogrenciId;
    
    $result = $stmt->execute($params);
    
    if ($result) {
        echo json_encode([
            'success' => true,
            'message' => 'Mesajlar okundu olarak işaretlendi',
            'updated_count' => $stmt->rowCount()
        ]);
    } else {
        echo json_encode([
            'success' => false,
            'message' => 'Mesajlar güncellenirken hata oluştu'
        ]);
    }
    
} catch (PDOException $e) {
    error_log('PDO Error in mesaj_okundu_isaretle.php: ' . $e->getMessage());
    echo json_encode([
        'success' => false,
        'message' => 'Veritabanı hatası: ' . $e->getMessage()
    ]);
} catch (Exception $e) {
    error_log('Error in mesaj_okundu_isaretle.php: ' . $e->getMessage());
    echo json_encode([
        'success' => false,
        'message' => 'Sunucu hatası: ' . $e->getMessage()
    ]);
}
?>
