
<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

require_once '../config.php';

// Yetkilendirme kontrolü
function checkAuthorization() {
    $headers = getallheaders();
    if (!isset($headers['Authorization'])) {
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'Token gerekli']);
        exit;
    }
    
    $token = str_replace('Bearer ', '', $headers['Authorization']);
    // Token doğrulama burada yapılabilir
    return true;
}

try {
    checkAuthorization();
    
    if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
        throw new Exception('Sadece GET metodu destekleniyor');
    }
    
    $grup = $_GET['grup'] ?? '';
    $tarih = $_GET['tarih'] ?? '';
    
    if (empty($grup) || empty($tarih)) {
        throw new Exception('Grup ve tarih parametreleri gerekli');
    }
    
    // O gün için tüm giriş-çıkış kayıtlarını al
    $query = "SELECT sc.*, u.adi_soyadi 
              FROM sinif_takip sc 
              LEFT JOIN users u ON sc.student_id = u.id 
              WHERE sc.grup = ? AND DATE(sc.tarih) = ? 
              ORDER BY sc.student_id, sc.zaman ASC";
    
    $stmt = $conn->prepare($query);
    $stmt->bind_param("ss", $grup, $tarih);
    $stmt->execute();
    $result = $stmt->get_result();
    
    $data = [];
    while ($row = $result->fetch_assoc()) {
        $data[] = [
            'id' => $row['id'],
            'student_id' => $row['student_id'],
            'student_name' => $row['adi_soyadi'],
            'grup' => $row['grup'],
            'action' => $row['action'],
            'tarih' => $row['tarih'],
            'zaman' => $row['zaman']
        ];
    }
    
    echo json_encode([
        'success' => true,
        'data' => $data,
        'message' => 'Günlük rapor verileri başarıyla yüklendi'
    ]);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage()
    ]);
}
?>
