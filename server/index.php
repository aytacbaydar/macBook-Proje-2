<?php
// Ana giriş noktası - API isteklerini uygun dosyalara yönlendirme
require_once 'config.php';

// Güvenlik başlıkları
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('X-XSS-Protection: 1; mode=block');
header('Referrer-Policy: strict-origin-when-cross-origin');

// CORS başlıklarını merkezi olarak yönet
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, X-CSRF-Token");
header("Access-Control-Max-Age: 3600");

// OPTIONS preflight istekleri için
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Rate limiting kontrolü
function checkRateLimit($endpoint) {
    $ip = $_SERVER['REMOTE_ADDR'];
    $userAgent = $_SERVER['HTTP_USER_AGENT'] ?? 'unknown';

    try {
        $conn = getConnection();

        // Son 1 dakikadaki istek sayısını kontrol et
        $stmt = $conn->prepare("
            SELECT COUNT(*) as request_count 
            FROM rate_limits 
            WHERE ip_address = ? 
            AND endpoint = ? 
            AND created_at > NOW() - INTERVAL 1 MINUTE
        ");

        $stmt->execute([$ip, $endpoint]);
        $result = $stmt->fetch(PDO::FETCH_ASSOC);

        // Rate limit: dakikada 60 istek
        if ($result['request_count'] >= 60) {
            http_response_code(429);
            echo json_encode([
                'error' => 'Rate limit aşıldı. Lütfen bir dakika bekleyip tekrar deneyin.',
                'retry_after' => 60
            ]);
            exit();
        }

        // İsteği kaydet
        $stmt = $conn->prepare("
            INSERT INTO rate_limits (ip_address, endpoint, user_agent, created_at) 
            VALUES (?, ?, ?, NOW())
        ");
        $stmt->execute([$ip, $endpoint, $userAgent]);

    } catch (PDOException $e) {
        // Rate limiting hatası durumunda devam et (sistem çökmemeli)
        error_log("Rate limiting hatası: " . $e->getMessage());
    }
}

// Request logging
function logRequest($endpoint, $method) {
    $logData = [
        'timestamp' => date('Y-m-d H:i:s'),
        'ip' => $_SERVER['REMOTE_ADDR'],
        'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? 'unknown',
        'method' => $method,
        'endpoint' => $endpoint,
        'request_uri' => $_SERVER['REQUEST_URI']
    ];

    $logFile = __DIR__ . '/../logs/api_requests.log';
    $logDir = dirname($logFile);

    if (!file_exists($logDir)) {
        mkdir($logDir, 0755, true);
    }

    file_put_contents($logFile, json_encode($logData) . "\n", FILE_APPEND | LOCK_EX);
}

// Input validation
function validateRequest($method, $endpoint) {
    // HTTP method kontrolü
    $allowedMethods = ['GET', 'POST', 'PUT', 'DELETE'];
    if (!in_array($method, $allowedMethods)) {
        http_response_code(405);
        echo json_encode(['error' => 'Desteklenmeyen HTTP metodu']);
        exit();
    }

    // Endpoint güvenlik kontrolü
    if (preg_match('/[^a-zA-Z0-9_\-.]/', $endpoint)) {
        http_response_code(400);
        echo json_encode(['error' => 'Geçersiz endpoint formatı']);
        exit();
    }

    // Content-Length kontrolü (büyük istekleri önle)
    $contentLength = $_SERVER['CONTENT_LENGTH'] ?? 0;
    $maxContentLength = 50 * 1024 * 1024; // 50MB

    if ($contentLength > $maxContentLength) {
        http_response_code(413);
        echo json_encode(['error' => 'İstek boyutu çok büyük']);
        exit();
    }
}

// Ana request handling
try {
    $requestUri = $_SERVER['REQUEST_URI'];
    $method = $_SERVER['REQUEST_METHOD'];
    $basePath = '/server/api/';

    // /server/api/ ile başlayan URL'leri işle
    if (strpos($requestUri, $basePath) === 0) {
        $endpoint = substr($requestUri, strlen($basePath));
        $endpoint = strtok($endpoint, '?'); // Query parametrelerini kaldır

        // Boş endpoint kontrolü
        if (empty($endpoint)) {
            http_response_code(400);
            echo json_encode(['error' => 'Endpoint belirtilmemiş']);
            exit();
        }

        // Güvenlik ve validation kontrolleri
        validateRequest($method, $endpoint);

        // Rate limiting kontrolü
        checkRateLimit($endpoint);

        // Request'i logla
        logRequest($endpoint, $method);

        // Endpoint'e göre yönlendirme (organize edilmiş klasör yapısı)
        $normalizedEndpoint = str_replace('.php', '', $endpoint);

        switch ($normalizedEndpoint) {
            // AUTH Endpoints
            case 'auth/login':
            case 'ogrenci_girisi': // Backward compatibility
                if ($method !== 'POST') {
                    http_response_code(405);
                    echo json_encode(['error' => 'Bu endpoint sadece POST metodunu destekler']);
                    exit();
                }
                require_once 'api/auth/login.php';
                break;

            case 'auth/register':
            case 'ogrenci_kayit': // Backward compatibility
                if ($method !== 'POST') {
                    http_response_code(405);
                    echo json_encode(['error' => 'Bu endpoint sadece POST metodunu destekler']);
                    exit();
                }
                require_once 'api/auth/register.php';
                break;

            // STUDENT Endpoints
            case 'student/profile':
            case 'ogrenci_bilgileri': // Backward compatibility
                if ($method !== 'GET') {
                    http_response_code(405);
                    echo json_encode(['error' => 'Bu endpoint sadece GET metodunu destekler']);
                    exit();
                }
                require_once 'api/student/profile.php';
                break;

            case 'student/update':
            case 'ogrenci_guncelle': // Backward compatibility
                if ($method !== 'PUT') {
                    http_response_code(405);
                    echo json_encode(['error' => 'Bu endpoint sadece PUT metodunu destekler']);
                    exit();
                }
                require_once 'api/student/update.php';
                break;

            case 'student/delete':
            case 'ogrenci_sil': // Backward compatibility
                if ($method !== 'DELETE') {
                    http_response_code(405);
                    echo json_encode(['error' => 'Bu endpoint sadece DELETE metodunu destekler']);
                    exit();
                }
                require_once 'api/student/delete.php';
                break;

            // ADMIN Endpoints
            case 'admin/dashboard':
            case 'yonetici_bilgileri': // Backward compatibility
                if (!in_array($method, ['GET', 'POST', 'DELETE'])) {
                    http_response_code(405);
                    echo json_encode(['error' => 'Bu endpoint GET, POST ve DELETE metodlarını destekler']);
                    exit();
                }
                require_once 'api/admin/dashboard.php';
                break;

            case 'admin/approve_all':
            case 'tum_ogrencileri_onayla': // Backward compatibility
                if ($method !== 'POST') {
                    http_response_code(405);
                    echo json_encode(['error' => 'Bu endpoint sadece POST metodunu destekler']);
                    exit();
                }
                require_once 'api/admin/approve_all.php';
                break;

            // CONTENT Endpoints
            case 'content/upload_lesson':
            case 'konu_anlatim_kaydet': // Backward compatibility
                if ($method !== 'POST') {
                    http_response_code(405);
                    echo json_encode(['error' => 'Bu endpoint sadece POST metodunu destekler']);
                    exit();
                }
                require_once 'api/content/upload_lesson.php';
                break;

            // Legacy support
            case 'ogrenci_profil':
                require_once 'api/ogrenci_profil.php';
                break;

            default:
                http_response_code(404);
                echo json_encode([
                    'error' => 'API endpoint bulunamadı',
                    'available_endpoints' => [
                        'auth/login',
                        'auth/register',
                        'student/profile',
                        'student/update',
                        'student/delete',
                        'admin/dashboard',
                        'admin/approve_all',
                        'content/upload_lesson',
                        'ogrenci_profil'
                    ]
                ]);
                break;
        }
    } else {
        // API dışındaki istekler için 404 dön
        http_response_code(404);
        echo json_encode(['error' => 'API endpoint bulunamadı. /server/api/ ile başlayan URL kullanın.']);
    }

} catch (Exception $e) {
    error_log("Index.php Error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['error' => 'Sunucu hatası oluştu']);
}

```

```
Updated the routing logic in index.php to reflect the new folder structure, including backward compatibility for old endpoints.
```

default:
                http_response_code(404);
                echo json_encode([
                    'error' => 'API endpoint bulunamadı',
                    'available_endpoints' => [
                        'auth/login',
                        'auth/register',
                        'student/profile',
                        'student/update',
                        'student/delete',
                        'admin/dashboard',
                        'admin/approve_all',
                        'content/upload_lesson',
                        'ogrenci_profil'
                    ]
                ]);
                break;
        }
    } else {
        // API dışındaki istekler için 404 dön
        http_response_code(404);
        echo json_encode(['error' => 'API endpoint bulunamadı. /server/api/ ile başlayan URL kullanın.']);
    }

} catch (Exception $e) {
    error_log("Index.php Error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['error' => 'Sunucu hatası oluştu']);
}