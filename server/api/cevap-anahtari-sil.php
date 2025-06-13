
<?php
// CORS başlıkları
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// OPTIONS isteklerini işle
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

// Config dosyasını dahil et
require_once '../config.php';

// POST isteği kontrolü
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    errorResponse('Sadece POST istekleri kabul edilir');
}

try {
    // Bağlantıyı al
    $pdo = getConnection();
    
    // JSON verilerini al
    $data = json_decode(file_get_contents('php://input'), true);
    
    // ID kontrolü
    if (!isset($data['id']) || !is_numeric($data['id'])) {
        errorResponse("Geçerli bir ID belirtilmedi");
    }
    
    $id = (int)$data['id'];
    
    // Kapak resmini al
    $stmt = $pdo->prepare("SELECT sinav_kapagi FROM cevapAnahtari WHERE id = :id");
    $stmt->execute([':id' => $id]);
    $sinav_kapagi = $stmt->fetchColumn();
    
    // Kaydı sil
    $stmt = $pdo->prepare("DELETE FROM cevapAnahtari WHERE id = :id");
    $result = $stmt->execute([':id' => $id]);
    
    if ($result && $stmt->rowCount() > 0) {
        // Dosya var mı kontrol et ve sil
        if (!empty($sinav_kapagi)) {
            $filepath = '../../uploads/' . $sinav_kapagi;
            if (file_exists($filepath)) {
                unlink($filepath);
            }
        }
        
        successResponse('Cevap anahtarı başarıyla silindi.');
    } else {
        errorResponse("Belirtilen ID ile kayıt bulunamadı");
    }
    
} catch (Exception $e) {
    errorResponse($e->getMessage());
}

// Bağlantıyı kapat
closeConnection();
?>
