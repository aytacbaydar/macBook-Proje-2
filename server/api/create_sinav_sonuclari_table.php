
<?php
require_once '../config.php';

try {
    $conn = getConnection();
    
    // Sınav sonuçları tablosunu oluştur
    $createTableQuery = "
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
            UNIQUE KEY unique_sinav_ogrenci (sinav_id, ogrenci_id),
            FOREIGN KEY (ogrenci_id) REFERENCES ogrenciler(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ";
    
    $stmt = $conn->prepare($createTableQuery);
    $stmt->execute();
    
    echo json_encode([
        'success' => true,
        'message' => 'Sınav sonuçları tablosu başarıyla oluşturuldu.'
    ]);
    
} catch (PDOException $e) {
    echo json_encode([
        'success' => false,
        'message' => 'Tablo oluşturulurken hata: ' . $e->getMessage()
    ]);
}
?>
