<?php
// Admin API'si
require_once '../config.php';

// GET isteği: Tüm kullanıcıları getir
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    try {
        // Admin yetkisini kontrol et
        $user = authorizeAdmin();

        $conn = getConnection();

        // Tüm kullanıcıları getir
        $stmt = $conn->prepare("
            SELECT o.id, o.adi_soyadi, o.email, o.cep_telefonu, o.rutbe, o.aktif, o.avatar,
                   o.created_at, ob.*
            FROM ogrenciler o
            LEFT JOIN ogrenci_bilgileri ob ON o.id = ob.ogrenci_id
            ORDER BY o.id DESC
        ");
        $stmt->execute();

        $users = [];
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            // Bilgiler nesnesini oluştur
            $bilgiler = array_filter([
                'okulu' => $row['okulu'] ?? null,
                'sinifi' => $row['sinifi'] ?? null,
                'brans' => $row['brans'] ?? null,
                'kayit_tarihi' => $row['kayit_tarihi'] ?? null,
                'grubu' => $row['grubu'] ?? null,
                'ders_gunu' => $row['ders_gunu'] ?? null,
                'ders_saati' => $row['ders_saati'] ?? null,
                'ucret' => $row['ucret'] ?? null,
                'veli_adi' => $row['veli_adi'] ?? null,
                'veli_cep' => $row['veli_cep'] ?? null
            ], function($value) {
                return $value !== null;
            });

            // Ana kullanıcı nesnesini oluştur
            $user = [
                'id' => $row['id'],
                'adi_soyadi' => $row['adi_soyadi'],
                'email' => $row['email'],
                'cep_telefonu' => $row['cep_telefonu'],
                'rutbe' => $row['rutbe'],
                'aktif' => (bool)$row['aktif'],
                'avatar' => $row['avatar'],
                'created_at' => $row['created_at']
            ];

            // Bilgiler varsa ekle
            if (!empty($bilgiler)) {
                $user['bilgiler'] = $bilgiler;
            }

            $users[] = $user;
        }

        successResponse($users);

    } catch (PDOException $e) {
        errorResponse('Veritabanı hatası: ' . $e->getMessage(), 500);
    } catch (Exception $e) {
        errorResponse('Beklenmeyen bir hata oluştu: ' . $e->getMessage(), 500);
    }
}
// POST isteği: Yeni kullanıcı oluştur
else if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // Admin yetkisini kontrol et
    authorizeAdmin();

    // register.php'yi çağır
    require_once 'register.php';
}
// DELETE isteği: Kullanıcıyı sil
else if ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
    try {
        // Admin yetkisini kontrol et
        $admin = authorizeAdmin();
        
        // URL'den ID parametresini al
        $requestUri = $_SERVER['REQUEST_URI'];
        $parts = explode('/', $requestUri);
        $studentId = intval(end($parts));
        
        if (!$studentId) {
            errorResponse('Geçerli bir öğrenci ID\'si belirtilmelidir');
        }
        
        // Admin kendisini silemez
        if ($studentId === $admin['id']) {
            errorResponse('Kendi hesabınızı silemezsiniz', 403);
        }
        
        $conn = getConnection();
        
        // Önce öğrenciyi kontrol et
        $stmt = $conn->prepare("SELECT id FROM ogrenciler WHERE id = :id");
        $stmt->bindParam(':id', $studentId);
        $stmt->execute();
        
        if ($stmt->rowCount() === 0) {
            errorResponse('Öğrenci bulunamadı', 404);
        }
        
        // İşlemi transaction içinde yap
        $conn->beginTransaction();
        
        // Önce öğrenci detaylarını sil (foreign key constraint nedeniyle)
        $stmt = $conn->prepare("DELETE FROM ogrenci_bilgileri WHERE ogrenci_id = :id");
        $stmt->bindParam(':id', $studentId);
        $stmt->execute();
        
        // Sonra öğrenciyi sil
        $stmt = $conn->prepare("DELETE FROM ogrenciler WHERE id = :id");
        $stmt->bindParam(':id', $studentId);
        $stmt->execute();
        
        $conn->commit();
        
        successResponse(null, 'Öğrenci başarıyla silindi');
        
    }  catch (PDOException $e) {
        if (isset($conn) && $conn->inTransaction()) {
            $conn->rollBack();
        }
        errorResponse('Veritabanı hatası: ' . $e->getMessage(), 500);
    } catch (Exception $e) {
        if (isset($conn) && $conn->inTransaction()) {
            $conn->rollBack();
        }
        errorResponse('Beklenmeyen bir hata oluştu: ' . $e->getMessage(), 500);
    }
}
// Diğer HTTP metodlarını reddet
else {
    errorResponse('Bu endpoint sadece GET, POST ve DELETE metodlarını desteklemektedir', 405);
}
?>