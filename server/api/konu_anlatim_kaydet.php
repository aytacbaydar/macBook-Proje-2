
<?php
// Konu anlatım dosyası yükleme API'si
require_once '../config.php';

// CORS başlıkları
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    try {
        // Kullanıcıyı doğrula
        $user = authorize();
        
        // Sadece yöneticiler ve öğretmenler dosya yükleyebilir
        if ($user['rutbe'] !== 'admin' && $user['rutbe'] !== 'ogretmen') {
            errorResponse('Bu işlemi gerçekleştirme yetkiniz yok', 403);
        }

        // Dosya yüklendi mi kontrol et
        if (!isset($_FILES['pdf_file']) || $_FILES['pdf_file']['error'] !== UPLOAD_ERR_OK) {
            errorResponse('PDF dosyası yüklenmedi veya hata oluştu', 400);
        }

        $file = $_FILES['pdf_file'];
        
        // Dosya türü kontrolü
        $allowedTypes = ['application/pdf'];
        $fileType = mime_content_type($file['tmp_name']);
        
        if (!in_array($fileType, $allowedTypes)) {
            errorResponse('Sadece PDF dosyaları yüklenebilir', 400);
        }

        // Dosya boyutu kontrolü (50MB)
        $maxSize = 50 * 1024 * 1024; // 50MB
        if ($file['size'] > $maxSize) {
            errorResponse('Dosya boyutu 50MB\'dan küçük olmalıdır', 400);
        }

        // Yükleme klasörünü oluştur
        $uploadDir = '../uploads/lessons/';
        if (!file_exists($uploadDir)) {
            mkdir($uploadDir, 0755, true);
        }

        // Dosya adını güvenli hale getir
        $fileName = preg_replace('/[^a-zA-Z0-9\-_\.]/', '_', $file['name']);
        $fileExtension = pathinfo($fileName, PATHINFO_EXTENSION);
        $baseName = pathinfo($fileName, PATHINFO_FILENAME);
        
        // Benzersiz dosya adı oluştur
        $newFileName = $baseName . '_' . time() . '.' . $fileExtension;
        $targetPath = $uploadDir . $newFileName;
        
        // Dosyayı taşı
        if (!move_uploaded_file($file['tmp_name'], $targetPath)) {
            errorResponse('Dosya kaydedilirken bir hata oluştu', 500);
        }

        // Veritabanına kaydet
        $conn = getConnection();
        $stmt = $conn->prepare("
            INSERT INTO konu_anlatim (
                dosya_adi, dosya_yolu, yukleyen_id, baslik, aciklama, created_at
            ) VALUES (
                :dosya_adi, :dosya_yolu, :yukleyen_id, :baslik, :aciklama, NOW()
            )
        ");
        
        $stmt->execute([
            ':dosya_adi' => $newFileName,
            ':dosya_yolu' => 'uploads/lessons/' . $newFileName,
            ':yukleyen_id' => $user['id'],
            ':baslik' => $_POST['baslik'] ?? $baseName,
            ':aciklama' => $_POST['aciklama'] ?? ''
        ]);

        $lessonId = $conn->lastInsertId();

        successResponse([
            'id' => $lessonId,
            'dosya_adi' => $newFileName,
            'dosya_yolu' => 'uploads/lessons/' . $newFileName
        ], 'Konu anlatım dosyası başarıyla yüklendi');

    } catch (PDOException $e) {
        errorResponse('Veritabanı hatası: ' . $e->getMessage(), 500);
    } catch (Exception $e) {
        errorResponse('Beklenmeyen bir hata oluştu: ' . $e->getMessage(), 500);
    }
} else {
    errorResponse('Bu endpoint sadece POST metodunu destekler', 405);
}
?>
