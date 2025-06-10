<?php
// CORS başlıkları
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// OPTIONS isteklerini işle
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

// Config dosyasını dahil et
require_once '../config.php';

// POST isteği kontrolü
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    errorResponse('Sadece POST istekleri kabul edilir');
}

try {
    // Bağlantıyı al
    $pdo = getConnection();

    // JSON veya form verilerini al
    $data = json_decode(file_get_contents('php://input'), true);
    if (empty($data)) {
        // Eğer JSON verisi yoksa POST verilerini kullan
        $data = $_POST;
    }

    // ID kontrolü
    if (empty($data['id']) || !is_numeric($data['id'])) {
        errorResponse("Geçerli bir ID belirtilmedi");
    }

    $id = (int)$data['id'];

    // Zorunlu alanların kontrolü
    if (empty($data['sinav_adi']) || empty($data['sinav_turu']) || 
        empty($data['soru_sayisi']) || empty($data['tarih'])) {
        errorResponse("Tüm zorunlu alanları doldurunuz");
    }

    // Güncellenecek veriler
    $sinav_adi = $data['sinav_adi'];
    $sinav_turu = $data['sinav_turu'];
    $soru_sayisi = (int)$data['soru_sayisi'];
    $tarih = $data['tarih'];

    // JSON verileri
    $cevaplar = $data['cevaplar'];
    if (is_array($cevaplar)) {
        $cevaplar = json_encode($cevaplar);
    }

    $konular = isset($data['konular']) ? $data['konular'] : '{}';
    if (is_array($konular)) {
        $konular = json_encode($konular);
    }

    $videolar = isset($data['videolar']) ? $data['videolar'] : '{}';
    if (is_array($videolar)) {
        $videolar = json_encode($videolar);
    }

    // Dosya yükleme işlemi
    $sinav_kapagi_update = false;
    $sinav_kapagi = '';

    if (isset($_FILES['sinav_kapagi']) && $_FILES['sinav_kapagi']['error'] === UPLOAD_ERR_OK) {
        // Uploads klasörünü oluştur
        $uploadDir = '../../uploads/';
        if (!file_exists($uploadDir)) {
            mkdir($uploadDir, 0755, true);
        }

        $tempFile = $_FILES['sinav_kapagi']['tmp_name'];
        $fileInfo = pathinfo($_FILES['sinav_kapagi']['name']);
        $fileExt = strtolower($fileInfo['extension']);

        // İzin verilen dosya türleri
        $allowedExtensions = ['jpg', 'jpeg', 'png', 'gif'];
        if (!in_array($fileExt, $allowedExtensions)) {
            errorResponse("Sadece JPG, JPEG, PNG ve GIF dosyaları yüklenebilir");
        }

        // Benzersiz bir dosya adı oluştur
        $yeni_sinav_kapagi = uniqid() . '_' . $fileInfo['basename'];
        $targetFile = $uploadDir . $yeni_sinav_kapagi;

        if (move_uploaded_file($tempFile, $targetFile)) {
            // Eski dosyayı sil
            $stmt = $pdo->prepare("SELECT sinav_kapagi FROM cevapAnahtari WHERE id = :id");
            $stmt->execute([':id' => $id]);
            $eskiDosya = $stmt->fetch(PDO::FETCH_ASSOC);

            if ($eskiDosya && !empty($eskiDosya['sinav_kapagi'])) {
                $eskiDosyaYolu = $uploadDir . $eskiDosya['sinav_kapagi'];
                if (file_exists($eskiDosyaYolu)) {
                    unlink($eskiDosyaYolu);
                }
            }

            $sinav_kapagi_update = true;
            $sinav_kapagi = $yeni_sinav_kapagi;
        } else {
            errorResponse("Dosya yükleme hatası");
        }
    }

    // SQL sorgusu hazırla
    if ($sinav_kapagi_update) {
        $stmt = $pdo->prepare("UPDATE cevapAnahtari SET 
                sinav_adi = :sinav_adi, 
                sinav_turu = :sinav_turu, 
                soru_sayisi = :soru_sayisi, 
                tarih = :tarih, 
                sinav_kapagi = :sinav_kapagi, 
                cevaplar = :cevaplar, 
                konular = :konular, 
                videolar = :videolar 
                WHERE id = :id");

        $params = [
            ':sinav_adi' => $sinav_adi,
            ':sinav_turu' => $sinav_turu,
            ':soru_sayisi' => $soru_sayisi,
            ':tarih' => $tarih,
            ':sinav_kapagi' => $sinav_kapagi,
            ':cevaplar' => $cevaplar,
            ':konular' => $konular,
            ':videolar' => $videolar,
            ':id' => $id
        ];
    } else {
        $stmt = $pdo->prepare("UPDATE cevapAnahtari SET 
                sinav_adi = :sinav_adi, 
                sinav_turu = :sinav_turu, 
                soru_sayisi = :soru_sayisi, 
                tarih = :tarih, 
                cevaplar = :cevaplar, 
                konular = :konular, 
                videolar = :videolar 
                WHERE id = :id");

        $params = [
            ':sinav_adi' => $sinav_adi,
            ':sinav_turu' => $sinav_turu,
            ':soru_sayisi' => $soru_sayisi,
            ':tarih' => $tarih,
            ':cevaplar' => $cevaplar,
            ':konular' => $konular,
            ':videolar' => $videolar,
            ':id' => $id
        ];
    }

    // Sorguyu çalıştır
    $result = $stmt->execute($params);

    if ($result && $stmt->rowCount() > 0) {
        successResponse('Cevap anahtarı başarıyla güncellendi.');
    } else {
        errorResponse("Güncelleme işlemi başarısız oldu veya değişiklik yapılmadı.");
    }

} catch (Exception $e) {
    errorResponse($e->getMessage());
}

// Bağlantıyı kapat
closeConnection();
?>