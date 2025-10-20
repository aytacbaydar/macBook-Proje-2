<?php
declare(strict_types=1);

require_once __DIR__ . '/../../config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    errorResponse('Bu endpoint sadece GET isteğini destekler', 405);
}

$user = authorize();
if (!$user) {
    // authorize gerekli HTTP yanıtını döndürür; burası teorik olarak ulaşılmaz.
    exit();
}

$teacherName = trim($user['adi_soyadi'] ?? '');
if ($teacherName === '') {
    errorResponse('Öğretmen bilgisi bulunamadı', 400);
}

try {
    $conn = getConnection();

    $stmt = $conn->prepare("
        SELECT DISTINCT TRIM(ob.grubu) AS grup
        FROM ogrenciler o
        INNER JOIN ogrenci_bilgileri ob ON o.id = ob.ogrenci_id
        WHERE o.rutbe = 'ogrenci'
          AND o.ogretmeni = :teacherName
          AND ob.grubu IS NOT NULL
          AND TRIM(ob.grubu) <> ''
        ORDER BY TRIM(ob.grubu) ASC
    ");
    $stmt->bindParam(':teacherName', $teacherName);
    $stmt->execute();

    $groups = array_column($stmt->fetchAll(PDO::FETCH_ASSOC), 'grup');

    successResponse($groups, 'Öğrenci grupları başarıyla getirildi');
} catch (PDOException $e) {
    errorResponse('Veritabanı hatası: ' . $e->getMessage(), 500);
} catch (Throwable $t) {
    errorResponse('Beklenmeyen hata: ' . $t->getMessage(), 500);
}
