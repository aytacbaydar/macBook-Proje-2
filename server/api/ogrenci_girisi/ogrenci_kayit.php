
<?php
// Hataları dosyaya logla
ini_set('display_errors', 0);
ini_set('display_startup_errors', 0);
error_reporting(E_ALL);
ini_set('log_errors', 0);
ini_set('error_log', '../../php_errors.log');

// CORS başlıkları
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Content-Type: application/json; charset=UTF-8");

// OPTIONS isteğini yönet (preflight)
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require '../config.php';

$response = [];

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // FormData verileri alınıyor
    if(isset($_POST['adi_soyadi']) || isset($_FILES['avatar'])) {
        // FormData ile gönderilmiş
        $adi_soyadi = $_POST['adi_soyadi'];
        $cep_telefonu = isset($_POST['cep_telefonu']) ? $_POST['cep_telefonu'] : '';
        $email = $_POST['email'];
        $sifre = $_POST['sifre'];
        $rutbe = isset($_POST['rutbe']) ? $_POST['rutbe'] : 'yeni';
        $aktif = isset($_POST['aktif']) && ($_POST['aktif'] === 'true' || $_POST['aktif'] === true) ? 1 : 0;
    } else {
        // JSON verileri kontrolü - eğer FormData değilse
        $input = file_get_contents("php://input");
        if (!empty($input)) {
            $data = json_decode($input, true);
            if (json_last_error() === JSON_ERROR_NONE) {
                $adi_soyadi = $data['adi_soyadi'];
                $cep_telefonu = isset($data['cep_telefonu']) ? $data['cep_telefonu'] : '';
                $email = $data['email'];
                $sifre = $data['sifre']; 
                $rutbe = isset($data['rutbe']) ? $data['rutbe'] : 'yeni';
                $aktif = isset($data['aktif']) && $data['aktif'] === true ? 1 : 0;
            } else {
                errorResponse('Geçersiz JSON verisi - Lütfen FormData formatında gönderin.');
            }
        } else {
            errorResponse('Boş istek gönderildi - Veri bulunamadı!');
        }
    }
    
    // Şifre MD5 ve orijinal şifre
    $sifremd5 = md5($sifre); 
    $gercek_sifre = $sifre;
    
    $avatar = '';

    // Resmi yeniden boyutlandırma fonksiyonu
    function resizeImage($sourcePath, $destinationPath, $maxWidth, $maxHeight) {
        list($width, $height, $type) = getimagesize($sourcePath);
        $ratio = $width / $height;

        if ($width > $maxWidth || $height > $maxHeight) {
            if ($maxWidth / $maxHeight > $ratio) {
                $maxWidth = $maxHeight * $ratio;
            } else {
                $maxHeight = $maxWidth / $ratio;
            }
        } else {
            // Uygun boyuttaysa küçültme yapmadan dosyayı kopyala
            copy($sourcePath, $destinationPath);
            return;
        }

        $srcImage = imagecreatefromstring(file_get_contents($sourcePath));
        $dstImage = imagecreatetruecolor($maxWidth, $maxHeight);

        imagecopyresampled($dstImage, $srcImage, 0, 0, 0, 0, $maxWidth, $maxHeight, $width, $height);

        // JPEG olarak kaydet
        imagejpeg($dstImage, $destinationPath, 90);

        imagedestroy($srcImage);
        imagedestroy($dstImage);
    }

    // Form doğrulama
    if (empty($adi_soyadi)) {
        errorResponse('İsim alanı boş bırakılamaz');
    }

    if (empty($email) || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        errorResponse('Geçerli bir email adresi girin');
    }

    if (empty($sifre) || strlen($sifre) < 6) {
        errorResponse('Şifre en az 6 karakter olmalıdır');
    }

    $conn = getConnection();
    
    // Email benzersizliğini kontrol et
    $stmt = $conn->prepare("SELECT COUNT(*) as count FROM ogrenciler WHERE email = :email");
    $stmt->bindParam(':email', $email);
    $stmt->execute();
    $email_result = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if ($email_result['count'] > 0) {
        errorResponse('Bu email adresi ile kayıtlı bir kullanıcı zaten mevcut');
    }

    // Avatar dosyasını yükle
    if (isset($_FILES['avatar']) && $_FILES['avatar']['error'] === UPLOAD_ERR_OK) {
        try {
            $target_dir = "../../avatar/";
            $target_avatar = "avatar/";

            // Dosya yükleme hata kodunu kontrol et
            if ($_FILES['avatar']['error'] !== UPLOAD_ERR_OK) {
                $errorCodes = [
                    1 => 'Dosya PHP ini dosyasında belirtilen maksimum boyutu aşıyor',
                    2 => 'Dosya HTML formunda belirtilen maksimum boyutu aşıyor',
                    3 => 'Dosya kısmen yüklendi',
                    4 => 'Dosya yüklenmedi',
                    6 => 'Geçici klasör eksik',
                    7 => 'Dosya diske yazılamadı',
                    8 => 'Dosya yükleme PHP uzantısı tarafından durduruldu',
                ];
                $errorMsg = isset($errorCodes[$_FILES['avatar']['error']]) 
                    ? $errorCodes[$_FILES['avatar']['error']] 
                    : 'Bilinmeyen yükleme hatası';
                errorResponse('Avatar yüklenirken hata: ' . $errorMsg);
            }

            // Eğer klasör yoksa oluştur
            if (!is_dir($target_dir)) {
                if (!mkdir($target_dir, 0777, true)) {
                    error_log("Klasör oluşturulamadı: $target_dir");
                    errorResponse('Avatar klasörü oluşturulamadı! Lütfen dosya izinlerini kontrol edin.');
                }
            }

            // Dosya adı güvenli hale getir (özel karakterleri ve boşlukları temizle)
            $safe_name = preg_replace('/[^a-zA-Z0-9_.-]/', '_', basename($_FILES["avatar"]["name"]));
            $safe_adi_soyadi = preg_replace('/[^a-zA-Z0-9_.-]/', '_', $adi_soyadi);
            
            $target_file = $target_dir . $safe_name;
            $resized_file = $target_dir . $safe_adi_soyadi . "_" . $safe_name;
            $avatar_adi = $target_avatar . $safe_adi_soyadi . "_" . $safe_name;

            // Dosya yükleme işlemi
            if (move_uploaded_file($_FILES["avatar"]["tmp_name"], $target_file)) {
                // Yüklenen dosyayı küçült
                resizeImage($target_file, $resized_file, 150, 150);
                
                if (file_exists($target_file)) {
                    unlink($target_file); // Orijinal dosyayı sil
                }
                
                $avatar = $avatar_adi; // Küçültülen dosya yolunu al
            } else {
                error_log("Dosya taşıma hatası: " . $_FILES['avatar']['tmp_name'] . " -> " . $target_file);
                errorResponse('Avatar yüklenemedi! Dosya taşınırken hata oluştu.');
            }
        } catch (Exception $e) {
            error_log("Avatar yükleme hatası: " . $e->getMessage());
            errorResponse('Avatar yükleme işleminde hata: ' . $e->getMessage());
        }
    } else {
        if (!isset($_FILES['avatar'])) {
            errorResponse('Avatar alanı formda bulunamadı');
        } else {
            errorResponse('Profil resmi yüklemek zorunludur (Hata Kodu: ' . $_FILES['avatar']['error'] . ')');
        }
    }

    try {
        $conn->beginTransaction();
        
        // Kullanıcıyı veritabanına kaydet
        $stmt = $conn->prepare("INSERT INTO ogrenciler (adi_soyadi, email, cep_telefonu, sifre, rutbe, aktif, avatar)
                VALUES (:adi_soyadi, :email, :cep_telefonu, :sifre, :rutbe, :aktif, :avatar)");
        
        $stmt->bindParam(':adi_soyadi', $adi_soyadi);
        $stmt->bindParam(':email', $email);
        $stmt->bindParam(':cep_telefonu', $cep_telefonu);
        $stmt->bindParam(':sifre', $sifremd5);
        $stmt->bindParam(':rutbe', $rutbe);
        $stmt->bindParam(':aktif', $aktif);
        $stmt->bindParam(':avatar', $avatar);
        
        if (!$stmt->execute()) {
            $error = $stmt->errorInfo();
            throw new PDOException("SQL Error: " . $error[2]);
        }
        
        $studentId = $conn->lastInsertId();
        if (!$studentId) {
            throw new Exception("Öğrenci ID'si alınamadı");
        }
        
        // Öğrenci bilgilerini oluştur (boş)
        $stmt = $conn->prepare("INSERT INTO ogrenci_bilgileri (ogrenci_id) VALUES (:ogrenci_id)");
        $stmt->bindParam(':ogrenci_id', $studentId);
        
        if (!$stmt->execute()) {
            $error = $stmt->errorInfo();
            throw new PDOException("Öğrenci bilgileri oluşturulurken hata: " . $error[2]);
        }
        
        $conn->commit();
        
        // Token oluştur
        $token = md5($studentId . $email . $sifremd5);
        
        // Başarılı yanıt döndür
        successResponse([
            'id' => $studentId,
            'adi_soyadi' => $adi_soyadi,
            'email' => $email,
            'rutbe' => $rutbe,
            'aktif' => $aktif,
            'avatar' => $avatar,
            'token' => $token
        ], 'Kullanıcı başarıyla kaydedildi!');
        
    } catch (PDOException $e) {
        if ($conn->inTransaction()) {
            $conn->rollBack();
        }
        error_log("Veritabanı hatası: " . $e->getMessage());
        errorResponse('Veritabanı hatası: ' . $e->getMessage(), 500);
    } catch (Exception $e) {
        if ($conn->inTransaction()) {
            $conn->rollBack();
        }
        error_log("Genel hata: " . $e->getMessage());
        errorResponse('İşlem sırasında hata: ' . $e->getMessage(), 500);
    }
} else {
    errorResponse('Sadece POST istekleri kabul edilir', 405);
}
?>
