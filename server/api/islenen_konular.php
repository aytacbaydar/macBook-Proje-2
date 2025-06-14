
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
    
    $ogretmen_id = $_GET['ogretmen_id'] ?? null;
    
    if (!$ogretmen_id) {
        throw new Exception('Öğretmen ID gerekli');
    }
    
    $sql = "SELECT ik.*, k.unite_adi, k.konu_adi, k.sinif_seviyesi 
            FROM islenen_konular ik
            JOIN konular k ON ik.konu_id = k.id
            WHERE ik.ogretmen_id = ?
            ORDER BY ik.isleme_tarihi DESC";
    
    $stmt = $pdo->prepare($sql);
    $stmt->execute([$ogretmen_id]);
    $islenen_konular = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo json_encode([
        'success' => true,
        'islenen_konular' => $islenen_konular
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
