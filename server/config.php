
<?php
// Güvenli CORS ayarları
$allowed_origins = [
    'http://localhost:4200',
    'http://localhost:3000',
    'https://your-domain.com' // Prod domain'inizi buraya ekleyin
];

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (in_array($origin, $allowed_origins)) {
    header("Access-Control-Allow-Origin: $origin");
}

header("Access-Control-Allow-Methods: POST, GET, OPTIONS, PUT, DELETE");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");
header("Content-Type: application/json; charset=UTF-8");
header("X-Content-Type-Options: nosniff");
header("X-Frame-Options: DENY");
header("X-XSS-Protection: 1; mode=block");

// Preflight OPTIONS request için
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Environment variables (production'da .env dosyası kullanılmalı)
define('DB_HOST', $_ENV['DB_HOST'] ?? 'localhost');
define('DB_USER', $_ENV['DB_USER'] ?? 'Toluen96411');
define('DB_PASS', $_ENV['DB_PASS'] ?? '3g783O*qd');
define('DB_NAME', $_ENV['DB_NAME'] ?? 'ogrenciData');

// JWT Secret key (production'da mutlaka değiştirilmeli)
define('JWT_SECRET', $_ENV['JWT_SECRET'] ?? 'your-super-secret-jwt-key-change-this-in-production');

// Güvenlik ayarları
define('TOKEN_EXPIRY', 3600 * 24); // 24 saat
define('MAX_LOGIN_ATTEMPTS', 5);
define('LOGIN_LOCKOUT_TIME', 900); // 15 dakika

// Veritabanına bağlantı
function getConnection() {
    try {
        $conn = new PDO(
            'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4',
            DB_USER,
            DB_PASS,
            [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false,
                PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES utf8mb4"
            ]
        );
        return $conn;
    } catch (PDOException $e) {
        // Production'da detaylı hata mesajı gösterme
        error_log('Database connection error: ' . $e->getMessage());
        http_response_code(500);
        echo json_encode(['error' => 'Veritabanı bağlantı hatası']);
        exit();
    }
}

// Güvenli şifre hash'leme
function hashPassword($password) {
    return password_hash($password, PASSWORD_ARGON2ID, [
        'memory_cost' => 65536, // 64 MB
        'time_cost' => 4,       // 4 iterations
        'threads' => 3          // 3 threads
    ]);
}

// Şifre doğrulama
function verifyPassword($password, $hash) {
    return password_verify($password, $hash);
}

// Güvenli token oluşturma (JWT benzeri)
function generateSecureToken($userId, $email) {
    $header = json_encode(['typ' => 'JWT', 'alg' => 'HS256']);
    $payload = json_encode([
        'user_id' => $userId,
        'email' => $email,
        'exp' => time() + TOKEN_EXPIRY,
        'iat' => time()
    ]);
    
    $headerEncoded = base64url_encode($header);
    $payloadEncoded = base64url_encode($payload);
    
    $signature = hash_hmac('sha256', $headerEncoded . "." . $payloadEncoded, JWT_SECRET, true);
    $signatureEncoded = base64url_encode($signature);
    
    return $headerEncoded . "." . $payloadEncoded . "." . $signatureEncoded;
}

// Token doğrulama
function verifyToken($token) {
    $parts = explode('.', $token);
    if (count($parts) !== 3) {
        return false;
    }
    
    [$headerEncoded, $payloadEncoded, $signatureEncoded] = $parts;
    
    $signature = base64url_decode($signatureEncoded);
    $expectedSignature = hash_hmac('sha256', $headerEncoded . "." . $payloadEncoded, JWT_SECRET, true);
    
    if (!hash_equals($expectedSignature, $signature)) {
        return false;
    }
    
    $payload = json_decode(base64url_decode($payloadEncoded), true);
    
    if (!$payload || $payload['exp'] < time()) {
        return false;
    }
    
    return $payload;
}

// Base64 URL safe encoding/decoding
function base64url_encode($data) {
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}

function base64url_decode($data) {
    return base64_decode(str_pad(strtr($data, '-_', '+/'), strlen($data) % 4, '=', STR_PAD_RIGHT));
}

// Rate limiting kontrolü
function checkRateLimit($identifier, $limit = 100, $window = 3600) {
    $conn = getConnection();
    
    // Eski kayıtları temizle
    $stmt = $conn->prepare("DELETE FROM rate_limits WHERE created_at < ?");
    $stmt->execute([date('Y-m-d H:i:s', time() - $window)]);
    
    // Mevcut istek sayısını kontrol et
    $stmt = $conn->prepare("SELECT COUNT(*) FROM rate_limits WHERE identifier = ? AND created_at > ?");
    $stmt->execute([$identifier, date('Y-m-d H:i:s', time() - $window)]);
    $count = $stmt->fetchColumn();
    
    if ($count >= $limit) {
        http_response_code(429);
        echo json_encode(['error' => 'Çok fazla istek. Lütfen daha sonra tekrar deneyin.']);
        exit();
    }
    
    // Yeni istek kaydı ekle
    $stmt = $conn->prepare("INSERT INTO rate_limits (identifier, created_at) VALUES (?, NOW())");
    $stmt->execute([$identifier]);
}

// Güvenli oturum yetkilendirme
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

    // Yeni JWT token doğrulama
    $payload = verifyToken($token);
    if (!$payload) {
        http_response_code(401);
        echo json_encode(['error' => 'Geçersiz veya süresi dolmuş token']);
        exit();
    }

    // Kullanıcı bilgilerini veritabanından al
    try {
        $conn = getConnection();
        $stmt = $conn->prepare("SELECT id, adi_soyadi, email, rutbe, aktif, last_login FROM ogrenciler WHERE id = ? AND aktif = TRUE");
        $stmt->execute([$payload['user_id']]);
        
        $user = $stmt->fetch();
        if (!$user) {
            http_response_code(401);
            echo json_encode(['error' => 'Kullanıcı bulunamadı veya aktif değil']);
            exit();
        }
        
        return $user;
    } catch (PDOException $e) {
        error_log('Database error in authorize: ' . $e->getMessage());
        http_response_code(500);
        echo json_encode(['error' => 'Sistem hatası']);
        exit();
    }
}

