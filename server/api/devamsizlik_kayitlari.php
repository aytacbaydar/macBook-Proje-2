
<?php
// Hataları dosyaya logla
ini_set('display_errors', 0);
ini_set('display_startup_errors', 0);
error_reporting(E_ALL);
ini_set('log_errors', 0);
ini_set('error_log', '../../php_errors.log');

// CORS başlıkları
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Content-Type: application/json; charset=UTF-8");

// OPTIONS isteğini yönet (preflight)
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require '../config.php';

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    try {
        // Kullanıcıyı doğrula
        $user = authorize();
        
        // Sadece öğretmenler kendi gruplarının devamsızlık kayıtlarını görebilir
        if ($user['rutbe'] !== 'ogretmen') {
            errorResponse('Bu işlem için yetkiniz yok. Sadece öğretmenler devamsızlık kayıtlarını görebilir.', 403);
        }
        
        $conn = getConnection();
        
        // Parametreleri al
        $grup = $_GET['grup'] ?? '';
        $tarih = $_GET['tarih'] ?? date('Y-m-d');
        
        if (empty($grup)) {
            errorResponse('Grup parametresi gerekli', 400);
        }
        
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
                FOREIGN KEY (ogretmen_id) REFERENCES ogrenciler(id) ON DELETE CASCADE,
                UNIQUE KEY unique_attendance (ogrenci_id, tarih, grup)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        ";gretmenler(id) ON DELETE CASCADE,
                UNIQUE KEY unique_attendance (ogrenci_id, tarih, grup)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        ";
        $conn->exec($createTableSql);
        
        // Devamsızlık kayıtlarını getir
        $stmt = $conn->prepare("
            SELECT dk.*, o.adi_soyadi, o.email
            FROM devamsizlik_kayitlari dk
            LEFT JOIN ogrenciler o ON dk.ogrenci_id = o.id
            WHERE dk.ogretmen_id = :ogretmen_id 
            AND dk.grup = :grup 
            AND dk.tarih = :tarih
            ORDER BY o.adi_soyadi ASC
        ");
        $stmt->bindParam(':ogretmen_id', $user['id']);
        $stmt->bindParam(':grup', $grup);
        $stmt->bindParam(':tarih', $tarih);
        $stmt->execute();
        
        $records = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        successResponse($records, 'Devamsızlık kayıtları başarıyla getirildi');
        
    } catch (PDOException $e) {
        error_log("Veritabanı hatası: " . $e->getMessage());
        errorResponse('Devamsızlık kayıtları getirilemedi: ' . $e->getMessage(), 500);
    } catch (Exception $e) {
        error_log("Genel hata: " . $e->getMessage());
        errorResponse('İşlem sırasında hata: ' . $e->getMessage(), 500);
    }
} else {
    errorResponse('Sadece GET istekleri kabul edilir', 405);
}
?>
