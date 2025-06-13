<?php
// Öğrenci giriş API'si
require_once '../config.php';

// Sadece POST isteklerine izin ver
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    errorResponse('Sadece POST metoduna izin verilmektedir', 405);
}

try {
    // JSON verilerini al
    $data = getJsonData();

    // Gerekli alanları kontrol et
    if (!isset($data['email']) || !isset($data['sifre'])) {
        errorResponse('Email ve şifre alanları zorunludur');
    }

    $conn = getConnection();

    // Kullanıcı bilgilerini kontrol et (detay bilgileriyle birlikte)
    $stmt = $conn->prepare("
        SELECT o.id, o.adi_soyadi, o.email, o.sifre, o.rutbe, o.avatar, o.ogretmeni,
             ob.sinifi,
             COALESCE(ob.ders_adi, 'Kimya') as ders_adi, 
             ob.grubu
        FROM ogrenciler o
        LEFT JOIN ogrenci_bilgileri ob ON o.id = ob.ogrenci_id
        WHERE o.email = :email AND o.aktif = TRUE
    ");
    $stmt->bindParam(':email', $data['email']);
    $stmt->execute();

    if ($stmt->rowCount() === 0) {
        errorResponse('Kullanıcı bulunamadı veya hesap aktif değil', 401);
    }

    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    // Şifre kontrolü
    if (md5($data['sifre']) !== $user['sifre']) {
        errorResponse('Geçersiz şifre', 401);
    }

    // Token oluştur
    $token = md5($user['id'] . $user['email'] . $user['sifre']);
    //$token = hash('sha256', $user['id'] . $user['email'] . $user['sifre']);


    // Debug için log ekle
    error_log("Login - User ID: " . $user['id'] . ", Email: " . $user['email']);
    error_log("Login - Generated Token: " . $token);
    error_log("Login - Aktif durumu: " . $user['aktif']);

    // Kullanıcı bilgilerini döndür (şifre hariç)
    unset($user['sifre']);
    $user['token'] = $token;

    successResponse($user, 'Giriş başarılı');

} catch (PDOException $e) {
    errorResponse('Veritabanı hatası: ' . $e->getMessage(), 500);
} catch (Exception $e) {
    errorResponse('Beklenmeyen bir hata oluştu: ' . $e->getMessage(), 500);
}