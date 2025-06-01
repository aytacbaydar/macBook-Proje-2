
<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Origin, Content-Type, Accept, Authorization, X-Request-With');

// OPTIONS isteği için erken çıkış
if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once '../config.php';

function errorResponse($message, $code = 400) {
    http_response_code($code);
    echo json_encode([
        'success' => false,
        'message' => $message,
        'data' => null
    ], JSON_UNESCAPED_UNICODE);
    exit();
}

function successResponse($data, $message = 'Başarılı') {
    echo json_encode([
        'success' => true,
        'message' => $message,
        'data' => $data
    ], JSON_UNESCAPED_UNICODE);
    exit();
}

try {
    // Token kontrolü
    $headers = getallheaders();
    $authHeader = $headers['Authorization'] ?? $headers['authorization'] ?? '';
    
    if (empty($authHeader) || !preg_match('/Bearer\s+(.*)$/i', $authHeader, $matches)) {
        errorResponse('Token bulunamadı', 401);
    }
    
    $token = $matches[1];
    
    // Veritabanı bağlantısı
    $conn = new PDO("mysql:host=$servername;dbname=$dbname;charset=utf8mb4", $username, $password);
    $conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    
    // Token doğrulama
    $stmt = $conn->prepare("SELECT id, adi_soyadi, rutbe FROM kullanicilar WHERE token = :token AND aktif = 1");
    $stmt->bindParam(':token', $token);
    $stmt->execute();
    $user = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$user) {
        errorResponse('Geçersiz token', 401);
    }
    
    // Sadece öğretmen ve admin erişebilir
    if (!in_array($user['rutbe'], ['ogretmen', 'admin'])) {
        errorResponse('Bu işlem için yetkiniz yok', 403);
    }
    
    // GET parametrelerini al
    $grup = $_GET['grup'] ?? '';
    $tarih = $_GET['tarih'] ?? '';
    
    if (empty($grup) || empty($tarih)) {
        errorResponse('Grup ve tarih parametreleri gerekli');
    }
    
    // Öğretmen ise sadece kendi öğrencilerini görebilir
    $teacherFilter = '';
    $params = [':grup' => $grup, ':tarih' => $tarih];
    
    if ($user['rutbe'] === 'ogretmen') {
        $teacherFilter = ' AND k.ogretmeni = :ogretmen';
        $params[':ogretmen'] = $user['adi_soyadi'];
    }
    
    // O gruptaki öğrencileri al
    $studentQuery = "
        SELECT k.id, k.adi_soyadi, k.email 
        FROM kullanicilar k 
        WHERE k.rutbe = 'ogrenci' 
        AND k.grubu = :grup 
        AND k.aktif = 1
        $teacherFilter
        ORDER BY k.adi_soyadi
    ";
    
    $stmt = $conn->prepare($studentQuery);
    foreach ($params as $key => $value) {
        if ($key !== ':tarih') {
            $stmt->bindValue($key, $value);
        }
    }
    $stmt->execute();
    $students = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // O tarihteki giriş-çıkış kayıtlarını al
    $attendanceQuery = "
        SELECT student_id, action, entry_time as zaman, qr_method
        FROM sinif_durumu 
        WHERE grup = :grup 
        AND DATE(entry_time) = :tarih
        ORDER BY student_id, entry_time
    ";
    
    $stmt = $conn->prepare($attendanceQuery);
    $stmt->bindValue(':grup', $grup);
    $stmt->bindValue(':tarih', $tarih);
    $stmt->execute();
    $attendanceRecords = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Öğrenci bazında giriş-çıkış hareketlerini organize et
    $studentAttendance = [];
    foreach ($attendanceRecords as $record) {
        $studentId = $record['student_id'];
        if (!isset($studentAttendance[$studentId])) {
            $studentAttendance[$studentId] = [];
        }
        $studentAttendance[$studentId][] = [
            'action' => $record['action'],
            'zaman' => $record['zaman'],
            'qr_method' => $record['qr_method']
        ];
    }
    
    // Sonuç verisini hazırla
    $reportData = [];
    foreach ($students as $student) {
        $studentId = $student['id'];
        $movements = $studentAttendance[$studentId] ?? [];
        
        // Öğrencinin son durumunu hesapla
        $isPresent = false;
        if (!empty($movements)) {
            $lastMovement = end($movements);
            $isPresent = ($lastMovement['action'] === 'entry');
        }
        
        $reportData[] = [
            'student_id' => $studentId,
            'student_name' => $student['adi_soyadi'],
            'student_email' => $student['email'],
            'is_present' => $isPresent,
            'movements' => $movements,
            'movement_count' => count($movements)
        ];
    }
    
    successResponse($reportData, 'Günlük rapor başarıyla yüklendi');
    
} catch (PDOException $e) {
    error_log("Database error: " . $e->getMessage());
    errorResponse('Veritabanı hatası: ' . $e->getMessage(), 500);
} catch (Exception $e) {
    error_log("General error: " . $e->getMessage());
    errorResponse('Sunucu hatası: ' . $e->getMessage(), 500);
}
?>
