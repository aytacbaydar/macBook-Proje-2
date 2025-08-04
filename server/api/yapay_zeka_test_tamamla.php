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
    // Test sonuçlarını ve cevapları veritabanına kaydet
    $sql = "UPDATE yapay_zeka_testler SET 
            user_answers = ?, 
            test_sonuclari = ?, 
            tamamlandi = 1, 
            tamamlanma_tarihi = NOW() 
            WHERE id = ?";
    
    $stmt = $pdo->prepare($sql);
    $result = $stmt->execute([
        json_encode($user_answers),
        json_encode($test_results),
        $test_id
    ]);

    if ($result) {
        echo json_encode([
            'success' => true,
            'message' => 'Test sonuçları başarıyla kaydedildi'
        ]);
    } else {
        echo json_encode([
            'success' => false,
            'message' => 'Test sonuçları kaydedilemedi'
        ]);
    }

} catch (PDOException $e) {
    echo json_encode([
        'success' => false,
        'message' => 'Veritabanı hatası: ' . $e->getMessage()
    ]);
}
?>

if (!$test_id) {
    echo json_encode([
        'success' => false,
        'message' => 'Test ID gerekli'
    ]);
    exit;
}

try {
    $conn = getConnection();

    // Önce tabloyu kontrol et ve gerekirse sonuc sütununu ekle
    $checkColumnSQL = "
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'yapay_zeka_testler' 
        AND COLUMN_NAME = 'sonuc'
    ";

    $checkStmt = $conn->prepare($checkColumnSQL);
    $checkStmt->execute();
    $columnExists = $checkStmt->fetch(PDO::FETCH_ASSOC);

    if (!$columnExists) {
        // sonuc sütununu ekle
        $addColumnSQL = "ALTER TABLE yapay_zeka_testler ADD COLUMN sonuc JSON NULL";
        $conn->exec($addColumnSQL);
    }

    // Test sonuçlarını kaydet
    $sql = "UPDATE yapay_zeka_testler 
            SET tamamlanma_tarihi = NOW(), 
                sonuc = ?
            WHERE id = ?";

    $stmt = $conn->prepare($sql);
    $stmt->execute([
        json_encode($test_results),
        $test_id
    ]);

    if ($stmt->rowCount() > 0) {
        echo json_encode([
            'success' => true,
            'message' => 'Test sonuçları başarıyla kaydedildi'
        ]);
    } else {
        echo json_encode([
            'success' => false,
            'message' => 'Test bulunamadı veya güncellenemedi'
        ]);
    }

} catch (PDOException $e) {
    echo json_encode([
        'success' => false,
        'message' => 'Veritabanı hatası: ' . $e->getMessage()
    ]);
}
?>