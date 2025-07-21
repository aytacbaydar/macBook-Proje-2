<?php
// CORS başlıkları
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// OPTIONS isteklerini işle
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

// Config dosyasını dahil et
require_once '../config.php';

// GET isteği kontrolü
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    errorResponse('Sadece GET istekleri kabul edilir');
}

try {
    // Bağlantıyı al
    $pdo = getConnection();

    // Tablo var mı kontrol et
    $stmt = $pdo->query("SHOW TABLES LIKE 'cevap_anahtarlari'");
    if ($stmt->rowCount() == 0) {
        // Tablo yoksa boş dizi döndür
        successResponse([], 'Tablo bulunamadı, boş liste döndürülüyor.');
        exit;
    }

    // Authorization kontrolü - multiple methods to get headers
    $headers = array();

    // Method 1: getallheaders() (Apache)
    if (function_exists('getallheaders')) {
        $headers = getallheaders();
    }

    // Method 2: $_SERVER variables (Nginx/other servers)
    if (empty($headers)) {
        foreach ($_SERVER as $key => $value) {
            if (substr($key, 0, 5) === 'HTTP_') {
                $header_name = str_replace(' ', '-', ucwords(str_replace('_', ' ', strtolower(substr($key, 5)))));
                $headers[$header_name] = $value;
            }
        }
    }

    // Authorization header kontrolü
    $authHeader = $headers['Authorization'] ?? $headers['authorization'] ?? $_SERVER['HTTP_AUTHORIZATION'] ?? '';

    if (empty($authHeader) || !preg_match('/Bearer\s+(.*)$/i', $authHeader, $matches)) {
        throw new Exception('Yetkisiz erişim');
    }

    $token = trim($matches[1]);

    // Sınavları katılımcı sayısı ile birlikte listele
    $sql = "
        SELECT 
            ca.*,
            COALESCE(katilimci.katilimci_sayisi, 0) as katilimci_sayisi
        FROM cevap_anahtarlari ca
        LEFT JOIN (
            SELECT 
                sinav_id,
                COUNT(DISTINCT ogrenci_id) as katilimci_sayisi
            FROM sinav_sonuclari 
            GROUP BY sinav_id
        ) katilimci ON ca.id = katilimci.sinav_id
        ORDER BY ca.created_at DESC
    ";
    $stmt = $pdo->prepare($sql);
    $stmt->execute();

    $cevapAnahtarlari = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // JSON alanlarını decode et
    foreach ($cevapAnahtarlari as &$row) {
        $row['cevaplar'] = json_decode($row['cevaplar'], true);
        $row['konular'] = json_decode($row['konular'], true);
        $row['videolar'] = json_decode($row['videolar'], true);
    }

    successResponse($cevapAnahtarlari, 'Cevap anahtarları başarıyla getirildi.');

} catch (Exception $e) {
    errorResponse($e->getMessage());
}

// Bağlantıyı kapat
closeConnection();
?>