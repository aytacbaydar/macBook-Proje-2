<?php
require_once '../config.php';

// Temel ayarlar - optimize edildi
ini_set('memory_limit', '512M');
ini_set('max_execution_time', 120);
ini_set('max_input_time', 120);
ini_set('upload_max_filesize', '100M');
ini_set('post_max_size', '100M');

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

// Sunucu yükü kontrolü
$currentLoad = sys_getloadavg()[0];
if ($currentLoad > 5.0) {
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

// Dosya boyutu kontrolü (100MB)
if ($uploadedFile['size'] > 100 * 1024 * 1024) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => 'Dosya boyutu 100MB\'dan büyük olamaz'
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

// Eski dosyaları temizle (1 saatten eski olanları)
cleanOldFiles($uploadDir, 3600);
cleanOldFiles($imageDir, 3600);

// Benzersiz işlem kimliği oluştur
$processId = isset($_POST['process_id']) ? $_POST['process_id'] : uniqid('pdf_', true);
error_log("PDF işleme başlatıldı - Process ID: " . $processId);

// Benzersiz dosya adı oluştur
$fileId = 'pdf_' . $processId . '_' . uniqid();
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
    error_log("PDF işleme başlıyor: " . $fileId);

    // PDF'i resimlere çevir
    $pages = convertPdfWithGhostscript($pdfPath, $fileId, $imageDir);

    // Geçici PDF dosyasını sil
    if (file_exists($pdfPath)) {
        unlink($pdfPath);
    }

    // Bellek temizliği
    if (function_exists('gc_collect_cycles')) {
        gc_collect_cycles();
    }

    error_log("PDF işleme tamamlandı: " . count($pages) . " sayfa");

    echo json_encode([
        'success' => true,
        'pages' => $pages,
        'file_id' => $fileId,
        'process_id' => $processId,
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
        'message' => 'PDF işlenemedi: ' . $e->getMessage(),
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

    // Maksimum 400 sayfa
    if ($pageCount > 400) {
        throw new Exception('PDF çok fazla sayfa içeriyor. Maksimum 400 sayfa desteklenir.');
    }

    error_log("PDF sayfa sayısı: " . $pageCount);

    // Her sayfayı ayrı ayrı işle
    for ($page = 1; $page <= $pageCount; $page++) {
        $outputFile = $imageDir . $fileId . '_page_' . $page . '.jpg';

        // Yüksek kaliteli çıkış için optimize edilmiş ayarlar
        $command = sprintf(
            'gs -dNOPAUSE -dBATCH -sDEVICE=jpeg -r300 -dFirstPage=%d -dLastPage=%d -dJPEGQ=90 -dTextAlphaBits=4 -dGraphicsAlphaBits=4 -dDownScaleFactor=1 -sOutputFile=%s %s 2>&1',
            $page,
            $page,
            escapeshellarg($outputFile),
            escapeshellarg($pdfPath)
        );

        error_log("Sayfa $page işleniyor: $command");

        exec($command, $output, $returnCode);

        if ($returnCode === 0 && file_exists($outputFile) && filesize($outputFile) > 0) {
            // URL'yi doğru şekilde oluştur
            $imageUrl = 'https://www.kimyaogreniyorum.com/uploads/pdf_images/' . $fileId . '_page_' . $page . '.jpg';
            $pages[] = $imageUrl;
            error_log("Sayfa $page başarıyla oluşturuldu: " . filesize($outputFile) . " bytes");

            // Dosya izinlerini ayarla
            chmod($outputFile, 0644);
        } else {
            error_log("Ghostscript başarısız, ImageMagick deneniyor...");

            // Alternatif komut - ImageMagick
            $altCommand = sprintf(
                'convert -density 300 -quality 90 %s[%d] -colorspace RGB -background white -alpha remove %s 2>&1',
                escapeshellarg($pdfPath),
                $page - 1, // ImageMagick 0'dan başlar
                escapeshellarg($outputFile)
            );

            error_log("ImageMagick komutu: $altCommand");
            exec($altCommand, $altOutput, $altReturn);

            if ($altReturn === 0 && file_exists($outputFile) && filesize($outputFile) > 0) {
                $imageUrl = 'https://www.kimyaogreniyorum.com/uploads/pdf_images/' . $fileId . '_page_' . $page . '.jpg';
                $pages[] = $imageUrl;
                error_log("Sayfa $page ImageMagick ile oluşturuldu");
                chmod($outputFile, 0644);
            } else {
                error_log("Her iki yöntem de başarısız oldu: " . implode("\n", array_merge($output, $altOutput)));
                throw new Exception("Sayfa $page işlenemedi");
            }
        }

        // CPU yükünü azaltmak için kısa bekle
        usleep(100000); // 0.1 saniye
    }

    if (empty($pages)) {
        throw new Exception('Hiçbir sayfa işlenemedi');
    }

    return $pages;
}

function cleanOldFiles($directory, $maxAge) {
    if (!is_dir($directory)) {
        return;
    }

    $currentTime = time();
    $files = glob($directory . '*');

    foreach ($files as $file) {
        if (is_file($file)) {
            $fileAge = $currentTime - filemtime($file);
            if ($fileAge > $maxAge) {
                unlink($file);
                error_log("Eski dosya silindi: " . basename($file));
            }
        }
    }
}
?>