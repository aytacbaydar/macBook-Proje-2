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

        case 'ogretmenler_listesi':
            require_once 'api/ogretmenler_listesi.php';
            break;

        case 'devamsizlik_kayitlari':
            require_once 'api/devamsizlik_kayitlari.php';
            break;

        case 'devamsizlik_kaydet':
            require_once 'api/devamsizlik_kaydet.php';
            break;

        case 'yaklasan_odemeler':
            require_once 'api/yaklasan_odemeler.php';
            break;

        case 'konu_listesi':
            require_once 'api/konu_listesi.php';
            break;

        case 'konu_ekle':
            require_once 'api/konu_ekle.php';
            break;

        case 'islenen_konular':
            require_once 'api/islenen_konular.php';
            break;

        case 'islenen_konu_ekle':
            require_once 'api/islenen_konu_ekle.php';
            break;

        case 'islenen_konu_sil':
            require_once 'api/islenen_konu_sil.php';
            break;

        case 'create_konular_tables':
            require_once 'api/create_konular_tables.php';
            break;

        case 'ogrenci_profil':
            require_once 'api/ogrenci_profil.php';
            break;

        case 'sinav_cevaplari_kaydet':
            require_once 'api/sinav_cevaplari_kaydet.php';
            break;

        case 'sinav_detay_sonuc':
            require_once 'api/sinav_detay_sonuc.php';
            break;
        case 'sinav_sonucu_getir':
            require_once 'api/sinav_sonucu_getir.php';
            break;

        case 'soru_mesajlari':
            require_once 'api/soru_mesajlari.php';
            break;

        case 'mesaj_okundu_isaretle':
            require_once 'api/mesaj_okundu_isaretle.php';
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