// Admin yetkisini kontrol
function authorizeAdmin() {
    $user = authorize();
    if ($user['rutbe'] !== 'admin') {
        http_response_code(403);
        echo json_encode(['error' => 'Bu işlem için yönetici yetkileri gerekiyor']);
        exit();
    }
    return $user;
}

// Input validation ve sanitization
function validateAndSanitizeInput($data, $rules = []) {
    $sanitized = [];
    $errors = [];
    
    foreach ($rules as $field => $rule) {
        $value = $data[$field] ?? null;
        
        // Required check
        if (isset($rule['required']) && $rule['required'] && empty($value)) {
            $errors[$field] = $field . ' alanı zorunludur';
            continue;
        }
        
        if (!empty($value)) {
            // Type validation
            switch ($rule['type'] ?? 'string') {
                case 'email':
                    if (!filter_var($value, FILTER_VALIDATE_EMAIL)) {
                        $errors[$field] = 'Geçerli bir email adresi girin';
                    } else {
                        $sanitized[$field] = filter_var($value, FILTER_SANITIZE_EMAIL);
                    }
                    break;
                    
                case 'int':
                    if (!filter_var($value, FILTER_VALIDATE_INT)) {
                        $errors[$field] = 'Geçerli bir sayı girin';
                    } else {
                        $sanitized[$field] = (int)$value;
                    }
                    break;
                    
                case 'string':
                default:
                    $sanitized[$field] = htmlspecialchars(trim($value), ENT_QUOTES, 'UTF-8');
                    
                    // Length check
                    if (isset($rule['max_length']) && strlen($sanitized[$field]) > $rule['max_length']) {
                        $errors[$field] = $field . ' maksimum ' . $rule['max_length'] . ' karakter olabilir';
                    }
                    
                    if (isset($rule['min_length']) && strlen($sanitized[$field]) < $rule['min_length']) {
                        $errors[$field] = $field . ' minimum ' . $rule['min_length'] . ' karakter olmalıdır';
                    }
                    break;
            }
        }
    }
    
    if (!empty($errors)) {
        http_response_code(400);
        echo json_encode(['error' => 'Validasyon hatası', 'details' => $errors]);
        exit();
    }
    
    return $sanitized;
}

// JSON verilerini al ve validate et
function getJsonData($validationRules = []) {
    $rawData = file_get_contents("php://input");
    $data = json_decode($rawData, true);
    
    if (json_last_error() !== JSON_ERROR_NONE) {
        http_response_code(400);
        echo json_encode(['error' => 'Geçersiz JSON verisi']);
        exit();
    }
    
    if (!empty($validationRules)) {
        return validateAndSanitizeInput($data, $validationRules);
    }
    
    return $data;
}

// Güvenli hata yanıtı
function errorResponse($message, $statusCode = 400, $logDetails = null) {
    if ($logDetails) {
        error_log("Error: $message - Details: $logDetails");
    }
    
    http_response_code($statusCode);
    echo json_encode(['error' => $message]);
    exit();
}

// Başarı yanıtı
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

// CSRF token oluşturma
function generateCSRFToken() {
    if (!isset($_SESSION)) {
        session_start();
    }
    
    $token = bin2hex(random_bytes(32));
    $_SESSION['csrf_token'] = $token;
    return $token;
}

// CSRF token doğrulama
function verifyCSRFToken($token) {
    if (!isset($_SESSION)) {
        session_start();
    }
    
    return isset($_SESSION['csrf_token']) && hash_equals($_SESSION['csrf_token'], $token);
}
?>
