
<?php
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

require_once '../config.php';

try {
    $pdo = getConnection();

    // First check if table exists
    $stmt = $pdo->prepare("SHOW TABLES LIKE 'cevap_anahtarlari'");
    $stmt->execute();
    $tableExists = $stmt->rowCount() > 0;

    if (!$tableExists) {
        echo json_encode([
            'success' => false,
            'message' => 'Cevap anahtarları tablosu bulunamadı',
            'debug' => 'Table cevap_anahtarlari does not exist'
        ]);
        exit;
    }

    // Get all records
    $stmt = $pdo->prepare("SELECT *, 
        CASE 
            WHEN aktiflik = 1 OR aktiflik = '1' OR aktiflik = true THEN 1 
            ELSE 0 
        END as aktiflik_normalized 
        FROM cevap_anahtarlari 
        ORDER BY tarih DESC");
    $stmt->execute();
    $result = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Debug information
    $totalCount = count($result);
    $activeCount = count(array_filter($result, function($item) {
        return $item['aktiflik_normalized'] == 1;
    }));

    echo json_encode([
        'success' => true,
        'data' => $result,
        'debug' => [
            'total_count' => $totalCount,
            'active_count' => $activeCount,
            'table_exists' => $tableExists
        ]
    ]);

} catch(PDOException $e) {
    echo json_encode([
        'success' => false,
        'message' => 'Veritabanı hatası: ' . $e->getMessage(),
        'debug' => $e->getTraceAsString()
    ]);
}
?>
