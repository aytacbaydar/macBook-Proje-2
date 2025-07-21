<?php
// Error handling başlat
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

// Output buffering ile hata yakalama
ob_start();

require_once '../config.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

// PHP hatalarını yakala
register_shutdown_function(function() {
    $error = error_get_last();
    if ($error !== NULL && $error['type'] === E_ERROR) {
        ob_clean();
        http_response_code(500);
        echo json_encode([
            'success' => false, 
            'message' => 'PHP Fatal Error: ' . $error['message'],
            'file' => $error['file'],
            'line' => $error['line']
        ]);
    }
});

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

$ogrenci_id = $input['ogrenci_id'] ?? null;
$gelistirilmesi_gereken_konular = $input['gelistirilmesi_gereken_konular'] ?? [];
$en_iyi_konular = $input['en_iyi_konular'] ?? [];
$kolay_soru_sayisi = $input['kolay_soru_sayisi'] ?? 5;
$zor_soru_sayisi = $input['zor_soru_sayisi'] ?? 3;

if (!$ogrenci_id) {
    echo json_encode(['success' => false, 'message' => 'Öğrenci ID gerekli']);
    exit;
}

// Yapay zeka sorular tablosunu oluştur
$createSorularTableSQL = "
CREATE TABLE IF NOT EXISTS yapay_zeka_sorular (
    id INT PRIMARY KEY AUTO_INCREMENT,
    konu_adi VARCHAR(255) NOT NULL,
    soru_metni TEXT NOT NULL,
    secenekler JSON NOT NULL,
    dogru_cevap VARCHAR(255) NOT NULL,
    zorluk_derecesi ENUM('kolay', 'orta', 'zor') DEFAULT 'orta',
    olusturma_tarihi TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)";

try {
    $pdo->exec($createSorularTableSQL);
    
    // Tablo boşsa örnek sorular ekle
    $checkSQL = "SELECT COUNT(*) as count FROM yapay_zeka_sorular";
    $checkStmt = $pdo->prepare($checkSQL);
    $checkStmt->execute();
    $count = $checkStmt->fetch(PDO::FETCH_ASSOC)['count'];
    
    if ($count == 0) {
        // Örnek sorular ekle
        $ornekSorular = [
            [
                'konu_adi' => 'Asitler ve Bazlar',
                'soru_metni' => 'Aşağıdakilerden hangisi güçlü asit örneğidir?',
                'secenekler' => json_encode(['A) CH3COOH', 'B) HCl', 'C) NH3', 'D) H2O']),
                'dogru_cevap' => 'B',
                'zorluk_derecesi' => 'kolay'
            ],
            [
                'konu_adi' => 'Asitler ve Bazlar',
                'soru_metni' => 'pH = 2 olan bir çözeltinin [H+] konsantrasyonu nedir?',
                'secenekler' => json_encode(['A) 10^-2 M', 'B) 10^-12 M', 'C) 2 M', 'D) 12 M']),
                'dogru_cevap' => 'A',
                'zorluk_derecesi' => 'zor'
            ],
            [
                'konu_adi' => 'Periyodik Sistem',
                'soru_metni' => 'Periyodik tabloda aynı grupta bulunan elementlerin ortak özelliği nedir?',
                'secenekler' => json_encode(['A) Aynı atom numarası', 'B) Aynı kütle numarası', 'C) Aynı valans elektron sayısı', 'D) Aynı nötron sayısı']),
                'dogru_cevap' => 'C',
                'zorluk_derecesi' => 'kolay'
            ],
            [
                'konu_adi' => 'Periyodik Sistem',
                'soru_metni' => 'Alkali metallerin iyonlaşma enerjileri periyodik tabloda aşağı doğru nasıl değişir?',
                'secenekler' => json_encode(['A) Artar', 'B) Azalır', 'C) Sabit kalır', 'D) Önce artar sonra azalır']),
                'dogru_cevap' => 'B',
                'zorluk_derecesi' => 'zor'
            ]
        ];
        
        $insertSQL = "INSERT INTO yapay_zeka_sorular (konu_adi, soru_metni, secenekler, dogru_cevap, zorluk_derecesi) VALUES (?, ?, ?, ?, ?)";
        $insertStmt = $pdo->prepare($insertSQL);
        
        foreach ($ornekSorular as $soru) {
            $insertStmt->execute([
                $soru['konu_adi'],
                $soru['soru_metni'],
                $soru['secenekler'],
                $soru['dogru_cevap'],
                $soru['zorluk_derecesi']
            ]);
        }
    }
} catch (PDOException $e) {
    echo json_encode(['success' => false, 'message' => 'Tablo oluşturma hatası: ' . $e->getMessage()]);
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

// Output buffer'ı temizle ve gönder
if (ob_get_length()) {
    ob_end_flush();
}
?>