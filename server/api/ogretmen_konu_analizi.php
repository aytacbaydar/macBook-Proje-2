<?php
// Enable error reporting for debugging
error_reporting(E_ALL);
ini_set('display_errors', 1);
ini_set('log_errors', 1);

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

error_log("=== OGRETMEN KONU ANALIZI BAŞLADI ===");
error_log("Request method: " . $_SERVER['REQUEST_METHOD']);
error_log("GET parameters: " . print_r($_GET, true));

try {
    require_once '../config.php';
    error_log("Config dosyası başarıyla yüklendi");
} catch (Exception $e) {
    error_log("Config dosyası yüklenemedi: " . $e->getMessage());
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

    error_log("Konu analizi başlatıldı - Öğretmen ID: " . $ogretmenId);

    // Veritabanı bağlantısını kontrol et
    try {
        if (!isset($conn)) {
            $conn = getConnection();
            error_log("Veritabanı bağlantısı oluşturuldu");
        }
        error_log("Veritabanı bağlantısı mevcut");
    } catch (Exception $e) {
        error_log("Veritabanı bağlantı hatası: " . $e->getMessage());
        errorResponse('Veritabanı bağlantı hatası: ' . $e->getMessage());
        exit();
    }

    // Öğretmenin varlığını kontrol et
    try {
        $stmt = $conn->prepare("SELECT adi_soyadi FROM ogrenciler WHERE id = :ogretmen_id AND rutbe = 'ogretmen'");
        error_log("Öğretmen kontrol sorgusu hazırlandı");
    } catch (Exception $e) {
        error_log("Öğretmen kontrol sorgusu hazırlanamadı: " . $e->getMessage());
        errorResponse('Sorgu hazırlama hatası: ' . $e->getMessage());
        exit();
    }
    try {
        $stmt->bindParam(':ogretmen_id', $ogretmenId);
        error_log("Öğretmen ID parametresi bağlandı: " . $ogretmenId);
        
        $stmt->execute();
        error_log("Öğretmen kontrol sorgusu çalıştırıldı");
        
        $ogretmen = $stmt->fetch(PDO::FETCH_ASSOC);
        error_log("Öğretmen verisi alındı: " . print_r($ogretmen, true));
    } catch (Exception $e) {
        error_log("Öğretmen kontrol sorgusu hatası: " . $e->getMessage());
        errorResponse('Öğretmen kontrol hatası: ' . $e->getMessage());
        exit();
    }

    if (!$ogretmen) {
        error_log("Öğretmen bulunamadı - ID: " . $ogretmenId);
        errorResponse('Öğretmen bulunamadı');
        exit();
    }

    error_log("Öğretmen bulundu - ID: " . $ogretmenId . ", Ad: " . $ogretmen['adi_soyadi']);

    $ogretmenAdi = $ogretmen['adi_soyadi'];

    // Konu analizi sorgusu
    $query = "
        SELECT 
            k.id as konu_id,
            k.konu_adi,
            COUNT(DISTINCT ss.ogrenci_id) as toplam_ogrenci,
            COUNT(DISTINCT CASE WHEN ss.dogru_sayisi > ss.yanlis_sayisi THEN ss.ogrenci_id END) as basarili_ogrenci,
            COUNT(DISTINCT CASE WHEN ss.dogru_sayisi <= ss.yanlis_sayisi THEN ss.ogrenci_id END) as basarisiz_ogrenci,
            ROUND(AVG(CASE 
                WHEN (ss.dogru_sayisi + ss.yanlis_sayisi) > 0 
                THEN (ss.dogru_sayisi * 100.0) / (ss.dogru_sayisi + ss.yanlis_sayisi) 
                ELSE 0 
            END), 2) as ortalama_basari,
            GROUP_CONCAT(
                DISTINCT CASE WHEN ss.dogru_sayisi > ss.yanlis_sayisi 
                THEN o.adi_soyadi 
                END 
                ORDER BY o.adi_soyadi 
                SEPARATOR ', '
            ) as basarili_ogrenciler,
            GROUP_CONCAT(
                DISTINCT CASE WHEN ss.dogru_sayisi <= ss.yanlis_sayisi 
                THEN o.adi_soyadi 
                END 
                ORDER BY o.adi_soyadi 
                SEPARATOR ', '
            ) as basarisiz_ogrenciler
        FROM konular k
        LEFT JOIN sinav_sonuclari ss ON k.id = ss.konu_id
        LEFT JOIN ogrenciler o ON ss.ogrenci_id = o.id
        WHERE k.ogretmen_id = :ogretmen_id
        GROUP BY k.id, k.konu_adi
        HAVING COUNT(DISTINCT ss.ogrenci_id) > 0
        ORDER BY ortalama_basari DESC
    ";

    try {
        error_log("Ana konu analizi sorgusu hazırlanıyor...");
        $stmt = $conn->prepare($query);
        error_log("Ana sorgu hazırlandı");
        
        $stmt->bindParam(':ogretmen_id', $ogretmenId);
        error_log("Parametreler bağlandı");
        
        $stmt->execute();
        error_log("Ana sorgu çalıştırıldı");
    } catch (Exception $e) {
        error_log("Ana sorgu hatası: " . $e->getMessage());
        error_log("SQL Query: " . $query);
        errorResponse('Ana sorgu hatası: ' . $e->getMessage());
        exit();
    }

    $konuAnalizleri = [];
    
    try {
        error_log("Sonuçlar işleniyor...");
        $rowCount = 0;
        
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            $rowCount++;
            error_log("Row " . $rowCount . " işleniyor: " . print_r($row, true));
        $konuAnalizleri[] = [
            'konu_id' => intval($row['konu_id']),
            'konu_adi' => $row['konu_adi'],
            'toplam_ogrenci' => intval($row['toplam_ogrenci']),
            'basarili_ogrenci' => intval($row['basarili_ogrenci']),
            'basarisiz_ogrenci' => intval($row['basarisiz_ogrenci']),
            'ortalama_basari' => floatval($row['ortalama_basari']),
            'basarili_ogrenciler' => $row['basarili_ogrenciler'] ? explode(', ', $row['basarili_ogrenciler']) : [],
            'basarisiz_ogrenciler' => $row['basarisiz_ogrenciler'] ? explode(', ', $row['basarisiz_ogrenciler']) : []
        ];
        }
        
        error_log("Toplam " . $rowCount . " row işlendi");
    } catch (Exception $e) {
        error_log("Sonuç işleme hatası: " . $e->getMessage());
        errorResponse('Sonuç işleme hatası: ' . $e->getMessage());
        exit();
    }

    error_log("Konu analizi başarılı - toplam konu: " . count($konuAnalizleri));

    successResponse([
        'konu_analizleri' => $konuAnalizleri
    ], 'Konu analizi başarıyla getirildi');

} catch (Exception $e) {
    error_log("=== GENEL HATA ===");
    error_log("Hata mesajı: " . $e->getMessage());
    error_log("Hata dosyası: " . $e->getFile());
    error_log("Hata satırı: " . $e->getLine());
    error_log("Stack trace: " . $e->getTraceAsString());
    error_log("=== HATA SONU ===");
    
    errorResponse('Sistem hatası: ' . $e->getMessage() . ' (Satır: ' . $e->getLine() . ')');
}
?>