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

// Hata gösterimi
ini_set('display_errors', 0);
ini_set('display_startup_errors', 0);
error_reporting(E_ALL);

// Veritabanı bağlantı bilgileri (baglanti.php kullanmayarak sorunları azaltalım)
$hostname = "localhost";
$username = "Toluen96411";
$password = "3g783O*qd";
$database = "ogrenciData";

try {
    // Bağlantı oluştur
    $conn = new PDO("mysql:host=$hostname;dbname=$database;charset=utf8mb4", $username, $password);
    $conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    
    // JSON veya form verilerini al
    $data = json_decode(file_get_contents('php://input'), true);
    if (empty($data)) {
        // Eğer JSON verisi yoksa POST verilerini kullan
        $data = $_POST;
    }
    
    // ID kontrolü
    if (empty($data['id']) || !is_numeric($data['id'])) {
        throw new Exception("Geçerli bir ID belirtilmedi");
    }
    
    $id = (int)$data['id'];
    
    // Zorunlu alanların kontrolü
    if (empty($data['sinav_adi']) || empty($data['sinav_turu']) || 
        empty($data['soru_sayisi']) || empty($data['tarih'])) {
        throw new Exception("Tüm zorunlu alanları doldurunuz");
    }
    
    // Güncellenecek veriler
    $sinav_adi = $data['sinav_adi'];
    $sinav_turu = $data['sinav_turu'];
    $soru_sayisi = (int)$data['soru_sayisi'];
    $tarih = $data['tarih'];
    
    // JSON verileri
    $cevaplar = $data['cevaplar'];
    if (is_array($cevaplar)) {
        $cevaplar = json_encode($cevaplar);
    }
    
    $konular = isset($data['konular']) ? $data['konular'] : '{}';
    if (is_array($konular)) {
        $konular = json_encode($konular);
    }
    
    $videolar = isset($data['videolar']) ? $data['videolar'] : '{}';
    if (is_array($videolar)) {
        $videolar = json_encode($videolar);
    }
    
    // Dosya yükleme işlemi
    $sinav_kapagi_update = false;
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
        $yeni_sinav_kapagi = uniqid() . '_' . $fileInfo['basename'];
        $targetFile = $uploadDir . $yeni_sinav_kapagi;
        
        if (move_uploaded_file($tempFile, $targetFile)) {
            // Eski dosyayı sil
            $stmt = $conn->prepare("SELECT sinav_kapagi FROM cevapAnahtari WHERE id = :id");
            $stmt->execute([':id' => $id]);
            $eskiDosya = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if ($eskiDosya && !empty($eskiDosya['sinav_kapagi'])) {
                $eskiDosyaYolu = $uploadDir . $eskiDosya['sinav_kapagi'];
                if (file_exists($eskiDosyaYolu)) {
                    unlink($eskiDosyaYolu);
                }
            }
            
            $sinav_kapagi_update = true;
            $sinav_kapagi = $yeni_sinav_kapagi;
        } else {
            throw new Exception("Dosya yükleme hatası");
        }
    }
    
    // SQL sorgusu hazırla
    if ($sinav_kapagi_update) {
        $stmt = $conn->prepare("UPDATE cevapAnahtari SET 
                sinav_adi = :sinav_adi, 
                sinav_turu = :sinav_turu, 
                soru_sayisi = :soru_sayisi, 
                tarih = :tarih, 
                sinav_kapagi = :sinav_kapagi, 
                cevaplar = :cevaplar, 
                konular = :konular, 
                videolar = :videolar 
                WHERE id = :id");
                
        $params = [
            ':sinav_adi' => $sinav_adi,
            ':sinav_turu' => $sinav_turu,
            ':soru_sayisi' => $soru_sayisi,
            ':tarih' => $tarih,
            ':sinav_kapagi' => $sinav_kapagi,
            ':cevaplar' => $cevaplar,
            ':konular' => $konular,
            ':videolar' => $videolar,
            ':id' => $id
        ];
    } else {
        $stmt = $conn->prepare("UPDATE cevapAnahtari SET 
                sinav_adi = :sinav_adi, 
                sinav_turu = :sinav_turu, 
                soru_sayisi = :soru_sayisi, 
                tarih = :tarih, 
                cevaplar = :cevaplar, 
                konular = :konular, 
                videolar = :videolar 
                WHERE id = :id");
                
        $params = [
            ':sinav_adi' => $sinav_adi,
            ':sinav_turu' => $sinav_turu,
            ':soru_sayisi' => $soru_sayisi,
            ':tarih' => $tarih,
            ':cevaplar' => $cevaplar,
            ':konular' => $konular,
            ':videolar' => $videolar,
            ':id' => $id
        ];
    }
    
    // Sorguyu çalıştır
    $result = $stmt->execute($params);
    
    if ($result) {
        // Debug bilgisi
        $debug_info = [
            'sql_success' => true,
            'rows_affected' => $stmt->rowCount(),
            'params' => $params
        ];
        
        echo json_encode([
            'success' => true,
            'message' => 'Cevap anahtarı başarıyla güncellendi.',
            'debug' => $debug_info
        ]);
    } else {
        throw new Exception("Güncelleme hatası");
    }
    
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Veritabanı hatası: ' . $e->getMessage(),
        'error_type' => 'PDOException',
        'file' => $e->getFile(),
        'line' => $e->getLine()
    ]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage(),
        'error_type' => 'Exception'
    ]);
}
?>