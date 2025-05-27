
<?php
// Öğrenci bilgileri API'si
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
        
        // Öğrenci ID'sini al
        $studentId = isset($_GET['id']) ? (int)$_GET['id'] : null;
        
        if (!$studentId) {
            errorResponse('Öğrenci ID gerekli', 400);
        }

        // Yetki kontrolü - Admin/öğretmen herkesin bilgilerini, öğrenci sadece kendisini görebilir
        if ($user['rutbe'] === 'ogrenci' && $user['id'] != $studentId) {
            errorResponse('Bu bilgilere erişim yetkiniz yok', 403);
        }

        $conn = getConnection();
        
        // Öğrenci bilgilerini getir
        $stmt = $conn->prepare("
            SELECT o.id, o.adi_soyadi, o.email, o.cep_telefonu, o.rutbe, o.aktif, o.avatar, o.created_at,
                   ob.okulu, ob.sinifi, ob.grubu, ob.ders_gunu, ob.ders_saati, ob.ucret,
                   ob.veli_adi, ob.veli_cep
            FROM ogrenciler o
            LEFT JOIN ogrenci_bilgileri ob ON o.id = ob.ogrenci_id
            WHERE o.id = :id
        ");
        $stmt->execute([':id' => $studentId]);
        
        $student = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$student) {
            errorResponse('Öğrenci bulunamadı', 404);
        }

        successResponse($student);

    } catch (PDOException $e) {
        errorResponse('Veritabanı hatası: ' . $e->getMessage(), 500);
    } catch (Exception $e) {
        errorResponse('Beklenmeyen bir hata oluştu: ' . $e->getMessage(), 500);
    }
} else {
    errorResponse('Bu endpoint sadece GET metodunu destekler', 405);
}
?>
