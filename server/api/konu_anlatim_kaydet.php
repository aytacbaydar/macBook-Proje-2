<?php
// CORS ve Content-Type başlıkları - saf JSON yanıtı için
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");
header("Access-Control-Max-Age: 3600"); // Preflight önbelleği
header("Content-Type: application/json; charset=UTF-8");
// JSON parsing hatalarını önlemek için fazla header'ları kaldırdık

// İstek zaman aşımını ve bellek limitini artır (büyük dosyalar için)
ini_set('max_execution_time', 300); // 5 dakika
ini_set('memory_limit', '256M');    // 256 MB bellek
ini_set('post_max_size', '50M');    // 50 MB maksimum POST
ini_set('upload_max_filesize', '50M'); // 50 MB maksimum dosya yükleme

// Hataları göster ve logla
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

// İstek logları - debug amaçlı
$log_file = __DIR__ . '/../../logs/api_debug.log';
$log_dir = dirname($log_file);

if (!file_exists($log_dir)) {
    mkdir($log_dir, 0777, true);
}

// İstek bilgilerini logla
$log_data = date('Y-m-d H:i:s') . " - API İsteği:\n";
$log_data .= "METHOD: " . $_SERVER['REQUEST_METHOD'] . "\n";
$log_data .= "POST Data: " . print_r($_POST, true) . "\n";
$log_data .= "FILES Data: " . print_r($_FILES, true) . "\n";
$log_data .= "Raw post: " . file_get_contents('php://input') . "\n";
file_put_contents($log_file, $log_data, FILE_APPEND);

// OPTIONS isteğini yönet (preflight)
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Not: errorResponse ve successResponse fonksiyonları config.php'den geliyor
// Bu dosyada tekrar tanımlamıyoruz

// POST isteği kontrol et
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    errorResponse('Sadece POST istekleri kabul edilir');
}

// Gelen verileri detaylı olarak logla
$log_data .= "\n\nGelen veriler detaylı inceleme:\n";
$log_data .= "Content-Type: " . $_SERVER['CONTENT_TYPE'] . "\n";
$log_data .= "POST 'pdf_adi' var mı: " . (isset($_POST['pdf_adi']) ? "EVET" : "HAYIR") . "\n";
$log_data .= "POST 'pdf_adi' değeri: " . (isset($_POST['pdf_adi']) ? $_POST['pdf_adi'] : "YOK") . "\n";
$log_data .= "POST 'ogrenci_grubu' var mı: " . (isset($_POST['ogrenci_grubu']) ? "EVET" : "HAYIR") . "\n";
$log_data .= "POST 'ogrenci_grubu' değeri: " . (isset($_POST['ogrenci_grubu']) ? $_POST['ogrenci_grubu'] : "YOK") . "\n";
$log_data .= "FILES 'pdf_dosyasi' var mı: " . (isset($_FILES['pdf_dosyasi']) ? "EVET" : "HAYIR") . "\n";
if (isset($_FILES['pdf_dosyasi'])) {
    $log_data .= "FILES 'pdf_dosyasi' error: " . $_FILES['pdf_dosyasi']['error'] . "\n";
    $log_data .= "FILES 'pdf_dosyasi' name: " . $_FILES['pdf_dosyasi']['name'] . "\n";
    $log_data .= "FILES 'pdf_dosyasi' size: " . $_FILES['pdf_dosyasi']['size'] . "\n";
}

// Tüm gelen $_POST verilerini dökümle
$log_data .= "\nTüm POST verileri:\n";
foreach ($_POST as $key => $value) {
    $log_data .= "$key: $value\n";
}

// FormData içinde dosya bilgilerini dökümle
$log_data .= "\nTüm FILES verileri:\n";
foreach ($_FILES as $key => $file_info) {
    $log_data .= "$key: \n";
    foreach ($file_info as $prop => $val) {
        $log_data .= "  $prop: $val\n";
    }
}

file_put_contents($log_file, $log_data, FILE_APPEND);

