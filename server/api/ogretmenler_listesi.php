
<?php
// Hataları dosyaya logla
ini_set('display_errors', 0);
ini_set('display_startup_errors', 0);
error_reporting(E_ALL);
ini_set('log_errors', 0);
ini_set('error_log', '../../php_errors.log');

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
        
        // Önce tablo yapısını kontrol et
        $stmt = $conn->prepare("DESCRIBE ogretmenler");
        $stmt->execute();
        $columns = $stmt->fetchAll(PDO::FETCH_COLUMN);
        
        // aktif sütunu varsa filtrele, yoksa tüm öğretmenleri getir
        if (in_array('aktif', $columns)) {
            $stmt = $conn->prepare("SELECT id, ogrt_adi_soyadi FROM ogretmenler WHERE aktif = 1 ORDER BY ogrt_adi_soyadi ASC");
        } else {
            $stmt = $conn->prepare("SELECT id, ogrt_adi_soyadi FROM ogretmenler ORDER BY ogrt_adi_soyadi ASC");
        }
        $stmt->execute();
        $teachers = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        successResponse($teachers, 'Öğretmenler başarıyla getirildi');
        
    } catch (PDOException $e) {
        error_log("Veritabanı hatası: " . $e->getMessage());
        errorResponse('Öğretmenler getirilemedi: ' . $e->getMessage(), 500);
    } catch (Exception $e) {
        error_log("Genel hata: " . $e->getMessage());
        errorResponse('İşlem sırasında hata: ' . $e->getMessage(), 500);
    }
} else {
    errorResponse('Sadece GET istekleri kabul edilir', 405);
}
?>
