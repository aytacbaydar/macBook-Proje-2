
<?php
// server/api/ogrenci_girisi/ogrenci_kayit.php
// Öğrenci kayıt API'si
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
        
        // Zorunlu alanları kontrol et
        $required = ['adi_soyadi', 'email', 'sifre', 'cep_telefonu'];
        foreach ($required as $field) {
            if (!isset($data[$field]) || empty(trim($data[$field]))) {
                errorResponse("$field alanı gereklidir", 400);
            }
        }

        $adi_soyadi = trim($data['adi_soyadi']);
        $email = filter_var(trim($data['email']), FILTER_SANITIZE_EMAIL);
        $sifre = $data['sifre'];
        $cep_telefonu = trim($data['cep_telefonu']);

        // Email format kontrolü
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            errorResponse('Geçerli bir email adresi giriniz', 400);
        }

        // Şifre uzunluk kontrolü
        if (strlen($sifre) < 6) {
            errorResponse('Şifre en az 6 karakter olmalıdır', 400);
        }

        $conn = getConnection();
        
        // Email kontrolü - daha önce kayıtlı mı?
        $stmt = $conn->prepare("SELECT id FROM ogrenciler WHERE email = :email");
        $stmt->execute([':email' => $email]);
        
        if ($stmt->rowCount() > 0) {
            errorResponse('Bu email adresi zaten kayıtlı', 409);
        }

        // Şifreyi hashle
        $hashedPassword = password_hash($sifre, PASSWORD_DEFAULT);

        // Öğrenciyi kaydet
        $stmt = $conn->prepare("
            INSERT INTO ogrenciler (adi_soyadi, email, sifre, cep_telefonu, rutbe, aktif, created_at) 
            VALUES (:adi_soyadi, :email, :sifre, :cep_telefonu, 'ogrenci', 0, NOW())
        ");
        
        $stmt->execute([
            ':adi_soyadi' => $adi_soyadi,
            ':email' => $email,
            ':sifre' => $hashedPassword,
            ':cep_telefonu' => $cep_telefonu
        ]);

        $userId = $conn->lastInsertId();

        $response = [
            'success' => true,
            'message' => 'Kayıt başarılı! Hesabınız onay bekliyor.',
            'user_id' => $userId
        ];

        successResponse($response, 'Öğrenci başarıyla kaydedildi');

    } catch (PDOException $e) {
        errorResponse('Veritabanı hatası: ' . $e->getMessage(), 500);
    } catch (Exception $e) {
        errorResponse('Beklenmeyen bir hata oluştu: ' . $e->getMessage(), 500);
    }
} else {
    errorResponse('Bu endpoint sadece POST metodunu destekler', 405);
}
?>
