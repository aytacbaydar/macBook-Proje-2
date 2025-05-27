
<?php
// Yönetici bilgileri API'si
require_once '../config.php';

// CORS başlıkları
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    try {
        // Kullanıcıyı doğrula
        $user = authorize();
        
        // Sadece yöneticiler erişebilir
        if ($user['rutbe'] !== 'admin') {
            errorResponse('Bu bilgilere erişim yetkiniz yok', 403);
        }

        $conn = getConnection();
        
        // İstatistikleri getir
        $stats = [];
        
        // Toplam öğrenci sayısı
        $stmt = $conn->prepare("SELECT COUNT(*) as total FROM ogrenciler WHERE rutbe = 'ogrenci'");
        $stmt->execute();
        $stats['toplam_ogrenci'] = $stmt->fetch(PDO::FETCH_ASSOC)['total'];
        
        // Aktif öğrenci sayısı
        $stmt = $conn->prepare("SELECT COUNT(*) as total FROM ogrenciler WHERE rutbe = 'ogrenci' AND aktif = 1");
        $stmt->execute();
        $stats['aktif_ogrenci'] = $stmt->fetch(PDO::FETCH_ASSOC)['total'];
        
        // Onay bekleyen öğrenci sayısı
        $stmt = $conn->prepare("SELECT COUNT(*) as total FROM ogrenciler WHERE rutbe = 'ogrenci' AND aktif = 0");
        $stmt->execute();
        $stats['bekleyen_ogrenci'] = $stmt->fetch(PDO::FETCH_ASSOC)['total'];
        
        // Öğretmen sayısı
        $stmt = $conn->prepare("SELECT COUNT(*) as total FROM ogrenciler WHERE rutbe = 'ogretmen'");
        $stmt->execute();
        $stats['toplam_ogretmen'] = $stmt->fetch(PDO::FETCH_ASSOC)['total'];

        successResponse($stats);

    } catch (PDOException $e) {
        errorResponse('Veritabanı hatası: ' . $e->getMessage(), 500);
    } catch (Exception $e) {
        errorResponse('Beklenmeyen bir hata oluştu: ' . $e->getMessage(), 500);
    }
} else {
    errorResponse('Bu endpoint sadece GET metodunu destekler', 405);
}
?>
