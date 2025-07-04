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
        // Kullanıcıyı doğrula
        $user = authorize();

        // Sadece öğretmenler kendi öğrencilerini görebilir
        if ($user['rutbe'] !== 'ogretmen') {
            errorResponse('Bu işlem için yetkiniz yok. Sadece öğretmenler öğrenci listesini görebilir.', 403);
        }

        $conn = getConnection();

        // Öğretmene ait öğrencileri getir
        error_log("Öğretmen ID ile öğrenci arama: " . $user['id']);
        error_log("Öğretmen adi_soyadi: " . $user['adi_soyadi']);

        // Önce öğretmen adıyla arama yapalım
        $stmt = $conn->prepare("
            SELECT o.id, o.adi_soyadi, o.email, o.cep_telefonu, o.rutbe, o.aktif, o.avatar, o.brans, o.ogretmeni, o.created_at,
                   ob.okulu, ob.sinifi, ob.grubu, ob.ders_gunu, ob.ders_saati, ob.ucret,
                   ob.veli_adi, ob.veli_cep
            FROM ogrenciler o
            LEFT JOIN ogrenci_bilgileri ob ON o.id = ob.ogrenci_id
            WHERE o.ogretmeni = :ogretmen_adi AND o.rutbe = 'ogrenci'
            ORDER BY o.created_at DESC
        ");
        $stmt->bindParam(':ogretmen_adi', $user['adi_soyadi'], PDO::PARAM_STR);
        $stmt->execute();

        $ogrenciler = $stmt->fetchAll(PDO::FETCH_ASSOC);
        error_log("Bulunan öğrenci sayısı: " . count($ogrenciler));

        if (count($ogrenciler) > 0) {
            error_log("İlk öğrenci: " . json_encode($ogrenciler[0]));
        } else {
            // Eğer öğrenci bulunamazsa, tüm öğrencileri kontrol edelim
            error_log("Öğrenci bulunamadı, tüm öğrencileri kontrol ediliyor...");
            $debugStmt = $conn->prepare("SELECT id, adi_soyadi, ogretmeni, rutbe FROM ogrenciler WHERE rutbe = 'ogrenci' LIMIT 5");
            $debugStmt->execute();
            $allStudents = $debugStmt->fetchAll(PDO::FETCH_ASSOC);
            error_log("Tüm öğrenciler sample: " . json_encode($allStudents));
        }

        successResponse($ogrenciler, 'Öğrenciler başarıyla getirildi');

    } catch (PDOException $e) {
        error_log("Veritabanı hatası: " . $e->getMessage());
        errorResponse('Öğrenciler getirilemedi: ' . $e->getMessage(), 500);
    } catch (Exception $e) {
        error_log("Genel hata: " . $e->getMessage());
        errorResponse('İşlem sırasında hata: ' . $e->getMessage(), 500);
    }
} else {
    errorResponse('Sadece GET istekleri kabul edilir', 405);
}
?>