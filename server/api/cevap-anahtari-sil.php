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

try {
    // Bağlantıyı içe aktar
    require_once '../baglanti.php';
    $pdo = getConnection();
    
    // JSON verilerini al
    $data = json_decode(file_get_contents('php://input'), true);
    
    // ID kontrolü
    if (!isset($data['id']) || !is_numeric($data['id'])) {
        throw new Exception("Geçerli bir ID belirtilmedi");
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
            $filepath = '../uploads/' . $sinav_kapagi;
            if (file_exists($filepath)) {
                unlink($filepath);
            }
        }
        
        echo json_encode([
            'success' => true,
            'message' => 'Cevap anahtarı başarıyla silindi.'
        ]);
    } else {
        throw new Exception("Belirtilen ID ile kayıt bulunamadı");
    }
    
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