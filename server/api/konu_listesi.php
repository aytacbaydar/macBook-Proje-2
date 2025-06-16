<?php
require_once '../config.php';

try {
    $conn = getConnection();
    
    // Tüm konuları ID sırasına göre getir - hiçbir filtreleme yok
    $stmt = $conn->prepare("SELECT * FROM konular ORDER BY id ASC");
    $stmt->execute();
    $konular = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode([
        'success' => true,
        'konular' => $konular,
        'total_count' => count($konular),
        'message' => 'Tüm konular filtresiz olarak getirildi'
    ]);

} catch(PDOException $e) {
    echo json_encode([
        'success' => false,
        'message' => 'Veritabanı hatası: ' . $e->getMessage()
    ]);
}
?>