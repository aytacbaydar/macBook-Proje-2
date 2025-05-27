<?php
require_once '../config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    errorResponse('Sadece POST metoduna izin verilmektedir', 405);
}

try {
    $user = authorize();
    $data = getJsonData();
    $studentId = isset($data['id']) ? intval($data['id']) : $user['id'];

    if ($user['rutbe'] !== 'admin' && $studentId !== $user['id']) {
        errorResponse('Bu bilgileri güncelleme yetkiniz yok', 403);
    }

    $conn = getConnection();
    $conn->beginTransaction();

    // 1. TEMEL BİLGİLER GÜNCELLE
    if (!empty($data['temel_bilgiler'])) {
        $temel = $data['temel_bilgiler'];
        $updateFields = [];
        $params = [];

        $allowed = ['adi_soyadi', 'cep_telefonu', 'avatar'];
        if ($user['rutbe'] === 'admin') {
            $allowed = array_merge($allowed, ['rutbe', 'aktif', 'email']);
        }

        foreach ($allowed as $field) {
            if (isset($temel[$field])) {
                $updateFields[] = "$field = :$field";
                $params[":$field"] = $temel[$field];
            }
        }

        // Şifre
        if (!empty($temel['sifre'])) {
            if (strlen($temel['sifre']) < 6) {
                $conn->rollBack();
                errorResponse('Şifre en az 6 karakter olmalıdır');
            }
            $updateFields[] = "sifre = :sifre";
            $params[':sifre'] = md5($temel['sifre']);
        }

        if (!empty($updateFields)) {
            $sql = "UPDATE ogrenciler SET " . implode(', ', $updateFields) . " WHERE id = :id";
            $params[':id'] = $studentId;
            $stmt = $conn->prepare($sql);
            $stmt->execute($params);
        }
    }

    // 2. DETAY BİLGİLERİ GÜNCELLE
    if (!empty($data['detay_bilgiler'])) {
        $detay = $data['detay_bilgiler'];
        $updateFields = [];
        $params = [];

        $ogrenci_detay_bilgi = ['okulu', 'sinifi', 'grubu', 'ders_gunu', 'ders_saati', 'ucret', 'veli_adi', 'veli_cep'];

        foreach ($ogrenci_detay_bilgi as $field) {
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
                // Kayıt varsa güncelle
                $sql = "UPDATE ogrenci_bilgileri SET " . implode(', ', $updateFields) . " WHERE ogrenci_id = :ogrenci_id";
                $params[':ogrenci_id'] = $studentId;
                $stmt = $conn->prepare($sql);
                $stmt->execute($params);
            } else {
                // Kayıt yoksa oluştur
                $fields = array_keys($params);
                $fields[] = 'ogrenci_id';
                $values = array_map(function($field) {
                    return str_replace(':', '', $field);
                }, $fields);
                
                $sql = "INSERT INTO ogrenci_bilgileri (" . implode(', ', $values) . ") VALUES (:" . implode(', :', $values) . ")";
                $params[':ogrenci_id'] = $studentId;
                $stmt = $conn->prepare($sql);
                $stmt->execute($params);
            }
        }
    }

    $conn->commit();

    // 3. GÜNCELLENEN VERİYİ GETİR
    $stmt = $conn->prepare("
        SELECT o.id, o.adi_soyadi, o.email, o.cep_telefonu, o.rutbe, o.aktif, o.avatar,
               ob.okulu, ob.sinifi, ob.grubu, ob.ders_gunu, ob.ders_saati, ob.ucret,
               ob.veli_adi, ob.veli_cep
        FROM ogrenciler o
        LEFT JOIN ogrenci_bilgileri ob ON o.id = ob.ogrenci_id
        WHERE o.id = :id
    ");
    $stmt->execute([':id' => $studentId]);
    $student = $stmt->fetch(PDO::FETCH_ASSOC);

    // 4. TOKEN GÜNCELLE (Admin değilse)
    if ($user['rutbe'] === 'admin' && $studentId !== $user['id']) {
        successResponse($student, 'Profil başarıyla güncellendi');
    } else {
        $stmt = $conn->prepare("SELECT sifre FROM ogrenciler WHERE id = :id");
        $stmt->execute([':id' => $studentId]);
        $userData = $stmt->fetch(PDO::FETCH_ASSOC);

        $token = md5($studentId . $student['email'] . $userData['sifre']);
        $student['token'] = $token;
        successResponse($student, 'Profil başarıyla güncellendi');
    }

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
