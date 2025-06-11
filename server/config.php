<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, GET, OPTIONS, PUT, DELETE");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");
header("Content-Type: application/json; charset=UTF-8");

// Türkiye saat dilimini ayarla
date_default_timezone_set('Europe/Istanbul');

// Preflight OPTIONS request için
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Veritabanı bağlantı bilgileri
define('DB_HOST', 'localhost');
define('DB_USER', 'Toluen96411');
define('DB_PASS', '3g783O*qd');
define('DB_NAME', 'ogrenciData');

// Veritabanına bağlantı
function getConnection() {
    try {
        $conn = new PDO(
            'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4',
            DB_USER,
            DB_PASS,
            [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
        );
        return $conn;
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Veritabanı bağlantı hatası: ' . $e->getMessage()]);
        exit();
    }
}

// Oturum yetkilendirme
function authorize() {
    if (!isset($_SERVER['HTTP_AUTHORIZATION'])) {
        http_response_code(401);
        echo json_encode(['error' => 'Yetkilendirme gerekli']);
        exit();
    }

    $auth = $_SERVER['HTTP_AUTHORIZATION'];
    $token = str_replace('Bearer ', '', $auth);
    
    if (empty($token)) {
        http_response_code(401);
        echo json_encode(['error' => 'Geçersiz token']);
        exit();
    }

    // Token doğrulama
    try {
        $conn = getConnection();
        
        // Debug için önce fusun@gmail.com kullanıcısını kontrol et
        $debugStmt = $conn->prepare("SELECT id, adi_soyadi, email, rutbe, aktif, sifre FROM ogrenciler WHERE email = 'fusun@gmail.com'");
        $debugStmt->execute();
        $debugUser = $debugStmt->fetch(PDO::FETCH_ASSOC);
        
        if ($debugUser) {
            $expectedToken = md5($debugUser['id'] . $debugUser['email'] . $debugUser['sifre']);
            error_log("Debug - fusun@gmail.com için beklenen token: " . $expectedToken);
            error_log("Debug - Gelen token: " . $token);
            error_log("Debug - Aktif durumu: " . $debugUser['aktif']);
            error_log("Debug - Rütbe: " . $debugUser['rutbe']);
        }
        
        // Orijinal token doğrulama
        $stmt = $conn->prepare("SELECT id, adi_soyadi, email, rutbe FROM ogrenciler WHERE MD5(CONCAT(id, email, sifre)) = :token AND aktif = 1");
        $stmt->bindParam(':token', $token);
        $stmt->execute();
        
        if ($stmt->rowCount() > 0) {
            return $stmt->fetch(PDO::FETCH_ASSOC);
        } else {
            // Aktif durumu farklı değerler de deneyebilir
            $stmt2 = $conn->prepare("SELECT id, adi_soyadi, email, rutbe FROM ogrenciler WHERE MD5(CONCAT(id, email, sifre)) = :token AND (aktif = 1 OR aktif = '1' OR aktif = TRUE OR aktif = 'true')");
            $stmt2->bindParam(':token', $token);
            $stmt2->execute();
            
            if ($stmt2->rowCount() > 0) {
                return $stmt2->fetch(PDO::FETCH_ASSOC);
            }
            
            http_response_code(401);
            echo json_encode(['error' => 'Geçersiz token veya hesap aktif değil', 'debug_token' => $token]);
            exit();
        }
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Veritabanı hatası: ' . $e->getMessage()]);
        exit();
    }
}

// Admin yetkisini kontrol
function authorizeAdmin() {
    $user = authorize();
    if ($user['rutbe'] !== 'admin' && $user['rutbe'] !== 'ogretmen') {
        http_response_code(403);
        echo json_encode(['error' => 'Bu işlem için yönetici yetkileri gerekiyor']);
        exit();
    }
    return $user;
}

// JSON verilerini al
function getJsonData() {
    $data = json_decode(file_get_contents("php://input"), true);
    if (json_last_error() !== JSON_ERROR_NONE) {
        http_response_code(400);
        echo json_encode(['error' => 'Geçersiz JSON verisi']);
        exit();
    }
    return $data;
}

// Hata yanıtı - function_exists kontrolü ile
if (!function_exists('errorResponse')) {
    function errorResponse($message, $statusCode = 400) {
        http_response_code($statusCode);
        echo json_encode(['error' => $message]);
        exit();
    }
}

// Başarı yanıtı - function_exists kontrolü ile
if (!function_exists('successResponse')) {
    function successResponse($data = null, $message = null) {
        $response = ['success' => true];
        
        if ($data !== null) {
            $response['data'] = $data;
        }
        
        if ($message !== null) {
            $response['message'] = $message;
        }
        
        echo json_encode($response);
        exit();
    }
}

// Arduino Bridge URL'si (Arduino bağlı bilgisayar IP'si)
if (!defined('LOCAL_ARDUINO_BRIDGE_URL')) {
    define('LOCAL_ARDUINO_BRIDGE_URL', 'http://192.168.0.30:8080');
}
