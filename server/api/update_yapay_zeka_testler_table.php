<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');

require_once '../config.php';

try {
    $pdo = getConnection();

    // Tabloyu kontrol et ve gerekirse sonuc sütununu ekle
    $checkColumnSQL = "
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'yapay_zeka_testler' 
        AND COLUMN_NAME = 'sonuc'
    ";

    $stmt = $pdo->prepare($checkColumnSQL);
    $stmt->execute();
    $columnExists = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$columnExists) {
        // sonuc sütununu ekle
        $addColumnSQL = "ALTER TABLE yapay_zeka_testler ADD COLUMN sonuc JSON NULL AFTER tamamlanma_tarihi";
        $pdo->exec($addColumnSQL);
        echo json_encode(['success' => true, 'message' => 'sonuc sütunu başarıyla eklendi']);
    } else {
        echo json_encode(['success' => true, 'message' => 'sonuc sütunu zaten mevcut']);
    }

} catch (PDOException $e) {
    echo json_encode(['success' => false, 'message' => 'Veritabanı hatası: ' . $e->getMessage()]);
}
?>