// Gelen isteği ayrıntılı olarak logla
$request_log = "REQUEST_METHOD: " . $_SERVER['REQUEST_METHOD'] . "\n";
$request_log .= "CONTENT_TYPE: " . (isset($_SERVER['CONTENT_TYPE']) ? $_SERVER['CONTENT_TYPE'] : 'Belirtilmemiş') . "\n";
$request_log .= "CONTENT_LENGTH: " . (isset($_SERVER['CONTENT_LENGTH']) ? $_SERVER['CONTENT_LENGTH'] : 'Belirtilmemiş') . "\n";
$request_log .= "POST verileri sayısı: " . count($_POST) . "\n";
$request_log .= "FILES verileri sayısı: " . count($_FILES) . "\n";
file_put_contents($log_file, $request_log, FILE_APPEND);

// Ham POST verilerini de incele
$raw_post = file_get_contents('php://input');
file_put_contents($log_file, "Ham POST verisi uzunluğu: " . strlen($raw_post) . " bytes\n", FILE_APPEND);
file_put_contents($log_file, "Ham POST verisi: " . substr($raw_post, 0, 1000) . (strlen($raw_post) > 1000 ? "...(kesildi)" : "") . "\n", FILE_APPEND);

// İstek başlıklarını logla
$request_headers = getallheaders();
$headers_log = "İstek başlıkları:\n";
foreach($request_headers as $name => $value) {
    $headers_log .= "$name: $value\n";
}
file_put_contents($log_file, $headers_log, FILE_APPEND);

// Gerekli verileri kontrol et ve hata mesajlarını biriktir
$errors = [];
$validation_log = "Veri doğrulama başlıyor...\n";

// PDF adı kontrolü
if (empty($_POST['pdf_adi'])) {
    $errors[] = 'pdf_adi alanı eksik';
    $validation_log .= "pdf_adi alanı bulunamadı veya boş\n";
} else {
    $validation_log .= "pdf_adi alanı mevcut: " . $_POST['pdf_adi'] . "\n";
}

// Öğrenci grubu kontrolü
if (empty($_POST['ogrenci_grubu'])) {
    $errors[] = 'ogrenci_grubu alanı eksik';
    $validation_log .= "ogrenci_grubu alanı bulunamadı veya boş\n";
} else {
    $validation_log .= "ogrenci_grubu alanı mevcut: " . $_POST['ogrenci_grubu'] . "\n";
}

