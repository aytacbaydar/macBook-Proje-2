
<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

require_once '../config.php';

try {
    $conn = getConnection();
    
    $id = $_GET['id'] ?? null;
    
    if (!$id) {
        throw new Exception('Konu ID gerekli');
    }
    
    // Önce konunun var olup olmadığını kontrol et
    $checkSql = "SELECT id FROM konular WHERE id = ?";
    $checkStmt = $conn->prepare($checkSql);
    $checkStmt->execute([$id]);
    
    if ($checkStmt->rowCount() === 0) {
        throw new Exception('Silinecek konu bulunamadı');
    }
    
    // İşlenen konular tablosunda bu konuya ait kayıtları da sil
    $deleteIslenmisSql = "DELETE FROM islenen_konular WHERE konu_id = ?";
    $deleteIslenmisStmt = $conn->prepare($deleteIslenmisSql);
    $deleteIslenmisStmt->execute([$id]);
    
    // Konuyu sil
    $sql = "DELETE FROM konular WHERE id = ?";
    $stmt = $conn->prepare($sql);
    $stmt->execute([$id]);
    
    if ($stmt->rowCount() > 0) {
        echo json_encode([
            'success' => true,
            'message' => 'Konu başarıyla silindi'
        ]);
    } else {
        throw new Exception('Konu silinirken hata oluştu');
    }
    
} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage()
    ]);
} catch (PDOException $e) {
    echo json_encode([
        'success' => false,
        'message' => 'Veritabanı hatası: ' . $e->getMessage()
    ]);
}
?>
