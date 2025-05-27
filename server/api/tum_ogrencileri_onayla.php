
<?php
// Tüm öğrencileri onaylama API'si
require_once '../config.php';

// CORS başlıkları
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    try {
        // Kullanıcıyı doğrula
        $user = authorize();
        
        // Sadece yöneticiler toplu onaylama yapabilir
        if ($user['rutbe'] !== 'admin') {
            errorResponse('Bu işlemi gerçekleştirme yetkiniz yok', 403);
        }

        $conn = getConnection();
        
        // Tüm bekleyen öğrencileri onayla
        $stmt = $conn->prepare("UPDATE ogrenciler SET aktif = 1 WHERE rutbe = 'ogrenci' AND aktif = 0");
        $stmt->execute();
        
        $approvedCount = $stmt->rowCount();

        successResponse(['onaylanan_sayisi' => $approvedCount], "Toplam $approvedCount öğrenci onaylandı");

    } catch (PDOException $e) {
        errorResponse('Veritabanı hatası: ' . $e->getMessage(), 500);
    } catch (Exception $e) {
        errorResponse('Beklenmeyen bir hata oluştu: ' . $e->getMessage(), 500);
    }
} else {
    errorResponse('Bu endpoint sadece POST metodunu destekler', 405);
}
?>
