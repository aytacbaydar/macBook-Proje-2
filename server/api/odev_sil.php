
<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: DELETE, OPTIONS');
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
    // Sadece DELETE metoduna izin ver
    if ($_SERVER['REQUEST_METHOD'] !== 'DELETE') {
        errorResponse('Sadece DELETE metoduna izin verilir', 405);
    }

    // Ödev ID'sini al
    $odev_id = isset($_GET['id']) ? (int)$_GET['id'] : 0;
    
    if ($odev_id <= 0) {
        errorResponse('Geçerli ödev ID gerekli');
    }

    // Ödevi getir
    $stmt = $conn->prepare("SELECT pdf_dosyasi, ogretmen_id FROM odevler WHERE id = ?");
    $stmt->execute([$odev_id]);
    $odev = $stmt->fetch();

    if (!$odev) {
        errorResponse('Ödev bulunamadı');
    }

    // Ödevi sil
    $stmt = $conn->prepare("DELETE FROM odevler WHERE id = ?");
    $result = $stmt->execute([$odev_id]);

    if ($result) {
        // PDF dosyasını da sil
        if ($odev['pdf_dosyasi']) {
            $file_path = '../uploads/odevler/' . $odev['pdf_dosyasi'];
            if (file_exists($file_path)) {
                unlink($file_path);
            }
        }

        successResponse(['id' => $odev_id], 'Ödev başarıyla silindi');
    } else {
        errorResponse('Ödev silinirken hata oluştu');
    }

} catch (Exception $e) {
    error_log("Ödev silme hatası: " . $e->getMessage());
    errorResponse('Sunucu hatası: ' . $e->getMessage(), 500);
}
?>
