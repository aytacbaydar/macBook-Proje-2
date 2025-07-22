<?php
// JSON parsing hataları için temiz output
ini_set('display_errors', 0); // JSON için hataları gizle
ini_set('display_startup_errors', 0);
error_reporting(E_ALL);

// Output buffering ile temiz JSON çıktısı sağla
ob_start();

// Tüm hata ve warning'leri log dosyasına yönlendir
ini_set('log_errors', 1);
ini_set('error_log', __DIR__ . '/../../logs/api_errors.log');

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
    ob_clean(); // Buffer'ı temizle
    echo json_encode(['success' => false, 'message' => 'Veritabanı bağlantısı başarısız: ' . $e->getMessage()]);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    ob_clean();
    echo json_encode(['success' => false, 'message' => 'Sadece POST metodu desteklenir']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);

if (!$input) {
    ob_clean();
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
    $konu_placeholders = implode(',', array_fill(0, count($gelistirilmesi_gereken_konular), '?'));
    $sql = "SELECT * FROM yapay_zeka_sorular 
            WHERE konu_adi IN ($konu_placeholders) 
            AND zorluk_derecesi = 'kolay' 
            ORDER BY RAND() 
            LIMIT " . intval($kolay_soru_sayisi);

    $params = $gelistirilmesi_gereken_konular;

    try {
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $kolay_sorular = $stmt->fetchAll(PDO::FETCH_ASSOC);
    } catch (PDOException $e) {
        echo json_encode(['success' => false, 'message' => 'Kolay sorular sorgusu hatası: ' . $e->getMessage()]);
        exit;
    }

    foreach ($kolay_sorular as &$soru) {
        $soru['secenekler'] = json_decode($soru['secenekler'], true);
        $soru['test_tipi'] = 'gelistirilmesi_gereken';
    }

    $test_sorulari = array_merge($test_sorulari, $kolay_sorular);
}

// En iyi konulardan zor sorular
if (!empty($en_iyi_konular)) {
    $konu_placeholders = implode(',', array_fill(0, count($en_iyi_konular), '?'));
    $sql = "SELECT * FROM yapay_zeka_sorular 
            WHERE konu_adi IN ($konu_placeholders) 
            AND zorluk_derecesi = 'zor' 
            ORDER BY RAND() 
            LIMIT " . intval($zor_soru_sayisi);

    $params = $en_iyi_konular;

    try {
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $zor_sorular = $stmt->fetchAll(PDO::FETCH_ASSOC);
    } catch (PDOException $e) {
        echo json_encode(['success' => false, 'message' => 'Zor sorular sorgusu hatası: ' . $e->getMessage()]);
        exit;
    }

    foreach ($zor_sorular as &$soru) {
        $soru['secenekler'] = json_decode($soru['secenekler'], true);
        $soru['test_tipi'] = 'en_iyi';
    }

    $test_sorulari = array_merge($test_sorulari, $zor_sorular);
}

// Test sonuçlarını kaydet
if (!empty($test_sorulari)) {
    // Test ID'si oluştur
    $test_id = 'test_' . uniqid();

    // Test adını oluştur
    $konu_listesi = array_merge($gelistirilmesi_gereken_konular, $en_iyi_konular);
    $test_adi = '';

    if (!empty($konu_listesi)) {
        // İlk 2-3 konuyu al ve test adını oluştur
        $secili_konular = array_slice($konu_listesi, 0, min(3, count($konu_listesi)));
        $test_adi = implode(', ', $secili_konular) . ' - Yapay Zeka Testi';

        // Çok uzun ise kısalt
        if (strlen($test_adi) > 100) {
            $test_adi = substr($test_adi, 0, 97) . '...';
        }
    } else {
        $test_adi = 'Yapay Zeka Testi - ' . date('d.m.Y H:i');
    }

    // Test tablosunu oluştur
    $createTestTableSQL = "
    CREATE TABLE IF NOT EXISTS yapay_zeka_testler (
        id VARCHAR(50) PRIMARY KEY,
        test_adi VARCHAR(255) NOT NULL,
        ogrenci_id INT NOT NULL,
        sorular JSON NOT NULL,
        olusturma_tarihi TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        tamamlanma_tarihi TIMESTAMP NULL,
        sonuc JSON NULL
    )";

    $pdo->exec($createTestTableSQL);

    // Test verilerini veritabanına kaydet
    $sql = "INSERT INTO yapay_zeka_testler (id, test_adi, ogrenci_id, sorular, olusturma_tarihi) 
            VALUES (?, ?, ?, ?, NOW())";
    $stmt = $pdo->prepare($sql);
    $stmt->execute([$test_id, $test_adi, $ogrenci_id, json_encode($test_sorulari)]);

    echo json_encode([
        'success' => true,
        'message' => 'Test başarıyla oluşturuldu',
        'test_id' => $test_id,
        'test_adi' => $test_adi,
        'sorular' => $test_sorulari,
        'toplam_soru' => count($test_sorulari)
    ]);
} else {
    echo json_encode(['success' => false, 'message' => 'Seçilen konular için soru bulunamadı']);
}

// Output buffer'dan fazla içeriği temizle ve sadece JSON gönder
$output = ob_get_clean();

// Eğer output buffer'da beklenmeyen içerik varsa logla
if (!empty($output) && trim($output) !== '') {
    error_log("Unexpected output in yapay_zeka_test_olustur.php: " . $output);
}

// Clean exit - sadece JSON döndür
exit;
?>