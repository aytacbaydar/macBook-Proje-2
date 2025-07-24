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
        foreach ($pageSelections as $selectionIndex => $selection) {
            try {
                // Seçim alanından soru resmini kes ve kaydet
                $questionImage = cropQuestionFromPdf($selection, $pageIndex);

                if ($questionImage) {
                    // Seçimin kendi doğru cevabını kullan, yoksa varsayılanı kullan
                    $dogruCevap = isset($selection['dogru_cevap']) ? $selection['dogru_cevap'] : $input['dogru_cevap'];

                    // Veritabanına kaydet
                    $sql = "INSERT INTO yapay_zeka_sorular (konu_adi, sinif_seviyesi, zorluk_derecesi, soru_resmi, dogru_cevap, ogretmen_id, olusturma_tarihi) 
                            VALUES (?, ?, ?, ?, ?, ?, NOW())";

                    $stmt = $pdo->prepare($sql);
                    $stmt->execute([
                        $konuAdi,
                        $sinifSeviyesi,
                        $zorlukDerecesi,
                        $questionImage,
                        $dogruCevap,
                        $ogretmenId
                    ]);

                    $savedCount++;
                }
            } catch (Exception $e) {
                error_log('Soru kaydetme hatası: ' . $e->getMessage());
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

function cropQuestionFromPdf($selection, $pageIndex) {
    $imageDir = '../../uploads/pdf_images/';
    $uploadDir = '../../uploads/soru_resimleri/';

    // PDF'den oluşturulan resmi bul
    $pageFiles = glob($imageDir . '*_page_' . ($pageIndex + 1) . '.jpg');

    if (empty($pageFiles)) {
        throw new Exception('Sayfa resmi bulunamadı');
    }

    $sourceImage = $pageFiles[0];

    if (!file_exists($sourceImage)) {
        throw new Exception('Kaynak resim bulunamadı');
    }

    // GD ile resmi kes
    $source = imagecreatefromjpeg($sourceImage);
    if (!$source) {
        throw new Exception('Kaynak resim açılamadı');
    }

    // Seçim koordinatları
    $x = (int)$selection['x'];
    $y = (int)$selection['y'];
    $width = (int)$selection['width'];
    $height = (int)$selection['height'];

    // Yeni resim oluştur
    $cropped = imagecreatetruecolor($width, $height);

    // Beyaz arka plan
    $white = imagecolorallocate($cropped, 255, 255, 255);
    imagefill($cropped, 0, 0, $white);

    // Resmi kes
    imagecopy($cropped, $source, 0, 0, $x, $y, $width, $height);

    // Dosya adı oluştur
    $filename = 'pdf_question_' . uniqid() . '.jpg';
    $savePath = $uploadDir . $filename;

    // Kaydet
    $success = imagejpeg($cropped, $savePath, 85);

    // Belleği temizle
    imagedestroy($source);
    imagedestroy($cropped);

    if (!$success) {
        throw new Exception('Resim kaydedilemedi');
    }

    return $filename;
}
?>