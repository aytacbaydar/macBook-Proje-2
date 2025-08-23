
<?php
require_once '../config.php';

try {
    $conn = getConnection();
    
    // Test cevap anahtarları tablosunu oluştur
    $createTableQuery = "
        CREATE TABLE IF NOT EXISTS test_cevap_anahtarlari (
            id INT AUTO_INCREMENT PRIMARY KEY,
            test_adi VARCHAR(255) NOT NULL,
            test_turu VARCHAR(50) NOT NULL,
            soru_sayisi INT NOT NULL,
            tarih DATE NOT NULL,
            cevaplar JSON NOT NULL,
            konular JSON DEFAULT NULL,
            videolar JSON DEFAULT NULL,
            aktiflik BOOLEAN DEFAULT TRUE,
            olusturma_tarihi TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            guncelleme_tarihi TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_test_adi (test_adi),
            INDEX idx_test_turu (test_turu),
            INDEX idx_tarih (tarih),
            INDEX idx_aktiflik (aktiflik)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ";
    
    $stmt = $conn->prepare($createTableQuery);
    $stmt->execute();
    
    echo json_encode([
        'success' => true,
        'message' => 'Test cevap anahtarları tablosu başarıyla oluşturuldu.'
    ]);
    
} catch (PDOException $e) {
    echo json_encode([
        'success' => false,
        'message' => 'Tablo oluşturulurken hata: ' . $e->getMessage()
    ]);
}
?>
