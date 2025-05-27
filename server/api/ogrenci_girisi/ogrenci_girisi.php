
<?php
// Öğrenci giriş API'si
require_once '../config.php';

// CORS başlıkları
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    try {
        $data = json_decode(file_get_contents('php://input'), true);
        
        if (!$data || !isset($data['email']) || !isset($data['sifre'])) {
            errorResponse('Email ve şifre alanları gerekli', 400);
        }

        $conn = getConnection();
        
        // Kullanıcıyı ara
        $stmt = $conn->prepare("SELECT * FROM ogrenciler WHERE email = :email");
        $stmt->execute([':email' => $data['email']]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$user || !password_verify($data['sifre'], $user['sifre'])) {
            errorResponse('Geçersiz email veya şifre', 401);
        }

        if (!$user['aktif']) {
            errorResponse('Hesabınız henüz aktif değil', 403);
        }

        // Token oluştur
        $token = md5($user['id'] . $user['email'] . $user['sifre']);
        
        // Kullanıcı bilgilerini döndür
        $userData = [
            'id' => $user['id'],
            'adi_soyadi' => $user['adi_soyadi'],
            'email' => $user['email'],
            'rutbe' => $user['rutbe'],
            'avatar' => $user['avatar'],
            'token' => $token
        ];

        successResponse($userData, 'Giriş başarılı');

    } catch (PDOException $e) {
        errorResponse('Veritabanı hatası: ' . $e->getMessage(), 500);
    } catch (Exception $e) {
        errorResponse('Beklenmeyen bir hata oluştu: ' . $e->getMessage(), 500);
    }
} else {
    errorResponse('Bu endpoint sadece POST metodunu destekler', 405);
}
?>
