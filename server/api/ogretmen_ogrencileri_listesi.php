
<?php
require_once '../config.php';

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    try {
        // Token doğrulama
        $headers = getallheaders();
        $authHeader = $headers['Authorization'] ?? '';
        
        if (!$authHeader || !str_starts_with($authHeader, 'Bearer ')) {
            errorResponse('Yetkilendirme token\'ı gerekli', 401);
            return;
        }
        
        $token = substr($authHeader, 7);
        $conn = getConnection();
        
        // Token'dan öğretmen bilgilerini al
        $stmt = $conn->prepare("SELECT adi_soyadi FROM ogrenciler WHERE token = ? AND rutbe = 'ogretmen'");
        $stmt->execute([$token]);
        $teacher = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$teacher) {
            errorResponse('Geçersiz token veya yetki', 401);
            return;
        }
        
        $teacherName = $teacher['adi_soyadi'];
        
        // Sadece bu öğretmene ait öğrencileri getir
        $stmt = $conn->prepare("
            SELECT o.id, o.adi_soyadi, o.email, o.cep_telefonu, o.rutbe, o.aktif, o.avatar, o.created_at,
                   ob.okulu, ob.sinifi, ob.grubu, ob.ders_gunu, ob.ders_saati, ob.ucret,
                   ob.veli_adi, ob.veli_cep
            FROM ogrenciler o
            LEFT JOIN ogrenci_bilgileri ob ON o.id = ob.ogrenci_id
            WHERE o.rutbe = 'ogrenci' AND o.ogretmeni = ?
            ORDER BY o.id DESC
        ");
        $stmt->execute([$teacherName]);
        
        $students = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        successResponse($students);
        
    } catch (PDOException $e) {
        errorResponse('Veritabanı hatası: ' . $e->getMessage(), 500);
    } catch (Exception $e) {
        errorResponse('Beklenmeyen bir hata oluştu: ' . $e->getMessage(), 500);
    }
} else {
    errorResponse('Bu endpoint sadece GET metodunu desteklemektedir', 405);
}
?>
