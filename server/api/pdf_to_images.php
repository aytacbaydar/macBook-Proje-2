php
<?php
require_once '../config.php';

// Bellek ve zaman sınırlarını artır
ini_set('memory_limit', '1024M'); // 1GB'a çıkardık
ini_set('max_execution_time', 600); // 10 dakikaya çıkardık
ini_set('max_input_time', 600);
ini_set('upload_max_filesize', '50M');
ini_set('post_max_size', '50M');

// Hata raporlamayı etkinleştir
error_reporting(E_ALL);
ini_set('display_errors', 1);
ini_set('log_errors', 1);

// PHP output buffering'i kapat
if (ob_get_level()) {
    ob_end_clean();
}

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

if (!isset($_FILES['pdf_file'])) {
    echo json_encode([
        'success' => false,
        'message' => 'PDF dosyası gerekli'
    ]);
    exit;
}

$uploadedFile = $_FILES['pdf_file'];

// Dosya türü kontrolü
if ($uploadedFile['type'] !== 'application/pdf') {
    echo json_encode([
        'success' => false,
        'message' => 'Sadece PDF dosyaları kabul edilir'
    ]);
    exit;
}

// Dosya boyutu kontrolü (10MB)
if ($uploadedFile['size'] > 10 * 1024 * 1024) {
    echo json_encode([
        'success' => false,
        'message' => 'Dosya boyutu 10MB\'dan büyük olamaz'
    ]);
    exit;
}

// Upload dizinini oluştur
$uploadDir = '../../uploads/pdf_temp/';
if (!is_dir($uploadDir)) {
    mkdir($uploadDir, 0755, true);
}

// Benzersiz dosya adı oluştur
$fileId = uniqid();
$pdfPath = $uploadDir . $fileId . '.pdf';

// Dosyayı kaydet
if (!move_uploaded_file($uploadedFile['tmp_name'], $pdfPath)) {
    echo json_encode([
        'success' => false,
        'message' => 'Dosya yüklenemedi'
    ]);
    exit;
}

try {
    // PDF'i resimlere çevir
    $pages = convertPdfToImages($pdfPath, $fileId);

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
    error_log('PDF dosya boyutu: ' . (file_exists($pdfPath) ? filesize($pdfPath) : 'Dosya bulunamadı'));
    error_log('Bellek kullanımı: ' . memory_get_usage(true) / 1024 / 1024 . ' MB');
    error_log('Maksimum bellek: ' . memory_get_peak_usage(true) / 1024 / 1024 . ' MB');

    // Geçici dosyayı sil
    if (file_exists($pdfPath)) {
        unlink($pdfPath);
    }

    // Oluşturulan sayfaları temizle
    if (isset($fileId)) {
        $outputDir = '../../uploads/pdf_images/';
        $files = glob($outputDir . $fileId . '_page_*.png');
        foreach ($files as $file) {
            if (file_exists($file)) {
                unlink($file);
            }
        }
    }

    // Bellek temizliği
    if (function_exists('gc_collect_cycles')) {
        gc_collect_cycles();
    }

    // Timeout kontrolü
    $isTimeout = strpos($e->getMessage(), 'timeout') !== false || 
                 strpos($e->getMessage(), 'time limit') !== false ||
                 strpos($e->getMessage(), 'Maximum execution') !== false;

    $userMessage = $isTimeout ? 
        'PDF dosyası çok büyük veya karmaşık. Lütfen daha küçük bir PDF kullanın.' :
        'PDF işlenemedi. Dosyanın bozuk olmadığından emin olun.';

    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => $userMessage,
        'error_code' => $isTimeout ? 'PDF_TIMEOUT' : 'PDF_PROCESSING_ERROR',
        'technical_error' => $e->getMessage()
    ]);
}

