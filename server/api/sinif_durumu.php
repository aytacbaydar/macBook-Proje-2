
<?php
// Sınıf durumu API'si
require_once '../config.php';

// CORS başlıkları
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Content-Type: application/json; charset=UTF-8");

// OPTIONS isteğini yönet
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    try {
        // Kullanıcıyı doğrula
        $user = authorize();
        
        // Parametreleri al
        $grup = $_GET['grup'] ?? '';
        $tarih = $_GET['tarih'] ?? date('Y-m-d');
        
        if (empty($grup)) {
            errorResponse('Grup parametresi gerekli');
        }
        
        $conn = getConnection();
        
        // Bugünkü sınıf durumunu getir
        $stmt = $conn->prepare("
            SELECT 
                sc.student_id,
                sc.entry_time,
                sc.exit_time,
                sc.is_present,
                sc.qr_method,
                o.adi_soyadi,
                o.avatar
            FROM sinif_durumu sc
            JOIN ogrenciler o ON sc.student_id = o.id
            JOIN ogrenci_bilgileri ob ON o.id = ob.ogrenci_id
            WHERE ob.grubu = :grup 
            AND DATE(sc.entry_time) = :tarih
            ORDER BY sc.entry_time DESC
        ");
        
        $stmt->bindParam(':grup', $grup);
        $stmt->bindParam(':tarih', $tarih);
        $stmt->execute();
        
        $result = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        successResponse($result, 'Sınıf durumu başarıyla getirildi');
        
    } catch (PDOException $e) {
        error_log("Veritabanı hatası: " . $e->getMessage());
        errorResponse('Sınıf durumu getirilemedi: ' . $e->getMessage(), 500);
    } catch (Exception $e) {
        error_log("Genel hata: " . $e->getMessage());
        errorResponse('İşlem sırasında hata: ' . $e->getMessage(), 500);
    }
} else {
    errorResponse('Sadece GET istekleri kabul edilir', 405);
}
?>
