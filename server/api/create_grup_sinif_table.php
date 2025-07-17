
<?php
require_once '../config.php';

// CORS ayarları header bilgileri config.php'de zaten tanımlanmış

// Preflight OPTIONS isteğini yanıtla
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Sadece POST isteklerini kabul et
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['success' => false, 'message' => 'Sadece POST metodu kabul edilir.']);
    exit;
}

try {
    $conn = getConnection();
    
    // grup_sinif tablosunu oluştur
    $sql = "CREATE TABLE IF NOT EXISTS `grup_sinif` (
        `id` INT AUTO_INCREMENT PRIMARY KEY,
        `grup_adi` VARCHAR(100) NOT NULL UNIQUE,
        `sinif_seviyesi` VARCHAR(20) NOT NULL,
        `aciklama` TEXT NULL,
        `olusturma_tarihi` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        `guncelleme_tarihi` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX `idx_grup_adi` (`grup_adi`),
        INDEX `idx_sinif_seviyesi` (`sinif_seviyesi`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;";

    $conn->exec($sql);
    
    // Mevcut grupları otomatik olarak ekle (varsa)
    $insertSql = "INSERT IGNORE INTO `grup_sinif` (`grup_adi`, `sinif_seviyesi`) VALUES 
        ('EAE', '12.Sınıf'),
        ('FAC', '11.Sınıf')";
    
    $conn->exec($insertSql);
    
    echo json_encode([
        'success' => true, 
        'message' => 'grup_sinif tablosu başarıyla oluşturuldu ve örnek veriler eklendi.',
        'sql' => $sql
    ]);
    
} catch(PDOException $e) {
    echo json_encode([
        'success' => false, 
        'message' => 'Tablo oluşturma hatası: ' . $e->getMessage()
    ]);
}

$conn = null;
?>
