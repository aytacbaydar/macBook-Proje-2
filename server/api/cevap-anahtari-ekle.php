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

try {
    // Bağlantıyı içe aktar
    require_once '../baglanti.php';
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
    
    // Veri doğrulama
    if (empty($sinav_adi) || empty($sinav_turu) || $soru_sayisi <= 0 || empty($tarih) || empty($cevaplar)) {
        throw new Exception("Tüm zorunlu alanları doldurunuz");
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
            throw new Exception("Sadece JPG, JPEG, PNG ve GIF dosyaları yüklenebilir");
        }
        
        // Benzersiz bir dosya adı oluştur
        $sinav_kapagi = uniqid() . '_' . $fileInfo['basename'];
        $targetFile = $uploadDir . $sinav_kapagi;
        
        if (!move_uploaded_file($tempFile, $targetFile)) {
            throw new Exception("Dosya yükleme hatası");
        }
    }
    
    // SQL sorgusu
    $sql = "INSERT INTO cevapAnahtari (sinav_adi, sinav_turu, soru_sayisi, tarih, sinav_kapagi, cevaplar, konular, videolar) 
            VALUES (:sinav_adi, :sinav_turu, :soru_sayisi, :tarih, :sinav_kapagi, :cevaplar, :konular, :videolar)";
    
    $stmt = $pdo->prepare($sql);
    $stmt->execute([
        ':sinav_adi' => $sinav_adi,
        ':sinav_turu' => $sinav_turu,
        ':soru_sayisi' => $soru_sayisi,
        ':tarih' => $tarih,
        ':sinav_kapagi' => $sinav_kapagi,
        ':cevaplar' => $cevaplar,
        ':konular' => $konular,
        ':videolar' => $videolar
    ]);
    
    echo json_encode([
        'success' => true,
        'message' => 'Cevap anahtarı başarıyla kaydedildi.'
    ]);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage()
    ]);
}

// Bağlantıyı kapat
closeConnection();
?>