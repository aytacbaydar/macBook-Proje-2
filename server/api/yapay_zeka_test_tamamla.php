
<?php
require_once '../config.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

try {
    $pdo = getConnection();
} catch (Exception $e) {
    echo json_encode(['success' => false, 'message' => 'Veritabanı bağlantısı başarısız: ' . $e->getMessage()]);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['success' => false, 'message' => 'Sadece POST metodu desteklenir']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);

if (!$input) {
    echo json_encode(['success' => false, 'message' => 'Geçersiz JSON verisi']);
    exit;
}

$test_id = $input['test_id'] ?? null;
$user_answers = $input['user_answers'] ?? [];
$test_results = $input['test_results'] ?? null;

if (!$test_id || !$test_results) {
    echo json_encode(['success' => false, 'message' => 'Test ID ve sonuçlar gerekli']);
    exit;
}

try {
    // Test sonuçlarını kaydet
    $sql = "UPDATE yapay_zeka_testler 
            SET tamamlanma_tarihi = NOW(), 
                sonuc = ?, 
                kullanici_cevaplari = ? 
            WHERE id = ?";
    
    $stmt = $pdo->prepare($sql);
    $stmt->execute([
        json_encode($test_results),
        json_encode($user_answers),
        $test_id
    ]);

    echo json_encode([
        'success' => true,
        'message' => 'Test başarıyla tamamlandı'
    ]);

} catch (PDOException $e) {
    echo json_encode([
        'success' => false, 
        'message' => 'Test tamamlanırken hata oluştu: ' . $e->getMessage()
    ]);
}
?>
