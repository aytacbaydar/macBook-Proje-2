
<?php
require_once '../config.php';

$user = authorizeAdmin(); // Sadece admin/öğretmen erişimi

$method = $_SERVER['REQUEST_METHOD'];

try {
    $conn = getConnection();
    
    switch ($method) {
        case 'GET':
            // Tüm grup-sınıf ilişkilerini listele
            $stmt = $conn->prepare("SELECT * FROM grup_sinif ORDER BY grup_adi");
            $stmt->execute();
            $groups = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            successResponse($groups, 'Grup-sınıf ilişkileri başarıyla getirildi');
            break;
            
        case 'POST':
            // Yeni grup-sınıf ilişkisi ekle
            $data = getJsonData();
            
            if (empty($data['grup_adi']) || empty($data['sinif_seviyesi'])) {
                errorResponse('Grup adı ve sınıf seviyesi gerekli');
            }
            
            $stmt = $conn->prepare("
                INSERT INTO grup_sinif (grup_adi, sinif_seviyesi, aciklama) 
                VALUES (:grup_adi, :sinif_seviyesi, :aciklama)
            ");
            
            $stmt->execute([
                ':grup_adi' => $data['grup_adi'],
                ':sinif_seviyesi' => $data['sinif_seviyesi'],
                ':aciklama' => $data['aciklama'] ?? null
            ]);
            
            successResponse(null, 'Grup-sınıf ilişkisi başarıyla eklendi');
            break;
            
        case 'PUT':
            // Grup-sınıf ilişkisini güncelle
            $data = getJsonData();
            
            if (empty($data['id']) || empty($data['grup_adi']) || empty($data['sinif_seviyesi'])) {
                errorResponse('ID, grup adı ve sınıf seviyesi gerekli');
            }
            
            $stmt = $conn->prepare("
                UPDATE grup_sinif 
                SET grup_adi = :grup_adi, sinif_seviyesi = :sinif_seviyesi, aciklama = :aciklama
                WHERE id = :id
            ");
            
            $stmt->execute([
                ':id' => $data['id'],
                ':grup_adi' => $data['grup_adi'],
                ':sinif_seviyesi' => $data['sinif_seviyesi'],
                ':aciklama' => $data['aciklama'] ?? null
            ]);
            
            successResponse(null, 'Grup-sınıf ilişkisi başarıyla güncellendi');
            break;
            
        case 'DELETE':
            // Grup-sınıf ilişkisini sil
            $data = getJsonData();
            
            if (empty($data['id'])) {
                errorResponse('ID gerekli');
            }
            
            $stmt = $conn->prepare("DELETE FROM grup_sinif WHERE id = :id");
            $stmt->execute([':id' => $data['id']]);
            
            successResponse(null, 'Grup-sınıf ilişkisi başarıyla silindi');
            break;
            
        default:
            errorResponse('Desteklenmeyen HTTP metodu', 405);
    }
    
} catch (PDOException $e) {
    errorResponse('Veritabanı hatası: ' . $e->getMessage(), 500);
} catch (Exception $e) {
    errorResponse('Genel hata: ' . $e->getMessage(), 500);
}
?>
