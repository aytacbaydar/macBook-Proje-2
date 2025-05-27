
<?php
// server/api/ogrenci_girisi/ogrenci_giris.php
// Öğrenci giriş API'si
require_once '../../config.php';

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
        // JSON verisini al
        $data = json_decode(file_get_contents('php://input'), true);
        
        if (!isset($data['email']) || !isset($data['sifre'])) {
            errorResponse('Email ve şifre gereklidir', 400);
        }

        $email = filter_var($data['email'], FILTER_SANITIZE_EMAIL);
        $sifre = $data['sifre'];

        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            errorResponse('Geçerli bir email adresi giriniz', 400);
        }

        $conn = getConnection();
        
        // Kullanıcıyı bul
        $stmt = $conn->prepare("SELECT * FROM ogrenciler WHERE email = :email");
        $stmt->execute([':email' => $email]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$user || !password_verify($sifre, $user['sifre'])) {
            errorResponse('Email veya şifre hatalı', 401);
        }

        // Aktif kullanıcı kontrolü
        if (!$user['aktif']) {
            errorResponse('Hesabınız henüz onaylanmamış', 403);
        }

        // JWT token oluştur
        $token = createJWT($user['id'], $user['email'], $user['rutbe']);

        // Başarılı giriş
        $response = [
            'success' => true,
            'message' => 'Giriş başarılı',
            'token' => $token,
            'user' => [
                'id' => $user['id'],
                'adi_soyadi' => $user['adi_soyadi'],
                'email' => $user['email'],
                'rutbe' => $user['rutbe'],
                'avatar' => $user['avatar']
            ]
        ];

        successResponse($response);

    } catch (PDOException $e) {
        errorResponse('Veritabanı hatası: ' . $e->getMessage(), 500);
    } catch (Exception $e) {
        errorResponse('Beklenmeyen bir hata oluştu: ' . $e->getMessage(), 500);
    }
} else {
    errorResponse('Bu endpoint sadece POST metodunu destekler', 405);
}
?>