function convertPdfToImages($pdfPath, $fileId) {
    $imageDir = '../../uploads/pdf_images/';

    // Dizin oluşturma ve izin kontrolü
    if (!is_dir($imageDir)) {
        if (!mkdir($imageDir, 0777, true)) {
            throw new Exception('Görsel dizini oluşturulamadı: ' . $imageDir);
        }
    }

    // Dizin yazılabilir mi kontrol et
    if (!is_writable($imageDir)) {
        chmod($imageDir, 0777);
        if (!is_writable($imageDir)) {
            throw new Exception('Görsel dizinine yazma izni yok: ' . $imageDir);
        }
    }

    $pages = [];
    $outputDir = '../../uploads/pdf_images/';

    // İlk olarak ImageMagick ile dene
    if (extension_loaded('imagick')) {
        try {
            $imagick = new Imagick();

            // Bellek sınırlarını daha agresif ayarla
            $imagick->setResourceLimit(Imagick::RESOURCETYPE_MEMORY, 512 * 1024 * 1024); // 512MB
            $imagick->setResourceLimit(Imagick::RESOURCETYPE_MAP, 1024 * 1024 * 1024); // 1GB
            $imagick->setResourceLimit(Imagick::RESOURCETYPE_DISK, 2 * 1024 * 1024 * 1024); // 2GB
            $imagick->setResourceLimit(Imagick::RESOURCETYPE_AREA, 128 * 1024 * 1024); // 128MB

            // PDF'yi parça parça işle
            $imagick->setResolution(300, 300); // Önce düşük çözünürlükle başla

            error_log("PDF okuma başlıyor: " . $pdfPath);
            $imagick->readImage($pdfPath . '[0]'); // Sadece ilk sayfayı oku

            $pageCount = $imagick->getNumberImages();
            error_log("PDF sayfa sayısı: " . $pageCount);

            // Çok fazla sayfa varsa hata ver
            if ($pageCount > 15) {
                throw new Exception('PDF çok fazla sayfa içeriyor. Maksimum 15 sayfa desteklenir.');
            }

            $imagick->clear(); // Belleği temizle

            // Şimdi tüm sayfaları yükle
            $imagick->setResolution(600, 600);
            $imagick->readImage($pdfPath);
            $pageCount = $imagick->getNumberImages();

            for ($i = 0; $i < $pageCount; $i++) {
                try {
                    error_log("Sayfa işleniyor: " . ($i + 1) . "/" . $pageCount);

                    $imagick->setIteratorIndex($i);

                    // Her sayfa için yeni bir Imagick instance'ı kullan
                    $pageImage = clone $imagick;

                    // PNG formatına çevir ve kaliteyi ayarla
                    $pageImage->setImageFormat('png');
                    $pageImage->setImageCompressionQuality(90); // Kaliteyi biraz düşür

                    // Dosya adını oluştur
                    $filename = $outputDir . $fileId . '_page_' . ($i + 1) . '.png';

                    if ($pageImage->writeImage($filename)) {
                        $pages[] = 'server/uploads/pdf_images/' . $fileId . '_page_' . ($i + 1) . '.png';
                        error_log("Sayfa başarıyla oluşturuldu: " . $filename . " (Boyut: " . filesize($filename) . " bytes)");
                    } else {
                        error_log("HATA: Sayfa oluşturulamadı: " . $filename);
                        throw new Exception("Sayfa " . ($i + 1) . " işlenemedi");
                    }

                    // Sayfa işlemi tamamlandı, belleği temizle
                    $pageImage->clear();
                    $pageImage->destroy();
                    unset($pageImage);

                    // Her sayfadan sonra bellek temizliği yap
                    if (function_exists('gc_collect_cycles')) {
                        gc_collect_cycles();
                    }

                    // Bellek kullanımını logla
                    $memoryUsage = memory_get_usage(true) / 1024 / 1024;
                    error_log("Bellek kullanımı sayfa " . ($i + 1) . " sonrası: " . round($memoryUsage, 2) . " MB");

                } catch (Exception $pageError) {
                    error_log("Sayfa " . ($i + 1) . " işlenirken hata: " . $pageError->getMessage());
                    throw new Exception("PDF sayfa " . ($i + 1) . " işlenemedi: " . $pageError->getMessage());
                }
            }

            // Ana Imagick nesnesini temizle
            $imagick->clear();
            $imagick->destroy();
            unset($imagick);

            // Son bellek temizliği
            if (function_exists('gc_collect_cycles')) {
                gc_collect_cycles();
            }

            error_log("PDF işleme tamamlandı. Toplam " . count($pages) . " sayfa oluşturuldu.");

            return $pages;
        } catch (Exception $e) {
            error_log("ImageMagick hatası: " . $e->getMessage());
            error_log("Hata detayı: " . $e->getTraceAsString());

            // Hata durumunda da belleği temizle
            if (isset($imagick)) {
                $imagick->clear();
                $imagick->destroy();
            }

            throw new Exception("PDF işleme hatası: " . $e->getMessage());
        }
    } else {
        // ImageMagick yoksa Ghostscript kullan
        return convertWithGhostscript($pdfPath, $fileId, $imageDir);
    }

    if (empty($pages)) {
        throw new Exception('PDF sayfaları işlenemedi - hiçbir sayfa oluşturulamadı');
    }

    error_log("Toplam " . count($pages) . " sayfa oluşturuldu");
    return $pages;
}

