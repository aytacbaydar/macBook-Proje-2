
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
    unlink($pdfPath);
    
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
    
    echo json_encode([
        'success' => false,
        'message' => 'PDF işlenemedi: ' . $e->getMessage()
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
            $imagick->setResolution(300, 300);
            $imagick->readImage($pdfPath);
            
            $pageCount = $imagick->getNumberImages();
            error_log("PDF sayfa sayısı: " . $pageCount);
            
            for ($i = 0; $i < $pageCount; $i++) {
                $imagick->setIteratorIndex($i);
                $imagick->setImageFormat('jpeg');
                $imagick->setImageCompressionQuality(95);
                
                $filename = $fileId . '_page_' . ($i + 1) . '.jpg';
                $imagePath = $imageDir . $filename;
                
                if ($imagick->writeImage($imagePath)) {
                    $pages[] = '../uploads/pdf_images/' . $filename;
                    error_log("Sayfa oluşturuldu: " . $filename);
                } else {
                    error_log("Sayfa oluşturulamadı: " . $filename);
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

function convertWithGhostscript($pdfPath, $fileId, $imageDir) {
    $pages = [];
    
    // Ghostscript komutu
    $outputPattern = $imageDir . $fileId . "_page_%d.jpg";
    $command = "gs -dNOPAUSE -dBATCH -sDEVICE=jpeg -r300 -dJPEGQ=95 -sOutputFile=" . 
               escapeshellarg($outputPattern) . " " . escapeshellarg($pdfPath) . " 2>&1";
    
    error_log("Ghostscript komutu: " . $command);
    
    exec($command, $output, $returnCode);
    
    error_log("Ghostscript çıktısı: " . implode("\n", $output));
    error_log("Ghostscript return code: " . $returnCode);
    
    if ($returnCode !== 0) {
        // Alternatif komut dene
        $command2 = "convert -density 300 " . escapeshellarg($pdfPath) . " -quality 95 " . 
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
