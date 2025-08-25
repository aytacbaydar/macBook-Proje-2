
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

    // Öğretmen ID'sini al
    $ogretmen_id = isset($_GET['ogretmen_id']) ? (int)$_GET['ogretmen_id'] : 0;
    
    if ($ogretmen_id <= 0) {
        errorResponse('Geçerli öğretmen ID gerekli');
    }

    // Ödevleri getir
    $stmt = $conn->prepare("
        SELECT id, grup, konu, baslangic_tarihi, bitis_tarihi, aciklama, pdf_dosyasi, 
               ogretmen_id, ogretmen_adi, olusturma_tarihi
        FROM odevler 
        WHERE ogretmen_id = ? 
        ORDER BY olusturma_tarihi DESC
    ");

    $stmt->execute([$ogretmen_id]);
    $odevler = $stmt->fetchAll(PDO::FETCH_ASSOC);

    successResponse($odevler, 'Ödevler başarıyla getirildi');

} catch (Exception $e) {
    error_log("Ödev listesi getirme hatası: " . $e->getMessage());
    errorResponse('Sunucu hatası: ' . $e->getMessage(), 500);
}
?>
