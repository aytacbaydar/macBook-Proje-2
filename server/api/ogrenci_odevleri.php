
<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

require_once '../config.php';

function errorResponse($message, $code = 400) {
    http_response_code($code);
    echo json_encode(['success' => false, 'message' => $message]);
    exit;
}

function successResponse($data = null, $message = '') {
    echo json_encode([
        'success' => true,
        'message' => $message,
        'data' => $data
    ]);
    exit;
}

try {
    // Veritabanı bağlantısını al
    $conn = getConnection();
    
    // Sadece GET metoduna izin ver
    if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
        errorResponse('Sadece GET metoduna izin verilir', 405);
    }

    // Token kontrolü
    $headers = getallheaders();
    $authHeader = isset($headers['Authorization']) ? $headers['Authorization'] : '';
    
    if (empty($authHeader) || !preg_match('/Bearer\s+(.*)$/i', $authHeader, $matches)) {
        errorResponse('Geçersiz token', 401);
    }

    $token = $matches[1];
    
    // Token'dan öğrenci bilgilerini al
    $stmt = $conn->prepare("SELECT id, grubu FROM kullanicilar WHERE token = ? AND rutbe = 'ogrenci'");
    $stmt->execute([$token]);
    $ogrenci = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$ogrenci) {
        errorResponse('Geçersiz token veya yetkisiz erişim', 401);
    }

    $ogrenci_grubu = $ogrenci['grubu'];
    
    if (empty($ogrenci_grubu)) {
        errorResponse('Öğrenci grup bilgisi bulunamadı');
    }

    // Öğrencinin grubuna ait ödevleri getir
    $stmt = $conn->prepare("
        SELECT id, grup, konu, baslangic_tarihi, bitis_tarihi, aciklama, pdf_dosyasi, 
               ogretmen_adi, olusturma_tarihi
        FROM odevler 
        WHERE grup = ? 
        ORDER BY olusturma_tarihi DESC
    ");

    $stmt->execute([$ogrenci_grubu]);
    $odevler = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Her ödev için durumu belirle (teslim tarihi kontrolü)
    $bugün = date('Y-m-d');
    foreach ($odevler as &$odev) {
        if ($bugün <= $odev['bitis_tarihi']) {
            $odev['durum'] = 'aktif';
        } else {
            $odev['durum'] = 'süresi_dolmuş';
        }
        
        // Kalan gün hesapla
        $kalan_gun = (strtotime($odev['bitis_tarihi']) - strtotime($bugün)) / (60 * 60 * 24);
        $odev['kalan_gun'] = max(0, ceil($kalan_gun));
    }

    successResponse($odevler, 'Ödevler başarıyla getirildi');

} catch (Exception $e) {
    error_log("Öğrenci ödevleri getirme hatası: " . $e->getMessage());
    errorResponse('Sunucu hatası: ' . $e->getMessage(), 500);
}
?>
