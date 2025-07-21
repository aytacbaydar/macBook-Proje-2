
<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

require_once '../config.php';

try {
    // Authorization kontrolü
    $headers = getallheaders();
    $authHeader = $headers['Authorization'] ?? '';
    
    if (empty($authHeader) || !preg_match('/Bearer\s+(.*)$/i', $authHeader, $matches)) {
        throw new Exception('Yetkisiz erişim');
    }
    
    $token = $matches[1];
    
    $conn = getConnection();
    
    // Token kontrolü ve kullanıcı bilgilerini al
    $tokenStmt = $conn->prepare("SELECT kullanici_id, rutbe FROM tokens WHERE token = ? AND expires_at > NOW()");
    $tokenStmt->execute([$token]);
    $tokenData = $tokenStmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$tokenData) {
        throw new Exception('Geçersiz veya süresi dolmuş token');
    }
    
    // Sadece öğretmen ve admin erişebilir
    if (!in_array($tokenData['rutbe'], ['ogretmen', 'admin'])) {
        throw new Exception('Bu işlem için yetkiniz yok');
    }
    
    $sinav_id = $_GET['sinav_id'] ?? 0;
    
    if (!$sinav_id) {
        throw new Exception('Sınav ID gerekli');
    }
    
    // Sınav sonuçları tablosunu oluştur (eğer yoksa)
    $createTableSQL = "
        CREATE TABLE IF NOT EXISTS sinav_sonuclari (
            id INT AUTO_INCREMENT PRIMARY KEY,
            sinav_id INT NOT NULL,
            ogrenci_id INT NOT NULL,
            sinav_adi VARCHAR(255) NOT NULL,
            sinav_turu VARCHAR(50) NOT NULL,
            soru_sayisi INT NOT NULL,
            dogru_sayisi INT NOT NULL DEFAULT 0,
            yanlis_sayisi INT NOT NULL DEFAULT 0,
            bos_sayisi INT NOT NULL DEFAULT 0,
            net_sayisi DECIMAL(5,2) NOT NULL DEFAULT 0,
            puan DECIMAL(6,2) NOT NULL DEFAULT 0,
            yuzde DECIMAL(5,2) NOT NULL DEFAULT 0,
            gonderim_tarihi TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            guncelleme_tarihi TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_sinav_ogrenci (sinav_id, ogrenci_id),
            INDEX idx_ogrenci_id (ogrenci_id),
            INDEX idx_sinav_turu (sinav_turu),
            INDEX idx_gonderim_tarihi (gonderim_tarihi),
            UNIQUE KEY unique_sinav_ogrenci (sinav_id, ogrenci_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ";
    
    $conn->exec($createTableSQL);
    
    // Eğer öğretmen ise, sadece kendi öğrencilerinin sonuçlarını göster
    $whereClause = "";
    $params = [$sinav_id];
    
    if ($tokenData['rutbe'] === 'ogretmen') {
        // Öğretmenin adını al
        $teacherStmt = $conn->prepare("SELECT adi_soyadi FROM kullanicilar WHERE id = ?");
        $teacherStmt->execute([$tokenData['kullanici_id']]);
        $teacherData = $teacherStmt->fetch(PDO::FETCH_ASSOC);
        
        if ($teacherData) {
            $teacherName = $teacherData['adi_soyadi'];
            // Öğretmen adı kontrolü daha esnek hale getir
            $whereClause = " AND (o.ogretmen_adi = ? OR o.ogretmen_adi LIKE ? OR o.ogretmen_adi IS NULL)";
            $params[] = $teacherName;
            $params[] = '%' . $teacherName . '%';
        }
    }
    
    // Sınav sonuçlarını öğrenci bilgileriyle birlikte al
    // Eğer öğretmen kontrolü başarısız olursa, tüm sonuçları getir
    if ($tokenData['rutbe'] === 'ogretmen' && empty($whereClause)) {
        $whereClause = "";
        $params = [$sinav_id];
    }
    
    $sql = "
        SELECT 
            sr.*,
            o.adi_soyadi as ogrenci_adi,
            o.ogretmen_adi
        FROM sinav_sonuclari sr
        LEFT JOIN ogrenciler o ON sr.ogrenci_id = o.id
        WHERE sr.sinav_id = ? $whereClause
        ORDER BY sr.net_sayisi DESC, sr.puan DESC
    ";
    
    $stmt = $conn->prepare($sql);
    $stmt->execute($params);
    $sonuclar = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Sonuçları formatla
    $formattedSonuclar = [];
    foreach ($sonuclar as $sonuc) {
        $formattedSonuclar[] = [
            'id' => (int)$sonuc['id'],
            'sinav_id' => (int)$sonuc['sinav_id'],
            'ogrenci_id' => (int)$sonuc['ogrenci_id'],
            'ogrenci_adi' => $sonuc['ogrenci_adi'],
            'sinav_adi' => $sonuc['sinav_adi'],
            'sinav_turu' => $sonuc['sinav_turu'],
            'soru_sayisi' => (int)$sonuc['soru_sayisi'],
            'dogru_sayisi' => (int)$sonuc['dogru_sayisi'],
            'yanlis_sayisi' => (int)$sonuc['yanlis_sayisi'],
            'bos_sayisi' => (int)$sonuc['bos_sayisi'],
            'net_sayisi' => (float)$sonuc['net_sayisi'],
            'puan' => (float)$sonuc['puan'],
            'yuzde' => (float)$sonuc['yuzde'],
            'gonderim_tarihi' => $sonuc['gonderim_tarihi']
        ];
    }
    
    echo json_encode([
        'success' => true,
        'data' => $formattedSonuclar,
        'count' => count($formattedSonuclar),
        'debug_info' => [
            'user_role' => $tokenData['rutbe'],
            'user_id' => $tokenData['kullanici_id'],
            'query_params' => count($params)
        ]
    ], JSON_UNESCAPED_UNICODE);
    
} catch (Exception $e) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage()
    ], JSON_UNESCAPED_UNICODE);
}
?>
