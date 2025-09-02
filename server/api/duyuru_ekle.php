
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
    
    if (!$input) {
        echo json_encode(['success' => false, 'message' => 'Geçersiz JSON verisi']);
        exit;
    }
    
    $baslik = trim($input['baslik'] ?? '');
    $icerik = trim($input['icerik'] ?? '');
    $grup = !empty(trim($input['grup'] ?? '')) ? trim($input['grup']) : null;
    $durum = $input['durum'] ?? 'aktif';
    
    // Validation
    if (empty($baslik)) {
        echo json_encode(['success' => false, 'message' => 'Duyuru başlığı gereklidir']);
        exit;
    }
    
    if (empty($icerik)) {
        echo json_encode(['success' => false, 'message' => 'Duyuru içeriği gereklidir']);
        exit;
    }
    
    // Duyuru ekle
    $stmt = $pdo->prepare("
        INSERT INTO duyurular (baslik, icerik, grup, ogretmen_id, ogretmen_adi, durum) 
        VALUES (?, ?, ?, ?, ?, ?)
    ");
    
    $success = $stmt->execute([
        $baslik,
        $icerik,
        $grup,
        $user['id'],
        $user['adi_soyadi'],
        $durum
    ]);
    
    if ($success) {
        $announcementId = $pdo->lastInsertId();
        
        echo json_encode([
            'success' => true,
            'message' => 'Duyuru başarıyla eklendi',
            'data' => [
                'id' => $announcementId,
                'baslik' => $baslik,
                'icerik' => $icerik,
                'grup' => $grup,
                'durum' => $durum
            ]
        ]);
    } else {
        echo json_encode(['success' => false, 'message' => 'Duyuru eklenirken hata oluştu']);
    }
    
} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'message' => 'Duyuru eklenirken hata: ' . $e->getMessage()
    ]);
}
?>
