
<?php
require_once '../config.php';

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode([
        'success' => false,
        'message' => 'Sadece POST istekleri kabul edilir'
    ]);
    exit;
}

try {
    $pdo = getConnection();
} catch (Exception $e) {
    echo json_encode(['success' => false, 'message' => 'Veritabanı bağlantısı başarısız: ' . $e->getMessage()]);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);

if (!$input) {
    echo json_encode([
        'success' => false,
        'message' => 'Geçersiz JSON verisi'
    ]);
    exit;
}

$test_id = $input['test_id'] ?? null;
$user_answers = $input['user_answers'] ?? [];
$test_results = $input['test_results'] ?? null;

if (!$test_id) {
    echo json_encode([
        'success' => false,
        'message' => 'Test ID gerekli'
    ]);
    exit;
}

try {
    // Önce testin var olup olmadığını kontrol et
    $checkSql = "SELECT id FROM yapay_zeka_testler WHERE id = ?";
    $checkStmt = $pdo->prepare($checkSql);
    $checkStmt->execute([$test_id]);
    
    if (!$checkStmt->fetch()) {
        echo json_encode([
            'success' => false,
            'message' => 'Test bulunamadı'
        ]);
        exit;
    }

    // Test sonuçlarını ve cevapları veritabanına kaydet
    $sql = "UPDATE yapay_zeka_testler SET 
            user_answers = ?, 
            test_sonuclari = ?, 
            tamamlandi = 1, 
            tamamlanma_tarihi = NOW() 
            WHERE id = ?";

    $stmt = $pdo->prepare($sql);
    $result = $stmt->execute([
        json_encode($user_answers, JSON_UNESCAPED_UNICODE),
        json_encode($test_results, JSON_UNESCAPED_UNICODE),
        $test_id
    ]);

    if ($result && $stmt->rowCount() > 0) {
        echo json_encode([
            'success' => true,
            'message' => 'Test sonuçları başarıyla kaydedildi'
        ]);
    } else {
        echo json_encode([
            'success' => false,
            'message' => 'Test sonuçları kaydedilemedi - kayıt etkilenmedi'
        ]);
    }

} catch (PDOException $e) {
    echo json_encode([
        'success' => false,
        'message' => 'Veritabanı hatası: ' . $e->getMessage()
    ]);
} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'message' => 'Genel hata: ' . $e->getMessage()
    ]);
}
?>
