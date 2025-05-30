
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

// PNG dosya adını kontrol et
if (!isset($_GET['file']) || empty($_GET['file'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Dosya parametresi gerekli']);
    exit();
}

$fileName = $_GET['file'];

// Güvenlik: sadece PNG dosyalarına izin ver
if (!preg_match('/\.png$/i', $fileName)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Sadece PNG dosyaları desteklenir']);
    exit();
}

// Güvenlik: path traversal saldırılarını önle
$fileName = basename($fileName);

// Dosya yolunu oluştur
$filePath = __DIR__ . '/../../dosyalar/cizimler/' . $fileName;

// Dosyanın var olup olmadığını kontrol et
if (!file_exists($filePath)) {
    http_response_code(404);
    echo json_encode(['success' => false, 'message' => 'Dosya bulunamadı: ' . $fileName]);
    exit();
}

// PNG content-type ayarla
header('Content-Type: image/png');
header('Content-Disposition: inline; filename="' . basename($fileName) . '"');
header('Content-Length: ' . filesize($filePath));

// Cache kontrol başlıkları
header('Cache-Control: private, max-age=0, must-revalidate');
header('Pragma: public');

// Dosyayı okuyup gönder
readfile($filePath);
exit();
?>
