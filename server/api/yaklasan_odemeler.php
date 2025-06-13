
<?php
// Türkiye saat dilimini ayarla
date_default_timezone_set('Europe/Istanbul');

// Hataları dosyaya logla
ini_set('display_errors', 0);
ini_set('display_startup_errors', 0);
error_reporting(E_ALL);
ini_set('log_errors', 0);
ini_set('error_log', '../../php_errors.log');

// CORS başlıkları
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Content-Type: application/json; charset=UTF-8");

// OPTIONS isteğini yönet (preflight)
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require '../config.php';

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    try {
        // Kullanıcıyı doğrula
        $user = authorize();
        
        // Sadece öğretmenler kendi öğrencilerinin ödemelerini görebilir
        if ($user['rutbe'] !== 'ogretmen') {
            errorResponse('Bu işlem için yetkiniz yok. Sadece öğretmenler ödeme bilgilerini görebilir.', 403);
        }
        
        $conn = getConnection();
        $teacherName = $user['adi_soyadi'];
        
        // Bu ayın tarihleri
        $currentYear = date('Y');
        $currentMonth = date('m');
        $currentDate = date('Y-m-d');
        
        // 4 ders yapan öğrencileri bul (devamsızlık kayıtlarından)
        $studentsWithLessonsQuery = "
            SELECT 
                o.id,
                o.adi_soyadi,
                o.email,
                ob.ucret,
                ob.grubu,
                COUNT(dk.id) as ders_sayisi,
                MAX(dk.tarih) as son_ders_tarihi
            FROM ogrenciler o
            LEFT JOIN ogrenci_bilgileri ob ON o.id = ob.ogrenci_id
            LEFT JOIN devamsizlik_kayitlari dk ON o.id = dk.ogrenci_id 
                AND dk.durum = 'present' 
                AND MONTH(dk.tarih) = ? 
                AND YEAR(dk.tarih) = ?
            WHERE o.ogretmeni = ? 
                AND o.rutbe = 'ogrenci' 
                AND o.aktif = 1
                AND ob.ucret > 0
            GROUP BY o.id, o.adi_soyadi, o.email, ob.ucret, ob.grubu
            HAVING ders_sayisi >= 4
        ";
        
        $stmt = $conn->prepare($studentsWithLessonsQuery);
        $stmt->execute([$currentMonth, $currentYear, $teacherName]);
        $studentsWithLessons = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        // Bu öğrencilerin bu ay ödeme yapıp yapmadığını kontrol et
        $upcomingPayments = [];
        
        foreach ($studentsWithLessons as $student) {
            // Bu öğrencinin bu ay ödemesi var mı kontrol et
            $paymentCheckQuery = "
                SELECT COUNT(*) as payment_count
                FROM ogrenci_odemeler op
                WHERE op.ogrenci_id = ? 
                    AND op.ay = ? 
                    AND op.yil = ?
            ";
            
            $paymentStmt = $conn->prepare($paymentCheckQuery);
            $paymentStmt->execute([$student['id'], $currentMonth, $currentYear]);
            $paymentResult = $paymentStmt->fetch(PDO::FETCH_ASSOC);
            
            // Eğer bu ay ödeme yapmamışsa, listeye ekle
            if ($paymentResult['payment_count'] == 0) {
                // Son ödeme tarihini hesapla (ayın sonuna kadar)
                $lastDayOfMonth = date('Y-m-t');
                
                $upcomingPayments[] = [
                    'id' => (int)$student['id'],
                    'adi_soyadi' => $student['adi_soyadi'],
                    'email' => $student['email'],
                    'ucret' => $student['ucret'],
                    'grubu' => $student['grubu'] ?: 'Grup Atanmamış',
                    'ders_sayisi' => (int)$student['ders_sayisi'],
                    'son_odeme_tarihi' => $lastDayOfMonth,
                    'son_ders_tarihi' => $student['son_ders_tarihi']
                ];
            }
        }
        
        // Ders sayısına göre sırala (en çok ders yapandan en aza)
        usort($upcomingPayments, function($a, $b) {
            return $b['ders_sayisi'] - $a['ders_sayisi'];
        });
        
        successResponse($upcomingPayments, 'Yaklaşan ödemeler başarıyla getirildi');
        
    } catch (PDOException $e) {
        error_log("Veritabanı hatası: " . $e->getMessage());
        errorResponse('Yaklaşan ödemeler getirilemedi: ' . $e->getMessage(), 500);
    } catch (Exception $e) {
        error_log("Genel hata: " . $e->getMessage());
        errorResponse('İşlem sırasında hata: ' . $e->getMessage(), 500);
    }
} else {
    errorResponse('Sadece GET istekleri kabul edilir', 405);
}
?>
