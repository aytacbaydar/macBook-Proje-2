
<?php
// Öğrenci kayıt API'si
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
        
        // Gerekli alanları kontrol et
        $requiredFields = ['adi_soyadi', 'email', 'sifre'];
        foreach ($requiredFields as $field) {
            if (!isset($data[$field]) || empty(trim($data[$field]))) {
                errorResponse("$field alanı gerekli", 400);
            }
        }

        // Email formatını kontrol et
        if (!filter_var($data['email'], FILTER_VALIDATE_EMAIL)) {
            errorResponse('Geçersiz email formatı', 400);
        }

        $conn = getConnection();
        
        // Email zaten kayıtlı mı kontrol et
        $stmt = $conn->prepare("SELECT id FROM ogrenciler WHERE email = :email");
        $stmt->execute([':email' => $data['email']]);
        if ($stmt->fetch()) {
            errorResponse('Bu email adresi zaten kayıtlı', 409);
        }

        // Şifreyi hash'le
        $hashedPassword = password_hash($data['sifre'], PASSWORD_DEFAULT);

        // Öğrenciyi kaydet
        $stmt = $conn->prepare("
            INSERT INTO ogrenciler (adi_soyadi, email, sifre, cep_telefonu, rutbe, aktif, created_at) 
            VALUES (:adi_soyadi, :email, :sifre, :cep_telefonu, 'ogrenci', 0, NOW())
        ");
        
        $stmt->execute([
            ':adi_soyadi' => trim($data['adi_soyadi']),
            ':email' => trim($data['email']),
            ':sifre' => $hashedPassword,
            ':cep_telefonu' => isset($data['cep_telefonu']) ? trim($data['cep_telefonu']) : null
        ]);

        $studentId = $conn->lastInsertId();

        // Detay bilgileri varsa kaydet
        if (isset($data['detay_bilgiler']) && is_array($data['detay_bilgiler'])) {
            $detay = $data['detay_bilgiler'];
            
            $stmt = $conn->prepare("
                INSERT INTO ogrenci_bilgileri (
                    ogrenci_id, okulu, sinifi, grubu, ders_gunu, ders_saati, 
                    ucret, veli_adi, veli_cep, created_at
                ) VALUES (
                    :ogrenci_id, :okulu, :sinifi, :grubu, :ders_gunu, :ders_saati,
                    :ucret, :veli_adi, :veli_cep, NOW()
                )
            ");
            
            $stmt->execute([
                ':ogrenci_id' => $studentId,
                ':okulu' => $detay['okulu'] ?? null,
                ':sinifi' => $detay['sinifi'] ?? null,
                ':grubu' => $detay['grubu'] ?? null,
                ':ders_gunu' => $detay['ders_gunu'] ?? null,
                ':ders_saati' => $detay['ders_saati'] ?? null,
                ':ucret' => $detay['ucret'] ?? null,
                ':veli_adi' => $detay['veli_adi'] ?? null,
                ':veli_cep' => $detay['veli_cep'] ?? null
            ]);
        }

        successResponse(['id' => $studentId], 'Kayıt başarılı. Hesabınız onaylandıktan sonra giriş yapabilirsiniz.');

    } catch (PDOException $e) {
        errorResponse('Veritabanı hatası: ' . $e->getMessage(), 500);
    } catch (Exception $e) {
        errorResponse('Beklenmeyen bir hata oluştu: ' . $e->getMessage(), 500);
    }
} else {
    errorResponse('Bu endpoint sadece POST metodunu destekler', 405);
}
?>
