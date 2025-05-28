
<?php
require_once '../../config.php';

// OPTIONS isteğini yönet
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    try {
        $conn = getConnection();
        
        // Tüm öğretmenleri getir
        $stmt = $conn->prepare("SELECT * FROM ogretmenler ORDER BY id DESC");
        $stmt->execute();
        $teachers = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        successResponse($teachers);
        
    } catch (Exception $e) {
        error_log("Öğretmenler listesi hatası: " . $e->getMessage());
        errorResponse('Öğretmenler yüklenirken hata oluştu', 500);
    }
} else {
    errorResponse('Geçersiz HTTP metodu', 405);
}
?>