// Dosya yükleme kontrolü - daha detaylı doğrulama
if (!isset($_FILES['pdf_dosyasi'])) {
    $errors[] = 'pdf_dosyasi alanı eksik';
    $validation_log .= "pdf_dosyasi alanı formda hiç yok\n";
} else {
    $validation_log .= "pdf_dosyasi alanı formda mevcut\n";
    $validation_log .= "pdf_dosyasi['name']: " . $_FILES['pdf_dosyasi']['name'] . "\n";
    $validation_log .= "pdf_dosyasi['type']: " . $_FILES['pdf_dosyasi']['type'] . "\n";
    $validation_log .= "pdf_dosyasi['size']: " . $_FILES['pdf_dosyasi']['size'] . " bytes\n";
    $validation_log .= "pdf_dosyasi['error']: " . $_FILES['pdf_dosyasi']['error'] . "\n";
    $validation_log .= "pdf_dosyasi['tmp_name']: " . (isset($_FILES['pdf_dosyasi']['tmp_name']) ? $_FILES['pdf_dosyasi']['tmp_name'] : 'YOK') . "\n";
    
    // PHP ayarlarını kontrol et ve logla
    $validation_log .= "PHP upload_max_filesize: " . ini_get('upload_max_filesize') . "\n";
    $validation_log .= "PHP post_max_size: " . ini_get('post_max_size') . "\n";
    $validation_log .= "PHP max_file_uploads: " . ini_get('max_file_uploads') . "\n";
    $validation_log .= "PHP memory_limit: " . ini_get('memory_limit') . "\n";
    
    // Maksimum boyut kontrolü (yaklaşık 20MB)
    $max_file_size = 25 * 1024 * 1024; // 25MB
    
    if ($_FILES['pdf_dosyasi']['error'] !== 0) {
        $error_codes = [
            1 => 'Dosya boyutu PHP.ini\'de izin verilen maksimum boyutu aşıyor',
            2 => 'Dosya boyutu HTML formunda belirtilen MAX_FILE_SIZE değerini aşıyor',
            3 => 'Dosya kısmen yüklendi',
            4 => 'Dosya yüklenmedi',
            6 => 'Geçici klasör eksik',
            7 => 'Diske yazma başarısız',
            8 => 'PHP uzantısı dosya yüklemeyi durdurdu'
        ];
        $error_msg = 'pdf_dosyasi alanı hatalı';
        $error_msg .= ' - ' . ($error_codes[$_FILES['pdf_dosyasi']['error']] ?? 'Bilinmeyen hata kodu: ' . $_FILES['pdf_dosyasi']['error']);
        $errors[] = $error_msg;
        $validation_log .= "pdf_dosyasi yükleme hatası: " . $error_msg . "\n";
    } else if ($_FILES['pdf_dosyasi']['size'] <= 0) {
        $errors[] = 'pdf_dosyasi dosya boyutu sıfır veya negatif';
        $validation_log .= "pdf_dosyasi dosya boyutu sıfır veya negatif\n";
    } else if ($_FILES['pdf_dosyasi']['size'] > $max_file_size) {
        $errors[] = 'pdf_dosyasi boyutu çok büyük (' . round($_FILES['pdf_dosyasi']['size'] / 1024 / 1024, 2) . 'MB). Maksimum izin verilen: 25MB';
        $validation_log .= "pdf_dosyasi boyutu çok büyük: " . $_FILES['pdf_dosyasi']['size'] . " bytes\n";
    } else if (!file_exists($_FILES['pdf_dosyasi']['tmp_name'])) {
        $errors[] = 'pdf_dosyasi geçici dosya bulunamadı';
        $validation_log .= "pdf_dosyasi geçici dosya bulunamadı: " . $_FILES['pdf_dosyasi']['tmp_name'] . "\n";
    } else if (!is_uploaded_file($_FILES['pdf_dosyasi']['tmp_name'])) {
        $errors[] = 'pdf_dosyasi geçerli bir yükleme değil';
        $validation_log .= "pdf_dosyasi geçerli bir yükleme değil: " . $_FILES['pdf_dosyasi']['tmp_name'] . "\n";
    } else {
        $validation_log .= "pdf_dosyasi başarıyla yüklendi\n";
        
        // Dosya tipi kontrolü
        $allowed_types = ['application/pdf'];
        $file_type = mime_content_type($_FILES['pdf_dosyasi']['tmp_name']);
        $validation_log .= "Algılanan dosya tipi: " . $file_type . "\n";
        
        if (!in_array($file_type, $allowed_types)) {
            $errors[] = 'pdf_dosyasi geçersiz dosya tipi: ' . $file_type . '. Sadece PDF kabul edilir.';
            $validation_log .= "pdf_dosyasi geçersiz dosya tipi: " . $file_type . "\n";
        }
    }
}

file_put_contents($log_file, $validation_log, FILE_APPEND);

// Tüm hatalar toplandıysa geri dön
if (!empty($errors)) {
    // Hatayı logla
    file_put_contents($log_file, "Hatalar: " . print_r($errors, true) . "\n", FILE_APPEND);
    errorResponse("Gerekli alanlar eksik: " . implode(', ', $errors));
}

// Verileri al
$pdfAdi = $_POST['pdf_adi'];
$ogrenciGrubu = $_POST['ogrenci_grubu'];
$sayfaSayisi = isset($_POST['sayfa_sayisi']) ? (int)$_POST['sayfa_sayisi'] : 1;

// Üst klasörleri oluştur
$pdfDirectory = '../../dosyalar/pdf/';
$cizimDirectory = '../../dosyalar/cizimler/';

// Klasörleri oluştur
foreach ([$pdfDirectory, $cizimDirectory] as $directory) {
    if (!file_exists($directory)) {
        if (!mkdir($directory, 0777, true)) {
            errorResponse('Klasör oluşturulamadı: ' . $directory);
        }
    }
}

