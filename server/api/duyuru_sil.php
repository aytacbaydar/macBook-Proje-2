
<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

require_once 'config.php';

try {
    // Token doğrulama
    $headers = getallheaders();
    $authHeader = $headers['Authorization'] ?? '';
    
    if (empty($authHeader) || !preg_match('/Bearer\s+(.*)$/i', $authHeader, $matches)) {
        echo json_encode(['success' => false, 'message' => 'Token bulunamadı']);
        exit;
    }
    
    $token = $matches[1];
    
    // Token'dan kullanıcı bilgilerini al
    $stmt = $pdo->prepare("SELECT id, adi_soyadi, rutbe FROM kullanicilar WHERE token = ? AND rutbe = 'ogretmen'");
    $stmt->execute([$token]);
    $user = $stmt->fetch();
    
    if (!$user) {
        echo json_encode(['success' => false, 'message' => 'Geçersiz token veya yetki']);
        exit;
    }
    
    // POST verilerini al
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (!$input || !isset($input['id'])) {
        echo json_encode(['success' => false, 'message' => 'Duyuru ID gereklidir']);
        exit;
    }
    
    $announcementId = (int)$input['id'];
    
    // Duyurunun sahibi olup olmadığını kontrol et
    $stmt = $pdo->prepare("SELECT ogretmen_id FROM duyurular WHERE id = ?");
    $stmt->execute([$announcementId]);
    $announcement = $stmt->fetch();
    
    if (!$announcement) {
        echo json_encode(['success' => false, 'message' => 'Duyuru bulunamadı']);
        exit;
    }
    
    if ($announcement['ogretmen_id'] != $user['id']) {
        echo json_encode(['success' => false, 'message' => 'Bu duyuruyu silme yetkiniz yok']);
        exit;
    }
    
    // Duyuruyu sil
    $stmt = $pdo->prepare("DELETE FROM duyurular WHERE id = ? AND ogretmen_id = ?");
    $success = $stmt->execute([$announcementId, $user['id']]);
    
    if ($success && $stmt->rowCount() > 0) {
        echo json_encode([
            'success' => true,
            'message' => 'Duyuru başarıyla silindi'
        ]);
    } else {
        echo json_encode(['success' => false, 'message' => 'Duyuru silinemedi']);
    }
    
} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'message' => 'Duyuru silinirken hata: ' . $e->getMessage()
    ]);
}
?>
