
<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

require_once '../config.php';

try {
    // Get JSON input
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (!$input) {
        throw new Exception('Geçersiz veri formatı');
    }
    
    $sinav_id = $input['sinav_id'] ?? 0;
    $ogrenci_id = $input['ogrenci_id'] ?? 0;
    $cevaplar = $input['cevaplar'] ?? [];
    $sinav_adi = $input['sinav_adi'] ?? '';
    $sinav_turu = $input['sinav_turu'] ?? '';
    $soru_sayisi = $input['soru_sayisi'] ?? 0;
    
    if (!$sinav_id || !$ogrenci_id || empty($cevaplar)) {
        throw new Exception('Eksik veri: Sınav ID, öğrenci ID ve cevaplar gerekli');
    }
    
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
    
    $conn->exec($createTableSQL);
    
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
    
} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage()
    ], JSON_UNESCAPED_UNICODE);
}
?>
