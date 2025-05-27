
<?php
// Öğrenciler listesi API'si
require_once '../config.php';

// GET isteği: Tüm öğrencileri getir
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    try {
        // Kullanıcıyı doğrula
        $user = authorize();
        
        // Sadece yöneticiler ve öğretmenler tüm öğrencileri görebilir
        if ($user['rutbe'] !== 'admin' && $user['rutbe'] !== 'ogretmen') {
            errorResponse('Bu bilgilere erişim yetkiniz yok', 403);
        }
        
        $conn = getConnection();
        
        // Tüm öğrencileri getir
        $stmt = $conn->prepare("
            SELECT o.id, o.adi_soyadi, o.email, o.cep_telefonu, o.rutbe, o.aktif, o.avatar, o.created_at,
                   ob.okulu, ob.sinifi, ob.grubu, ob.ders_gunu, ob.ders_saati, ob.ucret,
                   ob.veli_adi, ob.veli_cep
            FROM ogrenciler o
            LEFT JOIN ogrenci_bilgileri ob ON o.id = ob.ogrenci_id
            ORDER BY o.id DESC
        ");
        $stmt->execute();
        
        $students = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        successResponse($students);
        
    } catch (PDOException $e) {
        errorResponse('Veritabanı hatası: ' . $e->getMessage(), 500);
    } catch (Exception $e) {
        errorResponse('Beklenmeyen bir hata oluştu: ' . $e->getMessage(), 500);
    }
}
// Diğer HTTP metodlarını reddet
else {
    errorResponse('Bu endpoint sadece GET metodunu desteklemektedir', 405);
}
