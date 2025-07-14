<?php
// Error handling için output buffering başlat
ob_start();

// Hata raporlamasını kapat
error_reporting(0);
ini_set('display_errors', 0);

require_once '../config.php';

// CORS headers
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Content-Type: application/json; charset=UTF-8");

// Output buffer'ı temizle
ob_clean();

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    try {
        $user = authorize();

        if ($user['rutbe'] !== 'ogretmen') {
            errorResponse('Bu işlem için yetkiniz yok.', 403);
        }

        $conn = getConnection();
        $teacherName = $user['adi_soyadi'];

        $grup = $_GET['grup'] ?? '';
        $ogrenci_id = $_GET['ogrenci_id'] ?? '';

        if (empty($grup) || empty($ogrenci_id)) {
            errorResponse('Grup ve öğrenci ID gerekli.', 400);
        }

        // Öğrenci bilgilerini al
        $studentQuery = "
            SELECT o.id, o.adi_soyadi, o.email, ob.ucret, ob.grubu
            FROM ogrenciler o
            LEFT JOIN ogrenci_bilgileri ob ON o.id = ob.ogrenci_id
            WHERE o.id = ? AND o.ogretmeni = ? AND o.rutbe = 'ogrenci'
        ";
        $stmt = $conn->prepare($studentQuery);
        $stmt->execute([$ogrenci_id, $teacherName]);
        $student = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$student) {
            errorResponse('Öğrenci bulunamadı.', 404);
        }

        // Bu öğrencinin devamsızlık kayıtlarını al - hem normal hem ek dersleri
        $attendanceQuery = "
            SELECT tarih, durum, zaman, ders_tipi
            FROM devamsizlik_kayitlari
            WHERE ogrenci_id = ?
            ORDER BY tarih DESC, zaman DESC
        ";
        $stmt = $conn->prepare($attendanceQuery);
        $stmt->execute([$ogrenci_id]);
        $attendanceRecords = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Katıldığı ve katılmadığı ders sayılarını hesapla
        $presentCount = 0;
        $absentCount = 0;

        foreach ($attendanceRecords as $record) {
            if ($record['durum'] === 'present') {
                $presentCount++;
            } elseif ($record['durum'] === 'absent') {
                $absentCount++;
            }
        }

        $totalLessons = $presentCount + $absentCount;

        // Ödeme durumunu hesapla
        $ucretPerLesson = floatval($student['ucret'] ?? 0);

        // Her 4 derste bir ödeme yapılması gerekiyor
        $expectedPaymentCycles = floor($presentCount / 4);
        $expectedTotalAmount = $expectedPaymentCycles * $ucretPerLesson;

        // Bir sonraki ödeme için kaç ders kaldığını hesapla
        $lessonsUntilNextPayment = 4 - ($presentCount % 4);
        if ($lessonsUntilNextPayment === 4 && $presentCount > 0) {
            $lessonsUntilNextPayment = 0; // Tam 4'ün katı ise bir sonraki döngü için
        }

        // Bu öğrencinin ödemelerini al
        $paymentsQuery = "
            SELECT SUM(tutar) as toplam_odeme, COUNT(*) as odeme_sayisi
            FROM ogrenci_odemeler
            WHERE ogrenci_id = ?
        ";
        $stmt = $conn->prepare($paymentsQuery);
        $stmt->execute([$ogrenci_id]);
        $paymentData = $stmt->fetch(PDO::FETCH_ASSOC);

        $totalPaid = floatval($paymentData['toplam_odeme'] ?? 0);
        $paymentCount = intval($paymentData['odeme_sayisi'] ?? 0);

        // Borç hesaplama
        $debt = max(0, $expectedTotalAmount - $totalPaid);

        // Katılım yüzdesi
        $attendancePercentage = $totalLessons > 0 ? round(($presentCount / $totalLessons) * 100, 1) : 0;

        // Son devamsızlık kayıtlarını al (son 10 ders) - hem normal hem ek dersleri
        $recentAttendanceQuery = "
            SELECT durum, tarih, zaman, ders_tipi
            FROM devamsizlik_kayitlari
            WHERE ogrenci_id = ? AND grup = ?
            ORDER BY tarih DESC
            LIMIT 10
        ";
        $stmt = $conn->prepare($recentAttendanceQuery);
        $stmt->execute([$ogrenci_id, $grup]);
        $recentAttendance = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $statistics = [
            'student_info' => [
                'id' => $student['id'],
                'name' => $student['adi_soyadi'],
                'email' => $student['email'],
                'ucret' => $ucretPerLesson,
                'grup' => $student['grubu']
            ],
            'attendance_stats' => [
                'present_count' => $presentCount,
                'absent_count' => $absentCount,
                'total_lessons' => $totalLessons,
                'attendance_percentage' => $attendancePercentage
            ],
            'payment_stats' => [
                'expected_payment_cycles' => $expectedPaymentCycles,
                'expected_total_amount' => $expectedTotalAmount,
                'total_paid' => $totalPaid,
                'payment_count' => $paymentCount,
                'debt' => $debt,
                'lessons_until_next_payment' => $lessonsUntilNextPayment,
                'ucret_per_cycle' => $ucretPerLesson
            ],
            'recent_attendance' => $recentAttendance
        ];

        successResponse($statistics, 'Öğrenci istatistikleri başarıyla getirildi');

    } catch (Exception $e) {
        error_log("Öğrenci istatistik hatası: " . $e->getMessage());
        errorResponse('İstatistik getirme hatası: ' . $e->getMessage(), 500);
    }
} else {
    errorResponse('Sadece GET istekleri kabul edilir', 405);
}

// PHP hatalarını yakalayıp JSON formatında döndür
if (ob_get_length()) {
    ob_clean();
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'PHP execution error occurred',
        'error' => 'Internal server error'
    ]);
}
?>