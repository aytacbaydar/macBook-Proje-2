
<?php
require_once '../config.php';

try {
    $conn = getConnection();
    
    $sql = "CREATE TABLE IF NOT EXISTS rate_limits (
        id INT AUTO_INCREMENT PRIMARY KEY,
        identifier VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_identifier_time (identifier, created_at)
    )";
    
    $conn->exec($sql);
    echo json_encode(['success' => true, 'message' => 'Rate limit tablosu oluşturuldu']);
    
} catch(PDOException $e) {
    echo json_encode(['success' => false, 'message' => 'Hata: ' . $e->getMessage()]);
}
?>
