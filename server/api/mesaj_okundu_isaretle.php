<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once '../config.php';

try {
    // Get POST data
    $input = json_decode(file_get_contents('php://input'), true);

    if (!$input || !isset($input['ogrenci_id'])) {
        echo json_encode(['success' => false, 'message' => 'ogrenci_id gerekli']);
        exit;
    }

    $ogrenciId = (int)$input['ogrenci_id'];

    // Update all unread teacher messages for this student
    $sql = "UPDATE soru_mesajlari SET okundu = 1 WHERE ogrenci_id = ? AND gonderen_tip = 'ogretmen' AND okundu = 0";
    $stmt = $pdo->prepare($sql);
    $result = $stmt->execute([$ogrenciId]);

    if ($result) {
        echo json_encode([
            'success' => true,
            'message' => 'Mesajlar okundu olarak işaretlendi',
            'updated_count' => $stmt->rowCount()
        ]);
    } else {
        echo json_encode(['success' => false, 'message' => 'Güncelleme başarısız']);
    }

} catch (Exception $e) {
    echo json_encode(['success' => false, 'message' => 'Hata: ' . $e->getMessage()]);
}
?>