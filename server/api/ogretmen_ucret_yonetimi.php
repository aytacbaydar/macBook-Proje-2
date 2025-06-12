
<?php
// Hata raporlamayı tamamen devre dışı bırak
error_reporting(0);
ini_set('display_errors', 0);
ini_set('display_startup_errors', 0);
ini_set('log_errors', 1);

// Output buffer'ı temizle
if (ob_get_level()) {
    ob_end_clean();
}

require_once '../config.php';

// CORS ayarları
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Content-Type: application/json; charset=utf-8');

// Preflight request için
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Debug için request bilgilerini logla
error_log("ogretmen_ucret_yonetimi.php - Request Method: " . $_SERVER['REQUEST_METHOD']);
error_log("ogretmen_ucret_yonetimi.php - Request URI: " . $_SERVER['REQUEST_URI']);

try {
    // Kullanıcıyı doğrula
    $user = authorize();
    $conn = getConnection();
    
    // Kullanıcının öğretmen olduğunu kontrol et
    if ($user['rutbe'] !== 'ogretmen') {
        errorResponse('Bu işlem için yetkiniz yok. Sadece öğretmenler ücret yönetimi yapabilir.', 403);
    }
    
    // Tablo varlık kontrolü
    $checkTable = $conn->query("SHOW TABLES LIKE 'ogrenci_odemeler'");
    if ($checkTable->rowCount() == 0) {
        // Tablo yoksa oluştur
        $createTable = "
            CREATE TABLE IF NOT EXISTS ogrenci_odemeler (
                id INT AUTO_INCREMENT PRIMARY KEY,
                ogrenci_id INT NOT NULL,
                tutar DECIMAL(10,2) NOT NULL,
                odeme_tarihi DATETIME NOT NULL,
                aciklama TEXT,
                ay INT NOT NULL,
                yil INT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (ogrenci_id) REFERENCES ogrenciler(id)
            )
        ";
        $conn->exec($createTable);
        error_log("ogrenci_odemeler tablosu oluşturuldu");
    }
    
    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        // Öğretmenin ücret bilgilerini getir
        
        $teacherId = $user['id'];
        $teacherName = $user['adi_soyadi'];
        $currentYear = date('Y');
        $currentMonth = date('m');
        
        error_log("Teacher info - ID: $teacherId, Name: $teacherName");
        
        // 1. Öğretmenin öğrencilerini ve ücret bilgilerini getir (ogretmen_ogrencileri.php'deki gibi)
        $studentQuery = "
            SELECT o.id, o.adi_soyadi, o.email, o.cep_telefonu, o.rutbe, o.aktif, o.avatar, o.brans, o.ogretmeni, o.created_at,
                   ob.okulu, ob.sinifi, ob.grubu, ob.ders_gunu, ob.ders_saati, ob.ucret,
                   ob.veli_adi, ob.veli_cep
            FROM ogrenciler o
            LEFT JOIN ogrenci_bilgileri ob ON o.id = ob.ogrenci_id
            WHERE o.ogretmeni = :teacher_name
            ORDER BY o.created_at DESC
        ";
        
        $stmt = $conn->prepare($studentQuery);
        $stmt->bindParam(':teacher_name', $teacherName, PDO::PARAM_STR);
        $stmt->execute();
        $students = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        error_log("Found " . count($students) . " students for teacher ID: $teacherId");
        
        // 2. Bu ay ödeme yapan öğrencileri getir
        $paymentsQuery = "
            SELECT 
                op.id,
                op.ogrenci_id,
                op.tutar,
                op.odeme_tarihi,
                op.aciklama,
                op.ay,
                op.yil,
                o.adi_soyadi as ogrenci_adi
            FROM ogrenci_odemeler op
            INNER JOIN ogrenciler o ON op.ogrenci_id = o.id
            WHERE o.ogretmeni = :teacher_name
            AND op.yil = :current_year
            AND op.ay = :current_month
            ORDER BY op.odeme_tarihi DESC
        ";
        
        $stmt = $conn->prepare($paymentsQuery);
        $stmt->bindParam(':teacher_name', $teacherName, PDO::PARAM_STR);
        $stmt->bindParam(':current_year', $currentYear, PDO::PARAM_INT);
        $stmt->bindParam(':current_month', $currentMonth, PDO::PARAM_INT);
        $stmt->execute();
        $thisMonthPayments = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        // 3. Yıllık toplam geliri getir
        $yearlyQuery = "
            SELECT SUM(op.tutar) as toplam_yillik
            FROM ogrenci_odemeler op
            INNER JOIN ogrenciler o ON op.ogrenci_id = o.id
            WHERE o.ogretmeni = :teacher_name
            AND op.yil = :current_year
        ";
        
        $stmt = $conn->prepare($yearlyQuery);
        $stmt->bindParam(':teacher_name', $teacherName, PDO::PARAM_STR);
        $stmt->bindParam(':current_year', $currentYear, PDO::PARAM_INT);
        $stmt->execute();
        $yearlyResult = $stmt->fetch(PDO::FETCH_ASSOC);
        $yearlyTotal = $yearlyResult['toplam_yillik'] ?? 0;
        
        // 4. Aylık detayları hesapla
        $totalExpected = 0;
        $totalReceived = 0;
        $studentsWhoPayThis = [];
        $studentsWhoDidntPay = [];
        
        // Ödeme yapan öğrenci ID'lerini al
        $paidStudentIds = array_column($thisMonthPayments, 'ogrenci_id');
        
        foreach ($students as $student) {
            if (!empty($student['ucret']) && $student['ucret'] > 0) {
                $expectedAmount = (float) $student['ucret'];
                $totalExpected += $expectedAmount;
                
                if (in_array($student['id'], $paidStudentIds)) {
                    $studentsWhoPayThis[] = $student;
                    // Bu öğrencinin bu ayki ödemelerini topla
                    $studentPayments = array_filter($thisMonthPayments, function($payment) use ($student) {
                        return $payment['ogrenci_id'] == $student['id'];
                    });
                    $studentTotal = array_sum(array_column($studentPayments, 'tutar'));
                    $totalReceived += $studentTotal;
                } else {
                    $studentsWhoDidntPay[] = $student;
                }
            }
        }
        
        $response = [
            'students' => $students,
            'thisMonthPayments' => $thisMonthPayments,
            'summary' => [
                'totalExpected' => $totalExpected,
                'totalReceived' => $totalReceived,
                'yearlyTotal' => $yearlyTotal,
                'studentsWhoPayThis' => $studentsWhoPayThis,
                'studentsWhoDidntPay' => $studentsWhoDidntPay,
                'currentMonth' => $currentMonth,
                'currentYear' => $currentYear
            ]
        ];
        
        // Debug için response'u logla
        error_log("ogretmen_ucret_yonetimi.php - Response summary: " . json_encode([
            'students_count' => count($students),
            'payments_count' => count($thisMonthPayments),
            'teacher_id' => $teacherId,
            'teacher_name' => $teacherName,
            'total_expected' => $totalExpected,
            'total_received' => $totalReceived
        ]));
        
        successResponse($response);
        
    } elseif ($_SERVER['REQUEST_METHOD'] === 'POST') {
        // Yeni ödeme kaydı ekleme
        
        $input = file_get_contents('php://input');
        $data = json_decode($input, true);
        
        error_log("POST data received: " . $input);
        
        if (!$data || !isset($data['ogrenci_id']) || !isset($data['tutar'])) {
            errorResponse('Geçersiz veri. Öğrenci ID ve tutar gerekli.', 400);
        }
        
        $ogrenci_id = (int) $data['ogrenci_id'];
        $tutar = (float) $data['tutar'];
        $aciklama = $data['aciklama'] ?? '';
        $odeme_tarihi = $data['odeme_tarihi'] ?? date('Y-m-d H:i:s');
        $ay = (int) ($data['ay'] ?? date('m'));
        $yil = (int) ($data['yil'] ?? date('Y'));
        
        // Tutar kontrolü
        if ($tutar <= 0) {
            errorResponse('Ödeme tutarı sıfırdan büyük olmalıdır.', 400);
        }
        
        // Öğrencinin bu öğretmene ait olduğunu kontrol et
        $checkQuery = "
            SELECT COUNT(*) as count, o.adi_soyadi
            FROM ogrenciler o 
            WHERE o.id = :ogrenci_id 
            AND o.ogretmeni = :teacher_name
        ";
        
        $stmt = $conn->prepare($checkQuery);
        $stmt->bindParam(':ogrenci_id', $ogrenci_id, PDO::PARAM_INT);
        $stmt->bindParam(':teacher_name', $user['adi_soyadi'], PDO::PARAM_STR);
        $stmt->execute();
        
        $checkResult = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($checkResult['count'] == 0) {
            errorResponse('Bu öğrenciye ödeme kaydı ekleme yetkiniz yok veya öğrenci bulunamadı.', 403);
        }
        
        // Ödeme kaydını ekle
        $insertQuery = "
            INSERT INTO ogrenci_odemeler 
            (ogrenci_id, tutar, odeme_tarihi, aciklama, ay, yil, created_at)
            VALUES 
            (:ogrenci_id, :tutar, :odeme_tarihi, :aciklama, :ay, :yil, NOW())
        ";
        
        $stmt = $conn->prepare($insertQuery);
        $stmt->bindParam(':ogrenci_id', $ogrenci_id, PDO::PARAM_INT);
        $stmt->bindParam(':tutar', $tutar);
        $stmt->bindParam(':odeme_tarihi', $odeme_tarihi);
        $stmt->bindParam(':aciklama', $aciklama);
        $stmt->bindParam(':ay', $ay, PDO::PARAM_INT);
        $stmt->bindParam(':yil', $yil, PDO::PARAM_INT);
        
        if ($stmt->execute()) {
            $paymentId = $conn->lastInsertId();
            
            error_log("Payment added successfully - ID: $paymentId, Student: {$checkResult['adi_soyadi']}, Amount: $tutar");
            
            successResponse([
                'id' => $paymentId,
                'ogrenci_adi' => $checkResult['adi_soyadi'],
                'tutar' => $tutar,
                'ay' => $ay,
                'yil' => $yil
            ], 'Ödeme kaydı başarıyla eklendi.');
        } else {
            error_log("Payment insertion failed for student ID: $ogrenci_id");
            errorResponse('Ödeme kaydı eklenirken hata oluştu.', 500);
        }
        
    } else {
        errorResponse('Desteklenmeyen HTTP metodu', 405);
    }
    
} catch (PDOException $e) {
    error_log("Database error in ogretmen_ucret_yonetimi.php: " . $e->getMessage());
    errorResponse('Veritabanı hatası: ' . $e->getMessage(), 500);
} catch (Exception $e) {
    error_log("General error in ogretmen_ucret_yonetimi.php: " . $e->getMessage());
    errorResponse('Beklenmeyen bir hata oluştu: ' . $e->getMessage(), 500);
}
