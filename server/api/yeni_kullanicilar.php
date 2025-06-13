
<?php
require_once '../config.php';

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    try {
        // Token doğrulama
        $headers = getallheaders();
        $authHeader = $headers['Authorization'] ?? '';
        
        if (!$authHeader || !str_starts_with($authHeader, 'Bearer ')) {
            errorResponse('Yetkilendirme token\'ı gerekli', 401);
            return;
        }
        
        $token = substr($authHeader, 7);
        $conn = getConnection();
        
        // Token'dan kullanıcı bilgilerini al
        $stmt = $conn->prepare("SELECT rutbe FROM ogrenciler WHERE token = ?");
        $stmt->execute([$token]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$user || !in_array($user['rutbe'], ['ogretmen', 'admin'])) {
            errorResponse('Geçersiz token veya yetki', 401);
            return;
        }
        
        // Sadece yeni kullanıcıları getir
        $stmt = $conn->prepare("
            SELECT id, adi_soyadi, email, cep_telefonu, rutbe, created_at
            FROM ogrenciler 
            WHERE rutbe = 'yeni' 
            ORDER BY created_at DESC
        ");
        $stmt->execute();
        
        $newUsers = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        successResponse($newUsers);
        
    } catch (PDOException $e) {
        errorResponse('Veritabanı hatası: ' . $e->getMessage(), 500);
    } catch (Exception $e) {
        errorResponse('Beklenmeyen bir hata oluştu: ' . $e->getMessage(), 500);
    }
} else {
    errorResponse('Bu endpoint sadece GET metodunu desteklemektedir', 405);
}
?>
