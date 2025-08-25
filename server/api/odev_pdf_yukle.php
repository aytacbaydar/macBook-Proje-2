
<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

require_once 'config.php';

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
    $upload_dir = '../uploads/odevler/';
    if (!is_dir($upload_dir)) {
        mkdir($upload_dir, 0755, true);
    }

    // Benzersiz dosya adı oluştur
    $file_extension = pathinfo($file['name'], PATHINFO_EXTENSION);
    $original_name = pathinfo($file['name'], PATHINFO_FILENAME);
    $safe_name = preg_replace('/[^a-zA-Z0-9_-]/', '_', $original_name);
    $filename = $safe_name . '_' . time() . '_' . $ogretmen_id . '.' . $file_extension;
    
    $target_path = $upload_dir . $filename;

    // Dosyayı taşı
    if (move_uploaded_file($file['tmp_name'], $target_path)) {
        successResponse([
            'filename' => $filename,
            'original_name' => $file['name'],
            'size' => $file['size']
        ], 'PDF başarıyla yüklendi');
    } else {
        errorResponse('Dosya yüklenirken hata oluştu');
    }

} catch (Exception $e) {
    error_log("PDF yükleme hatası: " . $e->getMessage());
    errorResponse('Sunucu hatası: ' . $e->getMessage(), 500);
}
?>
