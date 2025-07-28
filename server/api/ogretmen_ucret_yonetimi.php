<?php
require_once '../config.php';

// Token kontrolü ve yetkilendirme fonksiyonu kaldırıldı

try {
    $conn = getConnection();
    $method = $_SERVER['REQUEST_METHOD'];

    if ($method === 'GET') {
        // Öğrenci ID parametresi kontrolü
        if (isset($_GET['ogrenci_id']) && !empty($_GET['ogrenci_id'])) {
            $ogrenciId = (int)$_GET['ogrenci_id'];
            
            // Tek öğrenci için ödemeler
            $paymentsQuery = "
                SELECT op.*, o.adi_soyadi as ogrenci_adi
                FROM ogrenci_odemeler op
                INNER JOIN ogrenciler o ON op.ogrenci_id = o.id
                WHERE op.ogrenci_id = ?
                ORDER BY op.odeme_tarihi DESC
            ";
            $stmt = $conn->prepare($paymentsQuery);
            $stmt->execute([$ogrenciId]);
            $payments = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            // Öğrenci bilgisi
            $studentQuery = "
                SELECT o.id, o.adi_soyadi, o.email, o.cep_telefonu, o.aktif,
                       ob.okulu, ob.sinifi, ob.grubu, ob.ders_gunu, ob.ders_saati, 
                       ob.ucret, ob.veli_adi, ob.veli_cep
                FROM ogrenciler o
                LEFT JOIN ogrenci_bilgileri ob ON o.id = ob.ogrenci_id
                WHERE o.id = ?
            ";
            $stmt = $conn->prepare($studentQuery);
            $stmt->execute([$ogrenciId]);
            $student = $stmt->fetch(PDO::FETCH_ASSOC);
            
            successResponse([
                'student' => $student,
                'payments' => $payments
            ]);
            exit;
        }
        
        // Öğretmen adı parametresi kontrolü (tüm öğrenciler için)
        if (!isset($_GET['ogretmen']) || empty(trim($_GET['ogretmen']))) {
            errorResponse('Öğretmen adı veya öğrenci ID gerekli.', 400);
            exit;
        }
        $teacherName = trim($_GET['ogretmen']);

        $currentYear = date('Y');
        $currentMonth = date('n');

        // Öğrenci bilgileri
        $studentsQuery = "
            SELECT o.id, o.adi_soyadi, o.email, o.cep_telefonu, o.aktif,
                   ob.okulu, ob.sinifi, ob.grubu, ob.ders_gunu, ob.ders_saati, 
                   ob.ucret, ob.veli_adi, ob.veli_cep
            FROM ogrenciler o
            LEFT JOIN ogrenci_bilgileri ob ON o.id = ob.ogrenci_id
            WHERE o.rutbe = 'ogrenci' AND o.ogretmeni = ?
            ORDER BY o.adi_soyadi
        ";
        $stmt = $conn->prepare($studentsQuery);
        $stmt->execute([$teacherName]);
        $students = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Bu ayki ödemeler
        $paymentsQuery = "
            SELECT op.*, o.adi_soyadi as ogrenci_adi
            FROM ogrenci_odemeler op
            INNER JOIN ogrenciler o ON op.ogrenci_id = o.id
            WHERE o.ogretmeni = ? AND op.yil = ? AND op.ay = ?
            ORDER BY op.odeme_tarihi DESC
        ";
        $stmt = $conn->prepare($paymentsQuery);
        $stmt->execute([$teacherName, $currentYear, $currentMonth]);
        $thisMonthPayments = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Yıllık gelir
        $stmt = $conn->prepare("
            SELECT SUM(op.tutar) as toplam_yillik
            FROM ogrenci_odemeler op
            INNER JOIN ogrenciler o ON op.ogrenci_id = o.id
            WHERE o.ogretmeni = ? AND op.yil = ?
        ");
        $stmt->execute([$teacherName, $currentYear]);
        $yearlyTotal = (float) ($stmt->fetchColumn() ?: 0);

        // Ödeme analiz
        $totalExpected = 0;
        $totalReceived = 0;
        $studentsWhoPayThis = [];
        $studentsWhoDidntPay = [];

        $paidStudentIds = array_column($thisMonthPayments, 'ogrenci_id');

        foreach ($students as $student) {
            if ($student['aktif'] && $student['ucret'] > 0) {
                $expected = (float)$student['ucret'];
                $totalExpected += $expected;

                if (in_array($student['id'], $paidStudentIds)) {
                    $studentPayments = array_filter($thisMonthPayments, fn($p) => $p['ogrenci_id'] == $student['id']);
                    $received = array_sum(array_column($studentPayments, 'tutar'));
                    $totalReceived += $received;
                    $studentsWhoPayThis[] = $student;
                } else {
                    $studentsWhoDidntPay[] = $student;
                }
            }
        }

        successResponse([
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
        ]);
    }

    elseif ($method === 'POST') {
        // Öğretmen adı POST verisinde veya headerda gönderilmeli, örnek:
        $data = json_decode(file_get_contents('php://input'), true);
        if (!$data || !isset($data['ogrenci_id'], $data['tutar'], $data['ogretmen'])) {
            errorResponse('Geçersiz veri. Öğrenci ID, tutar ve öğretmen adı gerekli.', 400);
            exit;
        }
        $teacherName = trim($data['ogretmen']);

        $ogrenci_id = (int)$data['ogrenci_id'];
        $tutar = (float)$data['tutar'];
        $aciklama = $data['aciklama'] ?? '';
        $odeme_tarihi = $data['odeme_tarihi'] ?? date('Y-m-d H:i:s');
        $ay = (int)($data['ay'] ?? date('m'));
        $yil = (int)($data['yil'] ?? date('Y'));

        // Yetki kontrolü (öğretmen adına göre)
        $stmt = $conn->prepare("SELECT COUNT(*) FROM ogrenciler WHERE id = ? AND ogretmeni = ?");
        $stmt->execute([$ogrenci_id, $teacherName]);
        if ($stmt->fetchColumn() == 0) {
            errorResponse('Bu öğrenciye ödeme kaydı ekleme yetkiniz yok.', 403);
            exit;
        }

        // Kayıt ekle
        $stmt = $conn->prepare("
            INSERT INTO ogrenci_odemeler 
            (ogrenci_id, tutar, odeme_tarihi, aciklama, ay, yil, created_at)
            VALUES (?, ?, ?, ?, ?, ?, NOW())
        ");
        $stmt->execute([$ogrenci_id, $tutar, $odeme_tarihi, $aciklama, $ay, $yil]);

        if ($stmt->rowCount()) {
            successResponse(['id' => $conn->lastInsertId()], 'Ödeme kaydı başarıyla eklendi.');
        } else {
            errorResponse('Ödeme kaydı eklenirken hata oluştu.', 500);
        }
    }

    else {
        errorResponse('Desteklenmeyen HTTP metodu', 405);
    }

} catch (PDOException $e) {
    error_log("DB error: " . $e->getMessage());
    errorResponse('Veritabanı hatası: ' . $e->getMessage(), 500);
} catch (Exception $e) {
    error_log("General error: " . $e->getMessage());
    errorResponse('Beklenmeyen bir hata oluştu: ' . $e->getMessage(), 500);
}
?>
