<?php
// Kullanıcı güncelleme API'si
require_once '../config.php';

// POST isteği: Kullanıcı bilgilerini güncelle
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    try {
        // Kullanıcıyı doğrula
        $user = authorize();

        // Sadece yöneticiler başka kullanıcıları düzenleyebilir
        if ($user['rutbe'] !== 'admin') {
            errorResponse('Bu işlem için yetkiniz yok', 403);
        }

        // JSON verisini al
        $data = json_decode(file_get_contents('php://input'), true);

        if (!isset($data['id']) || !is_numeric($data['id'])) {
            errorResponse('Geçerli bir kullanıcı ID\'si gereklidir', 400);
        }

        $userId = intval($data['id']);
        $conn = getConnection();

        // Kullanıcıyı kontrol et
        $stmt = $conn->prepare("SELECT id FROM ogrenciler WHERE id = :id");
        $stmt->bindParam(':id', $userId);
        $stmt->execute();

        if ($stmt->rowCount() === 0) {
            errorResponse('Kullanıcı bulunamadı', 404);
        }

        // Güncellenecek alanları belirle
        $updateFields = [];
        $params = [':id' => $userId];

        // Rütbe güncelleme
        if (isset($data['rutbe']) && in_array($data['rutbe'], ['admin', 'ogretmen', 'ogrenci'])) {
            $updateFields[] = "rutbe = :rutbe";
            $params[':rutbe'] = $data['rutbe'];
        }

        // Aktiflik durumu güncelleme
        if (isset($data['aktif'])) {
            $updateFields[] = "aktif = :aktif";
            $params[':aktif'] = $data['aktif'] ? 1 : 0;
        }

        // Güncelleme sorgusu
        if (!empty($updateFields)) {
            $sql = "UPDATE ogrenciler SET " . implode(', ', $updateFields) . " WHERE id = :id";
            $stmt = $conn->prepare($sql);
            $stmt->execute($params);

            // Güncel kullanıcı verilerini getir
            $stmt = $conn->prepare("
                SELECT id, adi_soyadi, email, cep_telefonu, rutbe, aktif, avatar, created_at 
                FROM ogrenciler 
                WHERE id = :id
            ");
            $stmt->bindParam(':id', $userId);
            $stmt->execute();

            $updatedUser = $stmt->fetch(PDO::FETCH_ASSOC);

            successResponse($updatedUser, 'Kullanıcı başarıyla güncellendi');
        } else {
            errorResponse('Güncellenecek veri bulunamadı', 400);
        }

    } catch (PDOException $e) {
        errorResponse('Veritabanı hatası: ' . $e->getMessage(), 500);
    } catch (Exception $e) {
        errorResponse('Beklenmeyen bir hata oluştu: ' . $e->getMessage(), 500);
    }
} else {
    errorResponse('Bu endpoint sadece POST metodunu desteklemektedir', 405);
}