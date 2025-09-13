
<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");

// OPTIONS isteğini yönet
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// GET isteği kontrol et
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Sadece GET istekleri kabul edilir']);
    exit();
}

// PDF dosya adını kontrol et
if (!isset($_GET['file']) || empty($_GET['file'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Dosya parametresi gerekli']);
    exit();
}

$fileName = $_GET['file'];

// Güvenlik: sadece PDF dosyalarına izin ver
if (!preg_match('/\.pdf$/i', $fileName)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Sadece PDF dosyaları desteklenir']);
    exit();
}

// Güvenlik: path traversal saldırılarını önle
$fileName = basename($fileName);

// Dosya yolunu oluştur - doğru yol yapısı  
$filePath = __DIR__ . '/../dosyalar/pdf/' . $fileName;

// Dosyanın var olup olmadığını kontrol et
if (!file_exists($filePath)) {
    http_response_code(404);
    echo json_encode(['success' => false, 'message' => 'Dosya bulunamadı: ' . $fileName]);
    exit();
}

// PDF content-type ayarla
header('Content-Type: application/pdf');
header('Content-Disposition: inline; filename="' . basename($fileName) . '"');
header('Content-Length: ' . filesize($filePath));
header('Accept-Ranges: bytes');

// Cache kontrol başlıkları
header('Cache-Control: public, max-age=3600');
header('Pragma: public');

// Dosyayı okuyup gönder
readfile($filePath);
exit();
?>
