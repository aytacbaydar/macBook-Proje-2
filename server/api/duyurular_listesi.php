
<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

require_once 'config.php';

try {
    // Token doğrulama
    $headers = getallheaders();
    $authHeader = $headers['Authorization'] ?? '';
    
    if (empty($authHeader) || !preg_match('/Bearer\s+(.*)$/i', $authHeader, $matches)) {
        echo json_encode(['success' => false, 'message' => 'Token bulunamadı']);
        exit;
    }
    
    $token = $matches[1];
    
    // Token'dan kullanıcı bilgilerini al
    $stmt = $pdo->prepare("SELECT id, adi_soyadi, rutbe FROM kullanicilar WHERE token = ? AND rutbe = 'ogretmen'");
    $stmt->execute([$token]);
    $user = $stmt->fetch();
    
    if (!$user) {
        echo json_encode(['success' => false, 'message' => 'Geçersiz token veya yetki']);
        exit;
    }
    
    // Duyurular tablosunu kontrol et ve oluştur
    $createTableSQL = "
    CREATE TABLE IF NOT EXISTS duyurular (
        id INT AUTO_INCREMENT PRIMARY KEY,
        baslik VARCHAR(255) NOT NULL,
        icerik TEXT NOT NULL,
        grup VARCHAR(100) NULL,
        ogretmen_id INT NOT NULL,
        ogretmen_adi VARCHAR(255) NOT NULL,
        olusturma_tarihi TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        durum ENUM('aktif', 'pasif') DEFAULT 'aktif',
        INDEX idx_ogretmen (ogretmen_id),
        INDEX idx_grup (grup),
        INDEX idx_durum (durum)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci";
    
    $pdo->exec($createTableSQL);
    
    // Öğretmenin duyurularını getir (hem kendi eklediği hem de genel duyurular)
    $query = "
        SELECT d.*, o.adi_soyadi as ogretmen_adi_full
        FROM duyurular d
        LEFT JOIN kullanicilar o ON d.ogretmen_id = o.id
        WHERE (d.ogretmen_id = ? OR d.grup IS NULL)
        AND d.durum = 'aktif'
        ORDER BY d.olusturma_tarihi DESC
        LIMIT 10
    ";
    
    $stmt = $pdo->prepare($query);
    $stmt->execute([$user['id']]);
    $announcements = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo json_encode([
        'success' => true,
        'data' => $announcements,
        'message' => 'Duyurular başarıyla getirildi'
    ]);
    
} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'message' => 'Duyurular yüklenirken hata: ' . $e->getMessage()
    ]);
}
?>
