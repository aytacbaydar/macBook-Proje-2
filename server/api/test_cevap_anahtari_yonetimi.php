
<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once '../config.php';

try {
    $pdo = new PDO("mysql:host=$host;dbname=$dbname;charset=utf8", $username, $password);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    $method = $_SERVER['REQUEST_METHOD'];
    $input = json_decode(file_get_contents('php://input'), true);

    switch ($method) {
        case 'GET':
            if (isset($_GET['ogretmen_id'])) {
                // Öğretmenin test cevap anahtarlarını listele
                $stmt = $pdo->prepare("SELECT * FROM test_cevap_anahtari WHERE ogretmen_id = ? AND aktif = TRUE ORDER BY olusturma_tarihi DESC");
                $stmt->execute([$_GET['ogretmen_id']]);
                $testler = $stmt->fetchAll(PDO::FETCH_ASSOC);

                // JSON cevapları decode et
                foreach ($testler as &$test) {
                    $test['cevaplar'] = json_decode($test['cevaplar'], true);
                }

                echo json_encode([
                    'success' => true,
                    'data' => $testler
                ]);
            } elseif (isset($_GET['test_id'])) {
                // Belirli bir test cevap anahtarını getir
                $stmt = $pdo->prepare("SELECT * FROM test_cevap_anahtari WHERE id = ? AND aktif = TRUE");
                $stmt->execute([$_GET['test_id']]);
                $test = $stmt->fetch(PDO::FETCH_ASSOC);

                if ($test) {
                    $test['cevaplar'] = json_decode($test['cevaplar'], true);
                    echo json_encode([
                        'success' => true,
                        'data' => $test
                    ]);
                } else {
                    echo json_encode([
                        'success' => false,
                        'message' => 'Test bulunamadı'
                    ]);
                }
            } else {
                // Tüm aktif testleri listele (öğrenciler için)
                $stmt = $pdo->prepare("SELECT id, test_adi, test_aciklamasi, soru_sayisi, olusturma_tarihi FROM test_cevap_anahtari WHERE aktif = TRUE ORDER BY olusturma_tarihi DESC");
                $stmt->execute();
                $testler = $stmt->fetchAll(PDO::FETCH_ASSOC);

                echo json_encode([
                    'success' => true,
                    'data' => $testler
                ]);
            }
            break;

        case 'POST':
            // Yeni test cevap anahtarı ekle
            $stmt = $pdo->prepare("INSERT INTO test_cevap_anahtari (test_adi, test_aciklamasi, ogretmen_id, soru_sayisi, cevaplar) VALUES (?, ?, ?, ?, ?)");
            $stmt->execute([
                $input['test_adi'],
                $input['test_aciklamasi'] ?? '',
                $input['ogretmen_id'],
                $input['soru_sayisi'],
                json_encode($input['cevaplar'])
            ]);

            echo json_encode([
                'success' => true,
                'message' => 'Test cevap anahtarı başarıyla eklendi',
                'id' => $pdo->lastInsertId()
            ]);
            break;

        case 'PUT':
            // Test cevap anahtarını güncelle
            $stmt = $pdo->prepare("UPDATE test_cevap_anahtari SET test_adi = ?, test_aciklamasi = ?, soru_sayisi = ?, cevaplar = ?, guncelleme_tarihi = CURRENT_TIMESTAMP WHERE id = ?");
            $stmt->execute([
                $input['test_adi'],
                $input['test_aciklamasi'] ?? '',
                $input['soru_sayisi'],
                json_encode($input['cevaplar']),
                $input['id']
            ]);

            echo json_encode([
                'success' => true,
                'message' => 'Test cevap anahtarı başarıyla güncellendi'
            ]);
            break;

        case 'DELETE':
            // Test cevap anahtarını pasif yap
            $stmt = $pdo->prepare("UPDATE test_cevap_anahtari SET aktif = FALSE WHERE id = ?");
            $stmt->execute([$input['id']]);

            echo json_encode([
                'success' => true,
                'message' => 'Test cevap anahtarı başarıyla silindi'
            ]);
            break;
    }

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
