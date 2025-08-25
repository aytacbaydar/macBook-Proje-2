
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
<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Database connection
require_once '../config.php';

function successResponse($data, $message = '') {
    echo json_encode([
        'success' => true,
        'message' => $message,
        'data' => $data
    ]);
    exit();
}

function errorResponse($message) {
    echo json_encode([
        'success' => false,
        'message' => $message,
        'data' => null
    ]);
    exit();
}

try {
    if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
        errorResponse('Sadece GET metoduna izin verilir');
    }

    // Get grup parameter from query string
    $grup = $_GET['grup'] ?? '';

    if (empty($grup)) {
        errorResponse('Grup parametresi gereklidir');
    }

    // Validate grup parameter
    $grup = trim($grup);
    if (strlen($grup) < 1) {
        errorResponse('Geçerli bir grup adı giriniz');
    }

    // Create PDO connection
    $dsn = "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=utf8mb4";
    $options = [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ];

    $conn = new PDO($dsn, DB_USER, DB_PASS, $options);

    // Get ödevler for the specific grup, ordered by creation date (newest first)
    $stmt = $conn->prepare("
        SELECT 
            id,
            grup,
            konu,
            baslangic_tarihi,
            bitis_tarihi,
            aciklama,
            pdf_dosyasi,
            ogretmen_id,
            ogretmen_adi,
            olusturma_tarihi
        FROM odevler 
        WHERE grup = ? 
        ORDER BY olusturma_tarihi DESC, bitis_tarihi ASC
    ");

    $stmt->execute([$grup]);
    $odevler = $stmt->fetchAll();

    // Log the query for debugging
    error_log("Grup için ödevler getiriliyor: " . $grup . ", Bulunan ödev sayısı: " . count($odevler));

    // Format dates and add additional info
    foreach ($odevler as &$odev) {
        // Convert dates to proper format if needed
        $odev['baslangic_tarihi'] = date('Y-m-d', strtotime($odev['baslangic_tarihi']));
        $odev['bitis_tarihi'] = date('Y-m-d', strtotime($odev['bitis_tarihi']));
        $odev['olusturma_tarihi'] = date('Y-m-d H:i:s', strtotime($odev['olusturma_tarihi']));
        
        // Add status based on dates
        $today = date('Y-m-d');
        $baslangic = $odev['baslangic_tarihi'];
        $bitis = $odev['bitis_tarihi'];
        
        if ($baslangic > $today) {
            $odev['status'] = 'upcoming';
        } else if ($baslangic <= $today && $bitis >= $today) {
            $odev['status'] = 'active';
        } else {
            $odev['status'] = 'expired';
        }
        
        // Calculate remaining days
        $bitisDate = new DateTime($bitis);
        $currentDate = new DateTime($today);
        $interval = $currentDate->diff($bitisDate);
        $odev['remaining_days'] = $bitisDate >= $currentDate ? $interval->days : -$interval->days;
        
        // Check if PDF file exists
        if (!empty($odev['pdf_dosyasi'])) {
            $pdf_path = __DIR__ . '/../uploads/odevler/' . $odev['pdf_dosyasi'];
            $odev['pdf_exists'] = file_exists($pdf_path);
        } else {
            $odev['pdf_exists'] = false;
        }
    }

    successResponse($odevler, count($odevler) . ' ödev bulundu');

} catch (PDOException $e) {
    error_log("Database error in ogrenci_odevleri.php: " . $e->getMessage());
    errorResponse('Veritabanı hatası: ' . $e->getMessage());
} catch (Exception $e) {
    error_log("General error in ogrenci_odevleri.php: " . $e->getMessage());
    errorResponse('Bir hata oluştu: ' . $e->getMessage());
}
?>
