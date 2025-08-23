
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

function createTable($conn) {
    error_log("createTable() - Creating iletisim_mesajlari table");
    
    try {
        $sql = "CREATE TABLE IF NOT EXISTS iletisim_mesajlari (
            id INT AUTO_INCREMENT PRIMARY KEY,
            gonderen_adi VARCHAR(100) NOT NULL,
            gonderen_email VARCHAR(150) NOT NULL,
            telefon VARCHAR(20),
            konu VARCHAR(200),
            mesaj_metni TEXT,
            resim_url VARCHAR(500),
            gonderim_tarihi TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            durum ENUM('yeni', 'okundu', 'cevaplanmis') DEFAULT 'yeni',
            admin_notu TEXT,
            cevaplama_tarihi TIMESTAMP NULL
        )";
        
        $conn->exec($sql);
        error_log("createTable() - Table created successfully");
    } catch (Exception $e) {
        error_log("createTable() - Error creating table: " . $e->getMessage());
        throw $e;
    }
}

function handleImageUpload($file, $gonderenEmail) {
    $uploadDir = '../../uploads/iletisim_resimleri/';
    
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
    $cleanEmail = preg_replace('/[^a-zA-Z0-9]/', '_', $gonderenEmail);
    $fileName = 'iletisim_' . $cleanEmail . '_' . time() . '.' . $extension;
    $filePath = $uploadDir . $fileName;
    
    // Dosyayı taşı
    if (!move_uploaded_file($file['tmp_name'], $filePath)) {
        throw new Exception('Dosya yüklenirken hata oluştu');
    }
    
    return 'uploads/iletisim_resimleri/' . $fileName;
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
            
            // Mesajları getir (sadece admin için)
            try {
                $user = authorize();
                error_log("GET request - User authorized: " . json_encode($user));
                
                if ($user['rutbe'] !== 'admin' && $user['rutbe'] !== 'ogretmen') {
                    http_response_code(403);
                    echo json_encode(['error' => 'Bu işlem için yönetici yetkileri gerekli']);
                    exit;
                }
            } catch (Exception $e) {
                // Eğer authorization başarısız olursa, genel mesajları getir
                error_log("GET request - Authorization failed, returning public messages");
            }
            
            $durum = $_GET['durum'] ?? null;
            $limit = $_GET['limit'] ?? 50;
            $offset = $_GET['offset'] ?? 0;
            
            $whereClause = '';
            $params = [];
            
            if ($durum) {
                $whereClause = 'WHERE durum = ?';
                $params[] = $durum;
            }
            
            $stmt = $conn->prepare("
                SELECT * FROM iletisim_mesajlari 
                $whereClause
                ORDER BY gonderim_tarihi DESC 
                LIMIT ? OFFSET ?
            ");
            
            $params[] = (int)$limit;
            $params[] = (int)$offset;
            
            $stmt->execute($params);
            $mesajlar = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            // Resim URL'lerini tam yola çevir
            foreach ($mesajlar as &$mesaj) {
                if ($mesaj['resim_url']) {
                    if (!str_starts_with($mesaj['resim_url'], 'http')) {
                        $mesaj['resim_url'] = './server/' . $mesaj['resim_url'];
                    }
                }
            }
            
            error_log("GET request - Found " . count($mesajlar) . " messages");
            
            echo json_encode([
                'success' => true,
                'data' => $mesajlar
            ]);
            break;
            
        case 'POST':
            // Yeni iletişim mesajı gönder
            $gonderenAdi = $_POST['gonderen_adi'] ?? '';
            $gonderenEmail = $_POST['gonderen_email'] ?? '';
            $telefon = $_POST['telefon'] ?? '';
            $konu = $_POST['konu'] ?? '';
            $mesajMetni = $_POST['mesaj_metni'] ?? '';
            
            // Gerekli alanları kontrol et
            if (empty($gonderenAdi) || empty($gonderenEmail) || empty($mesajMetni)) {
                http_response_code(400);
                echo json_encode(['error' => 'Gönderen adı, email ve mesaj metni gerekli']);
                exit;
            }
            
            // Email formatını kontrol et
            if (!filter_var($gonderenEmail, FILTER_VALIDATE_EMAIL)) {
                http_response_code(400);
                echo json_encode(['error' => 'Geçerli bir email adresi giriniz']);
                exit;
            }
            
            $resimUrl = null;
            
            // Resim yükleme kontrolü
            if (isset($_FILES['resim']) && $_FILES['resim']['error'] === UPLOAD_ERR_OK) {
                $resimUrl = handleImageUpload($_FILES['resim'], $gonderenEmail);
            }
            
            $stmt = $conn->prepare("
                INSERT INTO iletisim_mesajlari 
                (gonderen_adi, gonderen_email, telefon, konu, mesaj_metni, resim_url) 
                VALUES (?, ?, ?, ?, ?, ?)
            ");
            
            $stmt->execute([
                $gonderenAdi,
                $gonderenEmail,
                $telefon,
                $konu,
                $mesajMetni,
                $resimUrl
            ]);
            
            $mesajId = $conn->lastInsertId();
            
            echo json_encode([
                'success' => true,
                'message' => 'Mesajınız başarıyla gönderildi. En kısa sürede size dönüş yapacağız.',
                'data' => [
                    'id' => $mesajId,
                    'resim_url' => $resimUrl
                ]
            ]);
            break;
            
        case 'PUT':
            // Mesaj durumunu güncelle (sadece admin)
            $user = authorize();
            
            if ($user['rutbe'] !== 'admin' && $user['rutbe'] !== 'ogretmen') {
                http_response_code(403);
                echo json_encode(['error' => 'Bu işlem için yönetici yetkileri gerekli']);
                exit;
            }
            
            $input = json_decode(file_get_contents('php://input'), true);
            $mesajId = $input['id'] ?? 0;
            $durum = $input['durum'] ?? 'okundu';
            $adminNotu = $input['admin_notu'] ?? null;
            
            $updateFields = ['durum = ?'];
            $params = [$durum];
            
            if ($adminNotu !== null) {
                $updateFields[] = 'admin_notu = ?';
                $params[] = $adminNotu;
            }
            
            if ($durum === 'cevaplanmis') {
                $updateFields[] = 'cevaplama_tarihi = CURRENT_TIMESTAMP';
            }
            
            $params[] = $mesajId;
            
            $stmt = $conn->prepare("
                UPDATE iletisim_mesajlari 
                SET " . implode(', ', $updateFields) . " 
                WHERE id = ?
            ");
            $stmt->execute($params);
            
            echo json_encode([
                'success' => true,
                'message' => 'Mesaj durumu güncellendi'
            ]);
            break;
            
        case 'DELETE':
            // Mesaj sil (sadece admin)
            $user = authorize();
            
            if ($user['rutbe'] !== 'admin') {
                http_response_code(403);
                echo json_encode(['error' => 'Bu işlem için admin yetkileri gerekli']);
                exit;
            }
            
            $mesajId = $_GET['id'] ?? 0;
            
            // Mesajı getir
            $stmt = $conn->prepare("SELECT * FROM iletisim_mesajlari WHERE id = ?");
            $stmt->execute([$mesajId]);
            $mesaj = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if (!$mesaj) {
                http_response_code(404);
                echo json_encode(['error' => 'Mesaj bulunamadı']);
                exit;
            }
            
            // Resim varsa sil
            if ($mesaj['resim_url']) {
                $resimYolu = '../../' . $mesaj['resim_url'];
                if (file_exists($resimYolu)) {
                    unlink($resimYolu);
                }
            }
            
            $stmt = $conn->prepare("DELETE FROM iletisim_mesajlari WHERE id = ?");
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
