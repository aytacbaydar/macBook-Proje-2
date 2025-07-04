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
    $ogrenci_id = $_GET['ogrenci_id'] ?? 0;

    if (!$ogrenci_id) {
        throw new Exception('Öğrenci ID gerekli');
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

    // Öğrencinin tüm sınav sonuçlarını al ve her sınav için katılımcı sayısı ve sıralama bilgisi ekle
    $sql = "SELECT * FROM sinav_sonuclari WHERE ogrenci_id = ? ORDER BY gonderim_tarihi DESC";
    $stmt = $conn->prepare($sql);
    $stmt->execute([$ogrenci_id]);
    $sinavSonuclari = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Her sınav için katılımcı sayısı ve sıralama bilgisi ekle
    foreach ($sinavSonuclari as &$sonuc) {
        // Bu sınava kaç kişi katıldı
        $katilimciSql = "SELECT COUNT(*) as katilimci_sayisi FROM sinav_sonuclari WHERE sinav_id = ?";
        $katilimciStmt = $conn->prepare($katilimciSql);
        $katilimciStmt->execute([$sonuc['sinav_id']]);
        $katilimciResult = $katilimciStmt->fetch(PDO::FETCH_ASSOC);
        $sonuc['katilimci_sayisi'] = (int)$katilimciResult['katilimci_sayisi'];

        // Bu öğrencinin sıralaması (puana göre)
        $siralamaSql = "SELECT COUNT(*) + 1 as siralama FROM sinav_sonuclari 
                       WHERE sinav_id = ? AND puan > ?";
        $siralamaStmt = $conn->prepare($siralamaSql);
        $siralamaStmt->execute([$sonuc['sinav_id'], $sonuc['puan']]);
        $siralamaResult = $siralamaStmt->fetch(PDO::FETCH_ASSOC);
        $sonuc['siralama'] = (int)$siralamaResult['siralama'];
    }

    // İstatistikleri hesapla
    $toplamSinav = count($sinavSonuclari);
    $toplamDogru = array_sum(array_column($sinavSonuclari, 'dogru_sayisi'));
    $toplamYanlis = array_sum(array_column($sinavSonuclari, 'yanlis_sayisi'));
    $toplamBos = array_sum(array_column($sinavSonuclari, 'bos_sayisi'));
    $toplamNet = array_sum(array_column($sinavSonuclari, 'net_sayisi'));

    // Sınav türüne göre grupla
    $sinavTurleri = [];
    foreach ($sinavSonuclari as $sonuc) {
        $tur = $sonuc['sinav_turu'];
        if (!isset($sinavTurleri[$tur])) {
            $sinavTurleri[$tur] = [
                'sinav_sayisi' => 0,
                'toplam_dogru' => 0,
                'toplam_yanlis' => 0,
                'toplam_bos' => 0,
                'toplam_net' => 0,
                'ortalama_yuzde' => 0,
                'sinavlar' => []
            ];
        }

        $sinavTurleri[$tur]['sinav_sayisi']++;
        $sinavTurleri[$tur]['toplam_dogru'] += $sonuc['dogru_sayisi'];
        $sinavTurleri[$tur]['toplam_yanlis'] += $sonuc['yanlis_sayisi'];
        $sinavTurleri[$tur]['toplam_bos'] += $sonuc['bos_sayisi'];
        $sinavTurleri[$tur]['toplam_net'] += $sonuc['net_sayisi'];
        $sinavTurleri[$tur]['sinavlar'][] = $sonuc;
    }

    // Ortalama yüzdeleri hesapla
    foreach ($sinavTurleri as $tur => &$data) {
        if ($data['sinav_sayisi'] > 0) {
            $toplamYuzde = array_sum(array_column($data['sinavlar'], 'yuzde'));
            $data['ortalama_yuzde'] = round($toplamYuzde / $data['sinav_sayisi'], 1);
        }
    }

    echo json_encode([
        'success' => true,
        'data' => [
            'sinav_sonuclari' => $sinavSonuclari,
            'genel_istatistikler' => [
                'toplam_sinav' => $toplamSinav,
                'toplam_dogru' => $toplamDogru,
                'toplam_yanlis' => $toplamYanlis,
                'toplam_bos' => $toplamBos,
                'toplam_net' => round($toplamNet, 2),
                'genel_ortalama' => $toplamSinav > 0 ? round(array_sum(array_column($sinavSonuclari, 'yuzde')) / $toplamSinav, 1) : 0
            ],
            'sinav_turleri' => $sinavTurleri
        ]
    ], JSON_UNESCAPED_UNICODE);

} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage()
    ], JSON_UNESCAPED_UNICODE);
}
?>