
<?php
require_once '../config.php';

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    try {
        // Kullanıcıyı doğrula
        $user = authorize();

        // Sadece öğretmenler ek ders yoklaması listesini görebilir
        if ($user['rutbe'] !== 'ogretmen') {
            errorResponse('Bu işlem için yetkiniz yok.', 403);
        }

        $ogretmen_id = $user['id'];
        $tarih = $_GET['tarih'] ?? date('Y-m-d');

        // Ek ders yoklama kayıtlarını getir
        $sql = "SELECT edy.*, o.adi_soyadi as ogrenci_adi, o.grubu
                FROM ek_ders_yoklama edy
                JOIN ogrenciler o ON edy.ogrenci_id = o.id
                WHERE edy.ogretmen_id = :ogretmen_id 
                AND edy.ders_tarihi = :tarih
                ORDER BY o.adi_soyadi";

        $stmt = $conn->prepare($sql);
        $stmt->execute([
            ':ogretmen_id' => $ogretmen_id,
            ':tarih' => $tarih
        ]);

        $kayitlar = $stmt->fetchAll(PDO::FETCH_ASSOC);

        successResponse($kayitlar);

    } catch (Exception $e) {
        errorResponse('Sunucu hatası: ' . $e->getMessage(), 500);
    }
} else {
    errorResponse('Sadece GET istekleri kabul edilir', 405);
}
?>
