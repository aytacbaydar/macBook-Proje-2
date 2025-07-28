
<?php
require_once '../config.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

try {
    // Yetkilendirme kontrolü
    $user = authorize();
    
    // Öğrenci ID parametresini al
    $ogrenci_id = $_GET['ogrenci_id'] ?? null;
    
    if (!$ogrenci_id) {
        errorResponse('Öğrenci ID gerekli', 400);
    }
    
    // Veritabanı bağlantısı
    $conn = getConnection();
    
    // Devamsızlık kayıtlarını çek
    $stmt = $conn->prepare("
        SELECT 
            id,
            tarih,
            durum,
            aciklama,
            created_at
        FROM devamsizlik_kayitlari 
        WHERE ogrenci_id = :ogrenci_id 
        ORDER BY tarih DESC
    ");
    
    $stmt->bindParam(':ogrenci_id', $ogrenci_id, PDO::PARAM_INT);
    $stmt->execute();
    
    $kayitlar = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Başarılı yanıt döndür
    successResponse([
        'kayitlar' => $kayitlar,
        'toplam' => count($kayitlar)
    ], 'Devamsızlık kayıtları başarıyla yüklendi');
    
} catch (PDOException $e) {
    errorResponse('Veritabanı hatası: ' . $e->getMessage(), 500);
} catch (Exception $e) {
    errorResponse('Genel hata: ' . $e->getMessage(), 500);
}
?>
