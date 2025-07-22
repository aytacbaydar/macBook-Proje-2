
<?php
require_once '../config.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

try {
    $pdo = getConnection();
} catch (Exception $e) {
    echo json_encode(['success' => false, 'message' => 'Veritabanı bağlantısı başarısız: ' . $e->getMessage()]);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'DELETE') {
    echo json_encode(['success' => false, 'message' => 'Sadece DELETE metodu desteklenir']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);

if (!$input) {
    echo json_encode(['success' => false, 'message' => 'Geçersiz JSON verisi']);
    exit;
}

$test_id = $input['test_id'] ?? null;
$ogrenci_id = $input['ogrenci_id'] ?? null;

if (!$test_id || !$ogrenci_id) {
    echo json_encode(['success' => false, 'message' => 'Test ID ve öğrenci ID gerekli']);
    exit;
}

try {
    // Önce testin öğrenciye ait olduğunu kontrol et
    $checkSQL = "SELECT COUNT(*) as count FROM yapay_zeka_testler WHERE id = ? AND ogrenci_id = ?";
    $checkStmt = $pdo->prepare($checkSQL);
    $checkStmt->execute([$test_id, $ogrenci_id]);
    $result = $checkStmt->fetch(PDO::FETCH_ASSOC);

    if ($result['count'] == 0) {
        echo json_encode(['success' => false, 'message' => 'Test bulunamadı veya size ait değil']);
        exit;
    }

    // Testi sil
    $deleteSQL = "DELETE FROM yapay_zeka_testler WHERE id = ? AND ogrenci_id = ?";
    $deleteStmt = $pdo->prepare($deleteSQL);
    $deleteStmt->execute([$test_id, $ogrenci_id]);

    echo json_encode([
        'success' => true,
        'message' => 'Test başarıyla silindi'
    ]);

} catch (PDOException $e) {
    echo json_encode([
        'success' => false, 
        'message' => 'Test silinirken hata oluştu: ' . $e->getMessage()
    ]);
}
?>
