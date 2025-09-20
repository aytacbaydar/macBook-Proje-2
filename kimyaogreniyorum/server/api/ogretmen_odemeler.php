<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: *');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

// Database connection
$host = 'localhost';
$dbname = 'kimyaogreniyorum';
$username = 'root';
$password = '';

try {
    $pdo = new PDO("mysql:host=$host;dbname=$dbname;charset=utf8mb4", $username, $password);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
} catch (PDOException $e) {
    echo json_encode(['success' => false, 'message' => 'Database connection failed: ' . $e->getMessage()]);
    exit;
}

// Auth token kontrolü
$headers = getallheaders();
$auth_header = isset($headers['Authorization']) ? $headers['Authorization'] : '';
if (empty($auth_header) || substr($auth_header, 0, 7) !== 'Bearer ') {
    echo json_encode(['success' => false, 'message' => 'Authorization token required']);
    exit;
}

$token = substr($auth_header, 7);

// Token doğrulama
$stmt = $pdo->prepare("SELECT * FROM kullanicilar WHERE token = ? AND rol = 'ogretmen'");
$stmt->execute([$token]);
$teacher = $stmt->fetch(PDO::FETCH_ASSOC);

if (!$teacher) {
    echo json_encode(['success' => false, 'message' => 'Invalid token or not teacher']);
    exit;
}

$teacher_name = $teacher['adi_soyadi'];

try {
    // Bu öğretmenin öğrencilerinin ödemelerini al (bu ay)
    $current_month = date('n');
    $current_year = date('Y');
    
    $query = "
        SELECT 
            o.id,
            o.ogrenci_id,
            o.tutar,
            o.odeme_tarihi,
            o.aciklama,
            o.ay,
            o.yil,
            og.adi_soyadi as ogrenci_adi,
            og.ogretmen_adi
        FROM ogrenci_odemeler o
        INNER JOIN ogrenciler og ON o.ogrenci_id = og.id
        WHERE og.ogretmen_adi = ?
        AND og.aktif = 1
        AND o.ay = ?
        AND o.yil = ?
        ORDER BY o.odeme_tarihi DESC
    ";
    
    $stmt = $pdo->prepare($query);
    $stmt->execute([$teacher_name, $current_month, $current_year]);
    $payments = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Tüm zamanların ödemelerini de al (toplam için)
    $query_all = "
        SELECT 
            o.id,
            o.ogrenci_id,
            o.tutar,
            o.odeme_tarihi,
            o.aciklama,
            o.ay,
            o.yil,
            og.adi_soyadi as ogrenci_adi
        FROM ogrenci_odemeler o
        INNER JOIN ogrenciler og ON o.ogrenci_id = og.id
        WHERE og.ogretmen_adi = ?
        AND og.aktif = 1
        ORDER BY o.odeme_tarihi DESC
    ";
    
    $stmt = $pdo->prepare($query_all);
    $stmt->execute([$teacher_name]);
    $all_payments = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Response
    echo json_encode([
        'success' => true,
        'data' => [
            'current_month_payments' => $payments,
            'all_payments' => $all_payments,
            'teacher' => $teacher_name,
            'month' => $current_month,
            'year' => $current_year,
            'total_payments_count' => count($all_payments),
            'current_month_count' => count($payments)
        ]
    ]);

} catch (PDOException $e) {
    echo json_encode(['success' => false, 'message' => 'Database error: ' . $e->getMessage()]);
}
?>