<?php
declare(strict_types=1);

use PDO;
use RuntimeException;

function normalizeDateInput(?string $value, string $fallback, bool $endOfDay = false): string
{
    if ($value === null || trim($value) === '') {
        return adjustDateBoundary($fallback, $endOfDay);
    }

    try {
        $date = new DateTime($value);
    } catch (Exception $e) {
        return adjustDateBoundary($fallback, $endOfDay);
    }

    if ($endOfDay) {
        $date->setTime(23, 59, 59);
    } else {
        $date->setTime(0, 0, 0);
    }

    return $date->format('Y-m-d H:i:s');
}

function adjustDateBoundary(string $value, bool $endOfDay): string
{
    try {
        $date = new DateTime($value);
    } catch (Exception $e) {
        $date = new DateTime();
    }

    if ($endOfDay) {
        $date->setTime(23, 59, 59);
    } else {
        $date->setTime(0, 0, 0);
    }

    return $date->format('Y-m-d H:i:s');
}

function groupAttendanceRecords(array $records): array
{
    $grouped = [];

    foreach ($records as $record) {
        $dateKey = $record['tarih'];
        if (!isset($grouped[$dateKey])) {
            $grouped[$dateKey] = [
                'tarih' => $dateKey,
                'kayitlar' => [],
                'katilan_sayisi' => 0,
                'katilmayan_sayisi' => 0,
            ];
        }

        $grouped[$dateKey]['kayitlar'][] = $record;

        if ($record['durum'] === 'present') {
            $grouped[$dateKey]['katilan_sayisi']++;
        } elseif ($record['durum'] === 'absent') {
            $grouped[$dateKey]['katilmayan_sayisi']++;
        }
    }

    usort($grouped, static function (array $a, array $b): int {
        return strcmp($b['tarih'], $a['tarih']);
    });

    return $grouped;
}

function buildPaymentItems(array $payments): array
{
    $items = [];

    foreach ($payments as $payment) {
        $items[] = [
            'id' => (int)$payment['id'],
            'kullanici_id' => (int)$payment['ogrenci_id'],
            'islem_tipi' => 'Ödeme',
            'tutar' => (float)$payment['tutar'],
            'para_birimi' => 'TRY',
            'odeme_tarihi' => $payment['odeme_tarihi'],
            'aciklama' => $payment['aciklama'] ?? null,
            'durum' => 'odendi',
            'etiketi' => sprintf('%02d/%04d', (int)$payment['ay'], (int)$payment['yil']),
            'created_at' => $payment['odeme_tarihi'],
            'updated_at' => $payment['odeme_tarihi'],
            'ekleyen' => [
                'id' => null,
                'adi_soyadi' => null,
            ],
            'notlar' => [],
        ];
    }

    return $items;
}

function filterPaymentItems(array $items, ?string $durum): array
{
    if ($durum === null || trim($durum) === '' || strtolower($durum) === 'tum') {
        return $items;
    }

    $needle = strtolower($durum);

    return array_values(array_filter($items, static function (array $item) use ($needle): bool {
        return strtolower($item['durum'] ?? '') === $needle;
    }));
}