function convertToBytes($val) {
    $val = trim($val);
    $last = strtolower($val[strlen($val)-1]);
    $val = (int)$val;
    switch($last) {
        case 'g':
            $val *= 1024;
        case 'm':
            $val *= 1024;
        case 'k':
            $val *= 1024;
    }
    return $val;
}

function convertWithGhostscript($pdfPath, $fileId, $imageDir) {
    $pages = [];

    // Ghostscript komutu - orta kalite ayarları (bellek tasarrufu için)
    $outputPattern = $imageDir . $fileId . "_page_%d.jpg";
    $command = "gs -dNOPAUSE -dBATCH -sDEVICE=jpeg -r400 -dJPEGQ=85 -dTextAlphaBits=2 -dGraphicsAlphaBits=2 -dUseCropBox -sOutputFile=" . 
               escapeshellarg($outputPattern) . " " . escapeshellarg($pdfPath) . " 2>&1";

    error_log("Ghostscript komutu: " . $command);

    exec($command, $output, $returnCode);

    error_log("Ghostscript çıktısı: " . implode("\n", $output));
    error_log("Ghostscript return code: " . $returnCode);

    if ($returnCode !== 0) {
        // Alternatif komut dene - orta kalite
        $command2 = "convert -density 400 " . escapeshellarg($pdfPath) . " -quality 85 -colorspace RGB -strip " . 
                   $imageDir . $fileId . "_page_%d.jpg 2>&1";

        error_log("ImageMagick convert komutu: " . $command2);
        exec($command2, $output2, $returnCode2);

        if ($returnCode2 !== 0) {
            throw new Exception('PDF işlenemedi. Ghostscript hatası: ' . implode("\n", $output) . 
                              '. Convert hatası: ' . implode("\n", $output2));
        }
    }

    // Oluşturulan dosyaları listele
    $files = glob($imageDir . $fileId . '_page_*.jpg');

    if (!$files) {
        // Alternatif isimlendirme dene
        $files = glob($imageDir . $fileId . '_page-*.jpg');
    }

    if (!$files) {
        // Tek sayfa durumu için
        $singleFile = $imageDir . $fileId . '_page_0.jpg';
        if (file_exists($singleFile)) {
            $files = [$singleFile];
        }
    }

    error_log("Bulunan dosyalar: " . print_r($files, true));

    if ($files) {
        sort($files);
        foreach ($files as $file) {
            $filename = basename($file);
            $pages[] = '../uploads/pdf_images/' . $filename;
        }
    }

    return $pages;
}
?>