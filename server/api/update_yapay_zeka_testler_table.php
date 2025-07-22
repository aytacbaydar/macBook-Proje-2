
<?php
require_once '../config.php';

try {
    $pdo = getConnection();
    
    // Kullanıcı cevapları sütunu ekle
    $sql = "ALTER TABLE yapay_zeka_testler 
            ADD COLUMN IF NOT EXISTS kullanici_cevaplari JSON NULL";
    
    $pdo->exec($sql);
    
    echo "Tablo başarıyla güncellendi";
    
} catch (PDOException $e) {
    echo "Hata: " . $e->getMessage();
}
?>
