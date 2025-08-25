<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
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

    // Grup parametresini al ve kontrol et
    $grup = $_GET['grup'] ?? '';
    if (empty($grup)) {
        errorResponse('Grup parametresi gereklidir');
    }

    $grup = trim($grup);
    if (strlen($grup) < 1) {
        errorResponse('Geçerli bir grup adı giriniz');
    }

    // Veritabanı bağlantısını kur
    $dsn = "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=utf8mb4";
    $options = [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ];

    $conn = new PDO($dsn, DB_USER, DB_PASS, $options);

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

    // Öğrencinin grubuna ve GET parametresine göre ödevleri getir
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
        WHERE grup = ? AND grup = :ogrenci_grubu
        ORDER BY olusturma_tarihi DESC, bitis_tarihi ASC
    ");

    $stmt->execute([$grup, $ogrenci_grubu]);
    $odevler = $stmt->fetchAll();

    // Tarihleri formatla ve ek bilgiler ekle
    foreach ($odevler as &$odev) {
        // Tarihleri düzgün formata çevir
        $odev['baslangic_tarihi'] = date('Y-m-d', strtotime($odev['baslangic_tarihi']));
        $odev['bitis_tarihi'] = date('Y-m-d', strtotime($odev['bitis_tarihi']));
        $odev['olusturma_tarihi'] = date('Y-m-d H:i:s', strtotime($odev['olusturma_tarihi']));

        // Durumu belirle
        $today = date('Y-m-d');
        $baslangic = $odev['baslangic_tarihi'];
        $bitis = $odev['bitis_tarihi'];

        if ($baslangic > $today) {
            $odev['status'] = 'upcoming';
            $odev['durum'] = 'yaklaşan';
        } else if ($baslangic <= $today && $bitis >= $today) {
            $odev['status'] = 'active';
            $odev['durum'] = 'aktif';
        } else {
            $odev['status'] = 'expired';
            $odev['durum'] = 'süresi_dolmuş';
        }

        // Kalan gün hesapla
        $bitisDate = new DateTime($bitis);
        $currentDate = new DateTime($today);
        $interval = $currentDate->diff($bitisDate);
        $odev['remaining_days'] = $bitisDate >= $currentDate ? $interval->days : -$interval->days;
        $odev['kalan_gun'] = max(0, $odev['remaining_days']);

        // PDF dosyası kontrolü
        if (!empty($odev['pdf_dosyasi'])) {
            $pdf_path = __DIR__ . '/../uploads/odevler/' . $odev['pdf_dosyasi'];
            $odev['pdf_exists'] = file_exists($pdf_path);
        } else {
            $odev['pdf_exists'] = false;
        }
    }

    // Log için
    error_log("Grup için ödevler getiriliyor: " . $grup . ", Bulunan ödev sayısı: " . count($odevler));

    successResponse($odevler, count($odevler) . ' ödev bulundu');

} catch (PDOException $e) {
    error_log("Database error in ogrenci_odevleri.php: " . $e->getMessage());
    errorResponse('Veritabanı hatası: ' . $e->getMessage(), 500);
} catch (Exception $e) {
    error_log("General error in ogrenci_odevleri.php: " . $e->getMessage());
    errorResponse('Bir hata oluştu: ' . $e->getMessage(), 500);
}
?>