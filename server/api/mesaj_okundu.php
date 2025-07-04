<?php
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

require_once '../config.php';

$conn = getConnection(); // ⭐️ ÖNEMLİ: PDO bağlantısını buradan alıyoruz

$ogrenci_id = $_GET['ogrenci_id'] ?? $_POST['ogrenci_id'] ?? null;

if (!$ogrenci_id) {
    echo json_encode(["error" => "ogrenci_id parametresi gerekli."]);
    exit;
}

try {
    $sql = "UPDATE soru_mesajlari SET okundu = 1 WHERE ogrenci_id = :ogrenci_id AND okundu = 0";
    $stmt = $conn->prepare($sql);
    $stmt->bindParam(':ogrenci_id', $ogrenci_id, PDO::PARAM_INT);
    $stmt->execute();

    $adet = $stmt->rowCount();

    echo json_encode([
        "success" => true,
        "updated_count" => $adet,
        "message" => "$adet mesaj okundu olarak işaretlendi."
    ]);
} catch (PDOException $e) {
    echo json_encode(["error" => "Veritabanı hatası: " . $e->getMessage()]);
}
?>
