
<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

include_once '../config.php';

try {
    $ogrenci_id = $_GET['ogrenci_id'] ?? null;
    $hafta_sayisi = $_GET['hafta_sayisi'] ?? 4; // Son 4 hafta

    if (!$ogrenci_id) {
        throw new Exception('Öğrenci ID gerekli');
    }

    // Son N hafta için performans verilerini çek
    $stmt = $pdo->prepare("
        SELECT 
            WEEK(d.tarih) as hafta,
            YEAR(d.tarih) as yil,
            DATE(DATE_SUB(d.tarih, INTERVAL WEEKDAY(d.tarih) DAY)) as hafta_baslangic,
            COUNT(d.id) as katilim_sayisi,
            COUNT(CASE WHEN d.durum = 'var' THEN 1 END) as gelen_gun,
            COUNT(CASE WHEN d.durum = 'yok' THEN 1 END) as gelmeyen_gun,
            ROUND((COUNT(CASE WHEN d.durum = 'var' THEN 1 END) / COUNT(d.id)) * 100, 1) as basari_orani
        FROM devamsizlik d
        WHERE d.ogrenci_id = :ogrenci_id 
        AND d.tarih >= DATE_SUB(CURDATE(), INTERVAL :hafta_sayisi WEEK)
        GROUP BY WEEK(d.tarih), YEAR(d.tarih)
        ORDER BY yil DESC, hafta DESC
        LIMIT :hafta_sayisi
    ");
    
    $stmt->bindParam(':ogrenci_id', $ogrenci_id, PDO::PARAM_INT);
    $stmt->bindParam(':hafta_sayisi', $hafta_sayisi, PDO::PARAM_INT);
    $stmt->execute();
    
    $performans_verileri = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Hafta isimlerini Türkçe formatla
    foreach ($performans_verileri as &$veri) {
        $hafta_tarihi = new DateTime($veri['hafta_baslangic']);
        $veri['hafta_adi'] = $hafta_tarihi->format('d M') . ' - ' . 
                            $hafta_tarihi->modify('+6 days')->format('d M');
    }
    
    // Bu haftanın verilerini de ekle
    $stmt_bu_hafta = $pdo->prepare("
        SELECT 
            COUNT(CASE WHEN d.durum = 'var' THEN 1 END) as bu_hafta_katilim,
            COUNT(d.id) as bu_hafta_toplam
        FROM devamsizlik d
        WHERE d.ogrenci_id = :ogrenci_id 
        AND WEEK(d.tarih) = WEEK(CURDATE())
        AND YEAR(d.tarih) = YEAR(CURDATE())
    ");
    $stmt_bu_hafta->bindParam(':ogrenci_id', $ogrenci_id, PDO::PARAM_INT);
    $stmt_bu_hafta->execute();
    $bu_hafta = $stmt_bu_hafta->fetch(PDO::FETCH_ASSOC);

    echo json_encode([
        'success' => true,
        'data' => [
            'haftalik_performans' => array_reverse($performans_verileri), // Chronological order
            'bu_hafta' => $bu_hafta,
            'toplam_hafta' => count($performans_verileri)
        ]
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Haftalık performans verileri alınırken hata: ' . $e->getMessage()
    ]);
}
?>
