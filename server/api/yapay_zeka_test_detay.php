
<?php
require_once '../config.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

try {
    $pdo = getConnection();
} catch (Exception $e) {
    echo json_encode(['success' => false, 'message' => 'Veritabanı bağlantısı başarısız: ' . $e->getMessage()]);
    exit;
}

$test_id = $_GET['test_id'] ?? null;

if (!$test_id) {
    echo json_encode(['success' => false, 'message' => 'Test ID gerekli']);
    exit;
}

try {
    // Test bilgilerini getir
    $sql = "SELECT * FROM yapay_zeka_testler WHERE id = ?";
    $stmt = $pdo->prepare($sql);
    $stmt->execute([$test_id]);
    $test = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$test) {
        echo json_encode(['success' => false, 'message' => 'Test bulunamadı']);
        exit;
    }

    // Sorular JSON'unu parse et
    $sorular = json_decode($test['sorular'], true);
    
    // Test nesnesini oluştur
    $testData = [
        'id' => $test['id'],
        'sorular' => $sorular,
        'olusturma_tarihi' => $test['olusturma_tarihi'],
        'toplam_soru' => count($sorular)
    ];

    // Eğer test cevapları varsa bunları da ekle (ileride için)
    $userAnswers = [];
    
    echo json_encode([
        'success' => true,
        'test' => $testData,
        'user_answers' => $userAnswers,
        'message' => 'Test detayları başarıyla getirildi'
    ]);

} catch (PDOException $e) {
    echo json_encode([
        'success' => false, 
        'message' => 'Test detayları getirilirken hata oluştu: ' . $e->getMessage()
    ]);
}
?>
