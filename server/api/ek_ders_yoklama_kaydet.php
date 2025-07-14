
<?php
// Türkiye saat dilimini ayarla
date_default_timezone_set('Europe/Istanbul');

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

        // Debug: User bilgilerini logla
        error_log("=== EK DERS YOKLAMA KAYDET DEBUG ===");
        error_log("User bilgileri: " . print_r($user, true));
        error_log("User ID (ogretmen_id): " . ($user['id'] ?? 'YOK'));
        error_log("User Rütbe: " . ($user['rutbe'] ?? 'YOK'));
        error_log("=====================================");

        // Sadece öğretmenler ek ders yoklaması yapabilir
        if ($user['rutbe'] !== 'ogretmen') {
            errorResponse('Bu işlem için yetkiniz yok. Sadece öğretmenler ek ders yoklaması yapabilir.', 403);
        }

        // JSON verisini al
        $input = json_decode(file_get_contents('php://input'), true);

        // Debug: Input verilerini logla
        error_log("Input verisi: " . print_r($input, true));
        error_log("Records sayısı: " . (isset($input['records']) ? count($input['records']) : 'YOK'));

        if (!isset($input['records']) || !is_array($input['records'])) {
            errorResponse('Geçersiz veri formatı. Records dizisi gerekli.', 400);
        }

        $conn = getConnection();

        // Devamsızlık tablosunu oluştur (sadece yoksa)
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
                ders_tipi ENUM('normal', 'ek_ders') DEFAULT 'normal',
                olusturma_zamani TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                guncelleme_zamani TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_ogrenci_id (ogrenci_id),
                INDEX idx_ogretmen_id (ogretmen_id),
                INDEX idx_grup_tarih (grup, tarih),
                INDEX idx_ders_tipi (ders_tipi),
                UNIQUE KEY unique_attendance (ogrenci_id, tarih, grup, ogretmen_id, ders_tipi)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        ";
        $conn->exec($createTableSql);

        // Eğer ders_tipi kolonu yoksa ekle
        $alterTableSql = "
            ALTER TABLE devamsizlik_kayitlari 
            ADD COLUMN IF NOT EXISTS ders_tipi ENUM('normal', 'ek_ders') DEFAULT 'normal' AFTER yontem
        ";
        try {
            $conn->exec($alterTableSql);
        } catch (PDOException $e) {
            // Kolon zaten varsa hata vermez
            error_log("Ders tipi kolonu zaten mevcut veya eklenirken hata: " . $e->getMessage());
        }

        // Transaction başlat
        $conn->beginTransaction();

        $savedCount = 0;
        $errors = [];

        foreach ($input['records'] as $index => $record) {
            try {
                // Debug: Her record için bilgi logla
                error_log("Ek ders record $index işleniyor: " . print_r($record, true));

                // Gerekli alanları kontrol et
                if (!isset($record['ogrenci_id']) || !isset($record['grup']) || 
                    !isset($record['tarih']) || !isset($record['durum'])) {
                    $errors[] = "Eksik veri: ogrenci_id, grup, tarih ve durum gerekli";
                    continue;
                }

                // Öğrencinin varlığını kontrol et
                $studentCheckStmt = $conn->prepare("
                    SELECT id FROM ogrenciler 
                    WHERE id = :ogrenci_id
                ");
                $studentCheckStmt->bindParam(':ogrenci_id', $record['ogrenci_id']);
                $studentCheckStmt->execute();

                if ($studentCheckStmt->rowCount() === 0) {
                    $errors[] = "Öğrenci ID {$record['ogrenci_id']} bulunamadı";
                    continue;
                }

                // Zaman formatını düzenle
                $zaman = isset($record['zaman']) ? 
                    date('Y-m-d H:i:s', strtotime($record['zaman'])) : 
                    date('Y-m-d H:i:s');

                $yontem = isset($record['yontem']) ? $record['yontem'] : 'manual';

                // Ek ders kaydı olarak işaretle
                $stmt = $conn->prepare("
                    INSERT INTO devamsizlik_kayitlari 
                    (ogrenci_id, ogretmen_id, grup, tarih, durum, zaman, yontem, ders_tipi)
                    VALUES (:ogrenci_id, :ogretmen_id, :grup, :tarih, :durum, :zaman, :yontem, 'ek_ders')
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

                // Debug: SQL parametrelerini logla
                error_log("Ek ders SQL Parametreleri:");
                error_log("- ogrenci_id: " . $record['ogrenci_id']);
                error_log("- ogretmen_id: " . $user['id']);
                error_log("- grup: " . $record['grup']);
                error_log("- tarih: " . $record['tarih']);
                error_log("- durum: " . $record['durum']);
                error_log("- ders_tipi: ek_ders");

                $stmt->execute();
                error_log("Ek ders kaydı başarılı - Öğrenci ID: " . $record['ogrenci_id']);
                $savedCount++;

            } catch (PDOException $e) {
                $errors[] = "Ek ders kayıt hatası (öğrenci ID: {$record['ogrenci_id']}): " . $e->getMessage();
                error_log("Ek ders kayıt hatası: " . $e->getMessage());
            }
        }

        if (empty($errors)) {
            $conn->commit();
            successResponse([
                'saved_count' => $savedCount,
                'total_count' => count($input['records']),
                'message' => 'Ek ders yoklama kayıtları başarıyla kaydedildi'
            ], 'Ek ders yoklama kayıtları başarıyla kaydedildi');
        } else {
            $conn->rollBack();
            errorResponse('Ek ders kayıt sırasında hatalar oluştu: ' . implode(', ', $errors), 400);
        }

    } catch (PDOException $e) {
        if (isset($conn)) {
            $conn->rollBack();
        }
        error_log("Veritabanı hatası: " . $e->getMessage());
        errorResponse('Ek ders yoklama kayıtları kaydedilemedi: ' . $e->getMessage(), 500);
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
