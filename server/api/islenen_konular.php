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
    $conn = getConnection();

    $ogretmen_id = $_GET['ogretmen_id'] ?? null;

    if (!$ogretmen_id) {
        throw new Exception('Öğretmen ID gerekli');
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
        WHERE ik.ogretmen_id = :ogretmen_id
        ORDER BY ik.isleme_tarihi DESC
    ");

    $stmt->execute([':ogretmen_id' => $ogretmen_id]);
    $islenen_konular = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode([
        'success' => true,
        'islenen_konular' => $islenen_konular,
        'debug_info' => [
            'ogretmen_id' => $ogretmen_id,
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