
<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

require_once 'config.php';

try {
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (!isset($input['unite_adi']) || empty(trim($input['unite_adi']))) {
        throw new Exception('Ünite adı zorunludur');
    }
    
    if (!isset($input['konu_adi']) || empty(trim($input['konu_adi']))) {
        throw new Exception('Konu adı zorunludur');
    }
    
    $unite_adi = trim($input['unite_adi']);
    $konu_adi = trim($input['konu_adi']);
    $sinif_seviyesi = $input['sinif_seviyesi'] ?? '9';
    $aciklama = trim($input['aciklama'] ?? '');
    
    // Aynı ünite adı, konu adı ve sınıf seviyesinde konu var mı kontrol et
    $checkSql = "SELECT id FROM konular WHERE unite_adi = ? AND konu_adi = ? AND sinif_seviyesi = ?";
    $checkStmt = $pdo->prepare($checkSql);
    $checkStmt->execute([$unite_adi, $konu_adi, $sinif_seviyesi]);
    
    if ($checkStmt->rowCount() > 0) {
        throw new Exception('Bu ünite adı, konu adı ve sınıf seviyesinde zaten bir konu mevcut');
    }
    
    $sql = "INSERT INTO konular (unite_adi, konu_adi, sinif_seviyesi, aciklama, olusturma_tarihi) 
            VALUES (?, ?, ?, ?, NOW())";
    
    $stmt = $pdo->prepare($sql);
    $stmt->execute([$unite_adi, $konu_adi, $sinif_seviyesi, $aciklama]);
    
    echo json_encode([
        'success' => true,
        'message' => 'Konu başarıyla eklendi',
        'konu_id' => $pdo->lastInsertId()
    ]);
    
} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage()
    ]);
}
?>
