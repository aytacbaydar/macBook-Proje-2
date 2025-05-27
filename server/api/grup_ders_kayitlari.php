
<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");
header("Content-Type: application/json; charset=UTF-8");

// OPTIONS isteğini yönet
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// GET isteği kontrol et
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Sadece GET istekleri kabul edilir']);
    exit();
}

// Grup parametresini kontrol et
if (!isset($_GET['grup']) || empty($_GET['grup'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Grup parametresi gerekli']);
    exit();
}

$grup = $_GET['grup'];

try {
    require_once '../config.php';
    $conn = getConnection();

    // Konu anlatım kayıtları tablosunu kontrol et/oluştur
    $tableSql = "
    CREATE TABLE IF NOT EXISTS `konu_anlatim_kayitlari` (
      `id` int(11) NOT NULL AUTO_INCREMENT,
      `pdf_adi` varchar(255) NOT NULL,
      `pdf_dosya_yolu` varchar(255) NOT NULL,
      `sayfa_sayisi` int(11) NOT NULL DEFAULT 1,
      `cizim_dosya_yolu` varchar(255) DEFAULT NULL,
      `ogrenci_grubu` varchar(100) NOT NULL,
      `ogretmen_id` int(11) NOT NULL DEFAULT 1,
      `olusturma_zamani` datetime NOT NULL,
      `guncelleme_zamani` datetime DEFAULT NULL,
      PRIMARY KEY (`id`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    ";
    $conn->exec($tableSql);

    // Kullanıcılar tablosunu da kontrol et
    $userTableSql = "
    CREATE TABLE IF NOT EXISTS `kullanicilar` (
      `id` int(11) NOT NULL AUTO_INCREMENT,
      `adi_soyadi` varchar(255) NOT NULL,
      `email` varchar(255) NOT NULL UNIQUE,
      `sifre` varchar(255) NOT NULL,
      `rol` enum('ogrenci','ogretmen','yonetici') NOT NULL DEFAULT 'ogrenci',
      `aktif` tinyint(1) NOT NULL DEFAULT 1,
      `olusturma_zamani` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (`id`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    ";
    $conn->exec($userTableSql);

    // Bu gruba ait ders kayıtlarını getir
    $stmt = $conn->prepare("
        SELECT 
            k.id,
            k.pdf_adi,
            k.pdf_dosya_yolu,
            k.cizim_dosya_yolu,
            k.sayfa_sayisi,
            k.olusturma_zamani,
            COALESCE(u.adi_soyadi, 'Bilinmeyen Öğretmen') as ogretmen_adi
        FROM konu_anlatim_kayitlari k
        LEFT JOIN kullanicilar u ON k.ogretmen_id = u.id
        WHERE k.ogrenci_grubu = :grup
        ORDER BY k.olusturma_zamani DESC
    ");

    $stmt->bindParam(':grup', $grup);
    $stmt->execute();
    $kayitlar = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Başarılı yanıt
    echo json_encode([
        'success' => true,
        'data' => $kayitlar,
        'message' => 'Ders kayıtları başarıyla getirildi'
    ]);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Veritabanı hatası: ' . $e->getMessage()
    ]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Beklenmeyen bir hata oluştu: ' . $e->getMessage()
    ]);
}
?>
