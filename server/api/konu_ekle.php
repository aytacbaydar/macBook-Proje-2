
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
    
    if (!isset($input['baslik']) || empty(trim($input['baslik']))) {
        throw new Exception('Konu başlığı zorunludur');
    }
    
    $baslik = trim($input['baslik']);
    $sinif_seviyesi = $input['sinif_seviyesi'] ?? '9';
    $aciklama = trim($input['aciklama'] ?? '');
    
    // Aynı başlık ve sınıf seviyesinde konu var mı kontrol et
    $checkSql = "SELECT id FROM konular WHERE baslik = ? AND sinif_seviyesi = ?";
    $checkStmt = $pdo->prepare($checkSql);
    $checkStmt->execute([$baslik, $sinif_seviyesi]);
    
    if ($checkStmt->rowCount() > 0) {
        throw new Exception('Bu başlık ve sınıf seviyesinde zaten bir konu mevcut');
    }
    
    $sql = "INSERT INTO konular (baslik, sinif_seviyesi, aciklama, olusturma_tarihi) 
            VALUES (?, ?, ?, NOW())";
    
    $stmt = $pdo->prepare($sql);
    $stmt->execute([$baslik, $sinif_seviyesi, $aciklama]);
    
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
