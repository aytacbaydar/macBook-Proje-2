
<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

require_once '../config.php';

try {
    $conn = getConnection();
    
    $id = $_GET['id'] ?? null;
    
    if (!$id) {
        throw new Exception('İşlenen konu ID gerekli');
    }
    
    $sql = "DELETE FROM islenen_konular WHERE id = ?";
    $stmt = $conn->prepare($sql);
    $stmt->execute([$id]);
    
    if ($stmt->rowCount() > 0) {
        echo json_encode([
            'success' => true,
            'message' => 'Konu işareti başarıyla kaldırıldı'
        ]);
    } else {
        throw new Exception('Silinecek kayıt bulunamadı');
    }
    
} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage()
    ]);
}
?>
