
<?php
require_once '../config.php';

try {
    $conn = getConnection();
    
    // Öğrenci ödemeleri tablosunu oluştur
    $createTableQuery = "
        CREATE TABLE IF NOT EXISTS ogrenci_odemeler (
            id INT AUTO_INCREMENT PRIMARY KEY,
            ogrenci_id INT NOT NULL,
            tutar DECIMAL(10, 2) NOT NULL,
            odeme_tarihi DATETIME NOT NULL,
            aciklama TEXT,
            ay INT NOT NULL,
            yil INT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (ogrenci_id) REFERENCES ogrenciler(id) ON DELETE CASCADE,
            INDEX idx_ogrenci_ay_yil (ogrenci_id, ay, yil),
            INDEX idx_odeme_tarihi (odeme_tarihi)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ";
    
    $stmt = $conn->prepare($createTableQuery);
    $stmt->execute();
    
    echo json_encode([
        'success' => true,
        'message' => 'Ögrenci ödemeleri tablosu başarıyla oluşturuldu.'
    ]);
    
} catch (PDOException $e) {
    echo json_encode([
        'success' => false,
        'message' => 'Tablo oluşturulurken hata: ' . $e->getMessage()
    ]);
}
?>
