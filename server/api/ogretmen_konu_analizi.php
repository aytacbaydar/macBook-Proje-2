
<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

try {
    require_once '../config.php';
} catch (Exception $e) {
    echo json_encode(['success' => false, 'error' => 'Config dosyası hatası: ' . $e->getMessage()]);
    exit();
}

function errorResponse($message) {
    echo json_encode(['success' => false, 'message' => $message]);
}

function successResponse($data, $message = '') {
    echo json_encode(['success' => true, 'data' => $data, 'message' => $message]);
}

try {
    if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
        errorResponse('Sadece GET istekleri kabul edilir');
        exit();
    }

    $ogretmenId = isset($_GET['ogretmen_id']) ? intval($_GET['ogretmen_id']) : 0;

    if (!$ogretmenId) {
        errorResponse('Öğretmen ID gerekli');
        exit();
    }

    // Veritabanı bağlantısını kontrol et
    try {
        if (!isset($conn)) {
            $conn = getConnection();
        }
    } catch (Exception $e) {
        errorResponse('Veritabanı bağlantı hatası: ' . $e->getMessage());
        exit();
    }

    // Öğretmenin varlığını kontrol et
    try {
        $stmt = $conn->prepare("SELECT adi_soyadi FROM ogrenciler WHERE id = :ogretmen_id AND rutbe = 'ogretmen'");
        $stmt->bindParam(':ogretmen_id', $ogretmenId);
        $stmt->execute();
        $ogretmen = $stmt->fetch(PDO::FETCH_ASSOC);
    } catch (Exception $e) {
        errorResponse('Öğretmen kontrol hatası: ' . $e->getMessage());
        exit();
    }

    if (!$ogretmen) {
        errorResponse('Öğretmen bulunamadı');
        exit();
    }

    $ogretmenAdi = $ogretmen['adi_soyadi'];

    // Konu analizi sorgusu
    $query = "
        SELECT 
            k.id as konu_id,
            k.konu_adi,
            COUNT(DISTINCT ss.ogrenci_id) as toplam_ogrenci,
            COUNT(DISTINCT CASE WHEN (ss.dogru_sayisi * 100.0) / (ss.dogru_sayisi + ss.yanlis_sayisi) >= 80 THEN ss.ogrenci_id END) as mukemmel_ogrenci,
            COUNT(DISTINCT CASE WHEN (ss.dogru_sayisi * 100.0) / (ss.dogru_sayisi + ss.yanlis_sayisi) >= 60 AND (ss.dogru_sayisi * 100.0) / (ss.dogru_sayisi + ss.yanlis_sayisi) < 80 THEN ss.ogrenci_id END) as iyi_ogrenci,
            COUNT(DISTINCT CASE WHEN (ss.dogru_sayisi * 100.0) / (ss.dogru_sayisi + ss.yanlis_sayisi) >= 40 AND (ss.dogru_sayisi * 100.0) / (ss.dogru_sayisi + ss.yanlis_sayisi) < 60 THEN ss.ogrenci_id END) as orta_ogrenci,
            COUNT(DISTINCT CASE WHEN (ss.dogru_sayisi * 100.0) / (ss.dogru_sayisi + ss.yanlis_sayisi) < 40 THEN ss.ogrenci_id END) as kotu_ogrenci,
            ROUND(AVG(CASE 
                WHEN (ss.dogru_sayisi + ss.yanlis_sayisi) > 0 
                THEN (ss.dogru_sayisi * 100.0) / (ss.dogru_sayisi + ss.yanlis_sayisi) 
                ELSE 0 
            END), 2) as ortalama_basari,
            COUNT(DISTINCT ss.ogrenci_id) as cevaplayan_ogrenci
        FROM konular k
        LEFT JOIN sinav_sonuclari ss ON k.id = ss.konu_id
        WHERE k.ogretmen_id = :ogretmen_id
        GROUP BY k.id, k.konu_adi
        HAVING COUNT(DISTINCT ss.ogrenci_id) > 0
        ORDER BY ortalama_basari DESC
    ";

    try {
        $stmt = $conn->prepare($query);
        $stmt->bindParam(':ogretmen_id', $ogretmenId);
        $stmt->execute();
    } catch (Exception $e) {
        errorResponse('Ana sorgu hatası: ' . $e->getMessage());
        exit();
    }

    $konuAnalizleri = [];
    
    try {
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            // Her konu için öğrenci detaylarını al
            $konuId = $row['konu_id'];
            
            // Mükemmel öğrencileri getir (80-100%)
            $mukemmelQuery = "
                SELECT DISTINCT o.adi_soyadi 
                FROM sinav_sonuclari ss 
                JOIN ogrenciler o ON ss.ogrenci_id = o.id 
                WHERE ss.konu_id = :konu_id 
                AND (ss.dogru_sayisi * 100.0) / (ss.dogru_sayisi + ss.yanlis_sayisi) >= 80
                ORDER BY o.adi_soyadi
            ";
            $mukemmelStmt = $conn->prepare($mukemmelQuery);
            $mukemmelStmt->bindParam(':konu_id', $konuId);
            $mukemmelStmt->execute();
            $mukemmelOgrenciler = $mukemmelStmt->fetchAll(PDO::FETCH_COLUMN);

            // İyi öğrencileri getir (60-79%)
            $iyiQuery = "
                SELECT DISTINCT o.adi_soyadi 
                FROM sinav_sonuclari ss 
                JOIN ogrenciler o ON ss.ogrenci_id = o.id 
                WHERE ss.konu_id = :konu_id 
                AND (ss.dogru_sayisi * 100.0) / (ss.dogru_sayisi + ss.yanlis_sayisi) >= 60
                AND (ss.dogru_sayisi * 100.0) / (ss.dogru_sayisi + ss.yanlis_sayisi) < 80
                ORDER BY o.adi_soyadi
            ";
            $iyiStmt = $conn->prepare($iyiQuery);
            $iyiStmt->bindParam(':konu_id', $konuId);
            $iyiStmt->execute();
            $iyiOgrenciler = $iyiStmt->fetchAll(PDO::FETCH_COLUMN);

            // Orta öğrencileri getir (40-59%)
            $ortaQuery = "
                SELECT DISTINCT o.adi_soyadi 
                FROM sinav_sonuclari ss 
                JOIN ogrenciler o ON ss.ogrenci_id = o.id 
                WHERE ss.konu_id = :konu_id 
                AND (ss.dogru_sayisi * 100.0) / (ss.dogru_sayisi + ss.yanlis_sayisi) >= 40
                AND (ss.dogru_sayisi * 100.0) / (ss.dogru_sayisi + ss.yanlis_sayisi) < 60
                ORDER BY o.adi_soyadi
            ";
            $ortaStmt = $conn->prepare($ortaQuery);
            $ortaStmt->bindParam(':konu_id', $konuId);
            $ortaStmt->execute();
            $ortaOgrenciler = $ortaStmt->fetchAll(PDO::FETCH_COLUMN);

            // Kötü öğrencileri getir (0-39%)
            $kotuQuery = "
                SELECT DISTINCT o.adi_soyadi 
                FROM sinav_sonuclari ss 
                JOIN ogrenciler o ON ss.ogrenci_id = o.id 
                WHERE ss.konu_id = :konu_id 
                AND (ss.dogru_sayisi * 100.0) / (ss.dogru_sayisi + ss.yanlis_sayisi) < 40
                ORDER BY o.adi_soyadi
            ";
            $kotuStmt = $conn->prepare($kotuQuery);
            $kotuStmt->bindParam(':konu_id', $konuId);
            $kotuStmt->execute();
            $kotuOgrenciler = $kotuStmt->fetchAll(PDO::FETCH_COLUMN);

            $konuAnalizleri[] = [
                'konu_id' => intval($row['konu_id']),
                'konu_adi' => $row['konu_adi'],
                'toplam_ogrenci' => intval($row['toplam_ogrenci']),
                'cevaplayan_ogrenci' => intval($row['cevaplayan_ogrenci']),
                'ortalama_basari' => floatval($row['ortalama_basari']),
                'mukemmel_ogrenciler' => array_map(function($name) {
                    return ['adi_soyadi' => $name];
                }, $mukemmelOgrenciler),
                'iyi_ogrenciler' => array_map(function($name) {
                    return ['adi_soyadi' => $name];
                }, $iyiOgrenciler),
                'orta_ogrenciler' => array_map(function($name) {
                    return ['adi_soyadi' => $name];
                }, $ortaOgrenciler),
                'kotu_ogrenciler' => array_map(function($name) {
                    return ['adi_soyadi' => $name];
                }, $kotuOgrenciler)
            ];
        }
    } catch (Exception $e) {
        errorResponse('Sonuç işleme hatası: ' . $e->getMessage());
        exit();
    }

    successResponse([
        'konu_analizleri' => $konuAnalizleri
    ], 'Konu analizi başarıyla getirildi');

} catch (Exception $e) {
    errorResponse('Sistem hatası: ' . $e->getMessage());
}
?>
