<?php
require_once dirname(__DIR__) . '/../config.php';
require_once __DIR__ . '/helpers.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    errorResponse('Bu endpoint sadece GET isteklerini destekler.', 405);
}

try {
    $user = authorize();
    $conn = getConnection();

    $filters = array(
        'durum' => isset($_GET['durum']) ? $_GET['durum'] : null,
        'baslangic' => isset($_GET['baslangic']) ? $_GET['baslangic'] : null,
        'bitis' => isset($_GET['bitis']) ? $_GET['bitis'] : null,
        'limit' => isset($_GET['limit']) ? $_GET['limit'] : null,
    );

    $targetId = isset($user['id']) ? (int)$user['id'] : 0;

    if (isset($_GET['ogrenci_id']) && is_numeric($_GET['ogrenci_id'])) {
        $privileged = array('admin', 'ogretmen', 'yonetici');
        if (in_array(isset($user['rutbe']) ? $user['rutbe'] : '', $privileged, true)) {
            $targetId = (int)$_GET['ogrenci_id'];
        }
    }

    if ($targetId <= 0) {
        errorResponse('Öğrenci bulunamadı.', 400);
    }

    $data = getKullaniciUcretBilgileri($conn, $targetId, $filters);
    successResponse($data, 'Ücret bilgileri getirildi.');
} catch (RuntimeException $e) {
    errorResponse($e->getMessage(), 404);
} catch (Throwable $t) {
    errorResponse('Beklenmeyen hata: ' . $t->getMessage(), 500);
}