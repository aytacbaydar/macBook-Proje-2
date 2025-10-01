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
    $pdo = getConnection();
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
    soru_aciklamasi TEXT,
    soru_resmi VARCHAR(255) NOT NULL,
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

            // Soru verilerini hazırla (artık seçenekler yok)
            // Veriler olduğu gibi döndürülecek

            echo json_encode(['success' => true, 'data' => $sorular]);
        } else {
            echo json_encode(['success' => false, 'message' => 'Geçersiz istek']);
        }
        break;

    case 'POST':
        $action = $_POST['action'] ?? 'add';

        if ($action === 'update') {
            // Soru güncelleme
            $id = $_POST['id'] ?? '';
            $konu_adi = $_POST['konu_adi'] ?? '';
            $sinif_seviyesi = $_POST['sinif_seviyesi'] ?? '';
            $zorluk_derecesi = $_POST['zorluk_derecesi'] ?? '';
            $soru_aciklamasi = $_POST['soru_aciklamasi'] ?? '';
            $dogru_cevap = $_POST['dogru_cevap'] ?? '';
            $ogretmen_id = $_POST['ogretmen_id'] ?? '';

            if (empty($id) || empty($konu_adi) || empty($sinif_seviyesi) || empty($zorluk_derecesi) || empty($dogru_cevap) || empty($ogretmen_id)) {
                echo json_encode(['success' => false, 'message' => 'Gerekli alanlar eksik']);
                exit;
            }

            // Önce sorunun bu öğretmene ait olduğunu kontrol et
            $checkSql = "SELECT soru_resmi FROM yapay_zeka_sorular WHERE id = ? AND ogretmen_id = ?";
            $checkStmt = $pdo->prepare($checkSql);
            $checkStmt->execute([$id, $ogretmen_id]);
            $existingSoru = $checkStmt->fetch(PDO::FETCH_ASSOC);

            if (!$existingSoru) {
                echo json_encode(['success' => false, 'message' => 'Soru bulunamadı veya yetkiniz yok']);
                exit;
            }

            $soru_resmi = $existingSoru['soru_resmi']; // Mevcut resmi koru

            // Yeni resim yüklenmişse
            if (isset($_FILES['soru_resmi']) && $_FILES['soru_resmi']['error'] === UPLOAD_ERR_OK) {
                $upload_dir = '../uploads/soru_resimleri/';
                if (!file_exists($upload_dir)) {
                    mkdir($upload_dir, 0777, true);
                }

                $file_extension = strtolower(pathinfo($_FILES['soru_resmi']['name'], PATHINFO_EXTENSION));
                $allowed_extensions = ['jpg', 'jpeg', 'png', 'gif'];

                if (!in_array($file_extension, $allowed_extensions)) {
                    echo json_encode(['success' => false, 'message' => 'Geçersiz dosya formatı']);
                    exit;
                }

                // Eski resmi sil
                if ($soru_resmi && file_exists($upload_dir . $soru_resmi)) {
                    unlink($upload_dir . $soru_resmi);
                }

                $soru_resmi = uniqid() . '.' . $file_extension;
                $upload_path = $upload_dir . $soru_resmi;

                if (!move_uploaded_file($_FILES['soru_resmi']['tmp_name'], $upload_path)) {
                    echo json_encode(['success' => false, 'message' => 'Dosya yüklenemedi']);
                    exit;
                }
            }

            $sql = "UPDATE yapay_zeka_sorular SET konu_adi = ?, sinif_seviyesi = ?, zorluk_derecesi = ?, soru_aciklamasi = ?, soru_resmi = ?, dogru_cevap = ? WHERE id = ? AND ogretmen_id = ?";
            $stmt = $pdo->prepare($sql);

            if ($stmt->execute([$konu_adi, $sinif_seviyesi, $zorluk_derecesi, $soru_aciklamasi, $soru_resmi, $dogru_cevap, $id, $ogretmen_id])) {
                echo json_encode(['success' => true, 'message' => 'Soru başarıyla güncellendi']);
            } else {
                echo json_encode(['success' => false, 'message' => 'Soru güncellenemedi']);
            }
        } else {
            // Yeni soru ekleme
            $konu_adi = $_POST['konu_adi'] ?? '';
            $sinif_seviyesi = $_POST['sinif_seviyesi'] ?? '';
            $zorluk_derecesi = $_POST['zorluk_derecesi'] ?? '';
            $soru_aciklamasi = $_POST['soru_aciklamasi'] ?? '';
            $dogru_cevap = $_POST['dogru_cevap'] ?? '';
            $ogretmen_id = $_POST['ogretmen_id'] ?? '';

            if (empty($konu_adi) || empty($sinif_seviyesi) || empty($zorluk_derecesi) || empty($dogru_cevap) || empty($ogretmen_id)) {
                echo json_encode(['success' => false, 'message' => 'Gerekli alanlar eksik']);
                exit;
            }

            $soru_resmi = null;
            if (isset($_FILES['soru_resmi']) && $_FILES['soru_resmi']['error'] === UPLOAD_ERR_OK) {
                $uploadDir = '../uploads/soru_resimleri/';
                if (!file_exists($uploadDir)) {
                    mkdir($uploadDir, 0777, true);
                }

                $fileExt = strtolower(pathinfo($_FILES['soru_resmi']['name'], PATHINFO_EXTENSION));
                $allowedExtensions = ['jpg', 'jpeg', 'png', 'gif'];
                if (!in_array($fileExt, $allowedExtensions)) {
                    echo json_encode(['success' => false, 'message' => 'Sadece JPG, PNG ve GIF dosyaları kabul edilir']);
                    exit;
                }

                if ($_FILES['soru_resmi']['size'] > 5 * 1024 * 1024) {
                    echo json_encode(['success' => false, 'message' => 'Dosya boyutu 5MB\'dan büyük olamaz']);
                    exit;
                }

                $soru_resmi = 'soru_' . $ogretmen_id . '_' . time() . '.' . $fileExt;
                $targetFile = $uploadDir . $soru_resmi;

                if (!move_uploaded_file($_FILES['soru_resmi']['tmp_name'], $targetFile)) {
                    echo json_encode(['success' => false, 'message' => 'Resim yüklenirken hata oluştu']);
                    exit;
                }
            }

            // Soru resmi zorunlu (çünkü şıklar fotoğrafta olacak)
            if (empty($soru_resmi)) {
                echo json_encode(['success' => false, 'message' => 'Soru resmi gerekli']);
                exit;
            }

            $sql = "INSERT INTO yapay_zeka_sorular (konu_adi, sinif_seviyesi, zorluk_derecesi, soru_aciklamasi, soru_resmi, dogru_cevap, ogretmen_id) 
                    VALUES (:konu_adi, :sinif_seviyesi, :zorluk_derecesi, :soru_aciklamasi, :soru_resmi, :dogru_cevap, :ogretmen_id)";

            $stmt = $pdo->prepare($sql);
            $result = $stmt->execute([
                'konu_adi' => $konu_adi,
                'sinif_seviyesi' => $sinif_seviyesi,
                'zorluk_derecesi' => $zorluk_derecesi,
                'soru_aciklamasi' => $soru_aciklamasi,
                'soru_resmi' => $soru_resmi,
                'dogru_cevap' => $dogru_cevap,
                'ogretmen_id' => $ogretmen_id
            ]);

            if ($result) {
                echo json_encode(['success' => true, 'message' => 'Soru başarıyla eklendi', 'id' => $pdo->lastInsertId()]);
            } else {
                echo json_encode(['success' => false, 'message' => 'Soru eklenirken hata oluştu']);
            }
        }
        break;

    case 'DELETE':
        $soru_id = $_GET['id'] ?? null;
        $ogretmen_id = $_GET['ogretmen_id'] ?? null;

        if (!$soru_id || !$ogretmen_id) {
            echo json_encode(['success' => false, 'message' => 'Soru ID ve öğretmen ID gerekli']);
            exit;
        }

        // Önce sorunun bu öğretmene ait olduğunu kontrol et ve resmi sil
        $checkSql = "SELECT soru_resmi FROM yapay_zeka_sorular WHERE id = ? AND ogretmen_id = ?";
        $checkStmt = $pdo->prepare($checkSql);
        $checkStmt->execute([$soru_id, $ogretmen_id]);
        $existingSoru = $checkStmt->fetch(PDO::FETCH_ASSOC);

        if (!$existingSoru) {
            echo json_encode(['success' => false, 'message' => 'Soru bulunamadı veya yetkiniz yok']);
            exit;
        }

        $soru_resmi_to_delete = $existingSoru['soru_resmi'];
        $upload_dir = '../uploads/soru_resimleri/';

        $sql = "DELETE FROM yapay_zeka_sorular WHERE id = :id AND ogretmen_id = :ogretmen_id";
        $stmt = $pdo->prepare($sql);
        $result = $stmt->execute(['id' => $soru_id, 'ogretmen_id' => $ogretmen_id]);

        if ($result && $stmt->rowCount() > 0) {
            // Soru başarıyla silindiyse resmi de sil
            if ($soru_resmi_to_delete && file_exists($upload_dir . $soru_resmi_to_delete)) {
                unlink($upload_dir . $soru_resmi_to_delete);
            }
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