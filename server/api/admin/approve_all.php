<?php
// Tüm bekleyen kullanıcıları onaylayan API
require_once '../config.php';

// POST istekleri için
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    try {
        // Kullanıcı doğrulama
        $user = authorize();

        // Sadece yöneticiler onay yetkisine sahip
        if ($user['rutbe'] !== 'admin') {
            errorResponse('Bu işlemi yapmaya yetkiniz yok', 403);
        }

        $conn = getConnection();

        // İşlemi transaction içinde yap
        $conn->beginTransaction();

        // Bekleyen kullanıcıları al
        $stmt = $conn->prepare("SELECT * FROM kullanicilar WHERE aktif = 0 AND (rutbe IS NULL OR rutbe = '' OR rutbe = 'belirtilmemis')");
        $stmt->execute();
        $bekleyenKullanicilar = $stmt->fetchAll(PDO::FETCH_ASSOC);
        $onaylananSayisi = count($bekleyenKullanicilar);

        if ($onaylananSayisi > 0) {
            // Tüm bekleyen kullanıcıları onayla
            $stmt = $conn->prepare("UPDATE kullanicilar SET aktif = 1, rutbe = 'ogrenci' WHERE aktif = 0 AND (rutbe IS NULL OR rutbe = '' OR rutbe = 'belirtilmemis')");
            $stmt->execute();

            $conn->commit();

            successResponse([
                'message' => 'Tüm bekleyen kullanıcılar başarıyla onaylandı',
                'count' => $onaylananSayisi
            ]);
        } else {
            $conn->rollBack();
            successResponse([
                'message' => 'Onaylanacak bekleyen kullanıcı bulunamadı',
                'count' => 0
            ]);
        }

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