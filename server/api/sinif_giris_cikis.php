
<?php
// QR kod giriş/çıkış API'si
require_once '../config.php';

// CORS başlıkları
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Content-Type: application/json; charset=UTF-8");

// OPTIONS isteğini yönet
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    try {
        // Kullanıcıyı doğrula
        $user = authorize();
        
        // JSON verilerini al
        $data = getJsonData();
        
        // Gerekli alanları kontrol et
        if (!isset($data['student_id']) || !isset($data['action']) || !isset($data['grup'])) {
            errorResponse('student_id, action ve grup alanları zorunludur');
        }
        
        $student_id = $data['student_id'];
        $action = $data['action']; // 'entry' veya 'exit'
        $grup = $data['grup'];
        $tarih = $data['tarih'] ?? date('Y-m-d');
        $zaman = $data['zaman'] ?? date('Y-m-d H:i:s');
        
        $conn = getConnection();
        
        // Tabloyu oluştur (yoksa)
        $createTableSQL = "
            CREATE TABLE IF NOT EXISTS sinif_durumu (
                id INT AUTO_INCREMENT PRIMARY KEY,
                student_id INT NOT NULL,
                grup VARCHAR(100) NOT NULL,
                entry_time DATETIME NULL,
                exit_time DATETIME NULL,
                is_present BOOLEAN DEFAULT FALSE,
                qr_method ENUM('entry', 'exit') NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_student_id (student_id),
                INDEX idx_grup (grup),
                INDEX idx_entry_time (entry_time)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ";
        $conn->exec($createTableSQL);
        
        if ($action === 'entry') {
            // Giriş işlemi
            // Önce bugün bu öğrenci için kayıt var mı kontrol et
            $checkStmt = $conn->prepare("
                SELECT id, is_present FROM sinif_durumu 
                WHERE student_id = :student_id 
                AND grup = :grup 
                AND DATE(entry_time) = :tarih
                ORDER BY entry_time DESC 
                LIMIT 1
            ");
            $checkStmt->bindParam(':student_id', $student_id);
            $checkStmt->bindParam(':grup', $grup);
            $checkStmt->bindParam(':tarih', $tarih);
            $checkStmt->execute();
            
            $existing = $checkStmt->fetch(PDO::FETCH_ASSOC);
            
            if ($existing) {
                if ($existing['is_present']) {
                    errorResponse('Öğrenci zaten sınıfta kayıtlı');
                } else {
                    // Yeniden giriş - mevcut kaydı güncelle
                    $updateStmt = $conn->prepare("
                        UPDATE sinif_durumu 
                        SET entry_time = :zaman, 
                            exit_time = NULL, 
                            is_present = TRUE, 
                            qr_method = 'entry',
                            updated_at = CURRENT_TIMESTAMP
                        WHERE id = :id
                    ");
                    $updateStmt->bindParam(':zaman', $zaman);
                    $updateStmt->bindParam(':id', $existing['id']);
                    $updateStmt->execute();
                }
            } else {
                // Yeni giriş kaydı
                $insertStmt = $conn->prepare("
                    INSERT INTO sinif_durumu (student_id, grup, entry_time, is_present, qr_method) 
                    VALUES (:student_id, :grup, :zaman, TRUE, 'entry')
                ");
                $insertStmt->bindParam(':student_id', $student_id);
                $insertStmt->bindParam(':grup', $grup);
                $insertStmt->bindParam(':zaman', $zaman);
                $insertStmt->execute();
            }
            
            successResponse(['action' => 'entry', 'time' => $zaman], 'Giriş başarıyla kaydedildi');
            
        } elseif ($action === 'exit') {
            // Çıkış işlemi
            // Bugün giriş yapmış mı kontrol et
            $checkStmt = $conn->prepare("
                SELECT id, is_present FROM sinif_durumu 
                WHERE student_id = :student_id 
                AND grup = :grup 
                AND DATE(entry_time) = :tarih
                AND is_present = TRUE
                ORDER BY entry_time DESC 
                LIMIT 1
            ");
            $checkStmt->bindParam(':student_id', $student_id);
            $checkStmt->bindParam(':grup', $grup);
            $checkStmt->bindParam(':tarih', $tarih);
            $checkStmt->execute();
            
            $existing = $checkStmt->fetch(PDO::FETCH_ASSOC);
            
            if (!$existing) {
                errorResponse('Öğrenci bugün giriş yapmamış veya zaten çıkış yapmış');
            }
            
            // Çıkış kaydı güncelle
            $updateStmt = $conn->prepare("
                UPDATE sinif_durumu 
                SET exit_time = :zaman, 
                    is_present = FALSE, 
                    qr_method = 'exit',
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = :id
            ");
            $updateStmt->bindParam(':zaman', $zaman);
            $updateStmt->bindParam(':id', $existing['id']);
            $updateStmt->execute();
            
            successResponse(['action' => 'exit', 'time' => $zaman], 'Çıkış başarıyla kaydedildi');
            
        } else {
            errorResponse('Geçersiz action parametresi. "entry" veya "exit" olmalı');
        }
        
    } catch (PDOException $e) {
        error_log("Veritabanı hatası: " . $e->getMessage());
        errorResponse('İşlem kaydedilemedi: ' . $e->getMessage(), 500);
    } catch (Exception $e) {
        error_log("Genel hata: " . $e->getMessage());
        errorResponse('İşlem sırasında hata: ' . $e->getMessage(), 500);
    }
} else {
    errorResponse('Sadece POST istekleri kabul edilir', 405);
}
?>
