
<?php
require_once '../config.php';

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

try {
    $conn = getConnection();
    
    $input = json_decode(file_get_contents('php://input'), true);
    $id = $input['id'] ?? 0;

    if ($id <= 0) {
        echo json_encode([
            'success' => false,
            'message' => 'Geçersiz ID'
        ]);
        exit;
    }

    $sql = "DELETE FROM test_cevap_anahtarlari WHERE id = ?";
    $stmt = $conn->prepare($sql);
    $result = $stmt->execute([$id]);

    if ($result && $stmt->rowCount() > 0) {
        echo json_encode([
            'success' => true,
            'message' => 'Test cevap anahtarı başarıyla silindi'
        ]);
    } else {
        echo json_encode([
            'success' => false,
            'message' => 'Silme işlemi başarısız'
        ]);
    }

} catch (PDOException $e) {
    echo json_encode([
        'success' => false,
        'message' => 'Veritabanı hatası: ' . $e->getMessage()
    ]);
}
?>
