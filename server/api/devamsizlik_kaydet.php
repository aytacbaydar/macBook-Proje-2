
<?php
// Hataları dosyaya logla
ini_set('display_errors', 0);
ini_set('display_startup_errors', 0);
error_reporting(E_ALL);
ini_set('log_errors', 0);
ini_set('error_log', '../../php_errors.log');

// CORS başlıkları
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Content-Type: application/json; charset=UTF-8");

// OPTIONS isteğini yönet (preflight)
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require '../config.php';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    try {
        // Kullanıcıyı doğrula
        $user = authorize();
        
        // Sadece öğretmenler devamsızlık kaydı yapabilir
        if ($user['rutbe'] !== 'ogretmen') {
            errorResponse('Bu işlem için yetkiniz yok. Sadece öğretmenler devamsızlık kaydı yapabilir.', 403);
        }
        
        // JSON verisini al
        $input = json_decode(file_get_contents('php://input'), true);
        
        if (!isset($input['records']) || !is_array($input['records'])) {
            errorResponse('Geçersiz veri formatı. Records dizisi gerekli.', 400);
        }
        
        $conn = getConnection();
        
        // Devamsızlık tablosunu oluştur (yoksa)
        $createTableSql = "
            CREATE TABLE IF NOT EXISTS devamsizlik_kayitlari (
                id INT AUTO_INCREMENT PRIMARY KEY,
                ogrenci_id INT NOT NULL,
                ogretmen_id INT NOT NULL,
                grup VARCHAR(100) NOT NULL,
                tarih DATE NOT NULL,
                durum ENUM('present', 'absent') NOT NULL,
                zaman DATETIME NOT NULL,
                yontem ENUM('manual', 'qr') DEFAULT 'manual',
                olusturma_zamani TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                guncelleme_zamani TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (ogrenci_id) REFERENCES ogrenciler(id) ON DELETE CASCADE,
                FOREIGN KEY (ogretmen_id) REFERENCES ogretmenler(id) ON DELETE CASCADE,
                UNIQUE KEY unique_attendance (ogrenci_id, tarih, grup)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        ";
        $conn->exec($createTableSql);
        
        // Transaction başlat
        $conn->beginTransaction();
        
        $savedCount = 0;
        $errors = [];
        
        foreach ($input['records'] as $record) {
            try {
                // Gerekli alanları kontrol et
                if (!isset($record['ogrenci_id']) || !isset($record['grup']) || 
                    !isset($record['tarih']) || !isset($record['durum'])) {
                    $errors[] = "Eksik veri: ogrenci_id, grup, tarih ve durum gerekli";
                    continue;
                }
                
                // Öğrencinin bu öğretmene ait olduğunu kontrol et
                $studentCheckStmt = $conn->prepare("
                    SELECT id FROM ogrenciler 
                    WHERE id = :ogrenci_id AND ogretmeni = :ogretmen_id
                ");
                $studentCheckStmt->bindParam(':ogrenci_id', $record['ogrenci_id']);
                $studentCheckStmt->bindParam(':ogretmen_id', $user['id']);
                $studentCheckStmt->execute();
                
                if ($studentCheckStmt->rowCount() === 0) {
                    $errors[] = "Öğrenci ID {$record['ogrenci_id']} size ait değil";
                    continue;
                }
                
                // Zaman formatını düzenle
                $zaman = isset($record['zaman']) ? 
                    date('Y-m-d H:i:s', strtotime($record['zaman'])) : 
                    date('Y-m-d H:i:s');
                
                $yontem = isset($record['yontem']) ? $record['yontem'] : 'manual';
                
                // Insert veya Update yap
                $stmt = $conn->prepare("
                    INSERT INTO devamsizlik_kayitlari 
                    (ogrenci_id, ogretmen_id, grup, tarih, durum, zaman, yontem)
                    VALUES (:ogrenci_id, :ogretmen_id, :grup, :tarih, :durum, :zaman, :yontem)
                    ON DUPLICATE KEY UPDATE
                    durum = VALUES(durum),
                    zaman = VALUES(zaman),
                    yontem = VALUES(yontem),
                    guncelleme_zamani = CURRENT_TIMESTAMP
                ");
                
                $stmt->bindParam(':ogrenci_id', $record['ogrenci_id']);
                $stmt->bindParam(':ogretmen_id', $user['id']);
                $stmt->bindParam(':grup', $record['grup']);
                $stmt->bindParam(':tarih', $record['tarih']);
                $stmt->bindParam(':durum', $record['durum']);
                $stmt->bindParam(':zaman', $zaman);
                $stmt->bindParam(':yontem', $yontem);
                
                $stmt->execute();
                $savedCount++;
                
            } catch (PDOException $e) {
                $errors[] = "Kayıt hatası (öğrenci ID: {$record['ogrenci_id']}): " . $e->getMessage();
            }
        }
        
        if (empty($errors)) {
            $conn->commit();
            successResponse([
                'saved_count' => $savedCount,
                'total_count' => count($input['records'])
            ], 'Devamsızlık kayıtları başarıyla kaydedildi');
        } else {
            $conn->rollBack();
            errorResponse('Kayıt sırasında hatalar oluştu: ' . implode(', ', $errors), 400);
        }
        
    } catch (PDOException $e) {
        if (isset($conn)) {
            $conn->rollBack();
        }
        error_log("Veritabanı hatası: " . $e->getMessage());
        errorResponse('Devamsızlık kayıtları kaydedilemedi: ' . $e->getMessage(), 500);
    } catch (Exception $e) {
        if (isset($conn)) {
            $conn->rollBack();
        }
        error_log("Genel hata: " . $e->getMessage());
        errorResponse('İşlem sırasında hata: ' . $e->getMessage(), 500);
    }
} else {
    errorResponse('Sadece POST istekleri kabul edilir', 405);
}
?>
