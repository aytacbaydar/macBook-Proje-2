
<?php
// Öğrenci güncelleme API'si
require_once '../config.php';

// CORS başlıkları
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, PUT, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

if ($_SERVER['REQUEST_METHOD'] === 'POST' || $_SERVER['REQUEST_METHOD'] === 'PUT') {
    try {
        // Kullanıcıyı doğrula
        $user = authorize();
        
        $data = json_decode(file_get_contents('php://input'), true);
        
        if (!$data || !isset($data['id'])) {
            errorResponse('Öğrenci ID gerekli', 400);
        }

        $studentId = (int)$data['id'];

        // Yetki kontrolü - Admin herkesin bilgilerini, öğrenci sadece kendisini güncelleyebilir
        if ($user['rutbe'] === 'ogrenci' && $user['id'] != $studentId) {
            errorResponse('Bu bilgileri güncelleme yetkiniz yok', 403);
        }

        $conn = getConnection();
        $conn->beginTransaction();

        // Temel bilgileri güncelle
        if (isset($data['temel_bilgiler'])) {
            $temel = $data['temel_bilgiler'];
            $updateFields = [];
            $params = [];

            $allowedFields = ['adi_soyadi', 'email', 'cep_telefonu'];
            
            // Admin ise aktif durumu da güncelleyebilir
            if ($user['rutbe'] === 'admin') {
                $allowedFields[] = 'aktif';
                $allowedFields[] = 'rutbe';
            }

            foreach ($allowedFields as $field) {
                if (isset($temel[$field])) {
                    $updateFields[] = "$field = :$field";
                    $params[":$field"] = $temel[$field];
                }
            }

            // Şifre güncellemesi
            if (isset($temel['sifre']) && !empty($temel['sifre'])) {
                $updateFields[] = "sifre = :sifre";
                $params[":sifre"] = password_hash($temel['sifre'], PASSWORD_DEFAULT);
            }

            if (!empty($updateFields)) {
                $sql = "UPDATE ogrenciler SET " . implode(', ', $updateFields) . " WHERE id = :id";
                $params[':id'] = $studentId;
                $stmt = $conn->prepare($sql);
                $stmt->execute($params);
            }
        }

        // Detay bilgileri güncelle
        if (isset($data['detay_bilgiler'])) {
            $detay = $data['detay_bilgiler'];
            $updateFields = [];
            $params = [];

            $detayFields = ['okulu', 'sinifi', 'grubu', 'ders_gunu', 'ders_saati', 'ucret', 'veli_adi', 'veli_cep'];

            foreach ($detayFields as $field) {
                if (isset($detay[$field])) {
                    $updateFields[] = "$field = :$field";
                    $params[":$field"] = $detay[$field];
                }
            }

            if (!empty($updateFields)) {
                // Önce kayıt var mı kontrol et
                $checkStmt = $conn->prepare("SELECT COUNT(*) FROM ogrenci_bilgileri WHERE ogrenci_id = :ogrenci_id");
                $checkStmt->execute([':ogrenci_id' => $studentId]);
                $recordExists = (int)$checkStmt->fetchColumn() > 0;

                if ($recordExists) {
                    // Güncelle
                    $sql = "UPDATE ogrenci_bilgileri SET " . implode(', ', $updateFields) . " WHERE ogrenci_id = :ogrenci_id";
                    $params[':ogrenci_id'] = $studentId;
                    $stmt = $conn->prepare($sql);
                    $stmt->execute($params);
                } else {
                    // Yeni kayıt oluştur
                    $fields = array_keys($params);
                    $fields[] = 'ogrenci_id';
                    $params[':ogrenci_id'] = $studentId;
                    
                    $sql = "INSERT INTO ogrenci_bilgileri (" . implode(', ', $fields) . ") VALUES (" . implode(', ', array_keys($params)) . ")";
                    $stmt = $conn->prepare($sql);
                    $stmt->execute($params);
                }
            }
        }

        $conn->commit();
        successResponse(null, 'Öğrenci bilgileri başarıyla güncellendi');

    } catch (PDOException $e) {
        if (isset($conn) && $conn->inTransaction()) {
            $conn->rollBack();
        }
        errorResponse('Veritabanı hatası: ' . $e->getMessage(), 500);
    } catch (Exception $e) {
        if (isset($conn) && $conn->inTransaction()) {
            $conn->rollBack();
        }
        errorResponse('Beklenmeyen bir hata oluştu: ' . $e->getMessage(), 500);
    }
} else {
    errorResponse('Bu endpoint sadece POST/PUT metodlarını destekler', 405);
}
?>
