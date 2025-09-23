
<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once '../config.php';

function errorResponse($message, $code = 400) {
    http_response_code($code);
    echo json_encode(['success' => false, 'message' => $message]);
    exit;
}

function successResponse($data = null, $message = '') {
    echo json_encode([
        'success' => true,
        'message' => $message,
        'data' => $data
    ]);
    exit;
}

try {
    $conn = getConnection();
    $method = $_SERVER['REQUEST_METHOD'];

    if ($method === 'GET') {
        // Öğrenci ID parametresi kontrolü
        if (isset($_GET['ogrenci_id']) && !empty($_GET['ogrenci_id'])) {
            $ogrenciId = (int)$_GET['ogrenci_id'];
            
            // Belirli bir öğrencinin ödemelerini getir
            $query = "
                SELECT 
                    op.id,
                    op.ogrenci_id,
                    op.tutar,
                    op.odeme_tarihi,
                    op.aciklama,
                    op.ay,
                    op.yil,
                    op.created_at,
                    op.updated_at,
                    o.adi_soyadi as ogrenci_adi,
                    o.email as ogrenci_email
                FROM ogrenci_odemeler op
                INNER JOIN ogrenciler o ON op.ogrenci_id = o.id
                WHERE op.ogrenci_id = ?
                ORDER BY op.odeme_tarihi DESC, op.created_at DESC
            ";
            
            $stmt = $conn->prepare($query);
            $stmt->execute([$ogrenciId]);
            $payments = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            // Toplam ödeme hesapla
            $totalPaid = array_sum(array_column($payments, 'tutar'));
            
            successResponse([
                'payments' => $payments,
                'total_paid' => $totalPaid,
                'payment_count' => count($payments)
            ], count($payments) . ' ödeme kaydı bulundu');
            
        } elseif (isset($_GET['ogretmen']) && !empty($_GET['ogretmen'])) {
            // Öğretmenin tüm öğrencilerinin ödemelerini getir
            $teacherName = trim($_GET['ogretmen']);
            $currentMonth = date('n');
            $currentYear = date('Y');
            
            // Bu ayın ödemeleri
            $queryThisMonth = "
                SELECT 
                    op.id,
                    op.ogrenci_id,
                    op.tutar,
                    op.odeme_tarihi,
                    op.aciklama,
                    op.ay,
                    op.yil,
                    op.created_at,
                    o.adi_soyadi as ogrenci_adi,
                    o.email as ogrenci_email
                FROM ogrenci_odemeler op
                INNER JOIN ogrenciler o ON op.ogrenci_id = o.id
                WHERE o.ogretmeni = ? AND op.ay = ? AND op.yil = ?
                ORDER BY op.odeme_tarihi DESC
            ";
            
            $stmt = $conn->prepare($queryThisMonth);
            $stmt->execute([$teacherName, $currentMonth, $currentYear]);
            $thisMonthPayments = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            // Tüm ödemeler
            $queryAllPayments = "
                SELECT 
                    op.id,
                    op.ogrenci_id,
                    op.tutar,
                    op.odeme_tarihi,
                    op.aciklama,
                    op.ay,
                    op.yil,
                    op.created_at,
                    o.adi_soyadi as ogrenci_adi,
                    o.email as ogrenci_email
                FROM ogrenci_odemeler op
                INNER JOIN ogrenciler o ON op.ogrenci_id = o.id
                WHERE o.ogretmeni = ?
                ORDER BY op.odeme_tarihi DESC
            ";
            
            $stmt = $conn->prepare($queryAllPayments);
            $stmt->execute([$teacherName]);
            $allPayments = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            // Bu ay toplam
            $thisMonthTotal = array_sum(array_column($thisMonthPayments, 'tutar'));
            
            // Genel toplam
            $allTimeTotal = array_sum(array_column($allPayments, 'tutar'));
            
            successResponse([
                'current_month_payments' => $thisMonthPayments,
                'all_payments' => $allPayments,
                'this_month_total' => $thisMonthTotal,
                'all_time_total' => $allTimeTotal,
                'current_month' => $currentMonth,
                'current_year' => $currentYear
            ], 'Ödeme verileri başarıyla getirildi');
            
        } else {
            // Tüm ödemeleri getir (sadece admin için)
            $query = "
                SELECT 
                    op.id,
                    op.ogrenci_id,
                    op.tutar,
                    op.odeme_tarihi,
                    op.aciklama,
                    op.ay,
                    op.yil,
                    op.created_at,
                    op.updated_at,
                    o.adi_soyadi as ogrenci_adi,
                    o.email as ogrenci_email,
                    o.ogretmeni as ogretmen_adi
                FROM ogrenci_odemeler op
                INNER JOIN ogrenciler o ON op.ogrenci_id = o.id
                ORDER BY op.odeme_tarihi DESC
                LIMIT 100
            ";
            
            $stmt = $conn->prepare($query);
            $stmt->execute();
            $payments = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            successResponse([
                'payments' => $payments,
                'total_count' => count($payments)
            ], 'Son 100 ödeme kaydı getirildi');
        }
        
    } elseif ($method === 'POST') {
        // Yeni ödeme kaydı ekle
        $data = json_decode(file_get_contents('php://input'), true);
        
        if (!$data || !isset($data['ogrenci_id'], $data['tutar'])) {
            errorResponse('Eksik veri: ogrenci_id ve tutar gerekli', 400);
        }
        
        $ogrenci_id = (int)$data['ogrenci_id'];
        $tutar = (float)$data['tutar'];
        $odeme_tarihi = $data['odeme_tarihi'] ?? date('Y-m-d H:i:s');
        $aciklama = $data['aciklama'] ?? '';
        $ay = (int)($data['ay'] ?? date('n'));
        $yil = (int)($data['yil'] ?? date('Y'));
        
        // Öğrenci var mı kontrol et
        $checkStudent = $conn->prepare("SELECT id, adi_soyadi FROM ogrenciler WHERE id = ? AND aktif = 1");
        $checkStudent->execute([$ogrenci_id]);
        $student = $checkStudent->fetch(PDO::FETCH_ASSOC);
        
        if (!$student) {
            errorResponse('Geçerli bir öğrenci bulunamadı', 404);
        }
        
        // Ödeme kaydını ekle
        $insertQuery = "
            INSERT INTO ogrenci_odemeler 
            (ogrenci_id, tutar, odeme_tarihi, aciklama, ay, yil, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())
        ";
        
        $stmt = $conn->prepare($insertQuery);
        $stmt->execute([$ogrenci_id, $tutar, $odeme_tarihi, $aciklama, $ay, $yil]);
        
        if ($stmt->rowCount()) {
            $paymentId = $conn->lastInsertId();
            successResponse([
                'id' => $paymentId,
                'ogrenci_adi' => $student['adi_soyadi']
            ], 'Ödeme kaydı başarıyla eklendi');
        } else {
            errorResponse('Ödeme kaydı eklenirken hata oluştu', 500);
        }
        
    } elseif ($method === 'PUT') {
        // Ödeme kaydını güncelle
        $data = json_decode(file_get_contents('php://input'), true);
        
        if (!$data || !isset($data['id'])) {
            errorResponse('Güncellenecek ödeme ID\'si gerekli', 400);
        }
        
        $id = (int)$data['id'];
        $tutar = isset($data['tutar']) ? (float)$data['tutar'] : null;
        $odeme_tarihi = $data['odeme_tarihi'] ?? null;
        $aciklama = $data['aciklama'] ?? null;
        $ay = isset($data['ay']) ? (int)$data['ay'] : null;
        $yil = isset($data['yil']) ? (int)$data['yil'] : null;
        
        // Mevcut ödeme kaydını kontrol et
        $checkPayment = $conn->prepare("SELECT id FROM ogrenci_odemeler WHERE id = ?");
        $checkPayment->execute([$id]);
        
        if ($checkPayment->rowCount() === 0) {
            errorResponse('Ödeme kaydı bulunamadı', 404);
        }
        
        // Güncelleme sorgusu oluştur
        $updateFields = [];
        $params = [];
        
        if ($tutar !== null) {
            $updateFields[] = "tutar = ?";
            $params[] = $tutar;
        }
        if ($odeme_tarihi !== null) {
            $updateFields[] = "odeme_tarihi = ?";
            $params[] = $odeme_tarihi;
        }
        if ($aciklama !== null) {
            $updateFields[] = "aciklama = ?";
            $params[] = $aciklama;
        }
        if ($ay !== null) {
            $updateFields[] = "ay = ?";
            $params[] = $ay;
        }
        if ($yil !== null) {
            $updateFields[] = "yil = ?";
            $params[] = $yil;
        }
        
        if (empty($updateFields)) {
            errorResponse('Güncellenecek alan bulunamadı', 400);
        }
        
        $updateFields[] = "updated_at = NOW()";
        $params[] = $id;
        
        $updateQuery = "UPDATE ogrenci_odemeler SET " . implode(", ", $updateFields) . " WHERE id = ?";
        
        $stmt = $conn->prepare($updateQuery);
        $stmt->execute($params);
        
        if ($stmt->rowCount()) {
            successResponse(['id' => $id], 'Ödeme kaydı başarıyla güncellendi');
        } else {
            errorResponse('Ödeme kaydı güncellenirken hata oluştu', 500);
        }
        
    } elseif ($method === 'DELETE') {
        // Ödeme kaydını sil
        if (!isset($_GET['id']) || empty($_GET['id'])) {
            errorResponse('Silinecek ödeme ID\'si gerekli', 400);
        }
        
        $id = (int)$_GET['id'];
        
        // Ödeme kaydını kontrol et
        $checkPayment = $conn->prepare("SELECT id, ogrenci_id, tutar FROM ogrenci_odemeler WHERE id = ?");
        $checkPayment->execute([$id]);
        $payment = $checkPayment->fetch(PDO::FETCH_ASSOC);
        
        if (!$payment) {
            errorResponse('Ödeme kaydı bulunamadı', 404);
        }
        
        // Ödeme kaydını sil
        $deleteQuery = "DELETE FROM ogrenci_odemeler WHERE id = ?";
        $stmt = $conn->prepare($deleteQuery);
        $stmt->execute([$id]);
        
        if ($stmt->rowCount()) {
            successResponse([
                'deleted_id' => $id,
                'deleted_amount' => $payment['tutar']
            ], 'Ödeme kaydı başarıyla silindi');
        } else {
            errorResponse('Ödeme kaydı silinirken hata oluştu', 500);
        }
        
    } else {
        errorResponse('Desteklenmeyen HTTP metodu', 405);
    }

} catch (PDOException $e) {
    error_log("Database error in ogrenci_odemeler.php: " . $e->getMessage());
    errorResponse('Veritabanı hatası: ' . $e->getMessage(), 500);
} catch (Exception $e) {
    error_log("General error in ogrenci_odemeler.php: " . $e->getMessage());
    errorResponse('Bir hata oluştu: ' . $e->getMessage(), 500);
}
?>
