
<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

require_once '../config.php';

try {
    $pdo = getConnection();
    
    $input = json_decode(file_get_contents('php://input'), true);
    
    $konu_id = $input['konu_id'] ?? null;
    $grup_adi = $input['grup_adi'] ?? null;
    $ogretmen_id = $input['ogretmen_id'] ?? null;
    $isleme_tarihi = $input['isleme_tarihi'] ?? date('Y-m-d');
    
    if (!$konu_id || !$grup_adi || !$ogretmen_id) {
        throw new Exception('Konu ID, grup adı ve öğretmen ID gerekli');
    }
    
    // Aynı konu, grup ve öğretmen için kayıt var mı kontrol et
    $checkSql = "SELECT id FROM islenen_konular 
                 WHERE konu_id = ? AND grup_adi = ? AND ogretmen_id = ?";
    $checkStmt = $pdo->prepare($checkSql);
    $checkStmt->execute([$konu_id, $grup_adi, $ogretmen_id]);
    
    if ($checkStmt->rowCount() > 0) {
        throw new Exception('Bu konu bu grupla zaten işlenmiş olarak işaretlenmiş');
    }
    
    $sql = "INSERT INTO islenen_konular (konu_id, grup_adi, ogretmen_id, isleme_tarihi) 
            VALUES (?, ?, ?, ?)";
    
    $stmt = $pdo->prepare($sql);
    $stmt->execute([$konu_id, $grup_adi, $ogretmen_id, $isleme_tarihi]);
    
    echo json_encode([
        'success' => true,
        'message' => 'Konu işlenmiş olarak işaretlendi',
        'id' => $pdo->lastInsertId()
    ]);
    
} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage()
    ]);
} catch (PDOException $e) {
    echo json_encode([
        'success' => false,
        'message' => 'Veritabanı hatası: ' . $e->getMessage()
    ]);
}
?>
