<?php
// CORS başlıkları
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// OPTIONS isteklerini işle
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

try {
    // Bağlantıyı içe aktar
    require_once '../baglanti.php';
    $pdo = getConnection();
    
    // Tablo var mı kontrol et
    $stmt = $pdo->query("SHOW TABLES LIKE 'cevapAnahtari'");
    if ($stmt->rowCount() == 0) {
        // Tablo yoksa boş dizi döndür
        echo json_encode([
            'success' => true,
            'data' => []
        ]);
        exit;
    }
    
    // Cevap anahtarlarını al
    $stmt = $pdo->query("SELECT * FROM cevapAnahtari ORDER BY created_at DESC");
    $cevapAnahtarlari = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // JSON alanlarını decode et
    foreach ($cevapAnahtarlari as &$row) {
        $row['cevaplar'] = json_decode($row['cevaplar'], true);
        $row['konular'] = json_decode($row['konular'], true);
        $row['videolar'] = json_decode($row['videolar'], true);
    }
    
    echo json_encode([
        'success' => true,
        'data' => $cevapAnahtarlari
    ]);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage()
    ]);
}

// Bağlantıyı kapat
closeConnection();
?>