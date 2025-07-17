<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Authorization, Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

require_once '../config.php';

try {
    $pdo = getConnection();

    // Yetkilendirme kontrolü
    $headers = getallheaders();
    $authHeader = $headers['Authorization'] ?? '';

    if (!$authHeader || !preg_match('/Bearer\s+(.*)$/i', $authHeader, $matches)) {
        throw new Exception('Yetki gerekli');
    }

    $token = $matches[1];
    $userData = validateToken($token, $pdo);

    if (!$userData) {
        throw new Exception('Geçersiz token');
    }

    // Debug logs
    error_log("User ID: " . $userData['id']);
    error_log("POST data: " . print_r($_POST, true));
    error_log("FILES data: " . print_r($_FILES, true));

    // POST verilerini kontrol et
    if (!isset($_FILES['dekont_file'])) {
        throw new Exception('Dekont dosyası gerekli');
    }

    $tutar = floatval($_POST['tutar'] ?? 0);
    $aciklama = $_POST['aciklama'] ?? '';
    $ay = intval($_POST['ay'] ?? date('n'));
    $yil = intval($_POST['yil'] ?? date('Y'));
    $file = $_FILES['dekont_file'];

    if ($tutar <= 0) {
        throw new Exception('Geçerli bir tutar giriniz');
    }

    // Dosya kontrolü
    if ($file['error'] !== UPLOAD_ERR_OK) {
        throw new Exception('Dosya yükleme hatası: ' . $file['error']);
    }

    // Dosya tipini kontrol et
    $allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
    if (!in_array($file['type'], $allowedTypes)) {
        throw new Exception('Desteklenmeyen dosya tipi');
    }

    // Dosya boyutunu kontrol et (5MB)
    if ($file['size'] > 5 * 1024 * 1024) {
        throw new Exception('Dosya boyutu en fazla 5MB olabilir');
    }

    // Upload klasörünü oluştur
    $uploadDir = '../uploads/dekontlar/';
    if (!file_exists($uploadDir)) {
        mkdir($uploadDir, 0755, true);
    }

    // Dosya adını oluştur
    $extension = pathinfo($file['name'], PATHINFO_EXTENSION);
    $fileName = 'dekont_' . $userData['id'] . '_' . time() . '.' . $extension;
    $filePath = $uploadDir . $fileName;

    // Dosyayı kaydet
    if (!move_uploaded_file($file['tmp_name'], $filePath)) {
        throw new Exception('Dosya kaydedilemedi');
    }

    // Veritabanına dekont kaydını ekle
    $stmt = $pdo->prepare("
        INSERT INTO dekont_kayitlari 
        (ogrenci_id, tutar, aciklama, dekont_dosya, dekont_yuklenme_tarihi, ay, yil) 
        VALUES (?, ?, ?, ?, NOW(), ?, ?)
    ");
    $stmt->execute([
        $userData['id'],
        $tutar,
        $aciklama,
        $filePath,
        $ay,
        $yil
    ]);

    echo json_encode([
        'success' => true,
        'message' => 'Dekont başarıyla yüklendi',
        'file_path' => $filePath
    ]);

} catch (Exception $e) {
    error_log("Dekont yükleme hatası: " . $e->getMessage());
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}

function validateToken($token, $pdo) {
    try {
        $stmt = $pdo->prepare("
            SELECT * FROM ogrenciler 
            WHERE MD5(CONCAT(id, email, sifre)) = ? AND aktif = 1
        ");
        $stmt->execute([$token]);
        return $stmt->fetch(PDO::FETCH_ASSOC) ?: false;
    } catch (Exception $e) {
        return false;
    }
}
?>