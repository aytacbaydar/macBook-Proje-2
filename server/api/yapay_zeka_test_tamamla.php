
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

    // Test sorularını parse et
    $sorular = json_decode($test['sorular'], true);
    
    // Sonuçları hesapla
    $dogru_sayisi = 0;
    $yanlis_sayisi = 0;
    $bos_sayisi = 0;
    
    foreach ($sorular as $index => $soru) {
        $user_answer = $user_answers[$index] ?? null;
        
        if (!$user_answer) {
            $bos_sayisi++;
        } elseif ($user_answer === $soru['dogru_cevap']) {
            $dogru_sayisi++;
        } else {
            $yanlis_sayisi++;
        }
    }
    
    $toplam_soru = count($sorular);
    $net = $dogru_sayisi - ($yanlis_sayisi / 4);
    $yuzde = ($dogru_sayisi / $toplam_soru) * 100;
    
    // Sonuçları veritabanına kaydet
    $sonuc = [
        'dogru_sayisi' => $dogru_sayisi,
        'yanlis_sayisi' => $yanlis_sayisi,
        'bos_sayisi' => $bos_sayisi,
        'net' => round($net, 2),
        'yuzde' => round($yuzde, 2),
        'user_answers' => $user_answers
    ];
    
    $updateSQL = "UPDATE yapay_zeka_testler SET 
                  tamamlanma_tarihi = NOW(), 
                  sonuc = ? 
                  WHERE id = ?";
    $updateStmt = $pdo->prepare($updateSQL);
    $updateStmt->execute([json_encode($sonuc), $test_id]);
    
    echo json_encode([
        'success' => true,
        'message' => 'Test başarıyla tamamlandı',
        'results' => $sonuc
    ]);

} catch (PDOException $e) {
    echo json_encode([
        'success' => false, 
        'message' => 'Test tamamlanırken hata oluştu: ' . $e->getMessage()
    ]);
}
?>
