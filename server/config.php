<?php
// Hata çıktılarını tamamen devre dışı bırak
error_reporting(0);
ini_set('display_errors', 0);
ini_set('display_startup_errors', 0);

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
    // Authorization header'ı kontrol et
    $headers = getallheaders();
    $authHeader = null;
    
    // Case-insensitive header kontrolü
    foreach ($headers as $name => $value) {
        if (strtolower($name) === 'authorization') {
            $authHeader = $value;
            break;
        }
    }
    
    if (!$authHeader && isset($_SERVER['HTTP_AUTHORIZATION'])) {
        $authHeader = $_SERVER['HTTP_AUTHORIZATION'];
    }
    
    if (!$authHeader) {
        error_log("Authorization - Header bulunamadı. Mevcut headers: " . json_encode($headers));
        http_response_code(401);
        echo json_encode(['error' => 'Oturum süresi dolmuş. Lütfen tekrar giriş yapın.']);
        exit();
    }

    $token = str_replace('Bearer ', '', $authHeader);
    $token = trim($token);

    if (empty($token)) {
        error_log("Authorization - Token boş");
        http_response_code(401);
        echo json_encode(['error' => 'Oturum süresi dolmuş. Lütfen tekrar giriş yapın.']);
        exit();
    }

    // Token doğrulama
    try {
        $conn = getConnection();

        // Token ile kullanıcı bul
        $stmt = $conn->prepare("
            SELECT id, adi_soyadi, email, rutbe, aktif 
            FROM ogrenciler 
            WHERE MD5(CONCAT(id, email, sifre)) = :token 
            AND aktif = 1
        ");
        $stmt->bindParam(':token', $token);
        $stmt->execute();

        error_log("Authorization - Token: " . substr($token, 0, 10) . "... Query rowCount: " . $stmt->rowCount());

        if ($stmt->rowCount() === 0) {
            error_log("Authorization - Token veritabanında bulunamadı veya kullanıcı aktif değil");
            http_response_code(401);
            echo json_encode(['error' => 'Oturum süresi dolmuş. Lütfen tekrar giriş yapın.']);
            exit();
        }

        $user = $stmt->fetch(PDO::FETCH_ASSOC);
        error_log("Authorization - Başarılı giriş: " . $user['email']);

        return $user;
    } catch (PDOException $e) {
        error_log("Authorization - Veritabanı hatası: " . $e->getMessage());
        http_response_code(500);
        echo json_encode(['error' => 'Sistem hatası. Lütfen tekrar deneyin.']);
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
    function errorResponse($message, $code = 400) {
        // Output buffer'ı temizle
        if (ob_get_level()) ob_clean();
        http_response_code($code);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode([
            'success' => false,
            'message' => $message,
            'data' => null
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }
}

// Başarı yanıtı - function_exists kontrolü ile
if (!function_exists('successResponse')) {
    function successResponse($data = null, $message = 'Başarılı') {
        // Output buffer'ı temizle
        if (ob_get_level()) ob_clean();
        http_response_code(200);
        header('Content-Type: application/json; charset=utf-8');
        $response = [
            'success' => true,
            'message' => $message
        ];

        // Eğer data array ise, direkt merge et, değilse data key'i altına koy
        if (is_array($data)) {
            $response = array_merge($response, $data);
        } else {
            $response['data'] = $data;
        }

        echo json_encode($response, JSON_UNESCAPED_UNICODE);
        exit;
    }
}

// Arduino Bridge URL'si (Arduino bağlı bilgisayar PUBLIC IP'si)
if (!defined('LOCAL_ARDUINO_BRIDGE_URL')) {
    define('LOCAL_ARDUINO_BRIDGE_URL', 'http://77.245.149.70:8080'); // PUBLIC IP KULLANIN
}