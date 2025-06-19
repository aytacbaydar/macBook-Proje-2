
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
    
    // Öğrenci cevaplarını al
    $ogrenciSQL = "SELECT * FROM sinav_cevaplari WHERE sinav_id = ? AND ogrenci_id = ?";
    $ogrenciStmt = $conn->prepare($ogrenciSQL);
    $ogrenciStmt->execute([$sinav_id, $ogrenci_id]);
    $ogrenciData = $ogrenciStmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$ogrenciData) {
        throw new Exception('Bu sınav için cevap bulunamadı');
    }
    
    // Cevap anahtarını al
    $cevapAnahtariSQL = "SELECT cevaplar FROM cevap_anahtarlari WHERE id = ?";
    $cevapStmt = $conn->prepare($cevapAnahtariSQL);
    $cevapStmt->execute([$sinav_id]);
    $cevapAnahtari = $cevapStmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$cevapAnahtari) {
        throw new Exception('Cevap anahtarı bulunamadı');
    }
    
    $ogrenciCevaplari = json_decode($ogrenciData['cevaplar'], true);
    $dogruCevaplar = json_decode($cevapAnahtari['cevaplar'], true);
    
    // Analiz yap
    $dogru_sayisi = 0;
    $yanlis_sayisi = 0;
    $bos_sayisi = 0;
    $detaylar = [];
    
    for ($i = 1; $i <= $ogrenciData['soru_sayisi']; $i++) {
        $ogrenciCevap = $ogrenciCevaplari["soru{$i}"] ?? '';
        $dogruCevap = $dogruCevaplar["ca{$i}"] ?? '';
        
        $durum = '';
        if (empty($ogrenciCevap)) {
            $durum = 'bos';
            $bos_sayisi++;
        } elseif ($ogrenciCevap === $dogruCevap) {
            $durum = 'dogru';
            $dogru_sayisi++;
        } else {
            $durum = 'yanlis';
            $yanlis_sayisi++;
        }
        
        $detaylar["soru{$i}"] = [
            'ogrenci_cevap' => $ogrenciCevap,
            'dogru_cevap' => $dogruCevap,
            'durum' => $durum
        ];
    }
    
    // Puan hesaplama (doğru sayısı - yanlış sayısı/4)
    $puan = $dogru_sayisi - ($yanlis_sayisi / 4);
    $puan = max(0, $puan); // Negatif olamaz
    
    // Yüzde hesaplama
    $yuzde = ($dogru_sayisi / $ogrenciData['soru_sayisi']) * 100;
    
    $sonuc = [
        'sinav_id' => (int)$sinav_id,
        'ogrenci_id' => (int)$ogrenci_id,
        'sinav_adi' => $ogrenciData['sinav_adi'],
        'sinav_turu' => $ogrenciData['sinav_turu'],
        'soru_sayisi' => (int)$ogrenciData['soru_sayisi'],
        'dogru_sayisi' => $dogru_sayisi,
        'yanlis_sayisi' => $yanlis_sayisi,
        'bos_sayisi' => $bos_sayisi,
        'puan' => round($puan, 2),
        'yuzde' => round($yuzde, 1),
        'detaylar' => $detaylar,
        'gonderim_tarihi' => $ogrenciData['gonderim_tarihi']
    ];
    
    echo json_encode([
        'success' => true,
        'data' => $sonuc
    ], JSON_UNESCAPED_UNICODE);
    
} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage()
    ], JSON_UNESCAPED_UNICODE);
}
?>
