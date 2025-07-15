
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

// GET: Öğrenci ücret bilgilerini getir
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    try {
        $user = authorize();
        
        if ($user['rutbe'] !== 'ogrenci') {
            errorResponse('Bu işlem sadece öğrenciler için geçerlidir.', 403);
        }
        
        $conn = getConnection();
        $studentId = $user['id'];
        
        // 1. Öğrenci temel bilgilerini getir
        $studentQuery = "
            SELECT o.id, o.adi_soyadi, o.email, o.avatar, o.ogretmeni,
                   ob.ucret, ob.grubu, ob.okulu, ob.sinifi, ob.ders_adi
            FROM ogrenciler o
            LEFT JOIN ogrenci_bilgileri ob ON o.id = ob.ogrenci_id
            WHERE o.id = ? AND o.rutbe = 'ogrenci'
        ";
        $stmt = $conn->prepare($studentQuery);
        $stmt->execute([$studentId]);
        $student = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$student) {
            errorResponse('Öğrenci bilgisi bulunamadı.', 404);
        }
        
        // 2. Devamsızlık kayıtlarını getir (son 3 ay)
        $threeMonthsAgo = date('Y-m-d', strtotime('-3 months'));
        $attendanceQuery = "
            SELECT id, tarih, durum, zaman, ders_tipi, yontem
            FROM devamsizlik_kayitlari
            WHERE ogrenci_id = ? AND tarih >= ?
            ORDER BY tarih DESC, zaman DESC
        ";
        $stmt = $conn->prepare($attendanceQuery);
        $stmt->execute([$studentId, $threeMonthsAgo]);
        $attendanceRecords = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        // 3. Ödemeler (son 6 ay)
        $sixMonthsAgo = date('Y-m-d', strtotime('-6 months'));
        $paymentsQuery = "
            SELECT id, tutar, odeme_tarihi, aciklama, ay, yil
            FROM ogrenci_odemeler
            WHERE ogrenci_id = ? AND odeme_tarihi >= ?
            ORDER BY odeme_tarihi DESC
        ";
        $stmt = $conn->prepare($paymentsQuery);
        $stmt->execute([$studentId, $sixMonthsAgo]);
        $payments = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        // 4. İstatistikleri hesapla
        $ucretPerLesson = floatval($student['ucret'] ?? 0);
        
        // Katıldığı dersleri say (sadece normal ders ve ek ders)
        $presentCount = 0;
        $absentCount = 0;
        $totalRecords = count($attendanceRecords);
        
        foreach ($attendanceRecords as $record) {
            if ($record['durum'] === 'present') {
                // Sadece normal ders ve ek ders sayılsın
                if (!$record['ders_tipi'] || $record['ders_tipi'] === 'normal' || $record['ders_tipi'] === 'ek_ders') {
                    $presentCount++;
                }
            } elseif ($record['durum'] === 'absent') {
                $absentCount++;
            }
        }
        
        $totalLessons = $presentCount + $absentCount;
        $attendancePercentage = $totalLessons > 0 ? round(($presentCount / $totalLessons) * 100) : 0;
        
        // Ödeme hesaplamaları
        $expectedPaymentCycles = floor($presentCount / 4);
        $expectedTotalAmount = $expectedPaymentCycles * $ucretPerLesson;
        $lessonsUntilNextPayment = $presentCount > 0 ? 4 - ($presentCount % 4) : 4;
        
        // Toplam ödenen tutar
        $totalPaid = 0;
        foreach ($payments as $payment) {
            $totalPaid += floatval($payment['tutar']);
        }
        
        $debt = $expectedTotalAmount - $totalPaid;
        
        // Tarihe göre gruplanmış devamsızlık kayıtları
        $groupedAttendance = [];
        foreach ($attendanceRecords as $record) {
            $date = $record['tarih'];
            if (!isset($groupedAttendance[$date])) {
                $groupedAttendance[$date] = [];
            }
            $groupedAttendance[$date][] = $record;
        }
        
        // Grupları tarihe göre sırala
        ksort($groupedAttendance);
        $groupedAttendance = array_reverse($groupedAttendance, true);
        
        // Response datası
        $responseData = [
            'student_info' => $student,
            'attendance_records' => $attendanceRecords,
            'payments' => $payments,
            'grouped_attendance' => $groupedAttendance,
            'statistics' => [
                'present_count' => $presentCount,
                'absent_count' => $absentCount,
                'total_lessons' => $totalLessons,
                'attendance_percentage' => $attendancePercentage,
                'expected_payment_cycles' => $expectedPaymentCycles,
                'expected_total_amount' => $expectedTotalAmount,
                'total_paid' => $totalPaid,
                'debt' => $debt,
                'lessons_until_next_payment' => $lessonsUntilNextPayment,
                'ucret_per_lesson' => $ucretPerLesson,
                'payment_count' => count($payments)
            ]
        ];
        
        successResponse($responseData);
        
    } catch (Exception $e) {
        errorResponse('Veri getirme hatası: ' . $e->getMessage(), 500);
    }
}

errorResponse('Desteklenmeyen HTTP metodu', 405);
?>
