
<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

include '../config.php';

if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    exit(0);
}

try {
    // Veritabanı bağlantısını al
    $conn = getConnection();
    
    // Token doğrulama
    $headers = getallheaders();
    $authHeader = $headers['Authorization'] ?? '';
    
    if (empty($authHeader) || !preg_match('/Bearer\s+(.*)$/i', $authHeader, $matches)) {
        echo json_encode([
            'success' => false,
            'message' => 'Token bulunamadı'
        ]);
        exit;
    }
    
    $token = $matches[1];
    
    // Token'dan kullanıcı bilgilerini al
    // Token format: md5(id + email + password)
    $stmt = $conn->prepare("SELECT id, adi_soyadi, email, sifre, rutbe FROM ogrenciler WHERE aktif = 1");
    $stmt->execute();
    $users = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    $currentUser = null;
    foreach ($users as $user) {
        $expectedToken = md5($user['id'] . $user['email'] . $user['sifre']);
        if ($expectedToken === $token) {
            $currentUser = $user;
            break;
        }
    }
    
    if (!$currentUser) {
        echo json_encode([
            'success' => false,
            'message' => 'Geçersiz token'
        ]);
        exit;
    }
    
    // Sadece öğretmenler yeni öğrenci listesini görebilir
    if ($currentUser['rutbe'] !== 'ogretmen') {
        echo json_encode([
            'success' => false,
            'message' => 'Bu işlem için yetkiniz yok'
        ]);
        exit;
    }
    
    $teacherName = $currentUser['adi_soyadi'];
    error_log("Öğretmen adı: " . $teacherName);
    
    // Yeni kayıt olan öğrencileri getir
    // Kriteria: rutbe = 'yeni' olan kullanıcılar
    $stmt = $conn->prepare("
        SELECT o.*, ob.okulu, ob.sinifi, ob.grubu, ob.ders_gunu, ob.ders_saati, ob.ucret, ob.veli_adi, ob.veli_cep
        FROM ogrenciler o
        LEFT JOIN ogrenci_bilgileri ob ON o.id = ob.ogrenci_id
        WHERE o.rutbe = 'yeni'
        ORDER BY o.created_at DESC
    ");
    
    $stmt->execute();
    $newStudents = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    error_log("Bulunan yeni kayıt sayısı: " . count($newStudents));
    
    // Her öğrenci için detay logla
    foreach ($newStudents as $index => $student) {
        error_log("Yeni öğrenci " . ($index + 1) . ": " . json_encode([
            'id' => $student['id'],
            'adi_soyadi' => $student['adi_soyadi'],
            'email' => $student['email'],
            'rutbe' => $student['rutbe'],
            'ogretmeni' => $student['ogretmeni'],
            'created_at' => $student['created_at'],
            'aktif' => $student['aktif']
        ]));
    }
    
    // Avatar URL'lerini ayarla
    foreach ($newStudents as &$student) {
        if (empty($student['avatar'])) {
            $name = urlencode($student['adi_soyadi']);
            $student['avatar'] = "https://ui-avatars.com/api/?name={$name}&background=4f46e5&color=fff&size=60&font-size=0.6&rounded=true";
        }
        
        // Kayıt tarihini string olarak ayarla
        $student['kayit_tarihi'] = $student['created_at'];
    }
    
    echo json_encode([
        'success' => true,
        'data' => $newStudents,
        'message' => count($newStudents) . ' yeni kayıt bulundu'
    ]);

} catch (Exception $e) {
    error_log("Yeni kayıt öğrenciler API hatası: " . $e->getMessage());
    echo json_encode([
        'success' => false,
        'message' => 'Sunucu hatası: ' . $e->getMessage()
    ]);
}
?>
