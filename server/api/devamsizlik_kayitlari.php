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

        // Yetki kontrolü - öğretmenler tüm grupları, öğrenciler sadece kendi kayıtlarını görebilir
        if ($user['rutbe'] !== 'ogretmen' && $user['rutbe'] !== 'ogrenci') {
            errorResponse('Bu işlem için yetkiniz yok.', 403);
        }

        // Öğrenci sadece kendi kayıtlarını görebilir
        if ($user['rutbe'] === 'ogrenci') {
            $ogrenci_id = $user['id']; // Öğrenci kendi ID'sini kullanır
        }

        $conn = getConnection();

        // Parametreleri al
        $grup = $_GET['group'] ?? $_GET['grup'] ?? '';
        $tarih = $_GET['tarih'] ?? '';
        $baslangic_tarih = $_GET['baslangic_tarih'] ?? '';
        $bitis_tarih = $_GET['bitis_tarih'] ?? '';
        $ders_tipi = $_GET['ders_tipi'] ?? ''; // 'normal', 'ek_ders' veya boş (hepsi)
        $ogrenci_id = $_GET['ogrenci_id'] ?? ''; // Belirli bir öğrencinin kayıtları
        $butun_kayitlar = $_GET['butun_kayitlar'] ?? ''; // Tüm kayıtları getir

        // Grup parametresi sadece öğretmenler için gerekli
        if ($user['rutbe'] === 'ogretmen' && empty($grup) && empty($ogrenci_id)) {
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
                ders_tipi ENUM('normal', 'ek_ders', 'etut_dersi') DEFAULT 'normal',
                olusturma_zamani TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                guncelleme_zamani TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (ogrenci_id) REFERENCES ogrenciler(id) ON DELETE CASCADE,
                FOREIGN KEY (ogretmen_id) REFERENCES ogrenciler(id) ON DELETE CASCADE,
                UNIQUE KEY unique_attendance (ogrenci_id, tarih, grup)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        ";
        $conn->exec($createTableSql);

        // Ana devamsızlık kayıtları sorgusu - hem normal hem ek ders kayıtlarını getir
        $sql = "
            SELECT dk.*, o.adi_soyadi, o.email, o.avatar
            FROM devamsizlik_kayitlari dk
            LEFT JOIN ogrenciler o ON dk.ogrenci_id = o.id
            WHERE 1=1
        ";

        $params = [];

        // Öğrenci kendi kayıtlarını görüyorsa sadece kendi ID'si ile filtrele
        if (!empty($ogrenci_id)) {
            $sql .= " AND dk.ogrenci_id = :ogrenci_id";
            $params[':ogrenci_id'] = $ogrenci_id;
        } else {
            // Öğretmen kendi gruplarının kayıtlarını görüyor
            $sql .= " AND dk.ogretmen_id = :ogretmen_id";
            $params[':ogretmen_id'] = $user['id'];
            
            if (!empty($grup)) {
                $sql .= " AND dk.grup = :grup";
                $params[':grup'] = $grup;
            }
        }

        // Ders tipi filtresi ekle
        if (!empty($ders_tipi)) {
            $sql .= " AND dk.ders_tipi = :ders_tipi";
            $params[':ders_tipi'] = $ders_tipi;
        }

        // Tarih filtresi ekle
        if (!empty($tarih)) {
            $sql .= " AND dk.tarih = :tarih";
            $params[':tarih'] = $tarih;
        } elseif (!empty($baslangic_tarih) && !empty($bitis_tarih)) {
            $sql .= " AND dk.tarih BETWEEN :baslangic_tarih AND :bitis_tarih";
            $params[':baslangic_tarih'] = $baslangic_tarih;
            $params[':bitis_tarih'] = $bitis_tarih;
        }

        $sql .= " ORDER BY dk.tarih DESC, dk.ders_tipi ASC, o.adi_soyadi ASC";

        // LIMIT kontrolü - herhangi bir LIMIT olup olmadığını kontrol et
        if (strpos(strtoupper($sql), 'LIMIT') !== false) {
            error_log("UYARI: SQL sorgusunda LIMIT bulundu: " . $sql);
        }

        // Tüm kayıtları getirmek için LIMIT yok
        error_log("Executing SQL: " . $sql);
        error_log("Parameters: " . json_encode($params));
        error_log("Grup: " . $grup . ", Ogretmen ID: " . $user['id']);

        $stmt = $conn->prepare($sql);
        foreach ($params as $key => $value) {
            $stmt->bindValue($key, $value);
        }
        $stmt->execute();

        $records = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Toplam kayıt sayısını ayrıca kontrol et
        $countSql = "
            SELECT COUNT(*) as toplam_kayit
            FROM devamsizlik_kayitlari dk
            WHERE 1=1
        ";

        $countParams = [];

        // Öğrenci kendi kayıtlarını görüyorsa
        if (!empty($ogrenci_id)) {
            $countSql .= " AND dk.ogrenci_id = :ogrenci_id";
            $countParams[':ogrenci_id'] = $ogrenci_id;
        } else {
            // Öğretmen kendi gruplarının kayıtlarını görüyor
            $countSql .= " AND dk.ogretmen_id = :ogretmen_id";
            $countParams[':ogretmen_id'] = $user['id'];
            
            if (!empty($grup)) {
                $countSql .= " AND dk.grup = :grup";
                $countParams[':grup'] = $grup;
            }
        }

        // Tarih filtresi varsa count sorgusuna da ekle
        if (!empty($tarih)) {
            $countSql .= " AND dk.tarih = :tarih";
            $countParams[':tarih'] = $tarih;
        } elseif (!empty($baslangic_tarih) && !empty($bitis_tarih)) {
            $countSql .= " AND dk.tarih BETWEEN :baslangic_tarih AND :bitis_tarih";
            $countParams[':baslangic_tarih'] = $baslangic_tarih;
            $countParams[':bitis_tarih'] = $bitis_tarih;
        }

        $countStmt = $conn->prepare($countSql);
        foreach ($countParams as $key => $value) {
            $countStmt->bindValue($key, $value);
        }
        $countStmt->execute();
        $totalCount = $countStmt->fetch(PDO::FETCH_ASSOC)['toplam_kayit'];

        error_log("Toplam veritabanında kayıt sayısı: " . $totalCount);
        error_log("Döndürülen kayıt sayısı: " . count($records));

        // Tarihlere göre grupla
        $groupedByDate = [];
        foreach ($records as $record) {
            $date = $record['tarih'];
            if (!isset($groupedByDate[$date])) {
                $groupedByDate[$date] = [
                    'tarih' => $date,
                    'gun_adi' => date('l', strtotime($date)),
                    'katilan_sayisi' => 0,
                    'katilmayan_sayisi' => 0,
                    'ogrenciler' => []
                ];
            }

            $groupedByDate[$date]['ogrenciler'][] = $record;

            if ($record['durum'] === 'present') {
                $groupedByDate[$date]['katilan_sayisi']++;
            } else {
                $groupedByDate[$date]['katilmayan_sayisi']++;
            }
        }

        successResponse([
            'kayitlar' => $records,
            'tarihlere_gore' => array_values($groupedByDate),
            'toplam_kayit' => count($records)
        ], 'Devamsızlık kayıtları başarıyla getirildi');

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