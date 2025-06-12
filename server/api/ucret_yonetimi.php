
<?php
// Basit ücret yönetimi API'si
require_once '../config.php';

// CORS başlıkları
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Content-Type: application/json; charset=UTF-8");

// OPTIONS isteğini yönet
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// GET isteği: Öğrenci ve ödeme verilerini getir
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    try {
        $user = authorize();
        
        if ($user['rutbe'] !== 'ogretmen') {
            errorResponse('Bu işlem için yetkiniz yok.', 403);
        }
        
        $conn = getConnection();
        
        // Giriş yapan öğretmenin adını al
        $teacherName = $user['adi_soyadi'];
        
        // Öğretmenin öğrencilerini getir
        $stmt = $conn->prepare("
            SELECT o.id, o.adi_soyadi, o.email, o.cep_telefonu, o.rutbe, o.aktif,
                   ob.okulu, ob.sinifi, ob.grubu, ob.ders_gunu, ob.ders_saati, ob.ucret,
                   ob.veli_adi, ob.veli_cep
            FROM ogrenciler o
            LEFT JOIN ogrenci_bilgileri ob ON o.id = ob.ogrenci_id
            WHERE o.ogretmeni = ? AND o.rutbe = 'ogrenci'
            ORDER BY o.adi_soyadi
        ");
        $stmt->execute([$teacherName]);
        $students = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        // Bu ayın ödemelerini getir
        $currentYear = date('Y');
        $currentMonth = date('m');
        
        $stmt = $conn->prepare("
            SELECT op.*, o.adi_soyadi as ogrenci_adi
            FROM ogrenci_odemeler op
            INNER JOIN ogrenciler o ON op.ogrenci_id = o.id
            WHERE o.ogretmeni = ? AND op.yil = ? AND op.ay = ?
            ORDER BY op.odeme_tarihi DESC
        ");
        $stmt->execute([$teacherName, $currentYear, $currentMonth]);
        $payments = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        // Özet bilgileri hesapla
        $totalExpected = 0;
        $totalReceived = 0;
        $studentsWhoPayThis = [];
        $studentsWhoDidntPay = [];
        
        foreach ($students as $student) {
            if ($student['aktif'] && $student['ucret']) {
                $studentFee = floatval($student['ucret']);
                $totalExpected += $studentFee;
                
                // Bu öğrencinin bu ay ödemesi var mı kontrol et
                $paidThisMonth = false;
                foreach ($payments as $payment) {
                    if ($payment['ogrenci_id'] == $student['id']) {
                        $paidThisMonth = true;
                        $totalReceived += floatval($payment['tutar']);
                        break;
                    }
                }
                
                if ($paidThisMonth) {
                    $studentsWhoPayThis[] = $student;
                } else {
                    $studentsWhoDidntPay[] = $student;
                }
            }
        }
        
        $response = [
            'students' => $students,
            'payments' => $payments,
            'summary' => [
                'totalExpected' => $totalExpected,
                'totalReceived' => $totalReceived,
                'studentsWhoPayThis' => $studentsWhoPayThis,
                'studentsWhoDidntPay' => $studentsWhoDidntPay,
                'currentMonth' => intval($currentMonth),
                'currentYear' => intval($currentYear)
            ]
        ];
        
        successResponse($response);
        
    } catch (Exception $e) {
        errorResponse('Veri getirme hatası: ' . $e->getMessage(), 500);
    }
}

// POST isteği: Yeni ödeme ekle
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    try {
        $user = authorize();
        
        if ($user['rutbe'] !== 'ogretmen') {
            errorResponse('Bu işlem için yetkiniz yok.', 403);
        }
        
        $data = json_decode(file_get_contents('php://input'), true);
        
        if (!$data || !isset($data['ogrenci_id']) || !isset($data['tutar'])) {
            errorResponse('Gerekli alanlar eksik.', 400);
        }
        
        $conn = getConnection();
        
        $stmt = $conn->prepare("
            INSERT INTO ogrenci_odemeler (ogrenci_id, tutar, odeme_tarihi, aciklama, ay, yil)
            VALUES (?, ?, ?, ?, ?, ?)
        ");
        
        $stmt->execute([
            $data['ogrenci_id'],
            $data['tutar'],
            $data['odeme_tarihi'] ?? date('Y-m-d'),
            $data['aciklama'] ?? '',
            $data['ay'] ?? date('m'),
            $data['yil'] ?? date('Y')
        ]);
        
        successResponse(['message' => 'Ödeme başarıyla kaydedildi.']);
        
    } catch (Exception $e) {
        errorResponse('Ödeme kaydetme hatası: ' . $e->getMessage(), 500);
    }
}

errorResponse('Desteklenmeyen HTTP metodu', 405);
?>
