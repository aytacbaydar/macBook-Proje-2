
<?php
require_once '../config.php';

// CORS headers
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Content-Type: application/json; charset=UTF-8");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// GET: Ödeme verilerini getir
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    try {
        $user = authorize();
        
        if ($user['rutbe'] !== 'ogretmen') {
            errorResponse('Bu işlem için yetkiniz yok.', 403);
        }
        
        $conn = getConnection();
        $teacherName = $user['adi_soyadi'];
        
        // 1. Öğretmenin öğrencilerini getir
        $studentsQuery = "
            SELECT o.id, o.adi_soyadi, o.email, o.cep_telefonu, o.rutbe, o.aktif,
                   ob.okulu, ob.sinifi, ob.grubu, ob.ders_adi, ob.ders_gunu, ob.ders_saati, 
                   ob.ucret, ob.veli_adi, ob.veli_cep
            FROM ogrenciler o
            LEFT JOIN ogrenci_bilgileri ob ON o.id = ob.ogrenci_id
            WHERE o.ogretmeni = ? AND o.rutbe = 'ogrenci' AND o.aktif = 1
            ORDER BY o.adi_soyadi
        ";
        $stmt = $conn->prepare($studentsQuery);
        $stmt->execute([$teacherName]);
        $students = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        // 2. Bu ayın ödemelerini getir
        $currentYear = date('Y');
        $currentMonth = date('m');
        
        $paymentsQuery = "
            SELECT op.id, op.ogrenci_id, op.tutar, op.odeme_tarihi, op.aciklama, op.ay, op.yil,
                   o.adi_soyadi as ogrenci_adi
            FROM ogrenci_odemeler op
            INNER JOIN ogrenciler o ON op.ogrenci_id = o.id
            WHERE o.ogretmeni = ? AND op.yil = ? AND op.ay = ?
            ORDER BY op.odeme_tarihi DESC
        ";
        $stmt = $conn->prepare($paymentsQuery);
        $stmt->execute([$teacherName, $currentYear, $currentMonth]);
        $payments = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        // 3. Detaylı aylık analiz (2025 Ağustos - 2026 Haziran)
        $monthlyAnalysis = [];
        $totalExpectedAll = 0;
        $totalReceivedAll = 0;
        
        // Ay listesi (2025 Ağustos - 2026 Haziran)
        $analysisMonths = [
            ['year' => 2025, 'month' => 8, 'name' => 'Ağustos 2025'],
            ['year' => 2025, 'month' => 9, 'name' => 'Eylül 2025'],
            ['year' => 2025, 'month' => 10, 'name' => 'Ekim 2025'],
            ['year' => 2025, 'month' => 11, 'name' => 'Kasım 2025'],
            ['year' => 2025, 'month' => 12, 'name' => 'Aralık 2025'],
            ['year' => 2026, 'month' => 1, 'name' => 'Ocak 2026'],
            ['year' => 2026, 'month' => 2, 'name' => 'Şubat 2026'],
            ['year' => 2026, 'month' => 3, 'name' => 'Mart 2026'],
            ['year' => 2026, 'month' => 4, 'name' => 'Nisan 2026'],
            ['year' => 2026, 'month' => 5, 'name' => 'Mayıs 2026'],
            ['year' => 2026, 'month' => 6, 'name' => 'Haziran 2026']
        ];
        
        foreach ($analysisMonths as $monthInfo) {
            $year = $monthInfo['year'];
            $month = $monthInfo['month'];
            $monthName = $monthInfo['name'];
            
            // Bu ay için ödemeleri getir
            $monthPaymentsQuery = "
                SELECT op.id, op.ogrenci_id, op.tutar, op.odeme_tarihi, op.aciklama,
                       o.adi_soyadi as ogrenci_adi
                FROM ogrenci_odemeler op
                INNER JOIN ogrenciler o ON op.ogrenci_id = o.id
                WHERE o.ogretmeni = ? AND op.yil = ? AND op.ay = ?
                ORDER BY op.odeme_tarihi DESC
            ";
            $stmt = $conn->prepare($monthPaymentsQuery);
            $stmt->execute([$teacherName, $year, $month]);
            $monthPayments = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            // Bu ay için beklenen toplam
            $monthExpected = 0;
            $monthReceived = 0;
            $studentsWhoPaidThisMonth = [];
            $studentsWhoDidntPayThisMonth = [];
            $paidStudentIds = [];
            
            // Ödemeleri topla
            foreach ($monthPayments as $payment) {
                $monthReceived += floatval($payment['tutar']);
                if (!in_array($payment['ogrenci_id'], $paidStudentIds)) {
                    $paidStudentIds[] = $payment['ogrenci_id'];
                }
            }
            
            // Her öğrenci için analiz
            foreach ($students as $student) {
                $studentFee = floatval($student['ucret'] ?? 0);
                if ($studentFee > 0) {
                    $monthExpected += $studentFee;
                    
                    if (in_array($student['id'], $paidStudentIds)) {
                        $studentsWhoPaidThisMonth[] = [
                            'id' => $student['id'],
                            'adi_soyadi' => $student['adi_soyadi'],
                            'ucret' => $studentFee
                        ];
                    } else {
                        $studentsWhoDidntPayThisMonth[] = [
                            'id' => $student['id'],
                            'adi_soyadi' => $student['adi_soyadi'],
                            'ucret' => $studentFee
                        ];
                    }
                }
            }
            
            $monthlyAnalysis[] = [
                'year' => $year,
                'month' => $month,
                'monthName' => $monthName,
                'expected' => $monthExpected,
                'received' => $monthReceived,
                'deficit' => $monthExpected - $monthReceived,
                'payments' => $monthPayments,
                'studentsWhoPaid' => $studentsWhoPaidThisMonth,
                'studentsWhoDidntPay' => $studentsWhoDidntPayThisMonth,
                'paymentCount' => count($monthPayments),
                'paidStudentCount' => count($studentsWhoPaidThisMonth),
                'unpaidStudentCount' => count($studentsWhoDidntPayThisMonth)
            ];
            
            $totalExpectedAll += $monthExpected;
            $totalReceivedAll += $monthReceived;
        }
        
        // Mevcut ay özeti (geriye dönük uyumluluk için)
        $totalExpected = 0;
        $totalReceived = 0;
        $studentsWhoPayThis = [];
        $studentsWhoDidntPay = [];
        
        foreach ($students as $student) {
            $studentFee = floatval($student['ucret'] ?? 0);
            if ($studentFee > 0) {
                $totalExpected += $studentFee;
                
                // Bu öğrencinin bu ay ödemesi var mı?
                $hasPaid = false;
                $studentPaymentTotal = 0;
                
                foreach ($payments as $payment) {
                    if ($payment['ogrenci_id'] == $student['id']) {
                        $hasPaid = true;
                        $studentPaymentTotal += floatval($payment['tutar']);
                    }
                }
                
                if ($hasPaid) {
                    $studentsWhoPayThis[] = $student;
                    $totalReceived += $studentPaymentTotal;
                } else {
                    $studentsWhoDidntPay[] = $student;
                }
            }
        }
        
        $responseData = [
            'students' => $students,
            'payments' => $payments,
            'summary' => [
                'totalExpected' => $totalExpected,
                'totalReceived' => $totalReceived,
                'studentsWhoPayThis' => $studentsWhoPayThis,
                'studentsWhoDidntPay' => $studentsWhoDidntPay,
                'currentMonth' => intval($currentMonth),
                'currentYear' => intval($currentYear)
            ],
            'monthlyAnalysis' => $monthlyAnalysis,
            'yearlyTotals' => [
                'totalExpected' => $totalExpectedAll,
                'totalReceived' => $totalReceivedAll,
                'totalDeficit' => $totalExpectedAll - $totalReceivedAll
            ]
        ];
        
        // Doğru response formatı
        successResponse($responseData);
        
    } catch (Exception $e) {
        errorResponse('Veri getirme hatası: ' . $e->getMessage(), 500);
    }
}

// POST: Yeni ödeme kaydet
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    try {
        $user = authorize();
        
        if ($user['rutbe'] !== 'ogretmen') {
            errorResponse('Bu işlem için yetkiniz yok.', 403);
        }
        
        $data = json_decode(file_get_contents('php://input'), true);
        
        if (!$data || !isset($data['ogrenci_id']) || !isset($data['tutar'])) {
            errorResponse('Öğrenci ID ve tutar gerekli.', 400);
        }
        
        $conn = getConnection();
        
        // Ödeme kaydını ekle
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
