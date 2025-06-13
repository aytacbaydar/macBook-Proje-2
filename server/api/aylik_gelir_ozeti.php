
<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once '../config.php';

try {
    // POST verisinden öğretmen adını al
    $input = json_decode(file_get_contents('php://input'), true);
    $ogretmen_adi = $input['ogretmen_adi'] ?? null;
    
    if (!$ogretmen_adi) {
        throw new Exception('Öğretmen adı belirtilmedi');
    }

    $conn = getConnection();
    
    // Son 12 ayın gelir özetini al (doğru tablo yapısı ile)
    $stmt = $conn->prepare("
        SELECT 
            YEAR(op.odeme_tarihi) as yil,
            MONTH(op.odeme_tarihi) as ay,
            SUM(op.tutar) as toplam_gelir,
            COUNT(*) as odeme_sayisi
        FROM ogrenci_odemeler op
        INNER JOIN ogrenciler o ON op.ogrenci_id = o.id
        WHERE o.ogretmeni = ? 
        AND op.odeme_tarihi >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
        GROUP BY YEAR(op.odeme_tarihi), MONTH(op.odeme_tarihi)
        ORDER BY yil DESC, ay DESC
    ");
    $stmt->execute([$ogretmen_adi]);
    $aylik_gelirler = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Ay isimlerini ekle
    $ay_isimleri = [
        1 => 'Ocak', 2 => 'Şubat', 3 => 'Mart', 4 => 'Nisan',
        5 => 'Mayıs', 6 => 'Haziran', 7 => 'Temmuz', 8 => 'Ağustos',
        9 => 'Eylül', 10 => 'Ekim', 11 => 'Kasım', 12 => 'Aralık'
    ];
    
    foreach ($aylik_gelirler as &$gelir) {
        $gelir['ay_adi'] = $ay_isimleri[$gelir['ay']];
        $gelir['toplam_gelir'] = floatval($gelir['toplam_gelir']);
    }
    
    // Toplam gelir hesapla
    $toplam_gelir = array_sum(array_column($aylik_gelirler, 'toplam_gelir'));
    
    echo json_encode([
        'success' => true,
        'data' => [
            'aylik_gelirler' => $aylik_gelirler,
            'toplam_gelir' => $toplam_gelir,
            'son_12_ay_ortalama' => count($aylik_gelirler) > 0 ? $toplam_gelir / count($aylik_gelirler) : 0
        ]
    ]);
    
} catch (Exception $e) {
    error_log("Aylık gelir özeti hatası: " . $e->getMessage());
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage()
    ]);
}
?>
