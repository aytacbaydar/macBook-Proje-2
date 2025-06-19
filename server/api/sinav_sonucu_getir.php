
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
    
    // Sınav sonuçları tablosunu oluştur (eğer yoksa)
    $createTableSQL = "
        CREATE TABLE IF NOT EXISTS sinav_sonuclari (
            id INT AUTO_INCREMENT PRIMARY KEY,
            sinav_id INT NOT NULL,
            ogrenci_id INT NOT NULL,
            sinav_adi VARCHAR(255) NOT NULL,
            sinav_turu VARCHAR(50) NOT NULL,
            soru_sayisi INT NOT NULL,
            dogru_sayisi INT NOT NULL DEFAULT 0,
            yanlis_sayisi INT NOT NULL DEFAULT 0,
            bos_sayisi INT NOT NULL DEFAULT 0,
            net_sayisi DECIMAL(5,2) NOT NULL DEFAULT 0,
            puan DECIMAL(6,2) NOT NULL DEFAULT 0,
            yuzde DECIMAL(5,2) NOT NULL DEFAULT 0,
            gonderim_tarihi TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            guncelleme_tarihi TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_sinav_ogrenci (sinav_id, ogrenci_id),
            INDEX idx_ogrenci_id (ogrenci_id),
            INDEX idx_sinav_turu (sinav_turu),
            INDEX idx_gonderim_tarihi (gonderim_tarihi),
            UNIQUE KEY unique_sinav_ogrenci (sinav_id, ogrenci_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ";
    
    $conn->exec($createTableSQL);
    
    // Önceden hesaplanmış sonuçları al
    $sonucSQL = "SELECT * FROM sinav_sonuclari WHERE sinav_id = ? AND ogrenci_id = ?";
    $sonucStmt = $conn->prepare($sonucSQL);
    $sonucStmt->execute([$sinav_id, $ogrenci_id]);
    $sinavSonucu = $sonucStmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$sinavSonucu) {
        throw new Exception('Bu sınav için sonuç bulunamadı');
    }
    
    // Detaylı analiz için öğrenci cevaplarını ve cevap anahtarını al
    $ogrenciSQL = "SELECT cevaplar FROM sinav_cevaplari WHERE sinav_id = ? AND ogrenci_id = ?";
    $ogrenciStmt = $conn->prepare($ogrenciSQL);
    $ogrenciStmt->execute([$sinav_id, $ogrenci_id]);
    $ogrenciData = $ogrenciStmt->fetch(PDO::FETCH_ASSOC);
    
    $cevapAnahtariSQL = "SELECT cevaplar FROM cevapAnahtari WHERE id = ?";
    $cevapStmt = $conn->prepare($cevapAnahtariSQL);
    $cevapStmt->execute([$sinav_id]);
    $cevapAnahtari = $cevapStmt->fetch(PDO::FETCH_ASSOC);
    
    $detaylar = [];
    if ($ogrenciData && $cevapAnahtari) {
        $ogrenciCevaplari = json_decode($ogrenciData['cevaplar'], true);
        $dogruCevaplar = json_decode($cevapAnahtari['cevaplar'], true);
        
        for ($i = 1; $i <= $sinavSonucu['soru_sayisi']; $i++) {
            $ogrenciCevap = $ogrenciCevaplari["soru{$i}"] ?? '';
            $dogruCevap = $dogruCevaplar["ca{$i}"] ?? '';
            
            $durum = '';
            if (empty($ogrenciCevap)) {
                $durum = 'bos';
            } elseif ($ogrenciCevap === $dogruCevap) {
                $durum = 'dogru';
            } else {
                $durum = 'yanlis';
            }
            
            $detaylar["soru{$i}"] = [
                'ogrenci_cevap' => $ogrenciCevap,
                'dogru_cevap' => $dogruCevap,
                'durum' => $durum
            ];
        }
    }
    
    $sonuc = [
        'sinav_id' => (int)$sinavSonucu['sinav_id'],
        'ogrenci_id' => (int)$sinavSonucu['ogrenci_id'],
        'sinav_adi' => $sinavSonucu['sinav_adi'],
        'sinav_turu' => $sinavSonucu['sinav_turu'],
        'soru_sayisi' => (int)$sinavSonucu['soru_sayisi'],
        'dogru_sayisi' => (int)$sinavSonucu['dogru_sayisi'],
        'yanlis_sayisi' => (int)$sinavSonucu['yanlis_sayisi'],
        'bos_sayisi' => (int)$sinavSonucu['bos_sayisi'],
        'net_sayisi' => (float)$sinavSonucu['net_sayisi'],
        'puan' => (float)$sinavSonucu['puan'],
        'yuzde' => (float)$sinavSonucu['yuzde'],
        'detaylar' => $detaylar,
        'gonderim_tarihi' => $sinavSonucu['gonderim_tarihi']
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
