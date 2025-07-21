
<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

require_once '../config.php';

function authorize() {
    $headers = getallheaders();
    $token = $headers['Authorization'] ?? '';
    
    if (empty($token) || !str_starts_with($token, 'Bearer ')) {
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'Token bulunamadı']);
        exit;
    }
    
    $token = substr($token, 7);
    $user = verifyToken($token);
    
    if (!$user) {
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'Geçersiz token']);
        exit;
    }
    
    return $user;
}

function successResponse($data, $message = 'İşlem başarılı') {
    echo json_encode([
        'success' => true,
        'message' => $message,
        'data' => $data
    ]);
    exit;
}

function errorResponse($message, $code = 400) {
    http_response_code($code);
    echo json_encode([
        'success' => false,
        'message' => $message
    ]);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    try {
        $user = authorize();
        
        if ($user['rutbe'] !== 'ogretmen') {
            errorResponse('Bu işlem için yetkiniz yok.', 403);
        }

        $sinav_id = $_GET['sinav_id'] ?? '';
        $ogrenci_id = $_GET['ogrenci_id'] ?? '';

        if (empty($sinav_id) || empty($ogrenci_id)) {
            errorResponse('Sınav ID ve öğrenci ID gerekli.');
        }

        $pdo = getConnection();

        // Önce sınav sonucunu al
        $sinavSonucQuery = "
            SELECT ss.*, ca.sinav_adi, ca.soru_sayisi 
            FROM sinav_sonuclari ss
            INNER JOIN cevap_anahtarlari ca ON ss.sinav_id = ca.id
            WHERE ss.sinav_id = ? AND ss.ogrenci_id = ?
        ";
        $stmt = $pdo->prepare($sinavSonucQuery);
        $stmt->execute([$sinav_id, $ogrenci_id]);
        $sinavSonuc = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$sinavSonuc) {
            errorResponse('Sınav sonucu bulunamadı.');
        }

        // Cevap anahtarını al
        $cevapAnahtariQuery = "SELECT cevaplar FROM cevap_anahtarlari WHERE id = ?";
        $stmt = $pdo->prepare($cevapAnahtariQuery);
        $stmt->execute([$sinav_id]);
        $cevapAnahtari = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$cevapAnahtari) {
            errorResponse('Cevap anahtarı bulunamadı.');
        }

        // Öğrenci cevaplarını parse et
        $ogrenciCevaplari = json_decode($sinavSonuc['cevaplar'], true);
        $dogruCevaplar = json_decode($cevapAnahtari['cevaplar'], true);

        // Soru bazında detayları oluştur
        $soruDetaylari = [];
        
        for ($i = 1; $i <= $sinavSonuc['soru_sayisi']; $i++) {
            $ogrenciCevabi = $ogrenciCevaplari[$i] ?? null;
            $dogruCevap = $dogruCevaplar[$i] ?? null;
            
            $soruDetaylari[] = [
                'soru_no' => $i,
                'ogrenci_cevabi' => $ogrenciCevabi,
                'dogru_cevap' => $dogruCevap,
                'durum' => !$ogrenciCevabi ? 'bos' : ($ogrenciCevabi === $dogruCevap ? 'dogru' : 'yanlis')
            ];
        }

        $response = [
            'sinav_bilgileri' => [
                'sinav_adi' => $sinavSonuc['sinav_adi'],
                'soru_sayisi' => $sinavSonuc['soru_sayisi'],
                'dogru_sayisi' => $sinavSonuc['dogru_sayisi'],
                'yanlis_sayisi' => $sinavSonuc['yanlis_sayisi'],
                'bos_sayisi' => $sinavSonuc['bos_sayisi'],
                'net' => $sinavSonuc['dogru_sayisi'] - ($sinavSonuc['yanlis_sayisi'] / 4),
                'puan' => $sinavSonuc['puan'],
                'yuzde' => $sinavSonuc['yuzde']
            ],
            'soru_detaylari' => $soruDetaylari
        ];

        successResponse($response, 'Sınav detayları başarıyla getirildi.');

    } catch (Exception $e) {
        error_log("Sınav detayları getirme hatası: " . $e->getMessage());
        errorResponse('Sınav detayları getirilirken hata oluştu: ' . $e->getMessage(), 500);
    }
} else {
    errorResponse('Desteklenmeyen HTTP metodu.', 405);
}
?>
