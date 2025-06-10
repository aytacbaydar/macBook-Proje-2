
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

// Config dosyasını dahil et
require_once '../config.php';

// GET isteği kontrolü
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    errorResponse('Sadece GET istekleri kabul edilir');
}

try {
    // Bağlantıyı al
    $pdo = getConnection();
    
    // Tablo var mı kontrol et
    $stmt = $pdo->query("SHOW TABLES LIKE 'cevapAnahtari'");
    if ($stmt->rowCount() == 0) {
        // Tablo yoksa boş dizi döndür
        successResponse('Başarılı', []);
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
    
    successResponse('Cevap anahtarları başarıyla getirildi.', $cevapAnahtarlari);
    
} catch (Exception $e) {
    errorResponse($e->getMessage());
}

// Bağlantıyı kapat
closeConnection();
?>
