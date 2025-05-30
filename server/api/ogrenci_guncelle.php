<?php
// Avatar yükleme API'si
require_once '../config.php';

// Sadece POST isteklerine izin ver
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    errorResponse('Sadece POST metoduna izin verilmektedir', 405);
}

try {
    // Kullanıcıyı doğrula
    $user = authorize();
    
    // Upload klasörünü kontrol et ve oluştur
    $uploadDir = '../../avatar/';
    if (!file_exists($uploadDir)) {
        if (!mkdir($uploadDir, 0755, true)) {
            errorResponse('Upload dizini oluşturulamadı', 500);
        }
    }
    
    // Öğrenci ID'sini al
    $studentId = isset($_POST['id']) ? intval($_POST['id']) : $user['id'];
    
    // Admin olmayan kullanıcılar sadece kendi avatarlarını değiştirebilirler
    if ($user['rutbe'] !== 'admin' && $studentId !== $user['id']) {
        errorResponse('Bu öğrencinin bilgilerini değiştirme yetkiniz yok', 403);
    }
    
    // Dosya geldi mi kontrol et
    if (!isset($_FILES['avatar']) || $_FILES['avatar']['error'] !== UPLOAD_ERR_OK) {
        errorResponse('Dosya yüklenirken bir hata oluştu', 400);
    }
    
    // Dosya türünü kontrol et
    $allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
    $fileType = $_FILES['avatar']['type'];
    
    if (!in_array($fileType, $allowedTypes)) {
        errorResponse('Sadece JPEG, PNG ve GIF dosyaları yüklenebilir', 400);
    }
    
    // Dosya boyutunu kontrol et (8MB max)
    $maxFileSize = 8 * 1024 * 1024; // 8MB
    if ($_FILES['avatar']['size'] > $maxFileSize) {
        errorResponse('Dosya boyutu en fazla 8MB olabilir', 400);
    }
    
    // Dosya adını oluştur
    $fileExtension = pathinfo($_FILES['avatar']['name'], PATHINFO_EXTENSION);
    $newFileName = 'avatar_' . $studentId . '_' . time() . '.' . $fileExtension;
    $targetPath = $uploadDir . $newFileName;
    
    // Dosyayı taşı
    if (!move_uploaded_file($_FILES['avatar']['tmp_name'], $targetPath)) {
        errorResponse('Dosya kaydedilirken bir hata oluştu', 500);
    }
    
    // Veritabanında avatar alanını güncelle
    $conn = getConnection();
    $stmt = $conn->prepare("UPDATE ogrenciler SET avatar = :avatar WHERE id = :id");
    
    $avatarPath = 'avatar/' . $newFileName;
    $stmt->bindParam(':avatar', $avatarPath);
    $stmt->bindParam(':id', $studentId);
    $stmt->execute();
    
    // Yanıt döndür
    successResponse(['avatar' => $avatarPath], 'Avatar başarıyla güncellendi');
    
} catch (PDOException $e) {
    errorResponse('Veritabanı hatası: ' . $e->getMessage(), 500);
} catch (Exception $e) {
    errorResponse('Beklenmeyen bir hata oluştu: ' . $e->getMessage(), 500);
}
<?php
// Öğrenci güncelleme API'si
require_once '../config.php';

// POST isteği: Öğrenci bilgilerini güncelle
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

        // Temel bilgiler
        if (isset($data['adi_soyadi'])) {
            $updateFields[] = "adi_soyadi = :adi_soyadi";
            $params[':adi_soyadi'] = $data['adi_soyadi'];
        }

        if (isset($data['email'])) {
            $updateFields[] = "email = :email";
            $params[':email'] = $data['email'];
        }

        if (isset($data['cep_telefonu'])) {
            $updateFields[] = "cep_telefonu = :cep_telefonu";
            $params[':cep_telefonu'] = $data['cep_telefonu'];
        }

        if (isset($data['rutbe'])) {
            $updateFields[] = "rutbe = :rutbe";
            $params[':rutbe'] = $data['rutbe'];
        }

        if (isset($data['aktif'])) {
            $updateFields[] = "aktif = :aktif";
            $params[':aktif'] = $data['aktif'] ? 1 : 0;
        }

        // Eğitim bilgileri
        if (isset($data['okulu'])) {
            $updateFields[] = "okulu = :okulu";
            $params[':okulu'] = $data['okulu'];
        }

        if (isset($data['sinifi'])) {
            $updateFields[] = "sinifi = :sinifi";
            $params[':sinifi'] = $data['sinifi'];
        }

        if (isset($data['grubu'])) {
            $updateFields[] = "grubu = :grubu";
            $params[':grubu'] = $data['grubu'];
        }

        if (isset($data['ders_gunu'])) {
            $updateFields[] = "ders_gunu = :ders_gunu";
            $params[':ders_gunu'] = $data['ders_gunu'];
        }

        if (isset($data['ders_saati'])) {
            $updateFields[] = "ders_saati = :ders_saati";
            $params[':ders_saati'] = $data['ders_saati'];
        }

        if (isset($data['ucret'])) {
            $updateFields[] = "ucret = :ucret";
            $params[':ucret'] = $data['ucret'];
        }

        // Branş (öğretmenler için)
        if (isset($data['brans'])) {
            $updateFields[] = "brans = :brans";
            $params[':brans'] = $data['brans'];
        }

        // Şifre güncelleme (eğer verilmişse)
        if (isset($data['sifre']) && !empty($data['sifre'])) {
            $updateFields[] = "sifre = :sifre";
            $params[':sifre'] = password_hash($data['sifre'], PASSWORD_DEFAULT);
        }

        // Güncelleme sorgusu
        if (!empty($updateFields)) {
            $sql = "UPDATE ogrenciler SET " . implode(', ', $updateFields) . " WHERE id = :id";
            $stmt = $conn->prepare($sql);
            $stmt->execute($params);

            // Güncel kullanıcı verilerini getir
            $stmt = $conn->prepare("
                SELECT id, adi_soyadi, email, cep_telefonu, rutbe, aktif, brans, avatar, created_at,
                       okulu, sinifi, grubu, ders_gunu, ders_saati, ucret
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
?>
