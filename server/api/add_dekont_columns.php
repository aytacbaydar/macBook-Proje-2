
<?php
header('Content-Type: application/json');

require_once '../config.php';

try {
    $pdo = getConnection();
    
    // Önce kolonların var olup olmadığını kontrol et
    $checkColumns = $pdo->query("SHOW COLUMNS FROM payments LIKE 'dekont_url'");
    
    if ($checkColumns->rowCount() == 0) {
        // dekont_url kolonu yoksa ekle
        $pdo->exec("ALTER TABLE payments ADD COLUMN dekont_url VARCHAR(500) NULL");
    }
    
    $checkColumns = $pdo->query("SHOW COLUMNS FROM payments LIKE 'dekont_aciklama'");
    
    if ($checkColumns->rowCount() == 0) {
        // dekont_aciklama kolonu yoksa ekle
        $pdo->exec("ALTER TABLE payments ADD COLUMN dekont_aciklama TEXT NULL");
    }
    
    $checkColumns = $pdo->query("SHOW COLUMNS FROM payments LIKE 'dekont_yukleme_tarihi'");
    
    if ($checkColumns->rowCount() == 0) {
        // dekont_yukleme_tarihi kolonu yoksa ekle
        $pdo->exec("ALTER TABLE payments ADD COLUMN dekont_yukleme_tarihi DATETIME NULL");
    }

    echo json_encode([
        'success' => true,
        'message' => 'Dekont kolonları başarıyla eklendi'
    ]);

} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}
?>
