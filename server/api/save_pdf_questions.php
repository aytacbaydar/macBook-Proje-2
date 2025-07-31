<?php
require_once '../config.php';

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode([
        'success' => false,
        'message' => 'Sadece POST istekleri kabul edilir'
    ]);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);

if (!$input) {
    echo json_encode([
        'success' => false,
        'message' => 'Geçersiz JSON verisi'
    ]);
    exit;
}

$selections = $input['selections'] ?? [];
$konuAdi = $input['konu_adi'] ?? '';
$sinifSeviyesi = $input['sinif_seviyesi'] ?? '9';
$zorlukDerecesi = $input['zorluk_derecesi'] ?? 'kolay';
$dogruCevap = $input['dogru_cevap'] ?? 'A';
$ogretmenId = $input['ogretmen_id'] ?? null;

if (empty($selections) || !$konuAdi || !$ogretmenId) {
    echo json_encode([
        'success' => false,
        'message' => 'Gerekli alanlar eksik'
    ]);
    exit;
}

try {
    $pdo = getConnection();

    $savedCount = 0;
    $uploadDir = '../uploads/soru_resimleri/';

    if (!is_dir($uploadDir)) {
        mkdir($uploadDir, 0755, true);
    }

    foreach ($selections as $pageIndex => $pageSelections) {
        if (!is_array($pageSelections)) {
            error_log("Sayfa $pageIndex için geçersiz seçim verisi");
            continue;
        }

        foreach ($pageSelections as $selectionIndex => $selection) {
            try {
                // Seçim verilerini validate et
                if (!validateSelection($selection)) {
                    error_log("Geçersiz seçim verisi - Sayfa: $pageIndex, Seçim: $selectionIndex");
                    continue;
                }

                // Seçim alanından soru resmini kes ve kaydet
                $questionImage = cropQuestionFromPdf($selection, $pageIndex);

                if ($questionImage) {
                    // Seçimin kendi doğru cevabını kullan, yoksa varsayılanı kullan
                    $selectionDogruCevap = isset($selection['dogru_cevap']) && !empty($selection['dogru_cevap']) 
                        ? $selection['dogru_cevap'] 
                        : $dogruCevap;
                    
                    // Doğru cevap validation
                    if (!in_array($selectionDogruCevap, ['A', 'B', 'C', 'D', 'E'])) {
                        $selectionDogruCevap = $dogruCevap;
                    }
                    
                    error_log("Soru kaydediliyor - Sayfa: $pageIndex, Doğru cevap: $selectionDogruCevap");

                    // Veritabanına kaydet
                    $sql = "INSERT INTO yapay_zeka_sorular (konu_adi, sinif_seviyesi, zorluk_derecesi, soru_resmi, dogru_cevap, ogretmen_id, olusturma_tarihi) 
                            VALUES (?, ?, ?, ?, ?, ?, NOW())";

                    $stmt = $pdo->prepare($sql);
                    $result = $stmt->execute([
                        $konuAdi,
                        $sinifSeviyesi,
                        $zorlukDerecesi,
                        $questionImage,
                        $selectionDogruCevap,
                        $ogretmenId
                    ]);

                    if ($result) {
                        $savedCount++;
                        error_log("Soru başarıyla kaydedildi - ID: " . $pdo->lastInsertId());
                    } else {
                        error_log("Veritabanı kaydetme hatası");
                    }
                }
            } catch (Exception $e) {
                error_log('Soru kaydetme hatası - Sayfa: ' . $pageIndex . ', Hata: ' . $e->getMessage());
                continue; // Bu soruyu atla, diğerlerine devam et
            }
        }
    }

    echo json_encode([
        'success' => true,
        'saved_count' => $savedCount,
        'message' => $savedCount . ' soru başarıyla kaydedildi'
    ]);

} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'message' => 'Sorular kaydedilirken hata oluştu: ' . $e->getMessage()
    ]);
}

