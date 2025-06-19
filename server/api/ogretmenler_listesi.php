
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
    // Database connection
    $pdo = new PDO("mysql:host=$servername;dbname=$dbname;charset=utf8", $username, $password);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    // Get all teachers
    $stmt = $pdo->prepare("
        SELECT 
            id,
            adi_soyadi,
            email,
            telefon,
            brans,
            rutbe,
            aktif,
            avatar,
            kayit_tarihi
        FROM kullanicilar 
        WHERE rutbe = 'ogretmen'
        ORDER BY adi_soyadi ASC
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
