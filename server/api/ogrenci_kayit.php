<?php
// This is a placeholder for index.php
// Assuming it needs to include the new API files

// Include the student registration API
require_once 'server/api/ogrenci_kayit.php';

// Include the student login API
require_once 'server/api/ogrenci_giris.php';

// You may have other logic here.
?>
<?php
// server/api/ogrenci_kayit.php
// Öğrenci kayıt API'si
require_once '../config.php';

// Add student registration logic here, using the database connection from config.php

// Example:
/*
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $ad = $_POST['ad'];
    $soyad = $_POST['soyad'];
    $email = $_POST['email'];
    $sifre = password_hash($_POST['sifre'], PASSWORD_DEFAULT); // Hash the password

    $sql = "INSERT INTO ogrenciler (ad, soyad, email, sifre) VALUES (?, ?, ?, ?)";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param("ssss", $ad, $soyad, $email, $sifre);

    if ($stmt->execute()) {
        echo json_encode(['message' => 'Öğrenci başarıyla kaydedildi.']);
    } else {
        echo json_encode(['error' => 'Kayıt sırasında bir hata oluştu.']);
    }

    $stmt->close();
    $conn->close();
} else {
    echo json_encode(['error' => 'Geçersiz istek metodu.']);
}
*/
?>
<?php
// server/api/ogrenci_giris.php
// Öğrenci giriş API'si

// Add student login logic here
?>