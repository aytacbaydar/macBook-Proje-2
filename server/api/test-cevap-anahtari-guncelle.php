
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
    
    $input = json_decode(file_get_contents('php://input'), true);
    
    $id = $input['id'] ?? 0;
    $test_adi = $input['test_adi'] ?? '';
    $test_turu = $input['test_turu'] ?? '';
    $soru_sayisi = intval($input['soru_sayisi'] ?? 0);
    $tarih = $input['tarih'] ?? '';
    $cevaplar = json_encode($input['cevaplar'] ?? []);
    $konular = json_encode($input['konular'] ?? []);
    $videolar = json_encode($input['videolar'] ?? []);
    $aktiflik = $input['aktiflik'] ?? true;

    if ($id <= 0 || empty($test_adi) || empty($test_turu) || $soru_sayisi <= 0 || empty($tarih)) {
        echo json_encode([
            'success' => false,
            'message' => 'Zorunlu alanlar eksik'
        ]);
        exit;
    }

    $sql = "UPDATE test_cevap_anahtarlari SET 
            test_adi = ?, test_turu = ?, soru_sayisi = ?, tarih = ?, 
            cevaplar = ?, konular = ?, videolar = ?, aktiflik = ? 
            WHERE id = ?";
    
    $stmt = $conn->prepare($sql);
    $result = $stmt->execute([
        $test_adi, $test_turu, $soru_sayisi, $tarih,
        $cevaplar, $konular, $videolar, $aktiflik, $id
    ]);

    if ($result && $stmt->rowCount() > 0) {
        echo json_encode([
            'success' => true,
            'message' => 'Test cevap anahtarı başarıyla güncellendi'
        ]);
    } else {
        echo json_encode([
            'success' => false,
            'message' => 'Güncelleme işlemi başarısız'
        ]);
    }

} catch (PDOException $e) {
    echo json_encode([
        'success' => false,
        'message' => 'Veritabanı hatası: ' . $e->getMessage()
    ]);
}
?>
