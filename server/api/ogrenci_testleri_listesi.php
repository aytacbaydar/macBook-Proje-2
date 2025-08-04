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
    $sql = "SELECT id, olusturma_tarihi, sorular, tamamlandi, tamamlanma_tarihi, test_sonuclari FROM yapay_zeka_testler WHERE ogrenci_id = ? ORDER BY olusturma_tarihi DESC";
    $stmt = $pdo->prepare($sql);
    $stmt->execute([$ogrenci_id]);
    $testler = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $testListesi = [];
    foreach ($testler as $test) {
        $sorular = json_decode($test['sorular'], true);
        $testSonuclari = null;

        // Eğer test tamamlandıysa sonuçları da ekle
        if ($test['tamamlandi'] && !empty($test['test_sonuclari'])) {
            $testSonuclari = json_decode($test['test_sonuclari'], true);
        }

        $testItem = [
            'id' => $test['id'],
            'olusturma_tarihi' => $test['olusturma_tarihi'],
            'toplam_soru' => count($sorular ?: []),
            'tamamlandi' => (bool)$test['tamamlandi'],
            'tamamlanma_tarihi' => $test['tamamlanma_tarihi']
        ];

        // Test sonuçlarını ekle
        if ($testSonuclari) {
            $testItem['test_sonuclari'] = $testSonuclari;
        }

        $testListesi[] = $testItem;
    }

    echo json_encode([
        'success' => true,
        'data' => $testListesi,
        'message' => 'Testler başarıyla getirildi'
    ]);

} catch (PDOException $e) {
    echo json_encode([
        'success' => false, 
        'message' => 'Testler getirilirken hata oluştu: ' . $e->getMessage()
    ]);
}
?>