// Dosya adlarını oluştur
$tarih = date('Ymd_His');
$benzersizId = uniqid();
$pdfDosyaAdi = 'konu_' . $benzersizId . '_' . $tarih . '.pdf';
$pdfYolu = $pdfDirectory . $pdfDosyaAdi;

// PDF dosyasını kontrol et ve kaydet
if ($_FILES['pdf_dosyasi']['error'] !== 0) {
    errorResponse('PDF dosyası yüklenirken hata oluştu: ' . $_FILES['pdf_dosyasi']['error']);
}

// Dosyayı taşı
if (!move_uploaded_file($_FILES['pdf_dosyasi']['tmp_name'], $pdfYolu)) {
    errorResponse('PDF dosyası kaydedilemedi');
}

// Çizim dosyasını kaydet (varsa)
$cizimDosyaAdi = null;
if (isset($_FILES['cizim_verisi']) && $_FILES['cizim_verisi']['error'] == 0) {
    $cizimDosyaAdi = 'cizim_' . $benzersizId . '_' . $tarih . '.png';
    $cizimYolu = $cizimDirectory . $cizimDosyaAdi;

    if (!move_uploaded_file($_FILES['cizim_verisi']['tmp_name'], $cizimYolu)) {
        errorResponse('Çizim dosyası kaydedilemedi');
    }
}

// Veritabanı işlemlerini buraya ekleyebilirsiniz
// MySQL tablosu ile uyumlu bir kayıt gerçekleştirme örneği:
try {
    // Veritabanına bağlan
    require_once '../config.php'; // config.php'yi bir kez dahil ediyoruz
    $conn = getConnection();

    // Tablo kontrol et/oluştur
    $tableSql = "
    CREATE TABLE IF NOT EXISTS `konu_anlatim_kayitlari` (
      `id` int(11) NOT NULL AUTO_INCREMENT,
      `pdf_adi` varchar(255) NOT NULL,
      `pdf_dosya_yolu` varchar(255) NOT NULL,
      `sayfa_sayisi` int(11) NOT NULL DEFAULT 1,
      `cizim_dosya_yolu` varchar(255) DEFAULT NULL,
      `ogrenci_grubu` varchar(100) NOT NULL,
      `ogretmen_id` int(11) NOT NULL DEFAULT 1,
      `olusturma_zamani` datetime NOT NULL,
      `guncelleme_zamani` datetime DEFAULT NULL,
      PRIMARY KEY (`id`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    ";
    $conn->exec($tableSql);

    // Veritabanı kaydı
    $stmt = $conn->prepare("
        INSERT INTO konu_anlatim_kayitlari (
            pdf_adi, pdf_dosya_yolu, sayfa_sayisi, 
            cizim_dosya_yolu, ogrenci_grubu, ogretmen_id, 
            olusturma_zamani
        ) VALUES (
            :pdf_adi, :pdf_dosya_yolu, :sayfa_sayisi, 
            :cizim_dosya_yolu, :ogrenci_grubu, 1, 
            NOW()
        )
    ");

    $stmt->bindParam(':pdf_adi', $pdfAdi);
    $stmt->bindParam(':pdf_dosya_yolu', $pdfDosyaAdi);
    $stmt->bindParam(':sayfa_sayisi', $sayfaSayisi);
    $stmt->bindParam(':cizim_dosya_yolu', $cizimDosyaAdi);
    $stmt->bindParam(':ogrenci_grubu', $ogrenciGrubu);

    $stmt->execute();
    $kayitId = $conn->lastInsertId();

    // Başarılı yanıt
    successResponse([
        'kayit_id' => $kayitId,
        'pdf_yolu' => 'dosyalar/pdf/' . $pdfDosyaAdi,
        'cizim_yolu' => $cizimDosyaAdi ? 'dosyalar/cizimler/' . $cizimDosyaAdi : null
    ], 'Konu anlatım kaydı başarıyla oluşturuldu');

} catch (PDOException $e) {
    errorResponse('Veritabanı hatası: ' . $e->getMessage());
} catch (Exception $e) {
    errorResponse('Beklenmeyen bir hata oluştu: ' . $e->getMessage());
}
?>