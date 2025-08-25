
<?php
require_once '../config.php';

try {
    $sql = "CREATE TABLE IF NOT EXISTS odevler (
        id INT AUTO_INCREMENT PRIMARY KEY,
        grup VARCHAR(50) NOT NULL,
        konu VARCHAR(200) NOT NULL,
        baslangic_tarihi DATE NOT NULL,
        bitis_tarihi DATE NOT NULL,
        aciklama TEXT,
        pdf_dosyasi VARCHAR(255),
        ogretmen_id INT NOT NULL,
        ogretmen_adi VARCHAR(100) NOT NULL,
        olusturma_tarihi TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_ogretmen_id (ogretmen_id),
        INDEX idx_grup (grup),
        INDEX idx_bitis_tarihi (bitis_tarihi)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci";

    $conn->exec($sql);
    echo "Ödevler tablosu başarıyla oluşturuldu veya zaten mevcut.\n";

    // Uploads klasörünü oluştur
    $upload_dir = '../uploads/odevler/';
    if (!is_dir($upload_dir)) {
        mkdir($upload_dir, 0755, true);
        echo "Ödev yükleme klasörü oluşturuldu: $upload_dir\n";
    } else {
        echo "Ödev yükleme klasörü zaten mevcut: $upload_dir\n";
    }

} catch(PDOException $e) {
    echo "Tablo oluşturma hatası: " . $e->getMessage() . "\n";
}
?>
