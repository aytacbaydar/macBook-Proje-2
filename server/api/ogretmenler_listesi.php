
<?php
// CORS başlıkları
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Content-Type: application/json; charset=UTF-8");

// OPTIONS isteğini yönet (preflight)
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require '../config.php';

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    try {
        $conn = getConnection();
        
        // Tüm öğretmenleri getir
        $stmt = $conn->prepare("SELECT ogretmen_id as id, ogrt_adi_soyadi, aktif FROM ogretmenler ORDER BY ogrt_adi_soyadi ASC");
        $stmt->execute();
        $teachers = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        successResponse($teachers, 'Öğretmenler başarıyla getirildi');
        
    } catch (PDOException $e) {
        errorResponse('Öğretmenler getirilemedi: ' . $e->getMessage(), 500);
    } catch (Exception $e) {
        errorResponse('İşlem sırasında hata: ' . $e->getMessage(), 500);
    }
} else {
    errorResponse('Sadece GET istekleri kabul edilir', 405);
}
?>
