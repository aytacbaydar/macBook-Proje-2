<?php
// Ana giriş noktası - API isteklerini uygun dosyalara yönlendirme
require_once 'config.php';

// URL'den endpoint'i çıkar
$requestUri = $_SERVER['REQUEST_URI'];
$basePath = '/server/api/';

// /server/api/ ile başlayan URL'leri işle
if (strpos($requestUri, $basePath) === 0) {
    $endpoint = substr($requestUri, strlen($basePath));
    $endpoint = strtok($endpoint, '?'); // Query parametrelerini kaldır
    
    // Endpoint'e göre yönlendirme
    switch ($endpoint) {
        case 'ogrenci_kayit':
            require_once 'api/ogrenci_kayit.php';
            break;
            
        case 'ogrenci_girisi':
            require_once 'api/ogrenci_girisi.php';
            break;
            
        case 'yonetici_bilgileri':
            require_once 'api/yonetici_bilgileri.php';
            break;
            
        case 'ogrenci_bilgileri':
            require_once 'api/ogrenci_bilgileri.php';
            break;
            
        case 'ogrenci_profil':
            require_once 'api/ogrenci_profil.php';
            break;
            
        case 'ogrenci_guncelle':
            require_once 'api/ogrenci_guncelle.php';
            break;
            
        case 'tum_ogrencileri_onayla':
            require_once 'api/tum_ogrencileri_onayla.php';
            break;
            
        case 'konu_anlatim_kaydet.php':
            require_once 'api/konu_anlatim_kaydet.php';
            break;
            
        default:
            http_response_code(404);
            echo json_encode(['error' => 'API endpoint bulunamadı']);
            break;
    }
} else {
    // API dışındaki istekler için 404 dön
    http_response_code(404);
    echo json_encode(['error' => 'Sayfa bulunamadı']);
}
