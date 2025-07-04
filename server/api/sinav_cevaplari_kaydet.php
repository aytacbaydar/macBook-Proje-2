<?php
// Hata raporlamayı etkinleştir
error_reporting(E_ALL);
ini_set('display_errors', 1);
ini_set('log_errors', 1);

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

// Hata yakalama için try-catch
try {
    require_once '../config.php';
} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'message' => 'Config dosyası yüklenemedi: ' . $e->getMessage(),
        'debug' => true
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

try {
    // Get raw input for debugging
    $raw_input = file_get_contents('php://input');
    error_log('Raw input: ' . $raw_input);

    // Get JSON input
    $input = json_decode($raw_input, true);

    if (!$input) {
        $json_error = json_last_error_msg();
        throw new Exception('Geçersiz veri formatı. JSON hatası: ' . $json_error . '. Ham veri: ' . substr($raw_input, 0, 200));
    }

    error_log('Parsed input: ' . print_r($input, true));

    $sinav_id = $input['sinav_id'] ?? 0;
    $ogrenci_id = $input['ogrenci_id'] ?? 0;
    $cevaplar = $input['cevaplar'] ?? [];
    $sinav_adi = $input['sinav_adi'] ?? '';
    $sinav_turu = $input['sinav_turu'] ?? '';
    $soru_sayisi = $input['soru_sayisi'] ?? 0;

    error_log("Extracted data - sinav_id: $sinav_id, ogrenci_id: $ogrenci_id, cevaplar count: " . count($cevaplar));

    if (!$sinav_id || !$ogrenci_id || empty($cevaplar)) {
        throw new Exception("Eksik veri: Sınav ID ($sinav_id), öğrenci ID ($ogrenci_id) ve cevaplar (" . count($cevaplar) . ") gerekli");
    }

    // Veritabanı bağlantısını kur
    $conn = getConnection();

    if (!$conn) {
        throw new Exception('Veritabanı bağlantısı kurulamadı');
    }

    error_log('Database connection OK');

    // Tablo oluşturma (eğer yoksa)
    $createTableSQL = "
        CREATE TABLE IF NOT EXISTS sinav_cevaplari (
            id INT AUTO_INCREMENT PRIMARY KEY,
            sinav_id INT NOT NULL,
            ogrenci_id INT NOT NULL,
            sinav_adi VARCHAR(255) NOT NULL,
            sinav_turu VARCHAR(50) NOT NULL,
            soru_sayisi INT NOT NULL,
            cevaplar JSON NOT NULL,
            soru_konulari JSON NULL,
            gonderim_tarihi TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_sinav_ogrenci (sinav_id, ogrenci_id),
            INDEX idx_sinav_turu (sinav_turu),
            INDEX idx_gonderim_tarihi (gonderim_tarihi)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ";

    try {
        $conn->exec($createTableSQL);
        error_log('Table creation/check successful');
    } catch (PDOException $e) {
        throw new Exception('Tablo oluşturma hatası: ' . $e->getMessage());
    }

    // Sınav sonuçları tablosunu oluştur (eğer yoksa)
    $createResultsTableSQL = "
        CREATE TABLE IF NOT EXISTS sinav_sonuclari (
            id INT AUTO_INCREMENT PRIMARY KEY,
            sinav_id INT NOT NULL,
            ogrenci_id INT NOT NULL,
            sinav_adi VARCHAR(255) NOT NULL,
            sinav_turu VARCHAR(50) NOT NULL,
            soru_sayisi INT NOT NULL,
            dogru_sayisi INT NOT NULL DEFAULT 0,
            yanlis_sayisi INT NOT NULL DEFAULT 0,
            bos_sayisi INT NOT NULL DEFAULT 0,
            net_sayisi DECIMAL(5,2) NOT NULL DEFAULT 0,
            puan DECIMAL(6,2) NOT NULL DEFAULT 0,
            yuzde DECIMAL(5,2) NOT NULL DEFAULT 0,
            gonderim_tarihi TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            guncelleme_tarihi TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_sinav_ogrenci (sinav_id, ogrenci_id),
            INDEX idx_ogrenci_id (ogrenci_id),
            INDEX idx_sinav_turu (sinav_turu),
            INDEX idx_gonderim_tarihi (gonderim_tarihi),
            UNIQUE KEY unique_sinav_ogrenci (sinav_id, ogrenci_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ";

    try {
        $conn->exec($createResultsTableSQL);
        error_log('Results table creation/check successful');
    } catch (PDOException $e) {
        throw new Exception('Sonuçlar tablosu oluşturma hatası: ' . $e->getMessage());
    }

    // Cevap anahtarını ve konu bilgilerini al
    $cevapAnahtariSQL = "SELECT cevaplar, konular FROM cevapAnahtari WHERE id = ?";
    $cevapStmt = $conn->prepare($cevapAnahtariSQL);
    $cevapStmt->execute([$sinav_id]);
    $cevapAnahtari = $cevapStmt->fetch(PDO::FETCH_ASSOC);

    // Sonuçları hesapla
    $dogru_sayisi = 0;
    $yanlis_sayisi = 0;
    $bos_sayisi = 0;
    $soru_konulari = [];

    if ($cevapAnahtari) {
        $dogruCevaplar = json_decode($cevapAnahtari['cevaplar'], true);
        $konularData = json_decode($cevapAnahtari['konular'], true);

        for ($i = 1; $i <= $soru_sayisi; $i++) {
            $ogrenciCevap = $cevaplar["soru{$i}"] ?? '';
            $dogruCevap = $dogruCevaplar["ca{$i}"] ?? '';
            $soruKonusu = $konularData["ka{$i}"] ?? '';

            // Her soru için konu bilgisini kaydet
            if (!empty($soruKonusu)) {
                $soru_konulari["soru{$i}"] = $soruKonusu;
            }

            if (empty($ogrenciCevap)) {
                $bos_sayisi++;
            } elseif ($ogrenciCevap === $dogruCevap) {
                $dogru_sayisi++;
            } else {
                $yanlis_sayisi++;
            }
        }
    } else {
        // Cevap anahtarı yoksa tüm sorular boş sayılsın
        $bos_sayisi = $soru_sayisi;
        error_log("Warning: Cevap anahtarı bulunamadı. Sinav ID: $sinav_id");
    }

    // Net, puan ve yüzde hesaplama
    $net_sayisi = $dogru_sayisi - ($yanlis_sayisi / 4);
    $net_sayisi = max(0, $net_sayisi); // Negatif olamaz
    $puan = $net_sayisi; // Basit puan sistemi
    $yuzde = $soru_sayisi > 0 ? ($dogru_sayisi / $soru_sayisi) * 100 : 0;

    error_log("Calculated results - Doğru: $dogru_sayisi, Yanlış: $yanlis_sayisi, Boş: $bos_sayisi, Net: $net_sayisi");

    // Önceki cevabı kontrol et
    $checkSQL = "SELECT id FROM sinav_cevaplari WHERE sinav_id = ? AND ogrenci_id = ?";
    $checkStmt = $conn->prepare($checkSQL);
    $checkStmt->execute([$sinav_id, $ogrenci_id]);

    if ($checkStmt->fetch()) {
        // Cevapları güncelle
        $updateSQL = "
            UPDATE sinav_cevaplari 
            SET cevaplar = ?, soru_konulari = ?, sinav_adi = ?, sinav_turu = ?, soru_sayisi = ?, gonderim_tarihi = CURRENT_TIMESTAMP
            WHERE sinav_id = ? AND ogrenci_id = ?
        ";
        $stmt = $conn->prepare($updateSQL);
        $stmt->execute([
            json_encode($cevaplar, JSON_UNESCAPED_UNICODE),
            json_encode($soru_konulari, JSON_UNESCAPED_UNICODE),
            $sinav_adi,
            $sinav_turu,
            $soru_sayisi,
            $sinav_id,
            $ogrenci_id
        ]);

        // Sonuçları güncelle
        $updateResultsSQL = "
            UPDATE sinav_sonuclari 
            SET sinav_adi = ?, sinav_turu = ?, soru_sayisi = ?, 
                dogru_sayisi = ?, yanlis_sayisi = ?, bos_sayisi = ?,
                net_sayisi = ?, puan = ?, yuzde = ?, guncelleme_tarihi = CURRENT_TIMESTAMP
            WHERE sinav_id = ? AND ogrenci_id = ?
        ";
        $resultStmt = $conn->prepare($updateResultsSQL);
        $resultStmt->execute([
            $sinav_adi, $sinav_turu, $soru_sayisi,
            $dogru_sayisi, $yanlis_sayisi, $bos_sayisi,
            $net_sayisi, $puan, $yuzde,
            $sinav_id, $ogrenci_id
        ]);
    } else {
        // Yeni cevap kaydı
        $insertSQL = "
            INSERT INTO sinav_cevaplari (sinav_id, ogrenci_id, sinav_adi, sinav_turu, soru_sayisi, cevaplar, soru_konulari)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ";
        $stmt = $conn->prepare($insertSQL);
        $stmt->execute([
            $sinav_id,
            $ogrenci_id,
            $sinav_adi,
            $sinav_turu,
            $soru_sayisi,
            json_encode($cevaplar, JSON_UNESCAPED_UNICODE),
            json_encode($soru_konulari, JSON_UNESCAPED_UNICODE)
        ]);

        // Yeni sonuç kaydı
        $insertResultsSQL = "
            INSERT INTO sinav_sonuclari (sinav_id, ogrenci_id, sinav_adi, sinav_turu, soru_sayisi,
                                       dogru_sayisi, yanlis_sayisi, bos_sayisi, net_sayisi, puan, yuzde)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ";
        $resultStmt = $conn->prepare($insertResultsSQL);
        $resultStmt->execute([
            $sinav_id, $ogrenci_id, $sinav_adi, $sinav_turu, $soru_sayisi,
            $dogru_sayisi, $yanlis_sayisi, $bos_sayisi, $net_sayisi, $puan, $yuzde
        ]);
    }

    echo json_encode([
        'success' => true,
        'message' => 'Cevaplar ve sonuçlar başarıyla kaydedildi',
        'data' => [
            'sinav_id' => $sinav_id,
            'ogrenci_id' => $ogrenci_id,
            'cevap_sayisi' => count($cevaplar),
            'sonuclar' => [
                'dogru_sayisi' => $dogru_sayisi,
                'yanlis_sayisi' => $yanlis_sayisi,
                'bos_sayisi' => $bos_sayisi,
                'net_sayisi' => round($net_sayisi, 2),
                'puan' => round($puan, 2),
                'yuzde' => round($yuzde, 1)
            ]
        ]
    ], JSON_UNESCAPED_UNICODE);

} catch (PDOException $e) {
    error_log('PDO Exception: ' . $e->getMessage());
    echo json_encode([
        'success' => false,
        'message' => 'Veritabanı hatası: ' . $e->getMessage(),
        'error_type' => 'PDOException',
        'debug' => true
    ], JSON_UNESCAPED_UNICODE);
} catch (Exception $e) {
    error_log('General Exception: ' . $e->getMessage());
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage(),
        'error_type' => 'Exception',
        'debug' => true
    ], JSON_UNESCAPED_UNICODE);
} catch (Error $e) {
    error_log('Fatal Error: ' . $e->getMessage());
    echo json_encode([
        'success' => false,
        'message' => 'Sistem hatası: ' . $e->getMessage(),
        'error_type' => 'Error',
        'debug' => true
    ], JSON_UNESCAPED_UNICODE);
}
?>