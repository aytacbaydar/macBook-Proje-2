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
    $pdo = new PDO("mysql:host=$servername;dbname=$dbname;charset=utf8mb4", $username, $password);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
} catch (PDOException $e) {
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

$ogrenci_id = $input['ogrenci_id'] ?? null;
$gelistirilmesi_gereken_konular = $input['gelistirilmesi_gereken_konular'] ?? [];
$en_iyi_konular = $input['en_iyi_konular'] ?? [];
$kolay_soru_sayisi = $input['kolay_soru_sayisi'] ?? 5;
$zor_soru_sayisi = $input['zor_soru_sayisi'] ?? 3;

if (!$ogrenci_id) {
    echo json_encode(['success' => false, 'message' => 'Öğrenci ID gerekli']);
    exit;
}

$test_sorulari = [];

// Geliştirilmesi gereken konulardan kolay sorular
if (!empty($gelistirilmesi_gereken_konular)) {
    $konu_placeholders = str_repeat('?,', count($gelistirilmesi_gereken_konular) - 1) . '?';
    $sql = "SELECT * FROM yapay_zeka_sorular 
            WHERE konu_adi IN ($konu_placeholders) 
            AND zorluk_derecesi = 'kolay' 
            ORDER BY RAND() 
            LIMIT ?";

    $params = array_merge($gelistirilmesi_gereken_konular, [$kolay_soru_sayisi]);
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $kolay_sorular = $stmt->fetchAll(PDO::FETCH_ASSOC);

    foreach ($kolay_sorular as &$soru) {
        $soru['secenekler'] = json_decode($soru['secenekler'], true);
        $soru['test_tipi'] = 'gelistirilmesi_gereken';
    }

    $test_sorulari = array_merge($test_sorulari, $kolay_sorular);
}

// En iyi konulardan zor sorular
if (!empty($en_iyi_konular)) {
    $konu_placeholders = str_repeat('?,', count($en_iyi_konular) - 1) . '?';
    $sql = "SELECT * FROM yapay_zeka_sorular 
            WHERE konu_adi IN ($konu_placeholders) 
            AND zorluk_derecesi = 'zor' 
            ORDER BY RAND() 
            LIMIT ?";

    $params = array_merge($en_iyi_konular, [$zor_soru_sayisi]);
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $zor_sorular = $stmt->fetchAll(PDO::FETCH_ASSOC);

    foreach ($zor_sorular as &$soru) {
        $soru['secenekler'] = json_decode($soru['secenekler'], true);
        $soru['test_tipi'] = 'en_iyi';
    }

    $test_sorulari = array_merge($test_sorulari, $zor_sorular);
}

// Test sonuçlarını kaydet
if (!empty($test_sorulari)) {
    $test_id = uniqid('test_');

    // Test tablosunu oluştur
    $createTestTableSQL = "
    CREATE TABLE IF NOT EXISTS yapay_zeka_testler (
        id VARCHAR(50) PRIMARY KEY,
        ogrenci_id INT NOT NULL,
        sorular JSON NOT NULL,
        olusturma_tarihi TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        tamamlanma_tarihi TIMESTAMP NULL,
        sonuc JSON NULL
    )";

    $pdo->exec($createTestTableSQL);

    $sql = "INSERT INTO yapay_zeka_testler (id, ogrenci_id, sorular) VALUES (?, ?, ?)";
    $stmt = $pdo->prepare($sql);
    $stmt->execute([$test_id, $ogrenci_id, json_encode($test_sorulari)]);

    echo json_encode([
        'success' => true, 
        'message' => 'Test başarıyla oluşturuldu',
        'test_id' => $test_id,
        'sorular' => $test_sorulari,
        'toplam_soru' => count($test_sorulari)
    ]);
} else {
    echo json_encode(['success' => false, 'message' => 'Seçilen konular için soru bulunamadı']);
}
?>