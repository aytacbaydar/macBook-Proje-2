<?php

function ensureUcretIslemleriTables(PDO $conn)
{
    $conn->exec(<<<'SQL'
CREATE TABLE IF NOT EXISTS kullanici_ucret_islemleri (
    id INT AUTO_INCREMENT PRIMARY KEY,
    kullanici_id INT NOT NULL,
    islem_tipi VARCHAR(50) NOT NULL,
    tutar DECIMAL(12, 2) NOT NULL DEFAULT 0,
    para_birimi VARCHAR(8) NOT NULL DEFAULT 'TRY',
    odeme_tarihi DATETIME NOT NULL,
    aciklama TEXT DEFAULT NULL,
    durum VARCHAR(30) NOT NULL DEFAULT 'beklemede',
    etiketi VARCHAR(50) DEFAULT NULL,
    ekleyen_id INT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (kullanici_id) REFERENCES kullanicilar(id) ON DELETE CASCADE,
    FOREIGN KEY (ekleyen_id) REFERENCES kullanicilar(id) ON DELETE SET NULL,
    INDEX idx_kullanici_tarih (kullanici_id, odeme_tarihi),
    INDEX idx_durum (durum),
    INDEX idx_etiket (etiketi)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
SQL
    );

    $conn->exec(<<<'SQL'
CREATE TABLE IF NOT EXISTS kullanici_ucret_notlari (
    id INT AUTO_INCREMENT PRIMARY KEY,
    islem_id INT NOT NULL,
    baslik VARCHAR(120) DEFAULT NULL,
    icerik TEXT DEFAULT NULL,
    ekleyen_id INT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (islem_id) REFERENCES kullanici_ucret_islemleri(id) ON DELETE CASCADE,
    FOREIGN KEY (ekleyen_id) REFERENCES kullanicilar(id) ON DELETE SET NULL,
    INDEX idx_islem (islem_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
SQL
    );

    ensureUcretIslemleriColumn($conn, 'kullanici_ucret_islemleri', 'etiketi');
    ensureUcretIslemleriColumn($conn, 'kullanici_ucret_islemleri', 'ekleyen_id');
}

function ensureUcretIslemleriColumn(PDO $conn, $table, $column)
{
    $stmt = $conn->prepare('SHOW COLUMNS FROM ' . $table . ' LIKE :column');
    $stmt->execute(array(':column' => $column));
    if ($stmt->fetch(PDO::FETCH_ASSOC) !== false) {
        return;
    }

    if ($column === 'etiketi') {
        $conn->exec('ALTER TABLE ' . $table . " ADD COLUMN etiketi VARCHAR(50) DEFAULT NULL AFTER durum");
    } elseif ($column === 'ekleyen_id') {
        $conn->exec('ALTER TABLE ' . $table . " ADD COLUMN ekleyen_id INT DEFAULT NULL AFTER etiketi");
        $conn->exec('ALTER TABLE ' . $table . " ADD CONSTRAINT fk_ucret_islem_ekleyen FOREIGN KEY (ekleyen_id) REFERENCES kullanicilar(id) ON DELETE SET NULL");
    }
}

function normalizeDateFilter($value, $endOfDay)
{
    if ($value === null) {
        return null;
    }

    $trimmed = trim((string)$value);
    if ($trimmed === '') {
        return null;
    }

    try {
        $date = new DateTime($trimmed);
    } catch (Exception $e) {
        return null;
    }

    if ($endOfDay) {
        $date->setTime(23, 59, 59);
    } else {
        $date->setTime(0, 0, 0);
    }

    return $date->format('Y-m-d H:i:s');
}

function normalizeDateTimeValue($value)
{
    if ($value === null) {
        return date('Y-m-d H:i:s');
    }

    $trimmed = trim((string)$value);
    if ($trimmed === '') {
        return date('Y-m-d H:i:s');
    }

    try {
        $date = new DateTime($trimmed);
    } catch (Exception $e) {
        throw new InvalidArgumentException('Geçersiz odeme_tarihi değeri.');
    }

    return $date->format('Y-m-d H:i:s');
}

function groupAttendanceRecords($records)
{
    $grouped = array();

    foreach ($records as $record) {
        $dateKey = $record['tarih'];
        if (!isset($grouped[$dateKey])) {
            $grouped[$dateKey] = array(
                'tarih' => $dateKey,
                'kayitlar' => array(),
                'katilan_sayisi' => 0,
                'katilmayan_sayisi' => 0,
            );
        }

        $grouped[$dateKey]['kayitlar'][] = $record;

        if ($record['durum'] === 'present') {
            $grouped[$dateKey]['katilan_sayisi']++;
        } elseif ($record['durum'] === 'absent') {
            $grouped[$dateKey]['katilmayan_sayisi']++;
        }
    }

    usort($grouped, function ($a, $b) {
        return strcmp($b['tarih'], $a['tarih']);
    });

    return $grouped;
}

function buildPaymentItems($payments)
{
    $items = array();

    foreach ($payments as $payment) {
        $items[] = array(
            'id' => (int)$payment['id'],
            'kullanici_id' => (int)$payment['ogrenci_id'],
            'islem_tipi' => 'Ödeme',
            'tutar' => (float)$payment['tutar'],
            'para_birimi' => 'TRY',
            'odeme_tarihi' => $payment['odeme_tarihi'],
            'aciklama' => isset($payment['aciklama']) ? $payment['aciklama'] : null,
            'durum' => 'odendi',
            'etiketi' => sprintf('%02d/%04d', (int)$payment['ay'], (int)$payment['yil']),
            'created_at' => $payment['odeme_tarihi'],
            'updated_at' => $payment['odeme_tarihi'],
            'ekleyen' => array(
                'id' => null,
                'adi_soyadi' => null,
            ),
            'notlar' => array(),
        );
    }

    return $items;
}

function filterPaymentItems($items, $durum)
{
    if ($durum === null) {
        return $items;
    }

    $needle = strtolower(trim((string)$durum));
    if ($needle === '' || $needle === 'tum') {
        return $items;
    }

    $filtered = array();
    foreach ($items as $item) {
        $status = isset($item['durum']) ? strtolower($item['durum']) : '';
        if ($status === $needle) {
            $filtered[] = $item;
        }
    }

    return array_values($filtered);
}

function fetchUcretIslemleri(PDO $conn, $kullaniciId, $filters = array())
{
    ensureUcretIslemleriTables($conn);

    $kullaniciId = (int)$kullaniciId;
    if ($kullaniciId <= 0) {
        return array(
            'kullanici' => null,
            'items' => array(),
            'stats' => array(),
            'attendance' => array(),
            'filters' => $filters,
        );
    }

    $where = array('i.kullanici_id = :kullanici_id');
    $params = array(':kullanici_id' => $kullaniciId);

    if (isset($filters['durum'])) {
        $durum = trim((string)$filters['durum']);
        if ($durum !== '' && strtolower($durum) !== 'tum') {
            $where[] = 'i.durum = :durum';
            $params[':durum'] = strtolower($durum);
        }
    }

    $baslangic = normalizeDateFilter(isset($filters['baslangic']) ? $filters['baslangic'] : null, false);
    if ($baslangic !== null) {
        $where[] = 'i.odeme_tarihi >= :baslangic';
        $params[':baslangic'] = $baslangic;
    }

    $bitis = normalizeDateFilter(isset($filters['bitis']) ? $filters['bitis'] : null, true);
    if ($bitis !== null) {
        $where[] = 'i.odeme_tarihi <= :bitis';
        $params[':bitis'] = $bitis;
    }

    $whereSql = implode(' AND ', $where);

    $limitSql = '';
    if (isset($filters['limit']) && is_numeric($filters['limit'])) {
        $limit = max(1, min(500, (int)$filters['limit']));
        $limitSql = ' LIMIT ' . $limit;
    }

    $sql = 'SELECT
            i.id,
            i.kullanici_id,
            i.islem_tipi,
            i.tutar,
            i.para_birimi,
            i.odeme_tarihi,
            i.aciklama,
            i.durum,
            i.etiketi,
            i.created_at,
            i.updated_at,
            i.ekleyen_id,
            ekleyen.adi_soyadi AS ekleyen_adi,
            n.id AS note_id,
            n.baslik AS note_baslik,
            n.icerik AS note_icerik,
            n.created_at AS note_created_at,
            note_user.id AS note_ekleyen_id,
            note_user.adi_soyadi AS note_ekleyen_adi
        FROM kullanici_ucret_islemleri i
        LEFT JOIN kullanicilar ekleyen ON ekleyen.id = i.ekleyen_id
        LEFT JOIN kullanici_ucret_notlari n ON n.islem_id = i.id
        LEFT JOIN kullanicilar note_user ON note_user.id = n.ekleyen_id
        WHERE ' . $whereSql . '
        ORDER BY i.odeme_tarihi DESC, i.id DESC, n.created_at ASC' . $limitSql;

    $stmt = $conn->prepare($sql);
    $stmt->execute($params);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $items = array();
    foreach ($rows as $row) {
        $id = (int)$row['id'];
        if (!isset($items[$id])) {
            $items[$id] = array(
                'id' => $id,
                'kullanici_id' => (int)$row['kullanici_id'],
                'islem_tipi' => $row['islem_tipi'],
                'tutar' => (float)$row['tutar'],
                'para_birimi' => $row['para_birimi'],
                'odeme_tarihi' => $row['odeme_tarihi'],
                'aciklama' => $row['aciklama'],
                'durum' => $row['durum'],
                'etiketi' => $row['etiketi'],
                'ekleyen' => array(
                    'id' => $row['ekleyen_id'] !== null ? (int)$row['ekleyen_id'] : null,
                    'adi_soyadi' => isset($row['ekleyen_adi']) ? $row['ekleyen_adi'] : null,
                ),
                'created_at' => $row['created_at'],
                'updated_at' => $row['updated_at'],
                'notlar' => array(),
            );
        }

        if ($row['note_id'] !== null) {
            $items[$id]['notlar'][] = array(
                'id' => (int)$row['note_id'],
                'baslik' => $row['note_baslik'],
                'icerik' => $row['note_icerik'],
                'created_at' => $row['note_created_at'],
                'ekleyen' => array(
                    'id' => $row['note_ekleyen_id'] !== null ? (int)$row['note_ekleyen_id'] : null,
                    'adi_soyadi' => isset($row['note_ekleyen_adi']) ? $row['note_ekleyen_adi'] : null,
                ),
            );
        }
    }

    $items = array_values($items);

    $statSql = 'SELECT
            COUNT(*) AS adet,
            COALESCE(SUM(CASE WHEN durum IN (\'tamamlandi\', \'odendi\') THEN tutar ELSE 0 END), 0) AS toplam_odenen,
            COALESCE(SUM(CASE WHEN durum IN (\'beklemede\', \'taslak\') THEN tutar ELSE 0 END), 0) AS toplam_bekleyen,
            COALESCE(SUM(CASE WHEN durum IN (\'iptal\', \'iade\') THEN tutar ELSE 0 END), 0) AS toplam_iptal
        FROM kullanici_ucret_islemleri i
        WHERE ' . $whereSql;

    $statStmt = $conn->prepare($statSql);
    $statStmt->execute($params);
    $statRow = $statStmt->fetch(PDO::FETCH_ASSOC);
    if (!$statRow) {
        $statRow = array();
    }

    $userStmt = $conn->prepare('SELECT id, adi_soyadi, email, rutbe FROM kullanicilar WHERE id = :id LIMIT 1');
    $userStmt->execute(array(':id' => $kullaniciId));
    $kullanici = $userStmt->fetch(PDO::FETCH_ASSOC);

    return array(
        'kullanici' => $kullanici ? $kullanici : null,
        'items' => $items,
        'stats' => array(
            'toplam_islem' => isset($statRow['adet']) ? (int)$statRow['adet'] : 0,
            'toplam_odenen' => isset($statRow['toplam_odenen']) ? (float)$statRow['toplam_odenen'] : 0.0,
            'toplam_bekleyen' => isset($statRow['toplam_bekleyen']) ? (float)$statRow['toplam_bekleyen'] : 0.0,
            'toplam_iptal' => isset($statRow['toplam_iptal']) ? (float)$statRow['toplam_iptal'] : 0.0,
        ),
        'filters' => array(
            'durum' => isset($filters['durum']) ? $filters['durum'] : null,
            'baslangic' => $baslangic,
            'bitis' => $bitis,
            'limit' => isset($filters['limit']) ? $filters['limit'] : null,
        ),
    );
}

function fetchUcretIslemiById(PDO $conn, $id)
{
    ensureUcretIslemleriTables($conn);

    $stmt = $conn->prepare(
        'SELECT
            i.id,
            i.kullanici_id,
            i.islem_tipi,
            i.tutar,
            i.para_birimi,
            i.odeme_tarihi,
            i.aciklama,
            i.durum,
            i.etiketi,
            i.created_at,
            i.updated_at,
            i.ekleyen_id,
            ekleyen.adi_soyadi AS ekleyen_adi,
            n.id AS note_id,
            n.baslik AS note_baslik,
            n.icerik AS note_icerik,
            n.created_at AS note_created_at,
            note_user.id AS note_ekleyen_id,
            note_user.adi_soyadi AS note_ekleyen_adi
        FROM kullanici_ucret_islemleri i
        LEFT JOIN kullanicilar ekleyen ON ekleyen.id = i.ekleyen_id
        LEFT JOIN kullanici_ucret_notlari n ON n.islem_id = i.id
        LEFT JOIN kullanicilar note_user ON note_user.id = n.ekleyen_id
        WHERE i.id = :id
        ORDER BY n.created_at ASC'
    );
    $stmt->execute(array(':id' => (int)$id));
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    if (!$rows) {
        return null;
    }

    $first = $rows[0];
    $item = array(
        'id' => (int)$first['id'],
        'kullanici_id' => (int)$first['kullanici_id'],
        'islem_tipi' => $first['islem_tipi'],
        'tutar' => (float)$first['tutar'],
        'para_birimi' => $first['para_birimi'],
        'odeme_tarihi' => $first['odeme_tarihi'],
        'aciklama' => $first['aciklama'],
        'durum' => $first['durum'],
        'etiketi' => $first['etiketi'],
        'ekleyen' => array(
            'id' => $first['ekleyen_id'] !== null ? (int)$first['ekleyen_id'] : null,
            'adi_soyadi' => isset($first['ekleyen_adi']) ? $first['ekleyen_adi'] : null,
        ),
        'created_at' => $first['created_at'],
        'updated_at' => $first['updated_at'],
        'notlar' => array(),
    );

    foreach ($rows as $row) {
        if ($row['note_id'] !== null) {
            $item['notlar'][] = array(
                'id' => (int)$row['note_id'],
                'baslik' => $row['note_baslik'],
                'icerik' => $row['note_icerik'],
                'created_at' => $row['note_created_at'],
                'ekleyen' => array(
                    'id' => $row['note_ekleyen_id'] !== null ? (int)$row['note_ekleyen_id'] : null,
                    'adi_soyadi' => isset($row['note_ekleyen_adi']) ? $row['note_ekleyen_adi'] : null,
                ),
            );
        }
    }

    return $item;
}

function createUcretIslemi(PDO $conn, $payload, $kullaniciId, $ekleyenId)
{
    ensureUcretIslemleriTables($conn);

    $payload = is_array($payload) ? $payload : array();

    $islemTipi = trim(isset($payload['islem_tipi']) ? $payload['islem_tipi'] : '');
    if ($islemTipi === '') {
        throw new InvalidArgumentException('islem_tipi alanı zorunludur.');
    }

    $tutar = (double)(isset($payload['tutar']) ? $payload['tutar'] : 0);
    if ($tutar <= 0) {
        throw new InvalidArgumentException('tutar alanı 0 dan büyük olmalı.');
    }

    $paraBirimiRaw = strtoupper(trim(isset($payload['para_birimi']) ? $payload['para_birimi'] : 'TRY'));
    $sanitizedCurrency = preg_replace('/[^A-Z]/', '', $paraBirimiRaw);
    if ($sanitizedCurrency === '') {
        $sanitizedCurrency = 'TRY';
    }
    $paraBirimi = substr($sanitizedCurrency, 0, 8);

    $odemeTarihi = normalizeDateTimeValue(isset($payload['odeme_tarihi']) ? $payload['odeme_tarihi'] : null);

    $durumAllowed = array('beklemede', 'taslak', 'tamamlandi', 'odendi', 'iptal', 'iade');
    $durum = strtolower(trim(isset($payload['durum']) ? $payload['durum'] : 'beklemede'));
    if (!in_array($durum, $durumAllowed, true)) {
        $durum = 'beklemede';
    }

    $etiket = trim(isset($payload['etiketi']) ? $payload['etiketi'] : '');
    if ($etiket === '') {
        $etiket = null;
    } else {
        $etiket = substr($etiket, 0, 50);
    }

    $aciklama = trim(isset($payload['aciklama']) ? $payload['aciklama'] : '');
    if ($aciklama === '') {
        $aciklama = null;
    }

    $stmt = $conn->prepare(
        'INSERT INTO kullanici_ucret_islemleri
            (kullanici_id, islem_tipi, tutar, para_birimi, odeme_tarihi, aciklama, durum, etiketi, ekleyen_id)
         VALUES
            (:kullanici_id, :islem_tipi, :tutar, :para_birimi, :odeme_tarihi, :aciklama, :durum, :etiketi, :ekleyen_id)'
    );

    $stmt->execute(array(
        ':kullanici_id' => (int)$kullaniciId,
        ':islem_tipi' => $islemTipi,
        ':tutar' => $tutar,
        ':para_birimi' => $paraBirimi,
        ':odeme_tarihi' => $odemeTarihi,
        ':aciklama' => $aciklama,
        ':durum' => $durum,
        ':etiketi' => $etiket,
        ':ekleyen_id' => $ekleyenId > 0 ? (int)$ekleyenId : null,
    ));

    $islemId = (int)$conn->lastInsertId();

    $noteBaslik = trim(isset($payload['not_baslik']) ? $payload['not_baslik'] : '');
    $noteIcerik = trim(isset($payload['not_icerik']) ? $payload['not_icerik'] : '');
    if ($noteBaslik !== '' || $noteIcerik !== '') {
        $noteStmt = $conn->prepare(
            'INSERT INTO kullanici_ucret_notlari (islem_id, baslik, icerik, ekleyen_id)
             VALUES (:islem_id, :baslik, :icerik, :ekleyen_id)'
        );
        $noteStmt->execute(array(
            ':islem_id' => $islemId,
            ':baslik' => $noteBaslik !== '' ? $noteBaslik : null,
            ':icerik' => $noteIcerik !== '' ? $noteIcerik : null,
            ':ekleyen_id' => $ekleyenId > 0 ? (int)$ekleyenId : null,
        ));
    }

    $item = fetchUcretIslemiById($conn, $islemId);
    if ($item === null) {
        throw new RuntimeException('Yeni ücret işlemi okunamadı.');
    }

    return $item;
}

function getKullaniciUcretBilgileri(PDO $conn, $ogrenciId, $filters = array())
{
    $ogrenciId = (int)$ogrenciId;
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
    $studentStmt->execute(array(':id' => $ogrenciId));
    $student = $studentStmt->fetch(PDO::FETCH_ASSOC);

    if (!$student) {
        throw new RuntimeException('Öğrenci bulunamadı.');
    }

    $attendanceStartDefault = date('Y-m-d H:i:s', strtotime('-3 months'));
    $paymentsStartDefault = date('Y-m-d H:i:s', strtotime('-6 months'));
    $nowDefault = date('Y-m-d H:i:s');

    $attendanceStart = normalizeDateFilter(isset($filters['baslangic']) ? $filters['baslangic'] : null, false);
    if ($attendanceStart === null) {
        $attendanceStart = $attendanceStartDefault;
    }

    $attendanceEnd = normalizeDateFilter(isset($filters['bitis']) ? $filters['bitis'] : null, true);
    if ($attendanceEnd === null) {
        $attendanceEnd = $nowDefault;
    }

    $paymentsStart = normalizeDateFilter(isset($filters['baslangic']) ? $filters['baslangic'] : null, false);
    if ($paymentsStart === null) {
        $paymentsStart = $paymentsStartDefault;
    }

    $paymentsEnd = normalizeDateFilter(isset($filters['bitis']) ? $filters['bitis'] : null, true);
    if ($paymentsEnd === null) {
        $paymentsEnd = $nowDefault;
    }

    $attendanceStmt = $conn->prepare(
        'SELECT id, ogrenci_id, tarih, durum, zaman, yontem, ders_tipi
         FROM devamsizlik_kayitlari
         WHERE ogrenci_id = :id AND tarih BETWEEN :start AND :end
         ORDER BY tarih DESC, zaman DESC'
    );
    $attendanceStmt->execute(array(
        ':id' => $ogrenciId,
        ':start' => $attendanceStart,
        ':end' => $attendanceEnd,
    ));
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
    $paymentsStmt->bindValue(':limit', (int)$limit, PDO::PARAM_INT);
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

    $ucret = isset($student['ucret']) ? (float)$student['ucret'] : 0.0;
    $ucretPerLesson = $ucret > 0 ? $ucret / 4 : 0.0;
    $expectedTotalAmount = $presentCount * $ucretPerLesson;

    $totalPaid = 0.0;
    foreach ($payments as $payment) {
        $totalPaid += isset($payment['tutar']) ? (float)$payment['tutar'] : 0.0;
    }

    $remainingDebt = $expectedTotalAmount - $totalPaid;
    $lessonsUntilNextPayment = $presentCount > 0 ? 4 - ($presentCount % 4) : 4;
    if ($lessonsUntilNextPayment === 4) {
        $lessonsUntilNextPayment = 0;
    }

    $items = buildPaymentItems($payments);
    $items = filterPaymentItems($items, isset($filters['durum']) ? $filters['durum'] : null);

    return array(
        'kullanici' => array(
            'id' => (int)$student['id'],
            'adi_soyadi' => isset($student['adi_soyadi']) ? $student['adi_soyadi'] : null,
            'email' => isset($student['email']) ? $student['email'] : null,
            'rutbe' => isset($student['rutbe']) ? $student['rutbe'] : null,
            'grubu' => isset($student['grubu']) ? $student['grubu'] : null,
            'sinifi' => isset($student['sinifi']) ? $student['sinifi'] : null,
            'okulu' => isset($student['okulu']) ? $student['okulu'] : null,
            'ucret' => $ucret,
            'ucret_per_ders' => $ucretPerLesson,
        ),
        'items' => $items,
        'stats' => array(
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
        ),
        'attendance' => array(
            'records' => $attendanceRecords,
            'grouped' => groupAttendanceRecords($attendanceRecords),
            'present_count' => $presentCount,
            'absent_count' => $absentCount,
            'total_count' => $totalLessons,
        ),
        'filters' => array(
            'durum' => isset($filters['durum']) ? $filters['durum'] : null,
            'baslangic' => $attendanceStart,
            'bitis' => $attendanceEnd,
            'limit' => $limit,
        ),
    );
}