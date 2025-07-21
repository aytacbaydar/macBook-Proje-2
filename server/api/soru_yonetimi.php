<?php
require_once '../config.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}



try {
    $pdo = new PDO("mysql:host=$servername;dbname=$dbname;charset=utf8mb4", $username, $password);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
} catch (PDOException $e) {
    echo json_encode(['success' => false, 'message' => 'Veritabanı bağlantısı başarısız: ' . $e->getMessage()]);
    exit;
}

// Sorular tablosunu oluştur
$createTableSQL = "
CREATE TABLE IF NOT EXISTS yapay_zeka_sorular (
    id INT AUTO_INCREMENT PRIMARY KEY,
    konu_adi VARCHAR(255) NOT NULL,
    sinif_seviyesi VARCHAR(50) NOT NULL,
    zorluk_derecesi ENUM('kolay', 'orta', 'zor') NOT NULL,
    soru_metni TEXT NOT NULL,
    secenekler JSON NOT NULL,
    dogru_cevap VARCHAR(1) NOT NULL,
    ogretmen_id INT NOT NULL,
    olusturma_tarihi TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_konu_zorluk (konu_adi, zorluk_derecesi),
    INDEX idx_sinif_seviyesi (sinif_seviyesi)
)";

$pdo->exec($createTableSQL);

$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        if (isset($_GET['action']) && $_GET['action'] === 'list') {
            // Soruları listele
            $ogretmen_id = $_GET['ogretmen_id'] ?? null;
            $konu_adi = $_GET['konu_adi'] ?? null;
            $zorluk_derecesi = $_GET['zorluk_derecesi'] ?? null;

            $sql = "SELECT * FROM yapay_zeka_sorular WHERE 1=1";
            $params = [];

            if ($ogretmen_id) {
                $sql .= " AND ogretmen_id = :ogretmen_id";
                $params['ogretmen_id'] = $ogretmen_id;
            }

            if ($konu_adi) {
                $sql .= " AND konu_adi = :konu_adi";
                $params['konu_adi'] = $konu_adi;
            }

            if ($zorluk_derecesi) {
                $sql .= " AND zorluk_derecesi = :zorluk_derecesi";
                $params['zorluk_derecesi'] = $zorluk_derecesi;
            }

            $sql .= " ORDER BY olusturma_tarihi DESC";

            $stmt = $pdo->prepare($sql);
            $stmt->execute($params);
            $sorular = $stmt->fetchAll(PDO::FETCH_ASSOC);

            // JSON seçeneklerini decode et
            foreach ($sorular as &$soru) {
                $soru['secenekler'] = json_decode($soru['secenekler'], true);
            }

            echo json_encode(['success' => true, 'data' => $sorular]);
        } else {
            echo json_encode(['success' => false, 'message' => 'Geçersiz istek']);
        }
        break;

    case 'POST':
        $input = json_decode(file_get_contents('php://input'), true);

        if (!$input) {
            echo json_encode(['success' => false, 'message' => 'Geçersiz JSON verisi']);
            exit;
        }

        $required_fields = ['konu_adi', 'sinif_seviyesi', 'zorluk_derecesi', 'soru_metni', 'secenekler', 'dogru_cevap', 'ogretmen_id'];

        foreach ($required_fields as $field) {
            if (!isset($input[$field]) || empty($input[$field])) {
                echo json_encode(['success' => false, 'message' => "Gerekli alan eksik: $field"]);
                exit;
            }
        }

        // Seçenekleri JSON'a çevir
        $secenekler = json_encode($input['secenekler']);

        $sql = "INSERT INTO yapay_zeka_sorular (konu_adi, sinif_seviyesi, zorluk_derecesi, soru_metni, secenekler, dogru_cevap, ogretmen_id) 
                VALUES (:konu_adi, :sinif_seviyesi, :zorluk_derecesi, :soru_metni, :secenekler, :dogru_cevap, :ogretmen_id)";

        $stmt = $pdo->prepare($sql);
        $result = $stmt->execute([
            'konu_adi' => $input['konu_adi'],
            'sinif_seviyesi' => $input['sinif_seviyesi'],
            'zorluk_derecesi' => $input['zorluk_derecesi'],
            'soru_metni' => $input['soru_metni'],
            'secenekler' => $secenekler,
            'dogru_cevap' => $input['dogru_cevap'],
            'ogretmen_id' => $input['ogretmen_id']
        ]);

        if ($result) {
            echo json_encode(['success' => true, 'message' => 'Soru başarıyla eklendi', 'id' => $pdo->lastInsertId()]);
        } else {
            echo json_encode(['success' => false, 'message' => 'Soru eklenirken hata oluştu']);
        }
        break;

    case 'DELETE':
        $soru_id = $_GET['id'] ?? null;
        $ogretmen_id = $_GET['ogretmen_id'] ?? null;

        if (!$soru_id || !$ogretmen_id) {
            echo json_encode(['success' => false, 'message' => 'Soru ID ve öğretmen ID gerekli']);
            exit;
        }

        $sql = "DELETE FROM yapay_zeka_sorular WHERE id = :id AND ogretmen_id = :ogretmen_id";
        $stmt = $pdo->prepare($sql);
        $result = $stmt->execute(['id' => $soru_id, 'ogretmen_id' => $ogretmen_id]);

        if ($result && $stmt->rowCount() > 0) {
            echo json_encode(['success' => true, 'message' => 'Soru başarıyla silindi']);
        } else {
            echo json_encode(['success' => false, 'message' => 'Soru silinirken hata oluştu']);
        }
        break;

    default:
        echo json_encode(['success' => false, 'message' => 'Desteklenmeyen HTTP metodu']);
        break;
}
?>