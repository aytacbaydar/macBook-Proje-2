<?php
// Öğrenci silme API
require_once '../config.php';

// POST istekleri için
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    try {
        // Kullanıcı doğrulama
        $user = authorize();

        // Yöneticiler tüm öğrencileri silebilir, öğretmenler sadece kendi öğrencilerini silebilir
        if ($user['rutbe'] !== 'admin' && $user['rutbe'] !== 'ogretmen') {
            errorResponse('Bu işlemi yapmaya yetkiniz yok', 403);
        }

        // JSON verisini al
        $jsonData = file_get_contents('php://input');
        $data = json_decode($jsonData, true);

        if (!isset($data['id']) || !is_numeric($data['id'])) {
            errorResponse('Geçersiz kullanıcı ID', 400);
        }

        $userId = $data['id'];

        $conn = getConnection();

        // Eğer öğretmense, sadece kendi öğrencisini silebilir
        if ($user['rutbe'] === 'ogretmen') {
            $stmt = $conn->prepare("SELECT ogretmeni FROM ogrenciler WHERE id = ?");
            $stmt->execute([$userId]);
            $student = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if (!$student) {
                errorResponse('Öğrenci bulunamadı', 404);
            }
            
            // Öğretmen kontrolü - hem ID hem de isim ile kontrol et
            $teacherMatch = false;
            
            // Eğer ogretmeni alanı ID ise
            if (is_numeric($student['ogretmeni']) && $student['ogretmeni'] == $user['id']) {
                $teacherMatch = true;
            }
            // Eğer ogretmeni alanı isim ise
            else if ($student['ogretmeni'] === $user['adi_soyadi']) {
                $teacherMatch = true;
            }
            
            if (!$teacherMatch) {
                errorResponse('Bu öğrenciyi silme yetkiniz yok', 403);
            }
        }

        // İşlemi transaction içinde yap
        $conn->beginTransaction();

        // Önce öğrenci_bilgileri tablosundan sil
        $stmt = $conn->prepare("DELETE FROM ogrenci_bilgileri WHERE ogrenci_id = ?");
        $stmt->execute([$userId]);

        // Sonra ogrenciler tablosundan sil
        $stmt = $conn->prepare("DELETE FROM ogrenciler WHERE id = ?");
        $stmt->execute([$userId]);

        $conn->commit();

        successResponse(['message' => 'Kullanıcı başarıyla silindi']);

    } catch (PDOException $e) {
        if (isset($conn)) {
            $conn->rollBack();
        }
        errorResponse('Veritabanı hatası: ' . $e->getMessage(), 500);
    } catch (Exception $e) {
        if (isset($conn)) {
            $conn->rollBack();
        }
        errorResponse('Beklenmeyen bir hata oluştu: ' . $e->getMessage(), 500);
    }
} else {
    errorResponse('Bu endpoint için sadece POST istekleri kabul edilir', 405);
}
?>