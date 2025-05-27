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
