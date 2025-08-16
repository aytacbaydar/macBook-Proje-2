
<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once '../config.php';

try {
    $pdo = new PDO("mysql:host=$host;dbname=$dbname;charset=utf8", $username, $password);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    // Test cevap anahtarı tablosunu oluştur
    $sql = "CREATE TABLE IF NOT EXISTS test_cevap_anahtari (
        id INT AUTO_INCREMENT PRIMARY KEY,
        test_adi VARCHAR(255) NOT NULL,
        test_aciklamasi TEXT,
        ogretmen_id INT NOT NULL,
        soru_sayisi INT NOT NULL,
        cevaplar JSON NOT NULL,
        olusturma_tarihi TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        guncelleme_tarihi TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        aktif BOOLEAN DEFAULT TRUE,
        INDEX idx_ogretmen (ogretmen_id),
        INDEX idx_aktif (aktif)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci";

    $pdo->exec($sql);

    echo json_encode([
        'success' => true,
        'message' => 'Test cevap anahtarı tablosu başarıyla oluşturuldu'
    ]);

} catch (PDOException $e) {
    echo json_encode([
        'success' => false,
        'message' => 'Veritabanı hatası: ' . $e->getMessage()
    ]);
} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'message' => 'Hata: ' . $e->getMessage()
    ]);
}
?>
