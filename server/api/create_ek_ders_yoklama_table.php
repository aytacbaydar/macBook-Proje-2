
<?php
require_once '../config.php';

try {
    // Ek ders yoklama tablosunu oluştur
    $sql = "CREATE TABLE IF NOT EXISTS ek_ders_yoklama (
        id INT AUTO_INCREMENT PRIMARY KEY,
        ogrenci_id INT NOT NULL,
        ogretmen_id INT NOT NULL,
        ders_tarihi DATE NOT NULL,
        durum ENUM('geldi', 'gelmedi') NOT NULL,
        not TEXT,
        olusturma_zamani TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        guncelleme_zamani TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (ogrenci_id) REFERENCES ogrenciler(id) ON DELETE CASCADE,
        FOREIGN KEY (ogretmen_id) REFERENCES kullanicilar(id) ON DELETE CASCADE,
        UNIQUE KEY unique_yoklama (ogrenci_id, ogretmen_id, ders_tarihi)
    )";

    $conn->exec($sql);
    
    echo json_encode([
        'success' => true,
        'message' => 'Ek ders yoklama tablosu başarıyla oluşturuldu'
    ]);

} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'message' => 'Tablo oluşturulurken hata: ' . $e->getMessage()
    ]);
}
?>
