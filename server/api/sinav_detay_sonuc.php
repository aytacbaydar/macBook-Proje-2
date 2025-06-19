
<?php
// Enable error reporting for debugging
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

require_once '../config.php';

// Veritabanı bağlantısını kur
$conn = getConnection();

function getSinavDetaySonuc($conn, $sinav_id, $ogrenci_id) {
    try {
        error_log("DEBUG STEP 1: Function called with sinav_id=$sinav_id, ogrenci_id=$ogrenci_id");
        
        // Database connection check
        if (!$conn) {
            error_log("DEBUG ERROR: Database connection is null");
            return ['success' => false, 'message' => 'Veritabanı bağlantısı yok'];
        }
        error_log("DEBUG STEP 2: Database connection OK");
        
        // Önce sınav sonucu genel bilgilerini al
        error_log("DEBUG STEP 3: Preparing sinav_sonuclari query");
        $stmt = $conn->prepare("
            SELECT ss.*, ca.sinav_adi, ca.sinav_turu, ss.gonderim_tarihi 
            FROM sinav_sonuclari ss
            LEFT JOIN cevapAnahtari ca ON ss.sinav_id = ca.id
            WHERE ss.sinav_id = ? AND ss.ogrenci_id = ?
        ");
        
        if (!$stmt) {
            error_log("DEBUG ERROR: sinav_sonuclari prepare failed: " . print_r($conn->errorInfo(), true));
            return ['success' => false, 'message' => 'SQL prepare hatası'];
        }
        error_log("DEBUG STEP 4: Query prepared successfully");
        
        $executeResult = $stmt->execute([$sinav_id, $ogrenci_id]);
        if (!$executeResult) {
            error_log("DEBUG ERROR: sinav_sonuclari execute failed: " . print_r($stmt->errorInfo(), true));
            return ['success' => false, 'message' => 'SQL execute hatası'];
        }
        error_log("DEBUG STEP 5: Query executed successfully");
        
        $sinavSonucu = $stmt->fetch(PDO::FETCH_ASSOC);
        
        error_log("DEBUG STEP 6: Sınav sonucu query result: " . json_encode($sinavSonucu));
        
        if (!$sinavSonucu) {
            error_log("DEBUG STEP 7: Sınav sonucu bulunamadı - bu normal olabilir");
            return [
                'success' => false,
                'message' => 'Sınav sonucu bulunamadı'
            ];
        }
        error_log("DEBUG STEP 8: Sınav sonucu bulundu");

        // Öğrencinin cevaplarını al
        error_log("DEBUG STEP 9: Preparing ogrenci_cevaplari query");
        $stmt = $conn->prepare("
            SELECT soru_no, secilen_cevap 
            FROM ogrenci_cevaplari 
            WHERE sinav_id = ? AND ogrenci_id = ?
            ORDER BY soru_no
        ");
        
        if (!$stmt) {
            error_log("DEBUG ERROR: ogrenci_cevaplari prepare failed: " . print_r($conn->errorInfo(), true));
            return ['success' => false, 'message' => 'Öğrenci cevapları SQL prepare hatası'];
        }
        
        $executeResult = $stmt->execute([$sinav_id, $ogrenci_id]);
        if (!$executeResult) {
            error_log("DEBUG ERROR: ogrenci_cevaplari execute failed: " . print_r($stmt->errorInfo(), true));
            return ['success' => false, 'message' => 'Öğrenci cevapları SQL execute hatası'];
        }
        error_log("DEBUG STEP 10: Öğrenci cevapları query executed");
        
        $ogrenciCevaplari = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        error_log("DEBUG STEP 11: Öğrenci cevapları count: " . count($ogrenciCevaplari));

        // Cevap anahtarını al
        error_log("DEBUG STEP 12: Preparing cevapAnahtari query");
        $stmt = $conn->prepare("
            SELECT cevaplar, videolar 
            FROM cevapAnahtari 
            WHERE id = ?
        ");
        
        if (!$stmt) {
            error_log("DEBUG ERROR: cevapAnahtari prepare failed: " . print_r($conn->errorInfo(), true));
            return ['success' => false, 'message' => 'Cevap anahtarı SQL prepare hatası'];
        }
        
        $executeResult = $stmt->execute([$sinav_id]);
        if (!$executeResult) {
            error_log("DEBUG ERROR: cevapAnahtari execute failed: " . print_r($stmt->errorInfo(), true));
            return ['success' => false, 'message' => 'Cevap anahtarı SQL execute hatası'];
        }
        error_log("DEBUG STEP 13: Cevap anahtarı query executed");
        
        $cevapAnahtari = $stmt->fetch(PDO::FETCH_ASSOC);

        error_log("DEBUG STEP 14: Cevap anahtarı result: " . json_encode($cevapAnahtari));

        if (!$cevapAnahtari) {
            error_log("DEBUG STEP 15: Cevap anahtarı bulunamadı");
            return [
                'success' => false,
                'message' => 'Cevap anahtarı bulunamadı'
            ];
        }
        error_log("DEBUG STEP 16: Cevap anahtarı bulundu");

        // Cevap anahtarını parse et
        error_log("DEBUG STEP 17: JSON parsing başlıyor");
        error_log("DEBUG: Raw cevaplar data: " . $cevapAnahtari['cevaplar']);
        
        $dogruCevaplar = json_decode($cevapAnahtari['cevaplar'], true);
        if (json_last_error() !== JSON_ERROR_NONE) {
            error_log("DEBUG ERROR: JSON decode error for cevaplar: " . json_last_error_msg());
            return ['success' => false, 'message' => 'Cevaplar JSON formatı hatalı: ' . json_last_error_msg()];
        }
        error_log("DEBUG STEP 18: Cevaplar JSON parsed successfully");
        
        $videolar = json_decode($cevapAnahtari['videolar'], true);
        if (json_last_error() !== JSON_ERROR_NONE) {
            error_log("DEBUG ERROR: JSON decode error for videolar: " . json_last_error_msg());
            // Videolar optional olabilir, bu yüzden hata vermeyebiliriz
            $videolar = [];
        }
        error_log("DEBUG STEP 19: Videolar JSON parsed");
        
        if (!$dogruCevaplar) {
            error_log("DEBUG STEP 20: Cevaplar boş veya null");
            return [
                'success' => false,
                'message' => 'Cevap anahtarı formatı hatalı'
            ];
        }
        error_log("DEBUG STEP 21: All JSON parsing completed successfully");
        
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

        error_log("DEBUG STEP 22: Başarıyla sonuç döndürülüyor - Total sorular: " . count($sorular));
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
        error_log("MAIN DEBUG: GET request received");
        error_log("MAIN DEBUG: Raw GET params: " . print_r($_GET, true));
        
        $sinav_id = isset($_GET['sinav_id']) ? (int)$_GET['sinav_id'] : 0;
        $ogrenci_id = isset($_GET['ogrenci_id']) ? (int)$_GET['ogrenci_id'] : 0;

        error_log("MAIN DEBUG: Parsed sinav_id=$sinav_id, ogrenci_id=$ogrenci_id");

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
