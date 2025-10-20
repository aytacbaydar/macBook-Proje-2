<?php
declare(strict_types=1);

require_once __DIR__ . '/../../config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    errorResponse('Bu endpoint sadece POST isteğini destekler', 405);
}

$user = authorize();
if (!$user) {
    exit();
}

function slugify(string $value): string
{
    $normalized = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $value);
    $normalized = strtolower($normalized ?? $value);
    $normalized = preg_replace('/[^a-z0-9]+/i', '-', $normalized ?? $value);
    $normalized = preg_replace('/-+/', '-', $normalized ?? '');
    $normalized = trim($normalized ?? '', '-');
    if ($normalized === '') {
        $normalized = 'ders';
    }
    return substr($normalized, 0, 60);
}

$pdfAdi = trim($_POST['pdf_adi'] ?? '');
$ogrenciGrubu = trim($_POST['ogrenci_grubu'] ?? '');
$konuAdi = trim($_POST['konu_adi'] ?? '');
$kazanimAdi = trim($_POST['kazanim_adi'] ?? '');
$sayfaSayisi = max(1, (int)($_POST['sayfa_sayisi'] ?? 0));
$annotationJson = $_POST['annotation_json'] ?? null;

if ($pdfAdi === '' || $ogrenciGrubu === '' || $konuAdi === '' || $kazanimAdi === '') {
    errorResponse('pdf_adi, ogrenci_grubu, konu_adi ve kazanim_adi alanları zorunludur.', 400);
}

if (!isset($_FILES['pdf_dosyasi']) || $_FILES['pdf_dosyasi']['error'] !== UPLOAD_ERR_OK) {
    errorResponse('PDF dosyası yüklenemedi.', 400);
}

$uploadInfo = $_FILES['pdf_dosyasi'];
if (!is_uploaded_file($uploadInfo['tmp_name'])) {
    errorResponse('Geçersiz dosya yükleme isteği.', 400);
}

if ($uploadInfo['size'] <= 0) {
    errorResponse('PDF dosyası boş.', 400);
}

$mimeType = mime_content_type($uploadInfo['tmp_name']);
if ($mimeType !== 'application/pdf') {
    errorResponse('Sadece PDF dosyaları kabul edilir.', 400);
}

$pdfDirectory = __DIR__ . '/../../dosyalar/ders-anlatim/pdf/';
$annotationDirectory = __DIR__ . '/../../dosyalar/ders-anlatim/annotations/';

if (!is_dir($pdfDirectory) && !mkdir($pdfDirectory, 0777, true) && !is_dir($pdfDirectory)) {
    errorResponse('PDF dizini oluşturulamadı.', 500);
}

if (!is_dir($annotationDirectory) && !mkdir($annotationDirectory, 0777, true) && !is_dir($annotationDirectory)) {
    errorResponse('Çizim dizini oluşturulamadı.', 500);
}

$baseName = slugify($konuAdi) . '-' . slugify($kazanimAdi) . '-' . date('Ymd-His');
$pdfFileName = $baseName . '.pdf';
$pdfPath = $pdfDirectory . $pdfFileName;

if (!move_uploaded_file($uploadInfo['tmp_name'], $pdfPath)) {
    errorResponse('PDF dosyası kaydedilemedi.', 500);
}

$annotationRelativePath = null;
if ($annotationJson !== null && trim($annotationJson) !== '') {
    $annotationFileName = $baseName . '.json';
    $annotationFilePath = $annotationDirectory . $annotationFileName;
    if (file_put_contents($annotationFilePath, $annotationJson) === false) {
        errorResponse('Çizim verisi kaydedilemedi.', 500);
    }
    $annotationRelativePath = 'dosyalar/ders-anlatim/annotations/' . $annotationFileName;
}

$relativePdfPath = 'dosyalar/ders-anlatim/pdf/' . $pdfFileName;

try {
    $conn = getConnection();

    $createSql = "
    CREATE TABLE IF NOT EXISTS konu_anlatim_kayitlari (
      id INT PRIMARY KEY AUTO_INCREMENT,
      pdf_adi VARCHAR(255) NOT NULL,
      pdf_dosya_yolu VARCHAR(255) NOT NULL,
      sayfa_sayisi INT NOT NULL DEFAULT 1,
      cizim_dosya_yolu VARCHAR(255) DEFAULT NULL,
      ogrenci_grubu VARCHAR(100) NOT NULL,
      konu_adi VARCHAR(255) DEFAULT NULL,
      kazanim_adi VARCHAR(255) DEFAULT NULL,
      ogretmen_id INT NOT NULL,
      olusturma_zamani DATETIME NOT NULL,
      guncelleme_zamani DATETIME DEFAULT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    ";
    $conn->exec($createSql);

    $columns = array_column(
        $conn->query('SHOW COLUMNS FROM konu_anlatim_kayitlari')->fetchAll(PDO::FETCH_ASSOC),
        'Field'
    );
    if (!in_array('konu_adi', $columns, true)) {
        $conn->exec("ALTER TABLE konu_anlatim_kayitlari ADD COLUMN konu_adi VARCHAR(255) DEFAULT NULL AFTER ogrenci_grubu");
    }
    if (!in_array('kazanim_adi', $columns, true)) {
        $conn->exec("ALTER TABLE konu_anlatim_kayitlari ADD COLUMN kazanim_adi VARCHAR(255) DEFAULT NULL AFTER konu_adi");
    }
    if (!in_array('guncelleme_zamani', $columns, true)) {
        $conn->exec("ALTER TABLE konu_anlatim_kayitlari ADD COLUMN guncelleme_zamani DATETIME DEFAULT NULL AFTER olusturma_zamani");
    }

    $stmt = $conn->prepare(
        'INSERT INTO konu_anlatim_kayitlari (
            pdf_adi,
            pdf_dosya_yolu,
            sayfa_sayisi,
            cizim_dosya_yolu,
            ogrenci_grubu,
            konu_adi,
            kazanim_adi,
            ogretmen_id,
            olusturma_zamani,
            guncelleme_zamani
        ) VALUES (
            :pdf_adi,
            :pdf_dosya_yolu,
            :sayfa_sayisi,
            :cizim_dosya_yolu,
            :ogrenci_grubu,
            :konu_adi,
            :kazanim_adi,
            :ogretmen_id,
            NOW(),
            NOW()
        )'
    );

    $stmt->execute([
        ':pdf_adi' => $pdfAdi,
        ':pdf_dosya_yolu' => $relativePdfPath,
        ':sayfa_sayisi' => $sayfaSayisi,
        ':cizim_dosya_yolu' => $annotationRelativePath,
        ':ogrenci_grubu' => $ogrenciGrubu,
        ':konu_adi' => $konuAdi,
        ':kazanim_adi' => $kazanimAdi,
        ':ogretmen_id' => (int)($user['id'] ?? 0),
    ]);

    $kayitId = (int)$conn->lastInsertId();

    successResponse(
        [
            'kayit_id' => $kayitId,
            'pdf_yolu' => $relativePdfPath,
            'cizim_yolu' => $annotationRelativePath,
        ],
        'Konu anlatım kaydı başarıyla oluşturuldu'
    );
} catch (PDOException $e) {
    errorResponse('Veritabanı hatası: ' . $e->getMessage(), 500);
} catch (Throwable $t) {
    errorResponse('Beklenmeyen hata: ' . $t->getMessage(), 500);
}
