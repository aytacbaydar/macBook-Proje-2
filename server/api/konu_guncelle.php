
<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

require_once '../config.php';

try {
    $conn = getConnection();
    
    $input = json_decode(file_get_contents('php://input'), true);
    
    $id = $input['id'] ?? null;
    $konu_adi = $input['konu_adi'] ?? null;
    $unite_adi = $input['unite_adi'] ?? null;
    $sinif_seviyesi = $input['sinif_seviyesi'] ?? null;
    $aciklama = $input['aciklama'] ?? '';
    
    if (!$id || !$konu_adi || !$unite_adi || !$sinif_seviyesi) {
        throw new Exception('ID, konu adı, ünite adı ve sınıf seviyesi gerekli');
    }
    
    $sql = "UPDATE konular SET 
            konu_adi = ?, 
            unite_adi = ?, 
            sinif_seviyesi = ?, 
            aciklama = ? 
            WHERE id = ?";
    
    $stmt = $conn->prepare($sql);
    $stmt->execute([$konu_adi, $unite_adi, $sinif_seviyesi, $aciklama, $id]);
    
    if ($stmt->rowCount() > 0) {
        echo json_encode([
            'success' => true,
            'message' => 'Konu başarıyla güncellendi'
        ]);
    } else {
        throw new Exception('Güncellenecek konu bulunamadı veya hiçbir değişiklik yapılmadı');
    }
    
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
