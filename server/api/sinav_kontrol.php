
<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

require_once '../config.php';

try {
    $sinav_id = $_GET['sinav_id'] ?? 0;
    $ogrenci_id = $_GET['ogrenci_id'] ?? 0;

    if (!$sinav_id || !$ogrenci_id) {
        throw new Exception('Sınav ID ve öğrenci ID gerekli');
    }

    $conn = getConnection();

    // Öğrencinin bu sınavı daha önce çözüp çözmediğini kontrol et
    $checkSQL = "SELECT ss.*, ca.sinav_adi 
                 FROM sinav_sonuclari ss
                 LEFT JOIN cevapAnahtari ca ON ss.sinav_id = ca.id
                 WHERE ss.sinav_id = ? AND ss.ogrenci_id = ?";
    $stmt = $conn->prepare($checkSQL);
    $stmt->execute([$sinav_id, $ogrenci_id]);
    $sinavSonucu = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($sinavSonucu) {
        // Sınav daha önce çözülmüş
        echo json_encode([
            'success' => true,
            'sinav_cozulmus' => true,
            'message' => 'Bu sınavı daha önce çözmüşsünüz.',
            'sonuc' => [
                'sinav_adi' => $sinavSonucu['sinav_adi'],
                'sinav_turu' => $sinavSonucu['sinav_turu'],
                'dogru_sayisi' => $sinavSonucu['dogru_sayisi'],
                'yanlis_sayisi' => $sinavSonucu['yanlis_sayisi'],
                'bos_sayisi' => $sinavSonucu['bos_sayisi'],
                'net_sayisi' => $sinavSonucu['net_sayisi'],
                'puan' => $sinavSonucu['puan'],
                'yuzde' => $sinavSonucu['yuzde'],
                'gonderim_tarihi' => $sinavSonucu['gonderim_tarihi']
            ]
        ], JSON_UNESCAPED_UNICODE);
    } else {
        // Sınav daha önce çözülmemiş
        echo json_encode([
            'success' => true,
            'sinav_cozulmus' => false,
            'message' => 'Sınav çözülebilir.'
        ], JSON_UNESCAPED_UNICODE);
    }

} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage()
    ], JSON_UNESCAPED_UNICODE);
}
?>
