<?php
require_once '../config.php';

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    echo json_encode(['success' => false, 'message' => 'Sadece GET istekleri kabul edilir']);
    exit;
}

try {
    $pdo = getConnection();
} catch (Exception $e) {
    echo json_encode(['success' => false, 'message' => 'Veritabanı bağlantısı başarısız: ' . $e->getMessage()]);
    exit;
}

$test_id = $_GET['test_id'] ?? null;
$completed = $_GET['completed'] ?? false;

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
    if (!$sorular) {
        echo json_encode(['success' => false, 'message' => 'Test soruları geçersiz']);
        exit;
    }

    // Test adı oluştur
    $testAdi = !empty($test['test_adi']) ? $test['test_adi'] : 'Yapay Zeka Testi - ' . date('d.m.Y H:i', strtotime($test['olusturma_tarihi']));

    // Test nesnesini oluştur
    $testData = [
        'id' => $test['id'],
        'test_adi' => $testAdi,
        'sorular' => $sorular,
        'olusturma_tarihi' => $test['olusturma_tarihi'],
        'toplam_soru' => count($sorular)
    ];

    $userAnswers = [];
    $testSonuclari = null;

    if ($completed === 'true' || $completed === true) {
        // Tamamlanmış test için test sonuçlarını ve cevapları getir
        if (!empty($test['user_answers'])) {
            $userAnswers = json_decode($test['user_answers'], true) ?: [];
        }

        if (!empty($test['test_sonuclari'])) {
            $testSonuclari = json_decode($test['test_sonuclari'], true);
        }
    } else {
        // Devam ettirilebilir test için mevcut cevapları getir (varsa)
        if (!empty($test['user_answers'])) {
            $userAnswers = json_decode($test['user_answers'], true) ?: [];
        }
    }

    $response = [
        'success' => true,
        'test' => $testData,
        'user_answers' => $userAnswers,
        'message' => 'Test detayları başarıyla getirildi'
    ];

    if (($completed === 'true' || $completed === true) && $testSonuclari) {
        $response['test_sonuclari'] = $testSonuclari;
    }

    echo json_encode($response);

} catch (PDOException $e) {
    echo json_encode([
        'success' => false, 
        'message' => 'Test detayları getirilirken hata oluştu: ' . $e->getMessage()
    ]);
} catch (Exception $e) {
    echo json_encode([
        'success' => false, 
        'message' => 'Genel hata: ' . $e->getMessage()
    ]);
}
?>