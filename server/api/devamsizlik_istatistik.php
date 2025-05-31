
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
        
        // Sadece öğretmenler kendi gruplarının istatistiklerini görebilir
        if ($user['rutbe'] !== 'ogretmen') {
            errorResponse('Bu işlem için yetkiniz yok. Sadece öğretmenler devamsızlık istatistiklerini görebilir.', 403);
        }
        
        $conn = getConnection();
        
        // Parametreleri al
        $grup = $_GET['group'] ?? $_GET['grup'] ?? '';
        $ogrenci_id = $_GET['ogrenci_id'] ?? '';
        $baslangic_tarih = $_GET['baslangic_tarih'] ?? date('Y-01-01'); // Yılın başı
        $bitis_tarih = $_GET['bitis_tarih'] ?? date('Y-12-31'); // Yılın sonu
        
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
        ";
        $conn->exec($createTableSql);
        
        // Temel sorgu
        $sql = "
            SELECT 
                o.id as ogrenci_id,
                o.adi_soyadi,
                o.email,
                o.grubu,
                COUNT(CASE WHEN dk.durum = 'present' THEN 1 END) as katilan_ders_sayisi,
                COUNT(CASE WHEN dk.durum = 'absent' THEN 1 END) as katilmayan_ders_sayisi,
                COUNT(dk.id) as toplam_kayit,
                ROUND(
                    (COUNT(CASE WHEN dk.durum = 'present' THEN 1 END) * 100.0) / 
                    NULLIF(COUNT(dk.id), 0), 2
                ) as katilim_yuzdesi
            FROM ogrenciler o
            LEFT JOIN devamsizlik_kayitlari dk ON o.id = dk.ogrenci_id
            WHERE o.rutbe = 'ogrenci'
            AND dk.ogretmen_id = :ogretmen_id
            AND dk.tarih BETWEEN :baslangic_tarih AND :bitis_tarih
        ";
        
        $params = [
            ':ogretmen_id' => $user['id'],
            ':baslangic_tarih' => $baslangic_tarih,
            ':bitis_tarih' => $bitis_tarih
        ];
        
        // Grup filtresi ekle
        if (!empty($grup)) {
            $sql .= " AND dk.grup = :grup";
            $params[':grup'] = $grup;
        }
        
        // Öğrenci filtresi ekle
        if (!empty($ogrenci_id)) {
            $sql .= " AND o.id = :ogrenci_id";
            $params[':ogrenci_id'] = $ogrenci_id;
        }
        
        $sql .= " GROUP BY o.id, o.adi_soyadi, o.email, o.grubu ORDER BY o.adi_soyadi ASC";
        
        $stmt = $conn->prepare($sql);
        foreach ($params as $key => $value) {
            $stmt->bindValue($key, $value);
        }
        $stmt->execute();
        
        $istatistikler = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        // Genel istatistikler
        $genel_istatistik = [
            'toplam_ogrenci' => count($istatistikler),
            'toplam_katilan_ders' => array_sum(array_column($istatistikler, 'katilan_ders_sayisi')),
            'toplam_katilmayan_ders' => array_sum(array_column($istatistikler, 'katilmayan_ders_sayisi')),
            'ortalama_katilim_yuzdesi' => count($istatistikler) > 0 ? 
                round(array_sum(array_column($istatistikler, 'katilim_yuzdesi')) / count($istatistikler), 2) : 0
        ];
        
        successResponse([
            'ogrenci_istatistikleri' => $istatistikler,
            'genel_istatistik' => $genel_istatistik,
            'tarih_araligi' => [
                'baslangic' => $baslangic_tarih,
                'bitis' => $bitis_tarih
            ]
        ], 'Devamsızlık istatistikleri başarıyla getirildi');
        
    } catch (PDOException $e) {
        error_log("Veritabanı hatası: " . $e->getMessage());
        errorResponse('Devamsızlık istatistikleri getirilemedi: ' . $e->getMessage(), 500);
    } catch (Exception $e) {
        error_log("Genel hata: " . $e->getMessage());
        errorResponse('İşlem sırasında hata: ' . $e->getMessage(), 500);
    }
} else {
    errorResponse('Sadece GET istekleri kabul edilir', 405);
}
?>
