
<?php
require_once '../config.php';

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

try {
    $conn = getConnection();
    
    $sql = "SELECT * FROM test_cevap_anahtarlari ORDER BY olusturma_tarihi DESC";
    $stmt = $conn->prepare($sql);
    $stmt->execute();
    
    $results = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // JSON verilerini decode et
    foreach ($results as &$row) {
        $row['cevaplar'] = json_decode($row['cevaplar'], true) ?: [];
        $row['konular'] = json_decode($row['konular'], true) ?: [];
        $row['videolar'] = json_decode($row['videolar'], true) ?: [];
        $row['aktiflik'] = (bool) $row['aktiflik'];
    }
    
    echo json_encode([
        'success' => true,
        'data' => $results,
        'message' => 'Test cevap anahtarları başarıyla getirildi'
    ]);

} catch (PDOException $e) {
    echo json_encode([
        'success' => false,
        'message' => 'Veritabanı hatası: ' . $e->getMessage()
    ]);
}
?>