function validateSelection($selection) {
    // Gerekli alanları kontrol et
    $requiredFields = ['x', 'y', 'width', 'height'];
    foreach ($requiredFields as $field) {
        if (!isset($selection[$field]) || !is_numeric($selection[$field])) {
            return false;
        }
    }

    // Minimum boyut kontrolü
    if ($selection['width'] < 50 || $selection['height'] < 50) {
        return false;
    }

    // Negatif değer kontrolü
    if ($selection['x'] < 0 || $selection['y'] < 0) {
        return false;
    }

    return true;
}

function cropQuestionFromPdf($selection, $pageIndex) {
    $imageDir = '../../uploads/pdf_images/';
    $uploadDir = '../../uploads/soru_resimleri/';

    // PDF'den oluşturulan resmi bul
    $pageFiles = glob($imageDir . '*_page_' . ($pageIndex + 1) . '.jpg');

    if (empty($pageFiles)) {
        error_log("Sayfa resmi bulunamadı - Sayfa: " . ($pageIndex + 1));
        throw new Exception('Sayfa resmi bulunamadı');
    }

    // En yeni dosyayı bul (dosya değişiklik tarihine göre)
    usort($pageFiles, function($a, $b) {
        return filemtime($b) - filemtime($a);
    });

    $sourceImage = $pageFiles[0];
    error_log("Kullanılan kaynak resim: " . basename($sourceImage));

    if (!file_exists($sourceImage)) {
        throw new Exception('Kaynak resim bulunamadı');
    }

    // GD ile resmi kes
    $source = imagecreatefromjpeg($sourceImage);
    if (!$source) {
        throw new Exception('Kaynak resim açılamadı');
    }

    // Kaynak resim boyutlarını al
    $sourceWidth = imagesx($source);
    $sourceHeight = imagesy($source);
    
    error_log("Kaynak resim boyutları: {$sourceWidth}x{$sourceHeight}");

    // Seçim koordinatları - güvenlik kontrolü ve düzeltme
    $x = max(0, round((float)$selection['x']));
    $y = max(0, round((float)$selection['y']));
    $width = max(50, round((float)$selection['width']));
    $height = max(50, round((float)$selection['height']));

    // Koordinatları kaynak resim sınırları içinde tut
    $x = min($x, $sourceWidth - 50);
    $y = min($y, $sourceHeight - 50);
    $width = min($width, $sourceWidth - $x);
    $height = min($height, $sourceHeight - $y);

    error_log("Düzeltilmiş koordinatlar: x=$x, y=$y, width=$width, height=$height");

    // Minimum boyut kontrolü
    if ($width < 50 || $height < 50) {
        throw new Exception('Seçim alanı çok küçük (minimum 50x50 piksel)');
    }

    // Yeni resim oluştur
    $cropped = imagecreatetruecolor($width, $height);

    // Beyaz arka plan
    $white = imagecolorallocate($cropped, 255, 255, 255);
    imagefill($cropped, 0, 0, $white);

    // Resmi kes ve kopyala
    $copyResult = imagecopy($cropped, $source, 0, 0, $x, $y, $width, $height);
    
    if (!$copyResult) {
        imagedestroy($source);
        imagedestroy($cropped);
        throw new Exception('Resim kopyalama işlemi başarısız');
    }

    // Dosya adı oluştur (timestamp ve random ile)
    $filename = 'pdf_question_' . date('Ymd_His') . '_' . uniqid() . '.jpg';
    $savePath = $uploadDir . $filename;

    // Yüksek kalitede kaydet
    $success = imagejpeg($cropped, $savePath, 90);

    // Belleği temizle
    imagedestroy($source);
    imagedestroy($cropped);

    if (!$success) {
        throw new Exception('Resim kaydedilemedi');
    }

    // Dosya izinlerini ayarla
    chmod($savePath, 0644);
    
    error_log("Soru resmi başarıyla kaydedildi: $filename");

    return $filename;
}
?>