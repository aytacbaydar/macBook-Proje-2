
<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

require_once '../config.php';

function authorize() {
    $headers = getallheaders();
    
    if (!isset($headers['Authorization'])) {
        http_response_code(401);
        echo json_encode(['error' => 'Token bulunamadı']);
        exit;
    }
    
    $token = str_replace('Bearer ', '', $headers['Authorization']);
    
    try {
        $conn = getConnection();
        $stmt = $conn->prepare("SELECT * FROM ogrenciler WHERE token = ?");
        $stmt->execute([$token]);
        
        $user = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$user) {
            http_response_code(401);
            echo json_encode(['error' => 'Geçersiz token']);
            exit;
        }
        
        return $user;
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Sunucu hatası: ' . $e->getMessage()]);
        exit;
    }
}

function createTable($conn) {
    $sql = "CREATE TABLE IF NOT EXISTS soru_mesajlari (
        id INT AUTO_INCREMENT PRIMARY KEY,
        ogrenci_id INT NOT NULL,
        ogretmen_id INT NULL,
        mesaj_metni TEXT,
        resim_url VARCHAR(500),
        gonderim_tarihi TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        gonderen_tip ENUM('ogrenci', 'ogretmen') NOT NULL,
        gonderen_adi VARCHAR(100) NOT NULL,
        okundu TINYINT DEFAULT 0,
        FOREIGN KEY (ogrenci_id) REFERENCES ogrenciler(id) ON DELETE CASCADE
    )";
    
    $conn->exec($sql);
}

function handleImageUpload($file, $ogrenciId) {
    $uploadDir = '../../uploads/soru_resimleri/';
    
    // Klasörü oluştur
    if (!file_exists($uploadDir)) {
        mkdir($uploadDir, 0755, true);
    }
    
    // Dosya türünü kontrol et
    $allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
    if (!in_array($file['type'], $allowedTypes)) {
        throw new Exception('Sadece JPG, PNG ve GIF dosyaları kabul edilir');
    }
    
    // Dosya boyutunu kontrol et (5MB max)
    if ($file['size'] > 5 * 1024 * 1024) {
        throw new Exception('Dosya boyutu 5MB\'dan büyük olamaz');
    }
    
    // Dosya adını oluştur
    $extension = pathinfo($file['name'], PATHINFO_EXTENSION);
    $fileName = 'soru_' . $ogrenciId . '_' . time() . '.' . $extension;
    $filePath = $uploadDir . $fileName;
    
    // Dosyayı taşı
    if (!move_uploaded_file($file['tmp_name'], $filePath)) {
        throw new Exception('Dosya yüklenirken hata oluştu');
    }
    
    return 'uploads/soru_resimleri/' . $fileName;
}

try {
    $conn = getConnection();
    createTable($conn);
    
    $method = $_SERVER['REQUEST_METHOD'];
    
    switch ($method) {
        case 'GET':
            // Mesajları getir
            $user = authorize();
            $ogrenciId = $_GET['ogrenci_id'] ?? $user['id'];
            
            // Sadece kendi mesajlarını görebilir (öğrenci ise)
            if ($user['rutbe'] !== 'ogretmen' && $user['rutbe'] !== 'admin' && $ogrenciId != $user['id']) {
                http_response_code(403);
                echo json_encode(['error' => 'Bu mesajları görme yetkiniz yok']);
                exit;
            }
            
            $stmt = $conn->prepare("
                SELECT * FROM soru_mesajlari 
                WHERE ogrenci_id = ? 
                ORDER BY gonderim_tarihi ASC
            ");
            $stmt->execute([$ogrenciId]);
            $mesajlar = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            echo json_encode([
                'success' => true,
                'data' => $mesajlar
            ]);
            break;
            
        case 'POST':
            // Yeni mesaj gönder
            $user = authorize();
            
            $ogrenciId = $_POST['ogrenci_id'] ?? $user['id'];
            $mesajMetni = $_POST['mesaj_metni'] ?? '';
            $gonderenTip = $_POST['gonderen_tip'] ?? 'ogrenci';
            $gonderenAdi = $_POST['gonderen_adi'] ?? $user['adi_soyadi'];
            
            // Öğrenci sadece kendi adına mesaj gönderebilir
            if ($user['rutbe'] === 'ogrenci' && $ogrenciId != $user['id']) {
                http_response_code(403);
                echo json_encode(['error' => 'Bu işlem için yetkiniz yok']);
                exit;
            }
            
            $resimUrl = null;
            
            // Resim yükleme kontrolü
            if (isset($_FILES['resim']) && $_FILES['resim']['error'] === UPLOAD_ERR_OK) {
                $resimUrl = handleImageUpload($_FILES['resim'], $ogrenciId);
            }
            
            // Mesaj veya resim olmalı
            if (empty($mesajMetni) && empty($resimUrl)) {
                http_response_code(400);
                echo json_encode(['error' => 'Mesaj metni veya resim gerekli']);
                exit;
            }
            
            $stmt = $conn->prepare("
                INSERT INTO soru_mesajlari 
                (ogrenci_id, mesaj_metni, resim_url, gonderen_tip, gonderen_adi) 
                VALUES (?, ?, ?, ?, ?)
            ");
            
            $stmt->execute([
                $ogrenciId,
                $mesajMetni,
                $resimUrl,
                $gonderenTip,
                $gonderenAdi
            ]);
            
            $mesajId = $conn->lastInsertId();
            
            echo json_encode([
                'success' => true,
                'message' => 'Mesaj başarıyla gönderildi',
                'data' => [
                    'id' => $mesajId,
                    'resim_url' => $resimUrl
                ]
            ]);
            break;
            
        case 'PUT':
            // Mesaj okundu işaretle
            $user = authorize();
            $input = json_decode(file_get_contents('php://input'), true);
            $mesajId = $input['id'] ?? 0;
            
            $stmt = $conn->prepare("UPDATE soru_mesajlari SET okundu = 1 WHERE id = ?");
            $stmt->execute([$mesajId]);
            
            echo json_encode([
                'success' => true,
                'message' => 'Mesaj okundu olarak işaretlendi'
            ]);
            break;
            
        case 'DELETE':
            // Mesaj sil
            $user = authorize();
            $mesajId = $_GET['id'] ?? 0;
            
            // Mesajın sahibi mi kontrol et
            $stmt = $conn->prepare("SELECT * FROM soru_mesajlari WHERE id = ?");
            $stmt->execute([$mesajId]);
            $mesaj = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if (!$mesaj) {
                http_response_code(404);
                echo json_encode(['error' => 'Mesaj bulunamadı']);
                exit;
            }
            
            // Sadece kendi mesajlarını silebilir
            if ($user['rutbe'] === 'ogrenci' && $mesaj['ogrenci_id'] != $user['id']) {
                http_response_code(403);
                echo json_encode(['error' => 'Bu mesajı silme yetkiniz yok']);
                exit;
            }
            
            // Resim varsa sil
            if ($mesaj['resim_url']) {
                $resimYolu = '../../' . $mesaj['resim_url'];
                if (file_exists($resimYolu)) {
                    unlink($resimYolu);
                }
            }
            
            $stmt = $conn->prepare("DELETE FROM soru_mesajlari WHERE id = ?");
            $stmt->execute([$mesajId]);
            
            echo json_encode([
                'success' => true,
                'message' => 'Mesaj başarıyla silindi'
            ]);
            break;
            
        default:
            http_response_code(405);
            echo json_encode(['error' => 'Desteklenmeyen HTTP metodu']);
    }
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Sunucu hatası: ' . $e->getMessage()]);
}
?>
