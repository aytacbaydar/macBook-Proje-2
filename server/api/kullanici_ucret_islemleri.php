<?php
require_once '../config.php';
require_once '../database/ucret_islemleri/helpers.php';

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Content-Type: application/json; charset=UTF-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

try {
    $user = authorize();
    if (!$user) {
        exit();
    }

    $conn = getConnection();
    $method = $_SERVER['REQUEST_METHOD'];

    $currentId = (int)($user['id'] ?? 0);
    $rutbe = (string)($user['rutbe'] ?? '');
    $hasPrivileges = in_array($rutbe, ['admin', 'yonetici', 'ogretmen'], true);

    if ($method === 'GET') {
        $targetId = $hasPrivileges && isset($_GET['kullanici_id']) ? (int)$_GET['kullanici_id'] : $currentId;
        if ($targetId <= 0) {
            errorResponse('kullanici_id bulunamadi.', 400);
        }

        $filters = [
            'durum' => $_GET['durum'] ?? null,
            'baslangic' => $_GET['baslangic'] ?? null,
            'bitis' => $_GET['bitis'] ?? null,
            'limit' => $_GET['limit'] ?? null,
        ];

        $data = fetchUcretIslemleri($conn, $targetId, $filters);
        successResponse($data, 'Ucret islemleri listelendi.');
    } elseif ($method === 'POST') {
        $payload = decodeJsonBody();
        if ($payload === null) {
            $payload = $_POST;
        }
        if (!is_array($payload)) {
            $payload = [];
        }

        $targetId = isset($payload['kullanici_id']) ? (int)$payload['kullanici_id'] : $currentId;
        if (!$hasPrivileges) {
            $targetId = $currentId;
        }

        if ($targetId <= 0) {
            errorResponse('kullanici_id gecersiz.', 400);
        }

        $item = createUcretIslemi($conn, $payload, $targetId, $currentId);
        successResponse(['item' => $item], 'Ucret islemi kaydedildi.');
    } else {
        errorResponse('Desteklenmeyen HTTP metodu.', 405);
    }
} catch (\InvalidArgumentException $e) {
    errorResponse($e->getMessage(), 422);
} catch (\PDOException $e) {
    errorResponse('Veritabani hatasi: ' . $e->getMessage(), 500);
} catch (\Throwable $t) {
    errorResponse('Beklenmeyen hata: ' . $t->getMessage(), 500);
}

function decodeJsonBody(): ?array
{
    $raw = file_get_contents('php://input');
    if ($raw === false || trim($raw) === '') {
        return null;
    }

    $data = json_decode($raw, true);
    if (json_last_error() !== JSON_ERROR_NONE) {
        return null;
    }

    return $data;
}