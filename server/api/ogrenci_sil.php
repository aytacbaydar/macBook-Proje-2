<?php
// Öğrenci silme API
require_once '../config.php';

// POST istekleri için
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    try {
        // Kullanıcı doğrulama
        $user = authorize();

        // Sadece yöneticiler silme yetkisine sahip
        if ($user['rutbe'] !== 'admin') {
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