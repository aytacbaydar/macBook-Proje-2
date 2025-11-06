<?php
declare(strict_types=1);

function ensureUcretIslemleriTables(\PDO $conn): void
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

function ensureUcretIslemleriColumn(\PDO $conn, string $table, string $column): void
{
    $stmt = $conn->prepare('SHOW COLUMNS FROM ' . $table . ' LIKE :column');
    $stmt->execute([':column' => $column]);
    if ($stmt->fetch(\PDO::FETCH_ASSOC) !== false) {
        return;
    }

    if ($column === 'etiketi') {
        $conn->exec('ALTER TABLE ' . $table . " ADD COLUMN etiketi VARCHAR(50) DEFAULT NULL AFTER durum");
    } elseif ($column === 'ekleyen_id') {
        $conn->exec('ALTER TABLE ' . $table . " ADD COLUMN ekleyen_id INT DEFAULT NULL AFTER etiketi");
        $conn->exec('ALTER TABLE ' . $table . " ADD CONSTRAINT fk_ucret_islem_ekleyen FOREIGN KEY (ekleyen_id) REFERENCES kullanicilar(id) ON DELETE SET NULL");
    }
}

function fetchUcretIslemleri(\PDO $conn, int $kullaniciId, array $filters = []): array
{
    ensureUcretIslemleriTables($conn);

    $where = ['i.kullanici_id = :kullanici_id'];
    $params = [':kullanici_id' => $kullaniciId];

    if (isset($filters['durum']) && trim((string)$filters['durum']) !== '') {
        $durum = strtolower((string)$filters['durum']);
        $where[] = 'i.durum = :durum';
        $params[':durum'] = $durum;
    }

    $baslangic = normalizeDateFilter($filters['baslangic'] ?? null, false);
    if ($baslangic !== null) {
        $where[] = 'i.odeme_tarihi >= :baslangic';
        $params[':baslangic'] = $baslangic;
    }

    $bitis = normalizeDateFilter($filters['bitis'] ?? null, true);
    if ($bitis !== null) {
        $where[] = 'i.odeme_tarihi <= :bitis';
        $params[':bitis'] = $bitis;
    }

    $whereSql = implode(' AND ', $where);

    $limitSql = '';
    if (!empty($filters['limit']) && is_numeric($filters['limit'])) {
        $limit = max(1, min(500, (int)$filters['limit']));
        $limitSql = ' LIMIT ' . $limit;
    }

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
        WHERE ' . $whereSql . '
        ORDER BY i.odeme_tarihi DESC, i.id DESC, n.created_at ASC' . $limitSql
    );
    $stmt->execute($params);
    $rows = $stmt->fetchAll(\PDO::FETCH_ASSOC);

    $items = [];
    foreach ($rows as $row) {
        $id = (int)$row['id'];
        if (!isset($items[$id])) {
            $items[$id] = [
                'id' => $id,
                'kullanici_id' => (int)$row['kullanici_id'],
                'islem_tipi' => $row['islem_tipi'],
                'tutar' => (float)$row['tutar'],
                'para_birimi' => $row['para_birimi'],
                'odeme_tarihi' => $row['odeme_tarihi'],
                'aciklama' => $row['aciklama'],
                'durum' => $row['durum'],
                'etiketi' => $row['etiketi'],
                'ekleyen' => [
                    'id' => $row['ekleyen_id'] !== null ? (int)$row['ekleyen_id'] : null,
                    'adi_soyadi' => $row['ekleyen_adi'] ?? null,
                ],
                'created_at' => $row['created_at'],
                'updated_at' => $row['updated_at'],
                'notlar' => [],
            ];
        }

        if ($row['note_id'] !== null) {
            $items[$id]['notlar'][] = [
                'id' => (int)$row['note_id'],
                'baslik' => $row['note_baslik'],
                'icerik' => $row['note_icerik'],
                'created_at' => $row['note_created_at'],
                'ekleyen' => [
                    'id' => $row['note_ekleyen_id'] !== null ? (int)$row['note_ekleyen_id'] : null,
                    'adi_soyadi' => $row['note_ekleyen_adi'] ?? null,
                ],
            ];
        }
    }

    $items = array_values($items);

    $statStmt = $conn->prepare(
        'SELECT
            COUNT(*) AS adet,
            COALESCE(SUM(CASE WHEN durum IN (\'tamamlandi\', \'odendi\') THEN tutar ELSE 0 END), 0) AS toplam_odenen,
            COALESCE(SUM(CASE WHEN durum IN (\'beklemede\', \'taslak\') THEN tutar ELSE 0 END), 0) AS toplam_bekleyen,
            COALESCE(SUM(CASE WHEN durum IN (\'iptal\', \'iade\') THEN tutar ELSE 0 END), 0) AS toplam_iptal
        FROM kullanici_ucret_islemleri i
        WHERE ' . $whereSql
    );
    $statStmt->execute($params);
    $statRow = $statStmt->fetch(\PDO::FETCH_ASSOC) ?: [];

    $userStmt = $conn->prepare('SELECT id, adi_soyadi, email, rutbe FROM kullanicilar WHERE id = :id LIMIT 1');
    $userStmt->execute([':id' => $kullaniciId]);
    $kullanici = $userStmt->fetch(\PDO::FETCH_ASSOC) ?: null;

    return [
        'kullanici' => $kullanici,
        'items' => $items,
        'stats' => [
            'toplam_islem' => isset($statRow['adet']) ? (int)$statRow['adet'] : 0,
            'toplam_odenen' => isset($statRow['toplam_odenen']) ? (float)$statRow['toplam_odenen'] : 0.0,
            'toplam_bekleyen' => isset($statRow['toplam_bekleyen']) ? (float)$statRow['toplam_bekleyen'] : 0.0,
            'toplam_iptal' => isset($statRow['toplam_iptal']) ? (float)$statRow['toplam_iptal'] : 0.0,
        ],
        'applied_filters' => [
            'durum' => $filters['durum'] ?? null,
            'baslangic' => $baslangic,
            'bitis' => $bitis,
            'limit' => $filters['limit'] ?? null,
        ],
    ];
}

function fetchUcretIslemiById(\PDO $conn, int $id): ?array
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
    $stmt->execute([':id' => $id]);
    $rows = $stmt->fetchAll(\PDO::FETCH_ASSOC);

    if (!$rows) {
        return null;
    }

    $first = $rows[0];
    $item = [
        'id' => (int)$first['id'],
        'kullanici_id' => (int)$first['kullanici_id'],
        'islem_tipi' => $first['islem_tipi'],
        'tutar' => (float)$first['tutar'],
        'para_birimi' => $first['para_birimi'],
        'odeme_tarihi' => $first['odeme_tarihi'],
        'aciklama' => $first['aciklama'],
        'durum' => $first['durum'],
        'etiketi' => $first['etiketi'],
        'ekleyen' => [
            'id' => $first['ekleyen_id'] !== null ? (int)$first['ekleyen_id'] : null,
            'adi_soyadi' => $first['ekleyen_adi'] ?? null,
        ],
        'created_at' => $first['created_at'],
        'updated_at' => $first['updated_at'],
        'notlar' => [],
    ];

    foreach ($rows as $row) {
        if ($row['note_id'] !== null) {
            $item['notlar'][] = [
                'id' => (int)$row['note_id'],
                'baslik' => $row['note_baslik'],
                'icerik' => $row['note_icerik'],
                'created_at' => $row['note_created_at'],
                'ekleyen' => [
                    'id' => $row['note_ekleyen_id'] !== null ? (int)$row['note_ekleyen_id'] : null,
                    'adi_soyadi' => $row['note_ekleyen_adi'] ?? null,
                ],
            ];
        }
    }

    return $item;
}

function createUcretIslemi(\PDO $conn, array $payload, int $kullaniciId, int $ekleyenId): array
{
    ensureUcretIslemleriTables($conn);

    $islemTipi = trim((string)($payload['islem_tipi'] ?? ''));
    if ($islemTipi === '') {
        throw new \InvalidArgumentException('islem_tipi alani zorunludur.');
    }

    $tutar = (float)($payload['tutar'] ?? 0);
    if ($tutar <= 0) {
        throw new \InvalidArgumentException('tutar alani 0 dan buyuk olmali.');
    }

    $paraBirimiRaw = strtoupper(trim((string)($payload['para_birimi'] ?? 'TRY')));
    $sanitizedCurrency = preg_replace('/[^A-Z]/', '', $paraBirimiRaw) ?: 'TRY';
    $paraBirimi = substr($sanitizedCurrency, 0, 8);
    if ($paraBirimi === '') {
        $paraBirimi = 'TRY';
    }

    $odemeTarihi = normalizeDateTimeValue($payload['odeme_tarihi'] ?? null);

    $durumAllowed = ['beklemede', 'taslak', 'tamamlandi', 'odendi', 'iptal', 'iade'];
    $durum = strtolower(trim((string)($payload['durum'] ?? 'beklemede')));
    if (!in_array($durum, $durumAllowed, true)) {
        $durum = 'beklemede';
    }

    $etiket = trim((string)($payload['etiketi'] ?? ''));
    if ($etiket === '') {
        $etiket = null;
    } else {
        $etiket = substr($etiket, 0, 50);
    }

    $aciklama = trim((string)($payload['aciklama'] ?? ''));
    if ($aciklama === '') {
        $aciklama = null;
    }

    $stmt = $conn->prepare(
        'INSERT INTO kullanici_ucret_islemleri
            (kullanici_id, islem_tipi, tutar, para_birimi, odeme_tarihi, aciklama, durum, etiketi, ekleyen_id)
         VALUES
            (:kullanici_id, :islem_tipi, :tutar, :para_birimi, :odeme_tarihi, :aciklama, :durum, :etiketi, :ekleyen_id)'
    );

    $stmt->execute([
        ':kullanici_id' => $kullaniciId,
        ':islem_tipi' => $islemTipi,
        ':tutar' => $tutar,
        ':para_birimi' => $paraBirimi,
        ':odeme_tarihi' => $odemeTarihi,
        ':aciklama' => $aciklama,
        ':durum' => $durum,
        ':etiketi' => $etiket,
        ':ekleyen_id' => $ekleyenId > 0 ? $ekleyenId : null,
    ]);

    $islemId = (int)$conn->lastInsertId();

    $noteBaslik = trim((string)($payload['not_baslik'] ?? ''));
    $noteIcerik = trim((string)($payload['not_icerik'] ?? ''));
    if ($noteBaslik !== '' || $noteIcerik !== '') {
        $noteStmt = $conn->prepare(
            'INSERT INTO kullanici_ucret_notlari (islem_id, baslik, icerik, ekleyen_id)
             VALUES (:islem_id, :baslik, :icerik, :ekleyen_id)'
        );
        $noteStmt->execute([
            ':islem_id' => $islemId,
            ':baslik' => $noteBaslik !== '' ? $noteBaslik : null,
            ':icerik' => $noteIcerik !== '' ? $noteIcerik : null,
            ':ekleyen_id' => $ekleyenId > 0 ? $ekleyenId : null,
        ]);
    }

    $item = fetchUcretIslemiById($conn, $islemId);
    if ($item === null) {
        throw new \RuntimeException('Yeni ucret islemi okunamadi.');
    }

    return $item;
}

function normalizeDateFilter($value, bool $endOfDay): ?string
{
    if ($value === null) {
        return null;
    }

    $value = trim((string)$value);
    if ($value === '') {
        return null;
    }

    try {
        $date = new \DateTime($value);
    } catch (\Exception $e) {
        return null;
    }

    if ($endOfDay) {
        $date->setTime(23, 59, 59);
    } else {
        $date->setTime(0, 0, 0);
    }

    return $date->format('Y-m-d H:i:s');
}

function normalizeDateTimeValue($value): string
{
    if ($value === null) {
        return (new \DateTime())->format('Y-m-d H:i:s');
    }

    $value = trim((string)$value);
    if ($value === '') {
        return (new \DateTime())->format('Y-m-d H:i:s');
    }

    try {
        $dateTime = new \DateTime($value);
    } catch (\Exception $e) {
        throw new \InvalidArgumentException('Gecersiz odeme_tarihi degeri.');
    }

    return $dateTime->format('Y-m-d H:i:s');
}