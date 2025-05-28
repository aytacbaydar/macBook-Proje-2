
<?php
require_once '../config.php';

// OPTIONS isteğini yönet
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    try {
        $conn = getConnection();
        
        // Tüm öğrencileri bilgileriyle birlikte getir
        $stmt = $conn->prepare("
            SELECT o.id, o.adi_soyadi, o.email, o.cep_telefonu, o.rutbe, o.aktif, o.avatar, o.created_at as kayit_tarihi,
                   ob.okulu, ob.sinifi, ob.grubu, ob.ders_gunu, ob.ders_saati, ob.ucret, ob.brans,
                   ob.veli_adi, ob.veli_cep
            FROM ogrenciler o
            LEFT JOIN ogrenci_bilgileri ob ON o.id = ob.ogrenci_id
            ORDER BY o.id DESC
        ");
        $stmt->execute();
        $students = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        successResponse($students);
        
    } catch (Exception $e) {
        error_log("Öğrenciler listesi hatası: " . $e->getMessage());
        errorResponse('Öğrenciler yüklenirken hata oluştu', 500);
    }
} else {
    errorResponse('Geçersiz HTTP metodu', 405);
}
?>