function getKullaniciUcretBilgileri(PDO $conn, int $ogrenciId, array $filters = []): array
{
    if ($ogrenciId <= 0) {
        throw new RuntimeException('Geçersiz öğrenci kimliği.');
    }

    $studentStmt = $conn->prepare(
        'SELECT o.id, o.adi_soyadi, o.email, o.avatar, o.rutbe,
                ob.ucret, ob.grubu, ob.okulu, ob.sinifi, ob.ders_adi
         FROM ogrenciler o
         LEFT JOIN ogrenci_bilgileri ob ON o.id = ob.ogrenci_id
         WHERE o.id = :id'
    );
    $studentStmt->execute([':id' => $ogrenciId]);
    $student = $studentStmt->fetch(PDO::FETCH_ASSOC);

    if (!$student) {
        throw new RuntimeException('Öğrenci bulunamadı.');
    }

    $attendanceStartDefault = date('Y-m-d H:i:s', strtotime('-3 months'));
    $paymentsStartDefault = date('Y-m-d H:i:s', strtotime('-6 months'));
    $nowDefault = date('Y-m-d H:i:s');

    $attendanceStart = normalizeDateInput($filters['baslangic'] ?? null, $attendanceStartDefault, false);
    $attendanceEnd = normalizeDateInput($filters['bitis'] ?? null, $nowDefault, true);

    $paymentsStart = normalizeDateInput($filters['baslangic'] ?? null, $paymentsStartDefault, false);
    $paymentsEnd = normalizeDateInput($filters['bitis'] ?? null, $nowDefault, true);

    $attendanceStmt = $conn->prepare(
        'SELECT id, ogrenci_id, tarih, durum, zaman, yontem, ders_tipi
         FROM devamsizlik_kayitlari
         WHERE ogrenci_id = :id AND tarih BETWEEN :start AND :end
         ORDER BY tarih DESC, zaman DESC'
    );
    $attendanceStmt->execute([
        ':id' => $ogrenciId,
        ':start' => $attendanceStart,
        ':end' => $attendanceEnd,
    ]);
    $attendanceRecords = $attendanceStmt->fetchAll(PDO::FETCH_ASSOC);

    $limit = 200;
    if (isset($filters['limit']) && is_numeric($filters['limit'])) {
        $limit = max(10, min(500, (int)$filters['limit']));
    }

    $paymentsStmt = $conn->prepare(
        'SELECT id, ogrenci_id, tutar, odeme_tarihi, aciklama, ay, yil
         FROM ogrenci_odemeler
         WHERE ogrenci_id = :id AND odeme_tarihi BETWEEN :start AND :end
         ORDER BY odeme_tarihi DESC, id DESC
         LIMIT :limit'
    );
    $paymentsStmt->bindValue(':id', $ogrenciId, PDO::PARAM_INT);
    $paymentsStmt->bindValue(':start', $paymentsStart);
    $paymentsStmt->bindValue(':end', $paymentsEnd);
    $paymentsStmt->bindValue(':limit', $limit, PDO::PARAM_INT);
    $paymentsStmt->execute();
    $payments = $paymentsStmt->fetchAll(PDO::FETCH_ASSOC);

    $presentCount = 0;
    $absentCount = 0;

    foreach ($attendanceRecords as $record) {
        if ($record['durum'] === 'present') {
            $presentCount++;
        } elseif ($record['durum'] === 'absent') {
            $absentCount++;
        }
    }

    $totalLessons = $presentCount + $absentCount;

    $ucret = (float)($student['ucret'] ?? 0);
    $ucretPerLesson = $ucret > 0 ? $ucret / 4 : 0;
    $expectedTotalAmount = $presentCount * $ucretPerLesson;

    $totalPaid = 0.0;
    foreach ($payments as $payment) {
        $totalPaid += (float)$payment['tutar'];
    }

    $remainingDebt = $expectedTotalAmount - $totalPaid;
    $lessonsUntilNextPayment = $presentCount > 0 ? 4 - ($presentCount % 4) : 4;
    if ($lessonsUntilNextPayment === 4) {
        $lessonsUntilNextPayment = 0;
    }

    $items = buildPaymentItems($payments);
    $items = filterPaymentItems($items, $filters['durum'] ?? null);

    $stats = [
        'toplam_islem' => count($items),
        'toplam_odenen' => round($totalPaid, 2),
        'toplam_bekleyen' => $remainingDebt > 0 ? round($remainingDebt, 2) : 0.0,
        'toplam_iptal' => 0.0,
        'beklenen_toplam' => round($expectedTotalAmount, 2),
        'kalan_borc' => round($remainingDebt, 2),
        'fazla_odeme' => $remainingDebt < 0 ? round(abs($remainingDebt), 2) : 0.0,
        'ucret' => round($ucret, 2),
        'ucret_per_ders' => round($ucretPerLesson, 2),
        'katildigi_ders' => $presentCount,
        'toplam_ders' => $totalLessons,
        'sonraki_odemeye_kalan_ders' => $lessonsUntilNextPayment,
    ];

    return [
        'kullanici' => [
            'id' => (int)$student['id'],
            'adi_soyadi' => $student['adi_soyadi'] ?? null,
            'email' => $student['email'] ?? null,
            'rutbe' => $student['rutbe'] ?? null,
            'grubu' => $student['grubu'] ?? null,
            'sinifi' => $student['sinifi'] ?? null,
            'okulu' => $student['okulu'] ?? null,
            'ucret' => $ucret,
            'ucret_per_ders' => $ucretPerLesson,
        ],
        'items' => $items,
        'stats' => $stats,
        'attendance' => [
            'records' => $attendanceRecords,
            'grouped' => groupAttendanceRecords($attendanceRecords),
            'present_count' => $presentCount,
            'absent_count' => $absentCount,
            'total_count' => $totalLessons,
        ],
        'filters' => [
            'durum' => $filters['durum'] ?? null,
            'baslangic' => $attendanceStart,
            'bitis' => $attendanceEnd,
            'limit' => $limit,
        ],
    ];
}