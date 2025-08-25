
<?php
// Output buffer'ı başlat ve temizle
ob_start();
ob_clean();

// Hata raporlamayı ayarla
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

require_once '../config.php';

function errorResponse($message, $code = 400) {
    // Output buffer'ı temizle
    if (ob_get_length()) {
        ob_clean();
    }
    
    http_response_code($code);
    echo json_encode(['success' => false, 'message' => $message], JSON_UNESCAPED_UNICODE);
    exit;
}

function successResponse($data = null, $message = '') {
    // Output buffer'ı temizle
    if (ob_get_length()) {
        ob_clean();
    }
    
    echo json_encode([
        'success' => true,
        'message' => $message,
        'data' => $data
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

try {
    // Veritabanı bağlantısını al
    $pdo = getConnection();
    
    // Sadece POST metoduna izin ver
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        errorResponse('Sadece POST metoduna izin verilir', 405);
    }

    // Dosya yükleme kontrolü
    if (!isset($_FILES['pdf']) || $_FILES['pdf']['error'] !== UPLOAD_ERR_OK) {
        errorResponse('PDF dosyası yüklenemedi');
    }

    $file = $_FILES['pdf'];
    $ogretmen_id = isset($_POST['ogretmen_id']) ? (int)$_POST['ogretmen_id'] : 0;

    if ($ogretmen_id <= 0) {
        errorResponse('Geçerli öğretmen ID gerekli');
    }

    // Dosya türü kontrolü
    if ($file['type'] !== 'application/pdf') {
        errorResponse('Sadece PDF dosyası kabul edilir');
    }

    // Dosya boyutu kontrolü (50MB)
    if ($file['size'] > 50 * 1024 * 1024) {
        errorResponse('Dosya boyutu 50MB\'dan büyük olamaz');
    }

    // Upload dizinini kontrol et ve oluştur
    $upload_dir = __DIR__ . '/../uploads/odevler/';
    if (!is_dir($upload_dir)) {
        if (!mkdir($upload_dir, 0755, true)) {
            errorResponse('Upload dizini oluşturulamadı');
        }
    }
    
    // Dizinin yazılabilir olduğunu kontrol et
    if (!is_writable($upload_dir)) {
        errorResponse('Upload dizini yazılabilir değil');
    }

    // Benzersiz dosya adı oluştur
    $file_extension = pathinfo($file['name'], PATHINFO_EXTENSION);
    $original_name = pathinfo($file['name'], PATHINFO_FILENAME);
    $safe_name = preg_replace('/[^a-zA-Z0-9_-]/', '_', $original_name);
    $filename = $safe_name . '_' . time() . '_' . $ogretmen_id . '.' . $file_extension;
    
    $target_path = $upload_dir . $filename;

    // Dosyayı taşı
    error_log("Dosya taşınıyor: " . $file['tmp_name'] . " -> " . $target_path);
    
    if (move_uploaded_file($file['tmp_name'], $target_path)) {
        error_log("Dosya başarıyla taşındı: " . $target_path);
        
        // Dosyanın gerçekten oluştuğunu kontrol et
        if (file_exists($target_path)) {
            successResponse([
                'filename' => $filename,
                'original_name' => $file['name'],
                'size' => $file['size'],
                'path' => '../uploads/odevler/' . $filename
            ], 'PDF başarıyla yüklendi');
        } else {
            errorResponse('Dosya taşındı ama bulunamıyor');
        }
    } else {
        $upload_error = error_get_last();
        error_log("Dosya taşıma hatası: " . print_r($upload_error, true));
        errorResponse('Dosya yüklenirken hata oluştu: ' . ($upload_error['message'] ?? 'Bilinmeyen hata'));
    }

} catch (Exception $e) {
    error_log("PDF yükleme hatası: " . $e->getMessage());
    
    // Output buffer'ı temizle
    if (ob_get_length()) {
        ob_clean();
    }
    
    errorResponse('Sunucu hatası: ' . $e->getMessage(), 500);
}

// Output buffer'ı temizle ve sonlandır
if (ob_get_length()) {
    ob_clean();
}
?>
