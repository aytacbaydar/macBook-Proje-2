<?php
// Hata raporlamayı etkinleştir
error_reporting(E_ALL);
ini_set('display_errors', 1);
ini_set('log_errors', 1);

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

require_once '../config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    echo json_encode([
        'success' => false,
        'message' => 'Sadece GET istekleri kabul edilir'
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

try {
    $conn = getConnection();

    $ogrenci_id = $_GET['ogrenci_id'] ?? null;

    if (!$ogrenci_id) {
        throw new Exception('Öğrenci ID gerekli');
    }

    // Öğrencinin tüm sınav cevaplarını ve konu bilgilerini al
    $sql = "
        SELECT sc.cevaplar, sc.soru_konulari, sc.sinav_id, sc.sinav_adi, sc.sinav_turu,
               ca.cevaplar as dogru_cevaplar
        FROM sinav_cevaplari sc
        LEFT JOIN cevapAnahtari ca ON sc.sinav_id = ca.id
        WHERE sc.ogrenci_id = ?
        ORDER BY sc.gonderim_tarihi DESC
    ";

    $stmt = $conn->prepare($sql);
    $stmt->execute([$ogrenci_id]);
    $sinavlar = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Yapay zeka testlerini de al
    $yapay_zeka_sql = "
        SELECT yzt.id, yzt.test_adi, yzt.sorular, yzt.sonuc, yzt.tamamlanma_tarihi
        FROM yapay_zeka_testler yzt
        WHERE yzt.ogrenci_id = ? AND yzt.sonuc IS NOT NULL AND yzt.tamamlanma_tarihi IS NOT NULL
        ORDER BY yzt.tamamlanma_tarihi DESC
    ";

    $yapay_zeka_stmt = $conn->prepare($yapay_zeka_sql);
    $yapay_zeka_stmt->execute([$ogrenci_id]);
    $yapay_zeka_testler = $yapay_zeka_stmt->fetchAll(PDO::FETCH_ASSOC);

    $konu_istatistikleri = [];

    // Normal sınavları işle
    foreach ($sinavlar as $sinav) {
        $ogrenci_cevaplar = json_decode($sinav['cevaplar'], true);
        $soru_konulari = json_decode($sinav['soru_konulari'], true);
        $dogru_cevaplar = json_decode($sinav['dogru_cevaplar'], true);

        if (!$soru_konulari || !$dogru_cevaplar) continue;

        foreach ($soru_konulari as $soru_key => $konu_adi) {
            if (empty($konu_adi)) continue;

            $soru_no = str_replace('soru', '', $soru_key);
            $ogrenci_cevap = $ogrenci_cevaplar[$soru_key] ?? '';
            $dogru_cevap = $dogru_cevaplar["ca{$soru_no}"] ?? '';

            // Konu istatistiklerini başlat
            if (!isset($konu_istatistikleri[$konu_adi])) {
                $konu_istatistikleri[$konu_adi] = [
                    'konu_adi' => $konu_adi,
                    'toplam_soru' => 0,
                    'dogru_sayisi' => 0,
                    'yanlis_sayisi' => 0,
                    'bos_sayisi' => 0,
                    'basari_orani' => 0,
                    'sinavlar' => []
                ];
            }

            $konu_istatistikleri[$konu_adi]['toplam_soru']++;

            // Sinav bilgisini ekle
            if (!in_array($sinav['sinav_adi'], $konu_istatistikleri[$konu_adi]['sinavlar'])) {
                $konu_istatistikleri[$konu_adi]['sinavlar'][] = $sinav['sinav_adi'];
            }

            if (empty($ogrenci_cevap)) {
                $konu_istatistikleri[$konu_adi]['bos_sayisi']++;
            } elseif ($ogrenci_cevap === $dogru_cevap) {
                $konu_istatistikleri[$konu_adi]['dogru_sayisi']++;
            } else {
                $konu_istatistikleri[$konu_adi]['yanlis_sayisi']++;
            }
        }
    }

    // Yapay zeka testlerini işle
    foreach ($yapay_zeka_testler as $test) {
        $sorular = json_decode($test['sorular'], true);
        $sonuc = json_decode($test['sonuc'], true);
        
        if (!$sorular || !$sonuc || !isset($sonuc['details'])) continue;

        foreach ($sonuc['details'] as $detay) {
            if (!isset($detay['soru']) || !isset($detay['soru']['konu_adi'])) continue;
            
            $konu_adi = $detay['soru']['konu_adi'];
            $is_correct = $detay['is_correct'] ?? false;
            $user_answer = $detay['user_answer'] ?? '';

            // Konu istatistiklerini başlat
            if (!isset($konu_istatistikleri[$konu_adi])) {
                $konu_istatistikleri[$konu_adi] = [
                    'konu_adi' => $konu_adi,
                    'toplam_soru' => 0,
                    'dogru_sayisi' => 0,
                    'yanlis_sayisi' => 0,
                    'bos_sayisi' => 0,
                    'basari_orani' => 0,
                    'sinavlar' => []
                ];
            }

            $konu_istatistikleri[$konu_adi]['toplam_soru']++;

            // Test bilgisini ekle
            $test_adi = $test['test_adi'] . ' (YZ)';
            if (!in_array($test_adi, $konu_istatistikleri[$konu_adi]['sinavlar'])) {
                $konu_istatistikleri[$konu_adi]['sinavlar'][] = $test_adi;
            }

            if (empty($user_answer)) {
                $konu_istatistikleri[$konu_adi]['bos_sayisi']++;
            } elseif ($is_correct) {
                $konu_istatistikleri[$konu_adi]['dogru_sayisi']++;
            } else {
                $konu_istatistikleri[$konu_adi]['yanlis_sayisi']++;
            }
        }
    }

    // Başarı oranlarını hesapla
    foreach ($konu_istatistikleri as &$konu) {
        if ($konu['toplam_soru'] > 0) {
            $konu['basari_orani'] = round(($konu['dogru_sayisi'] / $konu['toplam_soru']) * 100, 1);
        }
    }

    // Başarı oranına göre sırala (yüksekten düşüğe)
    uasort($konu_istatistikleri, function($a, $b) {
        return $b['basari_orani'] <=> $a['basari_orani'];
    });

    echo json_encode([
        'success' => true,
        'data' => [
            'ogrenci_id' => $ogrenci_id,
            'konu_istatistikleri' => array_values($konu_istatistikleri),
            'toplam_konu_sayisi' => count($konu_istatistikleri),
            'genel_basari_orani' => count($konu_istatistikleri) > 0 ? 
                round(array_sum(array_column($konu_istatistikleri, 'basari_orani')) / count($konu_istatistikleri), 1) : 0
        ]
    ], JSON_UNESCAPED_UNICODE);

} catch (PDOException $e) {
    error_log('PDO Exception: ' . $e->getMessage());
    echo json_encode([
        'success' => false,
        'message' => 'Veritabanı hatası: ' . $e->getMessage()
    ], JSON_UNESCAPED_UNICODE);
} catch (Exception $e) {
    error_log('General Exception: ' . $e->getMessage());
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage()
    ], JSON_UNESCAPED_UNICODE);
}
?>