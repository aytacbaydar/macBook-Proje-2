<?php
// Öğrenci bilgileri API'si
require_once '../config.php';

// GET isteği: Öğrenci bilgilerini getir
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    try {
        // Kullanıcıyı doğrula
        $user = authorize();
        $studentId = isset($_GET['id']) ? intval($_GET['id']) : $user['id'];
        
        // Admin değilse, sadece kendi bilgilerini görebilir
        if ($user['rutbe'] !== 'admin' && $studentId !== $user['id']) {
            errorResponse('Bu bilgilere erişim yetkiniz yok', 403);
        }
        
        $conn = getConnection();
        
        // Öğrenci temel bilgilerini getir
        $stmt = $conn->prepare("
            SELECT id, adi_soyadi, email, cep_telefonu, rutbe, aktif, avatar, created_at
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
