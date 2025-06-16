
<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

require_once '../config.php';

try {
    $pdo = getConnection();
    
    $sql = "SELECT id, unite_adi, konu_adi, sinif_seviyesi, aciklama, olusturma_tarihi 
            FROM konular 
            ORDER BY id ASC";
    
    $stmt = $pdo->prepare($sql);
    $stmt->execute();
    $konular = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo json_encode([
        'success' => true,
        'konular' => $konular
    ]);
    
} catch (PDOException $e) {
    echo json_encode([
        'success' => false,
        'message' => 'Konular yüklenirken hata oluştu: ' . $e->getMessage()
    ]);
} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'message' => 'Genel hata: ' . $e->getMessage()
    ]);
}
?>
