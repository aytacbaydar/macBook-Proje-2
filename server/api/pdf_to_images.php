
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
$uploadDir = '../uploads/pdf_temp/';
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
    $imageDir = '../uploads/pdf_images/';
    if (!is_dir($imageDir)) {
        mkdir($imageDir, 0755, true);
    }
    
    $pages = [];
    
    // ImageMagick kullanarak PDF'i resimlere çevir
    if (extension_loaded('imagick')) {
        try {
            $imagick = new Imagick();
            $imagick->setResolution(150, 150); // DPI ayarı
            $imagick->readImage($pdfPath);
            
            $pageCount = $imagick->getNumberImages();
            
            for ($i = 0; $i < $pageCount; $i++) {
                $imagick->setIteratorIndex($i);
                $imagick->setImageFormat('jpeg');
                $imagick->setImageCompressionQuality(85);
                
                $filename = $fileId . '_page_' . ($i + 1) . '.jpg';
                $imagePath = $imageDir . $filename;
                
                $imagick->writeImage($imagePath);
                $pages[] = './uploads/pdf_images/' . $filename;
            }
            
            $imagick->clear();
            $imagick->destroy();
            
        } catch (Exception $e) {
            throw new Exception('ImageMagick hatası: ' . $e->getMessage());
        }
    } else {
        // ImageMagick yoksa Ghostscript kullan
        $command = "gs -dNOPAUSE -dBATCH -sDEVICE=jpeg -r150 -sOutputFile=" . 
                   $imageDir . $fileId . "_page_%d.jpg " . escapeshellarg($pdfPath);
        
        exec($command, $output, $returnCode);
        
        if ($returnCode !== 0) {
            throw new Exception('Ghostscript hatası: PDF işlenemedi');
        }
        
        // Oluşturulan dosyaları listele
        $files = glob($imageDir . $fileId . '_page_*.jpg');
        sort($files);
        
        foreach ($files as $file) {
            $filename = basename($file);
            $pages[] = './uploads/pdf_images/' . $filename;
        }
    }
    
    if (empty($pages)) {
        throw new Exception('PDF sayfaları işlenemedi');
    }
    
    return $pages;
}
?>
