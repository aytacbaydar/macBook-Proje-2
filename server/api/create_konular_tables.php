
<?php
require_once '../config.php';

try {
    // Konular tablosu - eski tablo varsa önce sil
    $pdo->exec("DROP TABLE IF EXISTS islenen_konular");
    $pdo->exec("DROP TABLE IF EXISTS konular");
    
    // Yeni konular tablosu
    $sql1 = "CREATE TABLE IF NOT EXISTS konular (
        id INT AUTO_INCREMENT PRIMARY KEY,
        unite_adi VARCHAR(500) NOT NULL,
        konu_adi VARCHAR(500) NOT NULL,
        sinif_seviyesi VARCHAR(10) NOT NULL,
        aciklama TEXT,
        olusturma_tarihi TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_sinif_seviyesi (sinif_seviyesi),
        INDEX idx_unite_adi (unite_adi),
        INDEX idx_konu_adi (konu_adi)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci";
    
    $pdo->exec($sql1);
    echo "Konular tablosu oluşturuldu.\n";
    
    // İşlenen konular tablosu
    $sql2 = "CREATE TABLE IF NOT EXISTS islenen_konular (
        id INT AUTO_INCREMENT PRIMARY KEY,
        konu_id INT NOT NULL,
        grup_adi VARCHAR(255) NOT NULL,
        ogretmen_id INT NOT NULL,
        isleme_tarihi DATE NOT NULL,
        kayit_tarihi TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (konu_id) REFERENCES konular(id) ON DELETE CASCADE,
        UNIQUE KEY unique_konu_grup_ogretmen (konu_id, grup_adi, ogretmen_id),
        INDEX idx_ogretmen_id (ogretmen_id),
        INDEX idx_grup_adi (grup_adi),
        INDEX idx_isleme_tarihi (isleme_tarihi)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci";
    
    $pdo->exec($sql2);
    echo "İşlenen konular tablosu oluşturuldu.\n";
    
    echo "Tüm tablolar başarıyla oluşturuldu!";
    
} catch (PDOException $e) {
    echo "Hata: " . $e->getMessage();
}
?>
