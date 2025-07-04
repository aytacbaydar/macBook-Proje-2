
<?php
// Enable error reporting for debugging
error_reporting(E_ALL);
ini_set('display_errors', 1);
ini_set('log_errors', 1);

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

require_once '../config.php';

// Log the request
error_log("soru_mesajlari.php - Request method: " . $_SERVER['REQUEST_METHOD']);
error_log("soru_mesajlari.php - Request URI: " . $_SERVER['REQUEST_URI']);
error_log("soru_mesajlari.php - GET params: " . json_encode($_GET));

// authorize fonksiyonu config.php'den geliyor

function createTable($conn) {
    error_log("createTable() - Creating soru_mesajlari table");
    
    try {
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
        error_log("createTable() - Table created successfully");
    } catch (Exception $e) {
        error_log("createTable() - Error creating table: " . $e->getMessage());
        throw $e;
    }
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
    error_log("Main try block - Starting");
    
    $conn = getConnection();
    error_log("Main try block - Database connection established");
    
    createTable($conn);
    error_log("Main try block - Table created/verified");
    
    $method = $_SERVER['REQUEST_METHOD'];
    error_log("Main try block - HTTP method: " . $method);
    
    switch ($method) {
        case 'GET':
            error_log("GET request - Starting");
            
            // Mesajları getir
            $user = authorize();
            error_log("GET request - User authorized: " . json_encode($user));
            
            if ($user['rutbe'] === 'ogretmen') {
                // Öğretmen ise - tüm öğrencilerinin mesajlarını getir veya belirli öğrencininkileri
                $ogrenciId = $_GET['ogrenci_id'] ?? null;
                
                if ($ogrenciId) {
                    // Belirli öğrencinin mesajları
                    // Önce bu öğrencinin kendi öğrencisi olup olmadığını kontrol et
                    $stmt = $conn->prepare("SELECT id FROM ogrenciler WHERE id = ? AND ogretmeni = ?");
                    $stmt->execute([$ogrenciId, $user['adi_soyadi']]);
                    if (!$stmt->fetch()) {
                        http_response_code(403);
                        echo json_encode(['error' => 'Bu öğrencinin mesajlarını görme yetkiniz yok']);
                        exit;
                    }
                    
                    $stmt = $conn->prepare("
                        SELECT * FROM soru_mesajlari 
                        WHERE ogrenci_id = ? 
                        ORDER BY gonderim_tarihi ASC
                    ");
                    $stmt->execute([$ogrenciId]);
                    $mesajlar = $stmt->fetchAll(PDO::FETCH_ASSOC);
                } else {
                    // Tüm öğrencilerinin mesajları (öğrenci bilgileriyle birlikte)
                    $stmt = $conn->prepare("
                        SELECT sm.*, o.adi_soyadi as ogrenci_adi 
                        FROM soru_mesajlari sm
                        JOIN ogrenciler o ON sm.ogrenci_id = o.id
                        WHERE o.ogretmeni = ?
                        ORDER BY sm.gonderim_tarihi DESC
                    ");
                    $stmt->execute([$user['adi_soyadi']]);
                    $mesajlar = $stmt->fetchAll(PDO::FETCH_ASSOC);
                }
            } else {
                // Öğrenci ise - sadece kendi mesajları
                $ogrenciId = $_GET['ogrenci_id'] ?? $user['id'];
                
                if ($ogrenciId != $user['id']) {
                    error_log("GET request - Access denied for user: " . $user['id']);
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
            }
            
            error_log("GET request - Found " . count($mesajlar) . " messages");
            
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
            $gonderenTip = $_POST['gonderen_tip'] ?? ($user['rutbe'] === 'ogretmen' ? 'ogretmen' : 'ogrenci');
            $gonderenAdi = $_POST['gonderen_adi'] ?? $user['adi_soyadi'];
            
            // Öğrenci sadece kendi adına mesaj gönderebilir
            if ($user['rutbe'] === 'ogrenci' && $ogrenciId != $user['id']) {
                http_response_code(403);
                echo json_encode(['error' => 'Bu işlem için yetkiniz yok']);
                exit;
            }
            
            // Öğretmen için öğrenci kontrolü
            if ($user['rutbe'] === 'ogretmen') {
                $stmt = $conn->prepare("SELECT id FROM ogrenciler WHERE id = ? AND ogretmeni = ?");
                $stmt->execute([$ogrenciId, $user['adi_soyadi']]);
                if (!$stmt->fetch()) {
                    http_response_code(403);
                    echo json_encode(['error' => 'Bu öğrenciye mesaj gönderme yetkiniz yok']);
                    exit;
                }
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
            
            // Öğretmen ID'sini belirle
            $ogretmenId = null;
            if ($user['rutbe'] === 'ogretmen') {
                $ogretmenId = $user['id'];
            } else {
                // Öğrenci mesajı ise, öğretmen ID'sini öğrencinin öğretmeninden al
                $stmt = $conn->prepare("SELECT og.id FROM ogrenciler o JOIN ogrenciler og ON o.ogretmeni = og.adi_soyadi WHERE o.id = ? AND og.rutbe = 'ogretmen'");
                $stmt->execute([$ogrenciId]);
                $result = $stmt->fetch();
                if ($result) {
                    $ogretmenId = $result['id'];
                }
            }
            
            $stmt = $conn->prepare("
                INSERT INTO soru_mesajlari 
                (ogrenci_id, ogretmen_id, mesaj_metni, resim_url, gonderen_tip, gonderen_adi) 
                VALUES (?, ?, ?, ?, ?, ?)
            ");
            
            $stmt->execute([
                $ogrenciId,
                $ogretmenId,
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
    error_log("MAIN CATCH - Exception caught: " . $e->getMessage());
    error_log("MAIN CATCH - Stack trace: " . $e->getTraceAsString());
    error_log("MAIN CATCH - File: " . $e->getFile() . " Line: " . $e->getLine());
    
    http_response_code(500);
    echo json_encode([
        'error' => 'Sunucu hatası: ' . $e->getMessage(),
        'details' => [
            'file' => $e->getFile(),
            'line' => $e->getLine(),
            'trace' => $e->getTraceAsString()
        ]
    ]);
}
?>
