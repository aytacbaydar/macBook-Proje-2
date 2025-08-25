
<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
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
    
    // Sadece POST metoduna izin ver
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        errorResponse('Sadece POST metoduna izin verilir', 405);
    }

    // JSON verisini al
    $input = json_decode(file_get_contents('php://input'), true);
    if (!$input) {
        errorResponse('Geçersiz JSON verisi');
    }

    // Zorunlu alanları kontrol et
    $required_fields = ['grup', 'konu', 'baslangic_tarihi', 'bitis_tarihi', 'ogretmen_id', 'ogretmen_adi'];
    foreach ($required_fields as $field) {
        if (!isset($input[$field]) || empty(trim($input[$field]))) {
            errorResponse("$field alanı zorunludur");
        }
    }

    $grup = trim($input['grup']);
    $konu = trim($input['konu']);
    $baslangic_tarihi = trim($input['baslangic_tarihi']);
    $bitis_tarihi = trim($input['bitis_tarihi']);
    $ogretmen_id = (int)$input['ogretmen_id'];
    $ogretmen_adi = trim($input['ogretmen_adi']);
    $aciklama = isset($input['aciklama']) ? trim($input['aciklama']) : '';
    $pdf_dosyasi = isset($input['pdf_dosyasi']) ? trim($input['pdf_dosyasi']) : '';

    // Tarih kontrolü
    if (strtotime($bitis_tarihi) <= strtotime($baslangic_tarihi)) {
        errorResponse('Bitiş tarihi başlangıç tarihinden sonra olmalıdır');
    }

    // Veritabanına kaydet
    $stmt = $conn->prepare("
        INSERT INTO odevler (grup, konu, baslangic_tarihi, bitis_tarihi, aciklama, pdf_dosyasi, ogretmen_id, ogretmen_adi, olusturma_tarihi) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
    ");

    $result = $stmt->execute([
        $grup,
        $konu,
        $baslangic_tarihi,
        $bitis_tarihi,
        $aciklama,
        $pdf_dosyasi,
        $ogretmen_id,
        $ogretmen_adi
    ]);

    if ($result) {
        $odev_id = $conn->lastInsertId();
        successResponse(['id' => $odev_id], 'Ödev başarıyla eklendi');
    } else {
        errorResponse('Ödev eklenirken hata oluştu');
    }

} catch (Exception $e) {
    error_log("Ödev ekleme hatası: " . $e->getMessage());
    errorResponse('Sunucu hatası: ' . $e->getMessage(), 500);
}
?>
