
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
    
    // Veritabanı bağlantısını kontrol et
    if (!isset($conn) || !$conn) {
        throw new Exception('Veritabanı bağlantısı yok');
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
    
    // Önceki cevabı kontrol et
    $checkSQL = "SELECT id FROM sinav_cevaplari WHERE sinav_id = ? AND ogrenci_id = ?";
    $checkStmt = $conn->prepare($checkSQL);
    $checkStmt->execute([$sinav_id, $ogrenci_id]);
    
    if ($checkStmt->fetch()) {
        // Güncelle
        $updateSQL = "
            UPDATE sinav_cevaplari 
            SET cevaplar = ?, sinav_adi = ?, sinav_turu = ?, soru_sayisi = ?, gonderim_tarihi = CURRENT_TIMESTAMP
            WHERE sinav_id = ? AND ogrenci_id = ?
        ";
        $stmt = $conn->prepare($updateSQL);
        $stmt->execute([
            json_encode($cevaplar, JSON_UNESCAPED_UNICODE),
            $sinav_adi,
            $sinav_turu,
            $soru_sayisi,
            $sinav_id,
            $ogrenci_id
        ]);
    } else {
        // Yeni kayıt
        $insertSQL = "
            INSERT INTO sinav_cevaplari (sinav_id, ogrenci_id, sinav_adi, sinav_turu, soru_sayisi, cevaplar)
            VALUES (?, ?, ?, ?, ?, ?)
        ";
        $stmt = $conn->prepare($insertSQL);
        $stmt->execute([
            $sinav_id,
            $ogrenci_id,
            $sinav_adi,
            $sinav_turu,
            $soru_sayisi,
            json_encode($cevaplar, JSON_UNESCAPED_UNICODE)
        ]);
    }
    
    echo json_encode([
        'success' => true,
        'message' => 'Cevaplar başarıyla kaydedildi',
        'data' => [
            'sinav_id' => $sinav_id,
            'ogrenci_id' => $ogrenci_id,
            'cevap_sayisi' => count($cevaplar)
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
