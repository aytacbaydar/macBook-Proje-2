
<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

require_once '../config.php';

try {
    $conn = getConnection();

    $grup = $_GET['grup'] ?? null;

    if (!$grup) {
        throw new Exception('Grup parametresi gerekli');
    }

    $stmt = $conn->prepare("
        SELECT 
            ik.*,
            k.konu_adi,
            k.konu_adi as konu_baslik,
            k.unite_adi,
            k.sinif_seviyesi
        FROM islenen_konular ik
        LEFT JOIN konular k ON ik.konu_id = k.id
        WHERE ik.grup_adi = :grup
        ORDER BY ik.isleme_tarihi DESC
    ");

    $stmt->execute([':grup' => $grup]);
    $islenen_konular = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode([
        'success' => true,
        'islenen_konular' => $islenen_konular,
        'debug_info' => [
            'grup' => $grup,
            'total_records' => count($islenen_konular),
            'sample_fields' => !empty($islenen_konular) ? array_keys($islenen_konular[0]) : []
        ]
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
