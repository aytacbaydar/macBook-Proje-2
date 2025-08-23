
<?php
require_once '../config.php';

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

try {
    $conn = getConnection();
    
    $test_adi = $_POST['test_adi'] ?? '';
    $test_turu = $_POST['test_turu'] ?? '';
    $soru_sayisi = intval($_POST['soru_sayisi'] ?? 0);
    $tarih = $_POST['tarih'] ?? '';
    $cevaplar = $_POST['cevaplar'] ?? '{}';
    $konular = $_POST['konular'] ?? '{}';
    $videolar = $_POST['videolar'] ?? '{}';
    $aktiflik = $_POST['aktiflik'] === 'true';

    if (empty($test_adi) || empty($test_turu) || $soru_sayisi <= 0 || empty($tarih)) {
        echo json_encode([
            'success' => false,
            'message' => 'Zorunlu alanlar eksik'
        ]);
        exit;
    }

    $sql = "INSERT INTO test_cevap_anahtarlari (test_adi, test_turu, soru_sayisi, tarih, cevaplar, konular, videolar, aktiflik) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)";
    
    $stmt = $conn->prepare($sql);
    $result = $stmt->execute([
        $test_adi,
        $test_turu,
        $soru_sayisi,
        $tarih,
        $cevaplar,
        $konular,
        $videolar,
        $aktiflik
    ]);

    if ($result) {
        echo json_encode([
            'success' => true,
            'message' => 'Test cevap anahtarı başarıyla eklendi',
            'id' => $conn->lastInsertId()
        ]);
    } else {
        echo json_encode([
            'success' => false,
            'message' => 'Test cevap anahtarı eklenirken hata oluştu'
        ]);
    }

} catch (PDOException $e) {
    echo json_encode([
        'success' => false,
        'message' => 'Veritabanı hatası: ' . $e->getMessage()
    ]);
}
?>
