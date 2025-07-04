
<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Sadece POST istekleri kabul edilir']);
    exit();
}

require_once '../config.php';

try {
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (!$input || !isset($input['ogrenci_id'])) {
        echo json_encode(['success' => false, 'message' => 'ogrenci_id gerekli']);
        exit();
    }

    $ogrenciId = (int)$input['ogrenci_id'];
    
    // Öğrencinin tüm öğretmen mesajlarını okundu yap
    $sql = "UPDATE soru_mesajlari SET okundu = 1 WHERE ogrenci_id = ? AND gonderen_tip = 'ogretmen'";
    $stmt = $pdo->prepare($sql);
    $result = $stmt->execute([$ogrenciId]);
    
    if ($result) {
        echo json_encode([
            'success' => true, 
            'message' => 'Tüm mesajlar okundu işaretlendi',
            'updated_count' => $stmt->rowCount()
        ]);
    } else {
        echo json_encode(['success' => false, 'message' => 'Güncelleme başarısız']);
    }

} catch (Exception $e) {
    echo json_encode(['success' => false, 'message' => 'Hata: ' . $e->getMessage()]);
}
?>
