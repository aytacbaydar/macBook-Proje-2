<?php
require_once '../config.php';

// Temel ayarlar - optimize edildi
ini_set('memory_limit', '128M'); // 256M'den 128M'ye düşürdük
ini_set('max_execution_time', 90); // 3 dakikadan 1.5 dakikaya düşürdük
ini_set('max_input_time', 90);
ini_set('upload_max_filesize', '10M');
ini_set('post_max_size', '10M');

// Hata raporlama
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode([
        'success' => false,
        'message' => 'Sadece POST istekleri kabul edilir'
    ]);
    exit;
}

// Sunucu yükü kontrolü - daha esnek
$currentLoad = sys_getloadavg()[0];
if ($currentLoad > 8.0) { // Eşiği 3.0'dan 8.0'a çıkardık
    http_response_code(503);
    echo json_encode([
        'success' => false,
        'message' => 'Sunucu şu anda yoğun. Lütfen birkaç dakika sonra tekrar deneyin.',
        'error_code' => 'SERVER_BUSY'
    ]);
    exit;
}

if (!isset($_FILES['pdf_file'])) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => 'PDF dosyası gerekli'
    ]);
    exit;
}

$uploadedFile = $_FILES['pdf_file'];

// Dosya türü kontrolü
$finfo = finfo_open(FILEINFO_MIME_TYPE);
$mimeType = finfo_file($finfo, $uploadedFile['tmp_name']);
finfo_close($finfo);

if ($mimeType !== 'application/pdf') {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => 'Sadece PDF dosyaları kabul edilir'
    ]);
    exit;
}

// Dosya boyutu kontrolü (3MB) - Daha küçük dosyalar için optimize ettik
if ($uploadedFile['size'] > 3 * 1024 * 1024) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => 'Dosya boyutu 3MB\'dan büyük olamaz'
    ]);
    exit;
}

// Upload dizinini oluştur
$uploadDir = '../../uploads/pdf_temp/';
$imageDir = '../../uploads/pdf_images/';

foreach ([$uploadDir, $imageDir] as $dir) {
    if (!is_dir($dir)) {
        if (!mkdir($dir, 0755, true)) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Dizin oluşturulamadı'
            ]);
            exit;
        }
    }
}

// Benzersiz dosya adı oluştur
$fileId = uniqid() . '_' . time();
$pdfPath = $uploadDir . $fileId . '.pdf';

// Dosyayı kaydet
if (!move_uploaded_file($uploadedFile['tmp_name'], $pdfPath)) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Dosya yüklenemedi'
    ]);
    exit;
}

try {
    // Basit yaklaşım: Sadece Ghostscript kullan
    $pages = convertPdfWithGhostscript($pdfPath, $fileId, $imageDir);

    // Geçici PDF dosyasını sil
    if (file_exists($pdfPath)) {
        unlink($pdfPath);
    }

    // Bellek temizliği
    if (function_exists('gc_collect_cycles')) {
        gc_collect_cycles();
    }

    echo json_encode([
        'success' => true,
        'pages' => $pages,
        'file_id' => $fileId,
        'message' => count($pages) . ' sayfa başarıyla işlendi'
    ]);

} catch (Exception $e) {
    error_log('PDF işleme hatası: ' . $e->getMessage());

    // Geçici dosyaları temizle
    if (file_exists($pdfPath)) {
        unlink($pdfPath);
    }

    // Oluşturulan resimleri temizle
    $files = glob($imageDir . $fileId . '_page_*.jpg');
    foreach ($files as $file) {
        if (file_exists($file)) {
            unlink($file);
        }
    }

    // Bellek temizliği
    if (function_exists('gc_collect_cycles')) {
        gc_collect_cycles();
    }

    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'PDF işlenemedi. Lütfen dosyanın bozuk olmadığından emin olun.',
        'error_code' => 'PDF_PROCESSING_ERROR'
    ]);
}

function convertPdfWithGhostscript($pdfPath, $fileId, $imageDir) {
    $pages = [];

    // Önce sayfa sayısını öğren
    $pageCountCommand = "gs -q -dNODISPLAY -c \"($pdfPath) (r) file runpdfbegin pdfpagecount = quit\" 2>&1";
    exec($pageCountCommand, $pageCountOutput, $pageCountReturn);

    $pageCount = 1; // Varsayılan
    if ($pageCountReturn === 0 && !empty($pageCountOutput)) {
        $pageCount = intval(trim($pageCountOutput[0]));
    }

    // Maksimum 5 sayfa - daha az kaynak kullanımı için
    if ($pageCount > 5) {
        throw new Exception('PDF çok fazla sayfa içeriyor. Maksimum 5 sayfa desteklenir.');
    }

    // Her sayfayı ayrı ayrı işle (bellek tasarrufu için)
    for ($page = 1; $page <= $pageCount; $page++) {
        $outputFile = $imageDir . $fileId . '_page_' . $page . '.jpg';

        // Daha yüksek kalite ve daha iyi görünürlük için ayarları artırdık
        $command = sprintf(
            'gs -dNOPAUSE -dBATCH -sDEVICE=jpeg -r200 -dFirstPage=%d -dLastPage=%d -dJPEGQ=85 -dTextAlphaBits=4 -dGraphicsAlphaBits=4 -sOutputFile=%s %s 2>&1',
            $page,
            $page,
            escapeshellarg($outputFile),
            escapeshellarg($pdfPath)
        );

        error_log("Sayfa $page işleniyor: $command");
        error_log("Çıktı dosyası: $outputFile");

        exec($command, $output, $returnCode);
        
        error_log("Ghostscript çıktısı: " . implode("\n", $output));
        error_log("Return code: $returnCode");

        if ($returnCode === 0 && file_exists($outputFile) && filesize($outputFile) > 0) {
            // URL'yi doğru şekilde oluştur
            $imageUrl = 'https://www.kimyaogreniyorum.com/uploads/pdf_images/' . $fileId . '_page_' . $page . '.jpg';
            $pages[] = $imageUrl;
            error_log("Sayfa $page başarıyla oluşturuldu: " . filesize($outputFile) . " bytes");
            error_log("URL: $imageUrl");
            
            // Dosya izinlerini kontrol et
            chmod($outputFile, 0644);
        } else {
            error_log("Sayfa $page oluşturulamadı. Return code: $returnCode, Output: " . implode("\n", $output));

            // Alternatif komut dene - daha iyi kalite
            $altCommand = sprintf(
                'convert -density 200 %s[%d] -quality 85 -colorspace RGB %s 2>&1',
                escapeshellarg($pdfPath),
                $page - 1, // ImageMagick 0'dan başlar
                escapeshellarg($outputFile)
            );

            error_log("Alternatif komut deneniyor: $altCommand");
            exec($altCommand, $altOutput, $altReturn);
            error_log("ImageMagick çıktısı: " . implode("\n", $altOutput));

            if ($altReturn === 0 && file_exists($outputFile) && filesize($outputFile) > 0) {
                $imageUrl = 'https://www.kimyaogreniyorum.com/uploads/pdf_images/' . $fileId . '_page_' . $page . '.jpg';
                $pages[] = $imageUrl;
                error_log("Sayfa $page alternatif yöntemle oluşturuldu");
                chmod($outputFile, 0644);
            } else {
                error_log("Alternatif yöntem de başarısız: " . implode("\n", $altOutput));
                throw new Exception("Sayfa $page işlenemedi");
            }
        }

        // Her sayfadan sonra kısa bekle
        usleep(100000); // 0.1 saniye
    }

    if (empty($pages)) {
        throw new Exception('Hiçbir sayfa işlenemedi');
    }

    return $pages;
}
?>