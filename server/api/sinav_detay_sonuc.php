
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
        error_log("DEBUG: getSinavDetaySonuc called with sinav_id=$sinav_id, ogrenci_id=$ogrenci_id");
        
        // Önce sınav sonucu genel bilgilerini al
        $stmt = $conn->prepare("
            SELECT ss.*, ca.sinav_adi, ca.sinav_turu, ss.sinav_tarihi
            FROM sinav_sonuclari ss
            LEFT JOIN cevapAnahtari ca ON ss.sinav_id = ca.id
            WHERE ss.sinav_id = ? AND ss.ogrenci_id = ?
        ");
        $stmt->execute([$sinav_id, $ogrenci_id]);
        $sinavSonucu = $stmt->fetch(PDO::FETCH_ASSOC);
        
        error_log("DEBUG: Sınav sonucu query result: " . json_encode($sinavSonucu));
        
        if (!$sinavSonucu) {
            error_log("DEBUG: Sınav sonucu bulunamadı");
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
        
        error_log("DEBUG: Öğrenci cevapları count: " . count($ogrenciCevaplari));

        // Cevap anahtarını al
        $stmt = $conn->prepare("
            SELECT cevaplar, videolar 
            FROM cevapAnahtari 
            WHERE id = ?
        ");
        $stmt->execute([$sinav_id]);
        $cevapAnahtari = $stmt->fetch(PDO::FETCH_ASSOC);

        error_log("DEBUG: Cevap anahtarı: " . json_encode($cevapAnahtari));

        if (!$cevapAnahtari) {
            error_log("DEBUG: Cevap anahtarı bulunamadı");
            return [
                'success' => false,
                'message' => 'Cevap anahtarı bulunamadı'
            ];
        }

        // Cevap anahtarını parse et
        $dogruCevaplar = json_decode($cevapAnahtari['cevaplar'], true);
        $videolar = json_decode($cevapAnahtari['videolar'], true);
        
        if (!$dogruCevaplar) {
            error_log("DEBUG: Cevaplar JSON parse edilemedi");
            return [
                'success' => false,
                'message' => 'Cevap anahtarı formatı hatalı'
            ];
        }
        
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
            $videoUrl = isset($videolar[$soruNo]) ? $videolar[$soruNo] : '';
            
            $soru = [
                'soru_no' => $soruNo,
                'ogrenci_cevabi' => $ogrenciCevabi,
                'dogru_cevap' => $dogruCevap,
                'video_url' => $videoUrl,
                'is_correct' => (!empty($ogrenciCevabi) && $ogrenciCevabi === $dogruCevap)
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
            'toplam_soru' => count($sorular),
            'basari_yuzdesi' => count($sorular) > 0 ? round(($dogruSayisi / count($sorular)) * 100, 2) : 0,
            'sorular' => $sorular
        ];

        error_log("DEBUG: Başarıyla sonuç döndürülüyor");
        return [
            'success' => true,
            'data' => $detaySonuc
        ];

    } catch (Exception $e) {
        error_log("ERROR in getSinavDetaySonuc: " . $e->getMessage());
        error_log("ERROR Stack trace: " . $e->getTraceAsString());
        return [
            'success' => false,
            'message' => 'Veritabanı hatası: ' . $e->getMessage()
        ];
    }
}

// GET request işlemi
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    try {
        $sinav_id = isset($_GET['sinav_id']) ? (int)$_GET['sinav_id'] : 0;
        $ogrenci_id = isset($_GET['ogrenci_id']) ? (int)$_GET['ogrenci_id'] : 0;

        error_log("DEBUG: Received request with sinav_id=$sinav_id, ogrenci_id=$ogrenci_id");

        if ($sinav_id <= 0 || $ogrenci_id <= 0) {
            error_log("DEBUG: Invalid parameters");
            echo json_encode([
                'success' => false,
                'message' => 'Geçersiz sınav ID veya öğrenci ID'
            ], JSON_UNESCAPED_UNICODE);
            exit;
        }

        $result = getSinavDetaySonuc($conn, $sinav_id, $ogrenci_id);
        echo json_encode($result, JSON_UNESCAPED_UNICODE);
        
    } catch (Exception $e) {
        error_log("FATAL ERROR in main request: " . $e->getMessage());
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'message' => 'Sunucu hatası: ' . $e->getMessage()
        ], JSON_UNESCAPED_UNICODE);
    }
} else {
    http_response_code(405);
    echo json_encode([
        'success' => false,
        'message' => 'Sadece GET metodu destekleniyor'
    ], JSON_UNESCAPED_UNICODE);
}
?>
