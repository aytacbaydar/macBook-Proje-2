
<?php
require_once '../config.php';

// Bellek ve zaman sınırlarını artır
ini_set('memory_limit', '1024M'); // 1GB
ini_set('max_execution_time', 600); // 10 dakika
ini_set('max_input_time', 600);
set_time_limit(600);

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
    // Hata durumunda geçici dosyayı temizle
    if (file_exists($pdfPath)) {
        unlink($pdfPath);
    }
    
    // Bellek temizliği
    if (function_exists('gc_collect_cycles')) {
        gc_collect_cycles();
    }
    
    error_log('PDF işleme hatası: ' . $e->getMessage());
    
    echo json_encode([
        'success' => false,
        'message' => 'PDF işlenemedi: ' . $e->getMessage(),
        'error_code' => 'PDF_PROCESSING_ERROR'
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
    
    // İlk olarak ImageMagick ile dene
    if (extension_loaded('imagick')) {
        try {
            $imagick = new Imagick();
            
            // Bellek sınırını ayarla
            $imagick->setResourceLimit(Imagick::RESOURCETYPE_MEMORY, 256 * 1024 * 1024); // 256MB
            $imagick->setResourceLimit(Imagick::RESOURCETYPE_MAP, 512 * 1024 * 1024); // 512MB
            
            $imagick->setResolution(400, 400); // Çözünürlüğü azalttık (600'den 400'e)
            $imagick->readImage($pdfPath);
            
            $pageCount = $imagick->getNumberImages();
            error_log("PDF sayfa sayısı: " . $pageCount);
            
            // Sayfa sayısını daha da sınırla
            if ($pageCount > 10) {
                throw new Exception('PDF çok fazla sayfa içeriyor. Maksimum 10 sayfa desteklenir.');
            }
            
            for ($i = 0; $i < $pageCount; $i++) {
                $imagick->setIteratorIndex($i);
                $imagick->setImageFormat('jpeg');
                $imagick->setImageCompressionQuality(85); // Kaliteyi düşürdük (98'den 85'e)
                
                // Bellek tasarrufu için basit ayarlar
                $imagick->setImageColorspace(Imagick::COLORSPACE_RGB);
                $imagick->stripImage(); // Metadata'yı temizle
                $imagick->resampleImage(400, 400, Imagick::FILTER_LANCZOS, 1);
                
                $filename = $fileId . '_page_' . ($i + 1) . '.jpg';
                $imagePath = $imageDir . $filename;
                
                if ($imagick->writeImage($imagePath)) {
                    $pages[] = '../uploads/pdf_images/' . $filename;
                    error_log("Sayfa oluşturuldu: " . $filename);
                } else {
                    error_log("Sayfa oluşturulamadı: " . $filename);
                }
                
                // Her sayfada bellek temizliği yap
                if (function_exists('gc_collect_cycles')) {
                    gc_collect_cycles();
                }
                
                // Bellek kullanımını kontrol et
                $memoryUsage = memory_get_usage(true);
                $memoryLimit = ini_get('memory_limit');
                $memoryLimitBytes = $this->convertToBytes($memoryLimit);
                
                if ($memoryUsage > ($memoryLimitBytes * 0.8)) {
                    error_log("Bellek kulımı kritik seviyede: " . round($memoryUsage / 1024 / 1024, 2) . "MB");
                    break; // Bellek doluysa durur
                }
            }
            
            $imagick->clear();
            $imagick->destroy();
            
        } catch (Exception $e) {
            error_log('ImageMagick hatası: ' . $e->getMessage());
            // ImageMagick başarısızsa Ghostscript'e geç
            return convertWithGhostscript($pdfPath, $fileId, $imageDir);
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
