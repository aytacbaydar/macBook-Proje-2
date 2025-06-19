
<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

require_once '../config.php';

function getSinavDetaySonuc($conn, $sinav_id, $ogrenci_id) {
    try {
        // Önce sınav sonucu genel bilgilerini al
        $stmt = $conn->prepare("
            SELECT ss.*, ca.sinav_adi, ca.sinav_turu, ss.sinav_tarihi
            FROM sinav_sonuclari ss
            LEFT JOIN cevapAnahtari ca ON ss.sinav_id = ca.id
            WHERE ss.sinav_id = ? AND ss.ogrenci_id = ?
        ");
        $stmt->execute([$sinav_id, $ogrenci_id]);
        $sinavSonucu = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$sinavSonucu) {
            return [
                'success' => false,
                'message' => 'Sınav sonucu bulunamadı'
            ];
        }

        // Öğrencinin cevaplarını al
        $stmt = $conn->prepare("
            SELECT soru_no, secilen_cevap 
            FROM ogrenci_cevaplari 
            WHERE sinav_id = ? AND ogrenci_id = ?
            ORDER BY soru_no
        ");
        $stmt->execute([$sinav_id, $ogrenci_id]);
        $ogrenciCevaplari = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Cevap anahtarını al
        $stmt = $conn->prepare("
            SELECT cevaplar 
            FROM cevapAnahtari 
            WHERE id = ?
        ");
        $stmt->execute([$sinav_id]);
        $cevapAnahtari = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$cevapAnahtari) {
            return [
                'success' => false,
                'message' => 'Cevap anahtarı bulunamadı'
            ];
        }

        // Cevap anahtarını parse et
        $dogruCevaplar = json_decode($cevapAnahtari['cevaplar'], true);
        
        // Öğrenci cevaplarını indeksle
        $ogrenciCevapIndex = [];
        foreach ($ogrenciCevaplari as $cevap) {
            $ogrenciCevapIndex[$cevap['soru_no']] = $cevap['secilen_cevap'];
        }

        // Soru bazında karşılaştırma yap
        $sorular = [];
        $dogruSayisi = 0;
        $yanlisSayisi = 0;
        $bosSayisi = 0;

        foreach ($dogruCevaplar as $soruNo => $dogruCevap) {
            $ogrenciCevabi = isset($ogrenciCevapIndex[$soruNo]) ? $ogrenciCevapIndex[$soruNo] : '';
            
            $soru = [
                'soru_no' => $soruNo,
                'ogrenci_cevabi' => $ogrenciCevabi,
                'dogru_cevap' => $dogruCevap,
                'konu_id' => null // Gelecekte konu tablosu bağlantısı için
            ];

            // İstatistik hesapla
            if (empty($ogrenciCevabi)) {
                $bosSayisi++;
            } elseif ($ogrenciCevabi === $dogruCevap) {
                $dogruSayisi++;
            } else {
                $yanlisSayisi++;
            }

            $sorular[] = $soru;
        }

        // Sonuç objesini oluştur
        $detaySonuc = [
            'id' => $sinavSonucu['id'],
            'sinav_id' => $sinavSonucu['sinav_id'],
            'sinav_adi' => $sinavSonucu['sinav_adi'],
            'sinav_turu' => $sinavSonucu['sinav_turu'],
            'sinav_tarihi' => $sinavSonucu['sinav_tarihi'],
            'dogru_sayisi' => $dogruSayisi,
            'yanlis_sayisi' => $yanlisSayisi,
            'bos_sayisi' => $bosSayisi,
            'sorular' => $sorular
        ];

        return [
            'success' => true,
            'data' => $detaySonuc
        ];

    } catch (Exception $e) {
        return [
            'success' => false,
            'message' => 'Veritabanı hatası: ' . $e->getMessage()
        ];
    }
}

// GET request işlemi
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $sinav_id = isset($_GET['sinav_id']) ? (int)$_GET['sinav_id'] : 0;
    $ogrenci_id = isset($_GET['ogrenci_id']) ? (int)$_GET['ogrenci_id'] : 0;

    if ($sinav_id <= 0 || $ogrenci_id <= 0) {
        echo json_encode([
            'success' => false,
            'message' => 'Geçersiz sınav ID veya öğrenci ID'
        ]);
        exit;
    }

    $result = getSinavDetaySonuc($conn, $sinav_id, $ogrenci_id);
    echo json_encode($result, JSON_UNESCAPED_UNICODE);
} else {
    echo json_encode([
        'success' => false,
        'message' => 'Sadece GET metodu destekleniyor'
    ]);
}
?>
