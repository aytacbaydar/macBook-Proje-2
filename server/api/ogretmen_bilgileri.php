<?php
// Öğretmen bilgileri API'si
require_once '../config.php';

// GET isteği: Öğretmen bilgilerini getir
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    try {
        // Kullanıcıyı doğrula
        $user = authorize();

        // Sadece öğretmenler kendi bilgilerini görebilir
        if ($user['rutbe'] !== 'ogretmen') {
            errorResponse('Bu bilgilere erişim yetkiniz yok', 403);
        }

        $conn = getConnection();

        // Öğretmen temel bilgilerini getir
        $stmt = $conn->prepare("
            SELECT id, adi_soyadi, email, cep_telefonu, rutbe, aktif, avatar, brans, created_at
            FROM ogrenciler
            WHERE id = :id AND rutbe = 'ogretmen'
        ");
        $stmt->bindParam(':id', $user['id']);
        $stmt->execute();

        if ($stmt->rowCount() === 0) {
            errorResponse('Öğretmen bulunamadı', 404);
        }

        $teacher = $stmt->fetch(PDO::FETCH_ASSOC);

        // Öğretmenin öğrencilerini getir (mükemmel öğrenciler için)
        $stmt = $conn->prepare("
            SELECT o.id, o.adi_soyadi, o.email, o.grubu,
                   COALESCE(AVG(ss.basari_yuzdesi), 0) as ortalama_basari
            FROM ogrenciler o
            LEFT JOIN sinav_sonuclari ss ON o.id = ss.ogrenci_id
            WHERE o.ogretmeni = :teacher_name AND o.rutbe = 'ogrenci' AND o.aktif = 1
            GROUP BY o.id, o.adi_soyadi, o.email, o.grubu
            HAVING ortalama_basari >= 80
            ORDER BY ortalama_basari DESC
            LIMIT 10
        ");
        $stmt->bindParam(':teacher_name', $user['adi_soyadi']);
        $stmt->execute();

        $mukemmelOgrenciler = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Sonucu hazırla
        $result = $teacher;
        $result['mukemmel_ogrenciler'] = $mukemmelOgrenciler;

        // Güvenlik nedeniyle mukemmel_ogrenciler alanını kaldır
        if (isset($result['mukemmel_ogrenciler'])) {
            unset($result['mukemmel_ogrenciler']);
        }

        // Öğretmen bilgilerini döndür
        $response = [
            'success' => true,
            'data' => $result
        ];

        successResponse($response);

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
?>