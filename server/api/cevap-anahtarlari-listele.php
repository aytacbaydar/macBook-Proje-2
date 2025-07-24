php
<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, DELETE, PUT, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

require_once '../config.php';

try {
    $conn = getConnection();

    // Cevap anahtarları tablosunun var olup olmadığını kontrol et
    $tableCheckQuery = "SHOW TABLES LIKE 'cevap_anahtarlari'";
    $result = $conn->query($tableCheckQuery);

    if ($result->rowCount() == 0) {
        // Tablo yoksa oluştur
        $createTableSQL = "
        CREATE TABLE IF NOT EXISTS cevap_anahtarlari (
            id INT AUTO_INCREMENT PRIMARY KEY,
            sinav_adi VARCHAR(255) NOT NULL,
            sinav_turu VARCHAR(50) NOT NULL,
            soru_sayisi INT NOT NULL,
            cevaplar JSON NOT NULL,
            tarih DATETIME DEFAULT CURRENT_TIMESTAMP,
            aktiflik BOOLEAN DEFAULT TRUE,
            sinav_kapagi VARCHAR(255) DEFAULT NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ";
        $conn->exec($createTableSQL);

        // Örnek veri ekle
        $sampleData = [
            ['Matematik TYT Deneme 1', 'TYT', 40, json_encode(array_fill(1, 40, 'A')), true],
            ['Kimya AYT Test', 'AYT', 13, json_encode(array_fill(1, 13, 'B')), true],
            ['Fizik Konu Testi', 'TEST', 20, json_encode(array_fill(1, 20, 'C')), true]
        ];

        $insertSQL = "INSERT INTO cevap_anahtarlari (sinav_adi, sinav_turu, soru_sayisi, cevaplar, aktiflik) VALUES (?, ?, ?, ?, ?)";
        $insertStmt = $conn->prepare($insertSQL);

        foreach ($sampleData as $data) {
            $insertStmt->execute($data);
        }
    }

    // Tüm cevap anahtarlarını getir
    $stmt = $conn->prepare("SELECT * FROM cevap_anahtarlari ORDER BY tarih DESC");
    $stmt->execute();
    $cevapAnahtarlari = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // JSON field'ları düzelt
    foreach ($cevapAnahtarlari as &$item) {
        if (isset($item['aktiflik'])) {
            $item['aktiflik'] = (bool)$item['aktiflik'];
        }
        if (isset($item['cevaplar']) && is_string($item['cevaplar'])) {
            $item['cevaplar'] = json_decode($item['cevaplar'], true);
        }
    }

    // Debug bilgisi
    error_log("Toplam sınav sayısı: " . count($cevapAnahtarlari));
    error_log("Aktif sınav sayısı: " . count(array_filter($cevapAnahtarlari, function($s) { return $s['aktiflik']; })));

    echo json_encode([
        'success' => true,
        'data' => $cevapAnahtarlari,
        'total_count' => count($cevapAnahtarlari),
        'active_count' => count(array_filter($cevapAnahtarlari, function($s) { return $s['aktiflik']; }))
    ], JSON_UNESCAPED_UNICODE);

} catch(PDOException $e) {
    error_log("Database error: " . $e->getMessage());
    echo json_encode([
        'success' => false,
        'message' => 'Veritabanı hatası: ' . $e->getMessage()
    ], JSON_UNESCAPED_UNICODE);
} catch(Exception $e) {
    error_log("General error: " . $e->getMessage());
    echo json_encode([
        'success' => false,
        'message' => 'Genel hata: ' . $e->getMessage()
    ], JSON_UNESCAPED_UNICODE);
}
?>