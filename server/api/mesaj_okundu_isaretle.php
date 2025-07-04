
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

// Get headers function that works on all servers
function getRequestHeaders() {
    $headers = array();
    
    // Try getallheaders first
    if (function_exists('getallheaders')) {
        $headers = getallheaders();
    } else {
        // Fallback for servers that don't support getallheaders
        foreach ($_SERVER as $name => $value) {
            if (substr($name, 0, 5) == 'HTTP_') {
                $headerName = str_replace(' ', '-', ucwords(str_replace('_', ' ', strtolower(substr($name, 5)))));
                $headers[$headerName] = $value;
            }
        }
    }
    
    return $headers;
}

// Authorization function
function authorize() {
    $headers = getRequestHeaders();
    $authHeader = $headers['Authorization'] ?? $headers['authorization'] ?? '';
    
    if (empty($authHeader) || substr($authHeader, 0, 7) !== 'Bearer ') {
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'Token gerekli']);
        exit;
    }
    
    $token = substr($authHeader, 7);
    
    global $pdo;
    $stmt = $pdo->prepare("SELECT * FROM ogrenciler WHERE token = ?");
    $stmt->execute([$token]);
    $user = $stmt->fetch();
    
    if (!$user) {
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'Geçersiz token']);
        exit;
    }
    
    return $user;
}

try {
    // Authorize user
    $user = authorize();
    
    // Get POST data
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (!$input) {
        echo json_encode(['success' => false, 'message' => 'Geçersiz JSON verisi']);
        exit;
    }
    
    // Check if this is for marking all student messages as read
    if (isset($input['ogrenci_id']) && !isset($input['message_ids'])) {
        $ogrenciId = $input['ogrenci_id'];
        
        // Student can only mark their own messages
        if ($user['rutbe'] === 'ogrenci' && $user['id'] != $ogrenciId) {
            echo json_encode(['success' => false, 'message' => 'Bu işlem için yetkiniz yok']);
            exit;
        }
        
        // Teacher can only mark messages for their students
        if ($user['rutbe'] === 'ogretmen') {
            $stmt = $pdo->prepare("SELECT id FROM ogrenciler WHERE id = ? AND ogretmeni = ?");
            $stmt->execute([$ogrenciId, $user['adi_soyadi']]);
            if (!$stmt->fetch()) {
                echo json_encode(['success' => false, 'message' => 'Bu öğrencinin mesajlarını işaretleme yetkiniz yok']);
                exit;
            }
        }
        
        // Mark all unread messages for this student as read
        if ($user['rutbe'] === 'ogrenci') {
            // Student marking teacher messages as read
            $sql = "UPDATE soru_mesajlari 
                    SET okundu = 1 
                    WHERE ogrenci_id = ? 
                    AND gonderen_tip = 'ogretmen' 
                    AND okundu = 0";
            $stmt = $pdo->prepare($sql);
            $result = $stmt->execute([$ogrenciId]);
        } else {
            // Teacher marking student messages as read
            $sql = "UPDATE soru_mesajlari 
                    SET okundu = 1 
                    WHERE ogrenci_id = ? 
                    AND gonderen_tip = 'ogrenci' 
                    AND okundu = 0";
            $stmt = $pdo->prepare($sql);
            $result = $stmt->execute([$ogrenciId]);
        }
        
        if ($result) {
            echo json_encode([
                'success' => true,
                'message' => 'Mesajlar okundu olarak işaretlendi',
                'updated_count' => $stmt->rowCount()
            ]);
        } else {
            echo json_encode(['success' => false, 'message' => 'Mesajlar güncellenirken hata oluştu']);
        }
        
    } else {
        // Legacy support for specific message IDs
        if (!isset($input['message_ids']) || !isset($input['ogrenci_id'])) {
            echo json_encode(['success' => false, 'message' => 'Gerekli parametreler eksik']);
            exit;
        }
        
        $messageIds = $input['message_ids'];
        $ogrenciId = $input['ogrenci_id'];
        
        if ($user['rutbe'] === 'ogrenci' && $user['id'] != $ogrenciId) {
            echo json_encode(['success' => false, 'message' => 'Bu işlem için yetkiniz yok']);
            exit;
        }
        
        if (!is_array($messageIds) || empty($messageIds)) {
            echo json_encode(['success' => false, 'message' => 'Geçersiz mesaj ID listesi']);
            exit;
        }
        
        $placeholders = str_repeat('?,', count($messageIds) - 1) . '?';
        $sql = "UPDATE soru_mesajlari 
                SET okundu = 1 
                WHERE id IN ($placeholders) 
                AND ogrenci_id = ? 
                AND gonderen_tip = 'ogretmen'";
        
        $stmt = $pdo->prepare($sql);
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
            echo json_encode(['success' => false, 'message' => 'Mesajlar güncellenirken hata oluştu']);
        }
    }
    
} catch (PDOException $e) {
    error_log('PDO Error in mesaj_okundu_isaretle.php: ' . $e->getMessage());
    echo json_encode(['success' => false, 'message' => 'Veritabanı hatası oluştu']);
} catch (Exception $e) {
    error_log('Error in mesaj_okundu_isaretle.php: ' . $e->getMessage());
    echo json_encode(['success' => false, 'message' => 'Sunucu hatası oluştu']);
}
?>
