
<?php
require_once '../config.php';

try {
    $conn = getConnection();
    
    // Cevap anahtarları tablosunu oluştur
    $createTableQuery = "
        CREATE TABLE IF NOT EXISTS cevap_anahtarlari (
            id INT AUTO_INCREMENT PRIMARY KEY,
            sinav_adi VARCHAR(255) NOT NULL,
            sinav_turu VARCHAR(50) NOT NULL,
            soru_sayisi INT NOT NULL,
            tarih DATE NOT NULL,
            sinav_kapagi VARCHAR(255),
            cevaplar JSON NOT NULL,
            konular JSON,
            videolar JSON,
            aktiflik BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_sinav_turu (sinav_turu),
            INDEX idx_tarih (tarih),
            INDEX idx_aktiflik (aktiflik)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ";
    
    $stmt = $conn->prepare($createTableQuery);
    $stmt->execute();
    
    echo json_encode([
        'success' => true,
        'message' => 'Cevap anahtarları tablosu başarıyla oluşturuldu.'
    ]);
    
} catch (PDOException $e) {
    echo json_encode([
        'success' => false,
        'message' => 'Tablo oluşturulurken hata: ' . $e->getMessage()
    ]);
}
?>
