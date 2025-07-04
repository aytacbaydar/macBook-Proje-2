
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

    // Basit sorgu ile öğrencinin tüm sınav sonuçlarını al
    $sql = "SELECT 
                ss.id,
                ss.sinav_id, 
                ss.ogrenci_id,
                ss.sinav_adi,
                ss.sinav_turu,
                ss.soru_sayisi,
                ss.dogru_sayisi,
                ss.yanlis_sayisi,
                ss.bos_sayisi,
                ss.net_sayisi,
                ss.puan,
                ss.yuzde,
                ss.gonderim_tarihi,
                ss.guncelleme_tarihi
            FROM sinav_sonuclari ss
            WHERE ss.ogrenci_id = ?
            ORDER BY ss.gonderim_tarihi DESC";
    
    $stmt = $conn->prepare($sql);
    $stmt->execute([$ogrenci_id]);
    $allResults = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Duplicate kayıtları manuel olarak temizle (aynı sinav_id için en son olanı tut)
    $uniqueResults = [];
    $seenSinavIds = [];
    
    foreach ($allResults as $result) {
        $sinavId = $result['sinav_id'];
        
        if (!in_array($sinavId, $seenSinavIds)) {
            $seenSinavIds[] = $sinavId;
            $uniqueResults[] = $result;
        }
    }

    // Her sınav için katılımcı sayısı ve sıralama bilgisi ekle
    foreach ($uniqueResults as &$sonuc) {
        // Bu sınava kaç kişi katıldı
        $katilimciSql = "SELECT COUNT(DISTINCT ogrenci_id) as katilimci_sayisi FROM sinav_sonuclari WHERE sinav_id = ?";
        $katilimciStmt = $conn->prepare($katilimciSql);
        $katilimciStmt->execute([$sonuc['sinav_id']]);
        $katilimciResult = $katilimciStmt->fetch(PDO::FETCH_ASSOC);
        $sonuc['katilimci_sayisi'] = (int)$katilimciResult['katilimci_sayisi'];

        // Bu öğrencinin sıralaması (puana göre)
        $siralamaSql = "SELECT COUNT(DISTINCT ogrenci_id) + 1 as siralama 
                       FROM sinav_sonuclari 
                       WHERE sinav_id = ? AND puan > ?";
        $siralamaStmt = $conn->prepare($siralamaSql);
        $siralamaStmt->execute([$sonuc['sinav_id'], $sonuc['puan']]);
        $siralamaResult = $siralamaStmt->fetch(PDO::FETCH_ASSOC);
        $sonuc['siralama'] = (int)$siralamaResult['siralama'];
    }

    // İstatistikleri hesapla
    $toplamSinav = count($uniqueResults);
    $toplamDogru = array_sum(array_column($uniqueResults, 'dogru_sayisi'));
    $toplamYanlis = array_sum(array_column($uniqueResults, 'yanlis_sayisi'));
    $toplamBos = array_sum(array_column($uniqueResults, 'bos_sayisi'));
    $toplamNet = array_sum(array_column($uniqueResults, 'net_sayisi'));

    // Sınav türüne göre grupla
    $sinavTurleri = [];
    foreach ($uniqueResults as $sonuc) {
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
            'sinav_sonuclari' => $uniqueResults,
            'genel_istatistikler' => [
                'toplam_sinav' => $toplamSinav,
                'toplam_dogru' => $toplamDogru,
                'toplam_yanlis' => $toplamYanlis,
                'toplam_bos' => $toplamBos,
                'toplam_net' => round($toplamNet, 2),
                'genel_ortalama' => $toplamSinav > 0 ? round(array_sum(array_column($uniqueResults, 'yuzde')) / $toplamSinav, 1) : 0
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
