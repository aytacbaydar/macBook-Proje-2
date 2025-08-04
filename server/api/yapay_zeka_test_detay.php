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

    // Test nesnesini oluştur
    $testData = [
        'id' => $test['id'],
        'sorular' => $sorular,
        'olusturma_tarihi' => $test['olusturma_tarihi'],
        'toplam_soru' => count($sorular)
    ];

    $userAnswers = [];
    $testSonuclari = null;

    if ($completed) {
        // Tamamlanmış test için test sonuçlarını ve cevapları getir
        $sql = "SELECT user_answers, test_sonuclari FROM yapay_zeka_testler WHERE id = ?";
        $stmt = $pdo->prepare($sql);
        $stmt->execute([$test_id]);
        $result = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($result) {
            // User answers JSON'unu parse et
            if (!empty($result['user_answers'])) {
                $userAnswers = json_decode($result['user_answers'], true) ?: [];
            }

            // Test sonuçlarını parse et
            if (!empty($result['test_sonuclari'])) {
                $testSonuclari = json_decode($result['test_sonuclari'], true);
            }
        }
    } else {
        // Devam ettirilebilir test için mevcut cevapları getir (varsa)
        $sql = "SELECT user_answers FROM yapay_zeka_testler WHERE id = ?";
        $stmt = $pdo->prepare($sql);
        $stmt->execute([$test_id]);
        $result = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($result && !empty($result['user_answers'])) {
            $userAnswers = json_decode($result['user_answers'], true) ?: [];
        }
    }

    $response = [
        'success' => true,
        'test' => $testData,
        'user_answers' => $userAnswers,
        'message' => 'Test detayları başarıyla getirildi'
    ];

    if ($completed && $testSonuclari) {
        $response['test_sonuclari'] = $testSonuclari;
    }

    echo json_encode($response);

} catch (PDOException $e) {
    echo json_encode([
        'success' => false, 
        'message' => 'Test detayları getirilirken hata oluştu: ' . $e->getMessage()
    ]);
}
?>