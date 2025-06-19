
<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    exit(0);
}

require_once '../config.php';

try {
    // Use getConnection function from config.php
    $pdo = getConnection();

    // Get all teachers from ogrenciler table (as teachers are stored there with rutbe='ogretmen')
    $stmt = $pdo->prepare("
        SELECT * FROM ogretmenler
    ");
    
    $stmt->execute();
    $teachers = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Convert aktif field to boolean
    foreach ($teachers as &$teacher) {
        $teacher['aktif'] = (bool)$teacher['aktif'];
    }

    echo json_encode([
        'success' => true,
        'data' => $teachers,
        'count' => count($teachers)
    ]);

} catch (PDOException $e) {
    echo json_encode([
        'success' => false,
        'error' => 'Veritabanı hatası: ' . $e->getMessage()
    ]);
} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'error' => 'Genel hata: ' . $e->getMessage()
    ]);
}
?>
