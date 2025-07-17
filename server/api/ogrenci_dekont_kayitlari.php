
<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Authorization, Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

require_once '../config.php';

try {
    $pdo = getConnection();

    // Yetkilendirme kontrolü
    $headers = getallheaders();
    $authHeader = $headers['Authorization'] ?? '';

    if (!$authHeader || !preg_match('/Bearer\s+(.*)$/i', $authHeader, $matches)) {
        throw new Exception('Yetki gerekli');
    }

    $token = $matches[1];
    $userData = validateToken($token, $pdo);

    if (!$userData) {
        throw new Exception('Geçersiz token');
    }

    // Öğrencinin dekont kayıtlarını getir
    $stmt = $pdo->prepare("
        SELECT 
            id,
            tutar,
            aciklama,
            dekont_dosya,
            dekont_yuklenme_tarihi,
            dekont_durumu,
            ay,
            yil,
            created_at
        FROM dekont_kayitlari 
        WHERE ogrenci_id = ? 
        ORDER BY yil DESC, ay DESC, created_at DESC
    ");
    
    $stmt->execute([$userData['id']]);
    $dekontlar = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Dosya yollarını düzenle
    foreach ($dekontlar as &$dekont) {
        if ($dekont['dekont_dosya']) {
            $dekont['dekont_url'] = str_replace('../uploads/', '/server/uploads/', $dekont['dekont_dosya']);
        }
    }

    echo json_encode([
        'success' => true,
        'data' => $dekontlar
    ]);

} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}

function validateToken($token, $pdo) {
    try {
        $stmt = $pdo->prepare("
            SELECT * FROM ogrenciler 
            WHERE MD5(CONCAT(id, email, sifre)) = ? AND aktif = 1
        ");
        $stmt->execute([$token]);
        return $stmt->fetch(PDO::FETCH_ASSOC) ?: false;
    } catch (Exception $e) {
        return false;
    }
}
?>
