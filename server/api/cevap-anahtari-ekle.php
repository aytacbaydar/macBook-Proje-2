
<?php
// CORS başlıkları
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// OPTIONS isteklerini işle
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

// Config dosyasını dahil et
require_once '../config.php';

// POST isteği kontrolü
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    errorResponse('Sadece POST istekleri kabul edilir');
}

try {
    // Bağlantıyı al
    $pdo = getConnection();
    
    // Tablo oluştur (eğer yoksa)
    $sql = "CREATE TABLE IF NOT EXISTS cevapAnahtari (
        id INT AUTO_INCREMENT PRIMARY KEY,
        sinav_adi VARCHAR(255) NOT NULL,
        sinav_turu VARCHAR(50) NOT NULL,
        soru_sayisi INT NOT NULL,
        tarih DATE NOT NULL,
        sinav_kapagi VARCHAR(255),
        cevaplar TEXT NOT NULL,
        konular TEXT,
        videolar TEXT,
        aktiflik BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )";
    
    $pdo->exec($sql);
    
    // Form verilerini al
    $sinav_adi = $_POST['sinav_adi'] ?? '';
    $sinav_turu = $_POST['sinav_turu'] ?? '';
    $soru_sayisi = (int)($_POST['soru_sayisi'] ?? 0);
    $tarih = $_POST['tarih'] ?? '';
    $cevaplar = $_POST['cevaplar'] ?? '{}';
    $konular = $_POST['konular'] ?? '{}';
    $videolar = $_POST['videolar'] ?? '{}';
    $aktiflik = isset($_POST['aktiflik']) ? (bool)$_POST['aktiflik'] : true;
    
    // Veri doğrulama
    if (empty($sinav_adi) || empty($sinav_turu) || $soru_sayisi <= 0 || empty($tarih) || empty($cevaplar)) {
        errorResponse("Tüm zorunlu alanları doldurunuz");
    }
    
    // Dosya yükleme işlemi
    $sinav_kapagi = '';
    if (isset($_FILES['sinav_kapagi']) && $_FILES['sinav_kapagi']['error'] === UPLOAD_ERR_OK) {
        // Uploads klasörünü oluştur
        $uploadDir = '../../uploads/';
        if (!file_exists($uploadDir)) {
            mkdir($uploadDir, 0755, true);
        }
        
        $tempFile = $_FILES['sinav_kapagi']['tmp_name'];
        $fileInfo = pathinfo($_FILES['sinav_kapagi']['name']);
        $fileExt = strtolower($fileInfo['extension']);
        
        // İzin verilen dosya türleri
        $allowedExtensions = ['jpg', 'jpeg', 'png', 'gif'];
        if (!in_array($fileExt, $allowedExtensions)) {
            errorResponse("Sadece JPG, JPEG, PNG ve GIF dosyaları yüklenebilir");
        }
        
        // Benzersiz bir dosya adı oluştur
        $sinav_kapagi = uniqid() . '_' . $fileInfo['basename'];
        $targetFile = $uploadDir . $sinav_kapagi;
        
        if (!move_uploaded_file($tempFile, $targetFile)) {
            errorResponse("Dosya yükleme hatası");
        }
    }
    
    // SQL sorgusu
    $sql = "INSERT INTO cevapAnahtari (sinav_adi, sinav_turu, soru_sayisi, tarih, sinav_kapagi, cevaplar, konular, videolar, aktiflik) 
            VALUES (:sinav_adi, :sinav_turu, :soru_sayisi, :tarih, :sinav_kapagi, :cevaplar, :konular, :videolar, :aktiflik)";
    
    $stmt = $pdo->prepare($sql);
    $result = $stmt->execute([
        ':sinav_adi' => $sinav_adi,
        ':sinav_turu' => $sinav_turu,
        ':soru_sayisi' => $soru_sayisi,
        ':tarih' => $tarih,
        ':sinav_kapagi' => $sinav_kapagi,
        ':cevaplar' => $cevaplar,
        ':konular' => $konular,
        ':videolar' => $videolar,
        ':aktiflik' => $aktiflik
    ]);
    
    if ($result) {
        successResponse('Cevap anahtarı başarıyla kaydedildi.');
    } else {
        errorResponse('Kaydetme işlemi başarısız oldu.');
    }
    
} catch (Exception $e) {
    errorResponse($e->getMessage());
}

// Bağlantıyı kapat
closeConnection();
?>
