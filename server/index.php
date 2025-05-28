
<?php
// Ana giriş noktası - API isteklerini uygun dosyalara yönlendirme
require_once 'config.php';

// Güvenlik başlıkları
header('X-Frame-Options: DENY');
header('X-XSS-Protection: 1; mode=block');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: strict-origin-when-cross-origin');

// İzin verilen endpoint'ler - Whitelist yaklaşımı
$allowedEndpoints = [
    'ogrenci_kayit' => 'api/ogrenci_girisi/ogrenci_kayit.php',
    'ogrenci_girisi' => 'api/ogrenci_girisi/ogrenci_girisi.php',
    'yonetici_bilgileri' => 'api/ogretmen/yonetici_bilgileri.php',
    'ogrenci_bilgileri' => 'api/ogretmen/ogrenci_bilgileri.php',
    'ogrenci_profil' => 'api/ogretmen/ogrenci_profil.php',
    'ogrenci_guncelle' => 'api/ogretmen/ogrenci_guncelle.php',
    'tum_ogrencileri_onayla' => 'api/tum_ogrencileri_onayla.php',
    'konu_anlatim_kaydet' => 'api/ogretmen/konu_anlatim_kaydet.php',
    'ogretmen/ogrenciler_listesi' => 'api/ogretmen/ogrenciler_listesi.php',
    'ogretmen/ogretmenler_listesi' => 'api/ogretmen/ogretmenler_listesi.php'
];

// Rate limiting basit kontrolü (session tabanlı)
session_start();
$clientIp = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
$currentTime = time();

// Son 60 saniyede 30'dan fazla istek kontrolü
if (!isset($_SESSION['request_count'])) {
    $_SESSION['request_count'] = [];
}

$_SESSION['request_count'] = array_filter($_SESSION['request_count'], function($timestamp) use ($currentTime) {
    return ($currentTime - $timestamp) < 60; // Son 60 saniye
});

if (count($_SESSION['request_count']) > 30) {
    http_response_code(429);
    echo json_encode(['error' => 'Çok fazla istek. Lütfen bekleyin.']);
    exit();
}

$_SESSION['request_count'][] = $currentTime;

// URL'den endpoint'i güvenli şekilde çıkar
$requestUri = $_SERVER['REQUEST_URI'];
$basePath = '/server/api/';

// Input validation ve sanitization
if (strpos($requestUri, $basePath) !== 0) {
    http_response_code(404);
    echo json_encode(['error' => 'Geçersiz API yolu']);
    exit();
}

$endpoint = substr($requestUri, strlen($basePath));
$endpoint = strtok($endpoint, '?'); // Query parametrelerini kaldır

// Güvenlik kontrolü: sadece alfanumerik karakterler ve underscore
if (!preg_match('/^[a-zA-Z0-9_]+$/', $endpoint)) {
    http_response_code(400);
    echo json_encode(['error' => 'Geçersiz endpoint formatı']);
    exit();
}

// Endpoint uzunluk kontrolü
if (strlen($endpoint) > 50) {
    http_response_code(400);
    echo json_encode(['error' => 'Endpoint çok uzun']);
    exit();
}

// Directory traversal koruması
if (strpos($endpoint, '..') !== false || strpos($endpoint, '/') !== false) {
    http_response_code(400);
    echo json_encode(['error' => 'Güvenlik ihlali tespit edildi']);
    exit();
}

// Whitelist kontrolü ve dosya yönlendirme
if (array_key_exists($endpoint, $allowedEndpoints)) {
    $filePath = $allowedEndpoints[$endpoint];
    
    // Dosya varlığı kontrolü
    if (!file_exists($filePath)) {
        error_log("API Hatası: Dosya bulunamadı - $filePath");
        http_response_code(500);
        echo json_encode(['error' => 'API servisi geçici olarak kullanılamıyor']);
        exit();
    }
    
    // Dosya güvenlik kontrolü
    $realPath = realpath($filePath);
    $apiDir = realpath('api/');
    
    if (!$realPath || strpos($realPath, $apiDir) !== 0) {
        error_log("Güvenlik İhlali: Geçersiz dosya yolu - $filePath");
        http_response_code(403);
        echo json_encode(['error' => 'Erişim reddedildi']);
        exit();
    }
    
    // Güvenli dosya include
    require_once $filePath;
    
} else {
    // Bilinmeyen endpoint'ler için log
    error_log("Bilinmeyen API endpoint: $endpoint - IP: $clientIp");
    http_response_code(404);
    echo json_encode(['error' => 'API endpoint bulunamadı']);
}
