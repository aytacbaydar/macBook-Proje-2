
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

$ogrenci_id = $_GET['ogrenci_id'] ?? null;

if (!$ogrenci_id) {
    echo json_encode(['success' => false, 'message' => 'Öğrenci ID gerekli']);
    exit;
}

try {
    // Öğrencinin testlerini getir
    $sql = "SELECT id, olusturma_tarihi, tamamlanma_tarihi, sonuc, 
            JSON_LENGTH(sorular) as toplam_soru
            FROM yapay_zeka_testler 
            WHERE ogrenci_id = ? 
            ORDER BY olusturma_tarihi DESC";
    
    $stmt = $pdo->prepare($sql);
    $stmt->execute([$ogrenci_id]);
    $testler = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Test sonuçlarını parse et
    foreach ($testler as &$test) {
        if ($test['sonuc']) {
            $sonuc = json_decode($test['sonuc'], true);
            $test['dogru_sayisi'] = $sonuc['dogru_sayisi'] ?? 0;
            $test['yanlis_sayisi'] = $sonuc['yanlis_sayisi'] ?? 0;
            $test['bos_sayisi'] = $sonuc['bos_sayisi'] ?? 0;
            $test['net'] = $sonuc['net'] ?? 0;
            $test['yuzde'] = $sonuc['yuzde'] ?? 0;
            $test['tamamlandi'] = true;
        } else {
            $test['tamamlandi'] = false;
        }
    }

    echo json_encode([
        'success' => true,
        'data' => $testler,
        'message' => 'Testler başarıyla getirildi'
    ]);

} catch (PDOException $e) {
    echo json_encode([
        'success' => false, 
        'message' => 'Testler getirilirken hata oluştu: ' . $e->getMessage()
    ]);
}
?>
