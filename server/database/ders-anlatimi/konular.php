<?php
declare(strict_types=1);

require_once __DIR__ . '/../../config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    errorResponse('Bu endpoint sadece GET isteğini destekler', 405);
}

$user = authorize();
if (!$user) {
    exit();
}

try {
    $conn = getConnection();

    $columnsStmt = $conn->query('SHOW COLUMNS FROM konular');
    $columns = array_column($columnsStmt->fetchAll(PDO::FETCH_ASSOC), 'Field');

    $hasAltKonu = in_array('alt_konu', $columns, true);
    $hasKazanim = in_array('kazanim_adi', $columns, true);
    $hasUnite = in_array('unite_adi', $columns, true);

    $select = ['konu_adi'];
    if ($hasAltKonu) {
        $select[] = 'alt_konu';
    } elseif ($hasUnite) {
        $select[] = 'unite_adi AS alt_konu';
        $hasAltKonu = true;
    }
    if ($hasKazanim) {
        $select[] = 'kazanim_adi';
    }

    $sql = 'SELECT ' . implode(', ', $select) . ' FROM konular ORDER BY konu_adi ASC';
    if ($hasAltKonu) {
        $sql .= ', alt_konu ASC';
    }

    $stmt = $conn->query($sql);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $normalized = array_map(
        static fn(array $row): array => [
            'konu_adi' => isset($row['konu_adi']) ? trim((string)$row['konu_adi']) : '',
            'alt_konu' => array_key_exists('alt_konu', $row) ? trim((string)$row['alt_konu']) : null,
            'kazanim_adi' => array_key_exists('kazanim_adi', $row) ? trim((string)$row['kazanim_adi']) : null,
        ],
        $rows
    );

    successResponse($normalized, 'Konular başarıyla getirildi');
} catch (PDOException $e) {
    errorResponse('Veritabanı hatası: ' . $e->getMessage(), 500);
} catch (Throwable $t) {
    errorResponse('Beklenmeyen hata: ' . $t->getMessage(), 500);
}
