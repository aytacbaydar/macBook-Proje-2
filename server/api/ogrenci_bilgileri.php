<?php
// Öğrenci bilgileri API'si
require_once '../config.php';

// GET isteği: Öğrenci bilgilerini getir
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    try {
        // Kullanıcıyı doğrula
        $user = authorize();
        $studentId = isset($_GET['id']) ? intval($_GET['id']) : $user['id'];
        
        $conn = getConnection();
        
        // Yetkilendirme kontrolü
        if ($user['rutbe'] === 'admin') {
            // Admin tüm öğrencileri görebilir
        } elseif ($user['rutbe'] === 'ogretmen') {
            // Öğretmen sadece kendi öğrencilerini görebilir
            $stmt_check = $conn->prepare("
                SELECT COUNT(*) as count 
                FROM ogrenciler o
                LEFT JOIN ogrenci_bilgileri ob ON o.id = ob.ogrenci_id
                WHERE o.id = :student_id AND o.ogretmeni = :teacher_name
            ");
            $stmt_check->bindParam(':student_id', $studentId);
            $stmt_check->bindParam(':teacher_name', $user['adi_soyadi']);
            $stmt_check->execute();
            
            $check_result = $stmt_check->fetch(PDO::FETCH_ASSOC);
            if ($check_result['count'] == 0) {
                errorResponse('Bu öğrencinin bilgilerine erişim yetkiniz yok', 403);
            }
        } elseif ($user['rutbe'] === 'ogrenci') {
            // Öğrenci sadece kendi bilgilerini görebilir
            if ($studentId !== $user['id']) {
                errorResponse('Bu bilgilere erişim yetkiniz yok', 403);
            }
        } else {
            errorResponse('Geçersiz kullanıcı türü', 403);
        }
        
        // Öğrenci temel bilgilerini getir
        $stmt = $conn->prepare("
            SELECT id, adi_soyadi, email, cep_telefonu, rutbe, aktif, avatar, brans, created_at
            FROM ogrenciler
            WHERE id = :id
        ");
        $stmt->bindParam(':id', $studentId);
        $stmt->execute();
        
        if ($stmt->rowCount() === 0) {
            errorResponse('Öğrenci bulunamadı', 404);
        }
        
        $student = $stmt->fetch(PDO::FETCH_ASSOC);
        
        // Öğrenci detaylı bilgilerini getir
        $stmt = $conn->prepare("
            SELECT * FROM ogrenci_bilgileri
            WHERE ogrenci_id = :ogrenci_id
        ");
        $stmt->bindParam(':ogrenci_id', $studentId);
        $stmt->execute();
        
        $studentDetails = $stmt->fetch(PDO::FETCH_ASSOC);
        
        // Sonuçları birleştir
        $result = array_merge($student, $studentDetails);
        
        successResponse($result);
        
    } catch (PDOException $e) {
        errorResponse('Veritabanı hatası: ' . $e->getMessage(), 500);
    } catch (Exception $e) {
        errorResponse('Beklenmeyen bir hata oluştu: ' . $e->getMessage(), 500);
    }
}
// Diğer HTTP metodlarını reddet
else {
    errorResponse('Bu endpoint sadece GET metodunu desteklemektedir', 405);
}
