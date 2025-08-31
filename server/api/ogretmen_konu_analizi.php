<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

require_once '../config.php';

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

    // Öğretmenin varlığını kontrol et
    $stmt = $conn->prepare("SELECT adi_soyadi FROM ogrenciler WHERE id = :ogretmen_id AND rutbe = 'ogretmen'");
    $stmt->bindParam(':ogretmen_id', $ogretmenId);
    $stmt->execute();

    $ogretmen = $stmt->fetch(PDO::FETCH_ASSOC);

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

    $stmt = $conn->prepare($query);
    $stmt->bindParam(':ogretmen_id', $ogretmenId);
    $stmt->execute();

    $konuAnalizleri = [];

    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
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

    error_log("Konu analizi başarılı - toplam konu: " . count($konuAnalizleri));

    successResponse([
        'konu_analizleri' => $konuAnalizleri
    ], 'Konu analizi başarıyla getirildi');

} catch (Exception $e) {
    error_log("Konu analizi hatası: " . $e->getMessage());
    errorResponse('Veritabanı hatası: ' . $e->getMessage());
}
?>