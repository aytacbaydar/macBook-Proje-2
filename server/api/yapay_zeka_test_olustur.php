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
$diger_konular = $input['diger_konular'] ?? [];
$kolay_soru_sayisi = max(1, min(45, $input['kolay_soru_sayisi'] ?? 15));
$orta_soru_sayisi = max(1, min(45, $input['orta_soru_sayisi'] ?? 15));
$zor_soru_sayisi = max(1, min(45, $input['zor_soru_sayisi'] ?? 15));

// Toplam soru sayısını kontrol et (5-45 arası)
$toplam_soru = $kolay_soru_sayisi + $orta_soru_sayisi + $zor_soru_sayisi;
if ($toplam_soru < 5) {
    $kolay_soru_sayisi = 2;
    $orta_soru_sayisi = 2;
    $zor_soru_sayisi = 1;
} elseif ($toplam_soru > 45) {
    $oran = 45 / $toplam_soru;
    $kolay_soru_sayisi = max(1, floor($kolay_soru_sayisi * $oran));
    $orta_soru_sayisi = max(1, floor($orta_soru_sayisi * $oran));
    $zor_soru_sayisi = max(1, floor($zor_soru_sayisi * $oran));
}

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
                'soru_metni' => 'Zayıf asitlerin özellikleri hakkında aşağıdakilerden hangisi doğrudur?',
                'secenekler' => json_encode(['A) Tamamen iyonlaşırlar', 'B) Kısmen iyonlaşırlar', 'C) Hiç iyonlaşmazlar', 'D) Sadece yüksek sıcaklıkta iyonlaşırlar']),
                'dogru_cevap' => 'B',
                'zorluk_derecesi' => 'orta'
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
                'soru_metni' => 'Periyodik cetvelde metalik özellik nasıl değişir?',
                'secenekler' => json_encode(['A) Soldan sağa artar', 'B) Soldan sağa azalır', 'C) Yukarıdan aşağıya azalır', 'D) Değişmez']),
                'dogru_cevap' => 'B',
                'zorluk_derecesi' => 'orta'
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

// Tüm seçili konuları birleştir
$tum_secili_konular = array_merge($gelistirilmesi_gereken_konular, $en_iyi_konular, $diger_konular);
$tum_secili_konular = array_unique($tum_secili_konular); // Tekrar eden konuları kaldır

if (!empty($tum_secili_konular)) {
    $konu_placeholders = implode(',', array_fill(0, count($tum_secili_konular), '?'));
    
    // Kolay sorular
    if ($kolay_soru_sayisi > 0) {
        $random_seed = time() . $ogrenci_id . implode('', $tum_secili_konular) . 'kolay';
        $sql = "SELECT * FROM yapay_zeka_sorular 
                WHERE konu_adi IN ($konu_placeholders) 
                AND zorluk_derecesi = 'kolay' 
                ORDER BY RAND(" . crc32($random_seed) . ") 
                LIMIT " . intval($kolay_soru_sayisi);

        try {
            $stmt = $pdo->prepare($sql);
            $stmt->execute($tum_secili_konular);
            $kolay_sorular = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            foreach ($kolay_sorular as &$soru) {
                $soru['secenekler'] = json_decode($soru['secenekler'], true);
                $soru['test_tipi'] = 'kolay';
            }
            
            $test_sorulari = array_merge($test_sorulari, $kolay_sorular);
        } catch (PDOException $e) {
            echo json_encode(['success' => false, 'message' => 'Kolay sorular sorgusu hatası: ' . $e->getMessage()]);
            exit;
        }
    }
    
    // Orta sorular
    if ($orta_soru_sayisi > 0) {
        $random_seed = time() . $ogrenci_id . implode('', $tum_secili_konular) . 'orta';
        $sql = "SELECT * FROM yapay_zeka_sorular 
                WHERE konu_adi IN ($konu_placeholders) 
                AND zorluk_derecesi = 'orta' 
                ORDER BY RAND(" . crc32($random_seed) . ") 
                LIMIT " . intval($orta_soru_sayisi);

        try {
            $stmt = $pdo->prepare($sql);
            $stmt->execute($tum_secili_konular);
            $orta_sorular = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            foreach ($orta_sorular as &$soru) {
                $soru['secenekler'] = json_decode($soru['secenekler'], true);
                $soru['test_tipi'] = 'orta';
            }
            
            $test_sorulari = array_merge($test_sorulari, $orta_sorular);
        } catch (PDOException $e) {
            echo json_encode(['success' => false, 'message' => 'Orta sorular sorgusu hatası: ' . $e->getMessage()]);
            exit;
        }
    }

    // Zor sorular
    if ($zor_soru_sayisi > 0) {
        $random_seed = time() . $ogrenci_id . implode('', $tum_secili_konular) . 'zor';
        $sql = "SELECT * FROM yapay_zeka_sorular 
                WHERE konu_adi IN ($konu_placeholders) 
                AND zorluk_derecesi = 'zor' 
                ORDER BY RAND(" . crc32($random_seed) . ") 
                LIMIT " . intval($zor_soru_sayisi);

        try {
            $stmt = $pdo->prepare($sql);
            $stmt->execute($tum_secili_konular);
            $zor_sorular = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            foreach ($zor_sorular as &$soru) {
                $soru['secenekler'] = json_decode($soru['secenekler'], true);
                $soru['test_tipi'] = 'zor';
            }
            
            $test_sorulari = array_merge($test_sorulari, $zor_sorular);
        } catch (PDOException $e) {
            echo json_encode(['success' => false, 'message' => 'Zor sorular sorgusu hatası: ' . $e->getMessage()]);
            exit;
        }
    }
}

// Test sonuçlarını kaydet
if (!empty($test_sorulari)) {
    // Test ID'si oluştur
    $test_id = 'test_' . uniqid();

    // Test adını oluştur
    $konu_listesi = array_merge($gelistirilmesi_gereken_konular, $en_iyi_konular, $diger_konular);
    $konu_listesi = array_unique($konu_listesi); // Tekrar eden konuları kaldır
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