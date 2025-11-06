<?php
require_once '../../../config.php';
require_once '../../../database/ucret_islemleri/kullanici_ucret_bilgileri.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    errorResponse('Bu endpoint sadece GET isteklerini destekler.', 405);
}

try {
    $user = authorize();
    $conn = getConnection();

    $filters = [
        'durum' => $_GET['durum'] ?? null,
        'baslangic' => $_GET['baslangic'] ?? null,
        'bitis' => $_GET['bitis'] ?? null,
        'limit' => $_GET['limit'] ?? null,
    ];

    $targetId = (int)($user['id'] ?? 0);

    if (isset($_GET['ogrenci_id']) && is_numeric($_GET['ogrenci_id'])) {
        if (in_array($user['rutbe'] ?? '', ['admin', 'ogretmen', 'yonetici'], true)) {
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