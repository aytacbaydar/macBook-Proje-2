
<?php
require_once '../config.php';

try {
    // user_answers kolonu ekle
    $sql1 = "ALTER TABLE yapay_zeka_testler ADD COLUMN IF NOT EXISTS user_answers TEXT DEFAULT NULL";
    $pdo->exec($sql1);
    
    // test_sonuclari kolonu ekle
    $sql2 = "ALTER TABLE yapay_zeka_testler ADD COLUMN IF NOT EXISTS test_sonuclari TEXT DEFAULT NULL";
    $pdo->exec($sql2);
    
    // tamamlandi kolonu ekle
    $sql3 = "ALTER TABLE yapay_zeka_testler ADD COLUMN IF NOT EXISTS tamamlandi TINYINT(1) DEFAULT 0";
    $pdo->exec($sql3);
    
    // tamamlanma_tarihi kolonu ekle
    $sql4 = "ALTER TABLE yapay_zeka_testler ADD COLUMN IF NOT EXISTS tamamlanma_tarihi DATETIME DEFAULT NULL";
    $pdo->exec($sql4);
    
    echo "Tablo başarıyla güncellendi!";
    
} catch (PDOException $e) {
    echo "Hata: " . $e->getMessage();
}
?>
