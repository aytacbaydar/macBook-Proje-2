
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
    // Token kontrolü
    $headers = getallheaders();
    $authHeader = $headers['Authorization'] ?? '';
    
    if (strpos($authHeader, 'Bearer ') !== 0) {
        throw new Exception('Geçersiz token formatı');
    }
    
    $token = substr($authHeader, 7);
    
    // Token'dan kullanıcı bilgilerini al
    $stmt = $pdo->prepare("SELECT * FROM kullanicilar WHERE token = ?");
    $stmt->execute([$token]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$user || $user['rutbe'] !== 'ogretmen') {
        throw new Exception('Yetkisiz erişim');
    }
    
    // Son 12 ayın gelir özetini al
    $stmt = $pdo->prepare("
        SELECT 
            YEAR(odeme_tarihi) as yil,
            MONTH(odeme_tarihi) as ay,
            SUM(tutar) as toplam_gelir,
            COUNT(*) as odeme_sayisi
        FROM odemeler o
        INNER JOIN kullanicilar k ON o.ogrenci_id = k.id
        WHERE k.ogretmeni = ? 
        AND odeme_tarihi >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
        GROUP BY YEAR(odeme_tarihi), MONTH(odeme_tarihi)
        ORDER BY yil DESC, ay DESC
    ");
    $stmt->execute([$user['adi_soyadi']]);
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
    
    // Toplam gelir
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
