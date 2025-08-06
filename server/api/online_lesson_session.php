<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Content-Type: application/json; charset=UTF-8");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

require_once '../config.php';

function successResponse($data) {
    echo json_encode(['success' => true] + $data);
    exit;
}

function errorResponse($message, $code = 400) {
    http_response_code($code);
    echo json_encode(['success' => false, 'error' => $message]);
    exit;
}

// Veritabanı bağlantısını config.php'den al
try {
    $pdo = getConnection();
} catch(Exception $e) {
    errorResponse("Veritabanı bağlantı hatası: " . $e->getMessage(), 500);
}

// Tabloları oluştur
try {
    // Online ders oturumları tablosu
    $pdo->exec("CREATE TABLE IF NOT EXISTS online_lesson_sessions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        teacher_id INT NOT NULL,
        teacher_name VARCHAR(255) NOT NULL,
        group_name VARCHAR(100) NOT NULL,
        lesson_title VARCHAR(255) NOT NULL,
        lesson_subject VARCHAR(255),
        canvas_data LONGTEXT,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_teacher_group (teacher_id, group_name),
        INDEX idx_active (is_active)
    )");

    // Online öğrenci katılımları tablosu
    $pdo->exec("CREATE TABLE IF NOT EXISTS online_student_sessions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        session_id INT NOT NULL,
        student_id INT NOT NULL,
        student_name VARCHAR(255) NOT NULL,
        join_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        is_online BOOLEAN DEFAULT TRUE,
        FOREIGN KEY (session_id) REFERENCES online_lesson_sessions(id) ON DELETE CASCADE,
        INDEX idx_session_student (session_id, student_id),
        INDEX idx_online (is_online)
    )");

    // Online ders mesajları tablosu
    $pdo->exec("CREATE TABLE IF NOT EXISTS online_lesson_messages (
        id INT AUTO_INCREMENT PRIMARY KEY,
        session_id INT NOT NULL,
        sender_id INT NOT NULL,
        sender_name VARCHAR(255) NOT NULL,
        sender_type ENUM('teacher', 'student') NOT NULL,
        message TEXT NOT NULL,
        is_read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (session_id) REFERENCES online_lesson_sessions(id) ON DELETE CASCADE,
        INDEX idx_session_time (session_id, created_at)
    )");

} catch(PDOException $e) {
    errorResponse("Tablo oluşturma hatası: " . $e->getMessage(), 500);
}

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);

    if (!$input || !isset($input['action'])) {
        errorResponse('Geçersiz istek');
    }

    $action = $input['action'];

    switch ($action) {
        case 'create_session':
            // Yeni ders oturumu oluştur
            if (!isset($input['teacher_id'], $input['teacher_name'], $input['group'], $input['lesson_title'])) {
                errorResponse('Eksik bilgiler');
            }

            try {
                // Mevcut aktif oturumu kapat
                $stmt = $pdo->prepare("UPDATE online_lesson_sessions SET is_active = FALSE WHERE teacher_id = ? AND group_name = ? AND is_active = TRUE");
                $stmt->execute([$input['teacher_id'], $input['group']]);

                // Yeni oturum oluştur
                $stmt = $pdo->prepare("INSERT INTO online_lesson_sessions (teacher_id, teacher_name, group_name, lesson_title, lesson_subject, canvas_data) VALUES (?, ?, ?, ?, ?, ?)");
                $stmt->execute([
                    $input['teacher_id'],
                    $input['teacher_name'],
                    $input['group'],
                    $input['lesson_title'],
                    $input['lesson_subject'] ?? '',
                    $input['canvas_data'] ?? null
                ]);

                $sessionId = $pdo->lastInsertId();
                successResponse(['session_id' => $sessionId, 'message' => 'Ders oturumu oluşturuldu']);

            } catch(PDOException $e) {
                errorResponse("Oturum oluşturma hatası: " . $e->getMessage(), 500);
            }
            break;

        case 'end_session':
            // Ders oturumunu sonlandır
            if (!isset($input['teacher_id'], $input['group'])) {
                errorResponse('Eksik bilgiler');
            }

            try {
                $stmt = $pdo->prepare("UPDATE online_lesson_sessions SET is_active = FALSE WHERE teacher_id = ? AND group_name = ? AND is_active = TRUE");
                $stmt->execute([$input['teacher_id'], $input['group']]);

                // Öğrenci oturumlarını da kapat
                $stmt = $pdo->prepare("UPDATE online_student_sessions ss 
                    JOIN online_lesson_sessions ls ON ss.session_id = ls.id 
                    SET ss.is_online = FALSE 
                    WHERE ls.teacher_id = ? AND ls.group_name = ?");
                $stmt->execute([$input['teacher_id'], $input['group']]);

                successResponse(['message' => 'Ders oturumu sonlandırıldı']);

            } catch(PDOException $e) {
                errorResponse("Oturum sonlandırma hatası: " . $e->getMessage(), 500);
            }
            break;

        case 'teacher_heartbeat':
            // Öğretmen heartbeat ve canvas güncelleme
            if (!isset($input['teacher_id'], $input['group'])) {
                errorResponse('Eksik bilgiler');
            }

            try {
                $stmt = $pdo->prepare("UPDATE online_lesson_sessions SET canvas_data = ?, updated_at = NOW() WHERE teacher_id = ? AND group_name = ? AND is_active = TRUE");
                $stmt->execute([
                    $input['canvas_data'] ?? null,
                    $input['teacher_id'],
                    $input['group']
                ]);

                successResponse(['message' => 'Heartbeat güncellendi']);

            } catch(PDOException $e) {
                errorResponse("Heartbeat hatası: " . $e->getMessage(), 500);
            }
            break;

        case 'update_canvas':
            // Canvas verilerini güncelle
            if (!isset($input['teacher_id'], $input['group'], $input['canvas_data'])) {
                errorResponse('Eksik bilgiler');
            }

            try {
                $stmt = $pdo->prepare("UPDATE online_lesson_sessions SET canvas_data = ?, updated_at = NOW() WHERE teacher_id = ? AND group_name = ? AND is_active = TRUE");
                $stmt->execute([
                    $input['canvas_data'],
                    $input['teacher_id'],
                    $input['group']
                ]);

                successResponse(['message' => 'Canvas güncellendi']);

            } catch(PDOException $e) {
                errorResponse("Canvas güncelleme hatası: " . $e->getMessage(), 500);
            }
            break;

        case 'student_join':
            // Öğrenci katılımı
            if (!isset($input['student_id'], $input['student_name'], $input['group'])) {
                errorResponse('Eksik bilgiler');
            }

            try {
                // Aktif oturumu bul
                $stmt = $pdo->prepare("SELECT id FROM online_lesson_sessions WHERE group_name = ? AND is_active = TRUE ORDER BY created_at DESC LIMIT 1");
                $stmt->execute([$input['group']]);
                $session = $stmt->fetch();

                if (!$session) {
                    errorResponse('Aktif ders oturumu bulunamadı');
                }

                // Mevcut katılımı kontrol et
                $stmt = $pdo->prepare("SELECT id FROM online_student_sessions WHERE session_id = ? AND student_id = ?");
                $stmt->execute([$session['id'], $input['student_id']]);
                $existingEntry = $stmt->fetch();

                if ($existingEntry) {
                    // Mevcut kaydı güncelle
                    $stmt = $pdo->prepare("UPDATE online_student_sessions SET last_seen = NOW(), is_online = TRUE WHERE session_id = ? AND student_id = ?");
                    $stmt->execute([$session['id'], $input['student_id']]);
                } else {
                    // Yeni kayıt oluştur
                    $stmt = $pdo->prepare("INSERT INTO online_student_sessions (session_id, student_id, student_name, is_online) VALUES (?, ?, ?, TRUE)");
                    $stmt->execute([
                        $session['id'],
                        $input['student_id'],
                        $input['student_name']
                    ]);
                }

                successResponse(['message' => 'Öğrenci katıldı', 'session_id' => $session['id']]);

            } catch(PDOException $e) {
                errorResponse("Öğrenci katılım hatası: " . $e->getMessage(), 500);
            }
            break;

        case 'student_heartbeat':
            // Öğrenci heartbeat
            if (!isset($input['student_id'], $input['group'])) {
                errorResponse('Eksik bilgiler');
            }

            try {
                $stmt = $pdo->prepare("UPDATE online_student_sessions ss 
                    JOIN online_lesson_sessions ls ON ss.session_id = ls.id 
                    SET ss.last_seen = NOW(), ss.is_online = TRUE 
                    WHERE ss.student_id = ? AND ls.group_name = ? AND ls.is_active = TRUE");
                $stmt->execute([$input['student_id'], $input['group']]);

                successResponse(['message' => 'Öğrenci heartbeat güncellendi']);

            } catch(PDOException $e) {
                errorResponse("Öğrenci heartbeat hatası: " . $e->getMessage(), 500);
            }
            break;

        case 'student_leave':
            // Öğrenci dersten ayrılma
            if (!isset($input['student_id'], $input['group'])) {
                errorResponse('Eksik bilgiler');
            }

            try {
                $stmt = $pdo->prepare("UPDATE online_student_sessions ss 
                    JOIN online_lesson_sessions ls ON ss.session_id = ls.id 
                    SET ss.is_online = FALSE 
                    WHERE ss.student_id = ? AND ls.group_name = ? AND ls.is_active = TRUE");
                $stmt->execute([$input['student_id'], $input['group']]);

                successResponse(['message' => 'Öğrenci dersten ayrıldı']);

            } catch(PDOException $e) {
                errorResponse("Öğrenci ayrılma hatası: " . $e->getMessage(), 500);
            }
            break;

        case 'send_message':
            // Mesaj gönder
            if (!isset($input['group'], $input['message'], $input['sender_type'])) {
                errorResponse('Eksik bilgiler');
            }

            try {
                // Aktif oturumu bul
                $stmt = $pdo->prepare("SELECT id FROM online_lesson_sessions WHERE group_name = ? AND is_active = TRUE ORDER BY created_at DESC LIMIT 1");
                $stmt->execute([$input['group']]);
                $session = $stmt->fetch();

                if (!$session) {
                    errorResponse('Aktif ders oturumu bulunamadı');
                }

                // Gönderen bilgilerini belirle
                $senderId = $input['sender_type'] === 'teacher' ? $input['teacher_id'] : $input['student_id'];
                $senderName = $input['sender_type'] === 'teacher' ? $input['teacher_name'] : $input['student_name'];

                // Mesajı kaydet
                $stmt = $pdo->prepare("INSERT INTO online_lesson_messages (session_id, sender_id, sender_name, sender_type, message) VALUES (?, ?, ?, ?, ?)");
                $stmt->execute([
                    $session['id'],
                    $senderId,
                    $senderName,
                    $input['sender_type'],
                    $input['message']
                ]);

                successResponse(['message' => 'Mesaj gönderildi']);

            } catch(PDOException $e) {
                errorResponse("Mesaj gönderme hatası: " . $e->getMessage(), 500);
            }
            break;

        default:
            errorResponse('Geçersiz işlem');
    }

} else if ($method === 'GET') {
    $action = $_GET['action'] ?? '';

    switch ($action) {
        case 'get_students':
            // Online öğrencileri getir
            if (!isset($_GET['group'])) {
                errorResponse('Grup parametresi gerekli');
            }

            try {
                $stmt = $pdo->prepare("SELECT id FROM online_lesson_sessions WHERE group_name = ? AND is_active = TRUE ORDER BY created_at DESC LIMIT 1");
                $stmt->execute([$_GET['group']]);
                $session = $stmt->fetch();

                if (!$session) {
                    successResponse(['students' => []]);
                }

                $stmt = $pdo->prepare("SELECT student_id as id, student_name as name, join_time, last_seen FROM online_student_sessions WHERE session_id = ? AND is_online = TRUE");
                $stmt->execute([$session['id']]);
                $students = $stmt->fetchAll(PDO::FETCH_ASSOC);

                successResponse(['students' => $students]);

            } catch(PDOException $e) {
                errorResponse("Öğrenci listesi getirme hatası: " . $e->getMessage(), 500);
            }
            break;

        case 'get_messages':
            // Grup mesajlarını getir
            if (!isset($_GET['group'])) {
                errorResponse('Grup bilgisi gerekli');
            }

            try {
                $stmt = $pdo->prepare("
                    SELECT m.id, m.sender_id, m.sender_name, m.sender_type, m.message, m.created_at as timestamp 
                    FROM online_lesson_messages m
                    JOIN online_lesson_sessions ls ON m.session_id = ls.id
                    WHERE ls.group_name = ? AND ls.is_active = TRUE
                    ORDER BY m.created_at ASC
                ");
                $stmt->execute([$_GET['group']]);
                $messages = $stmt->fetchAll(PDO::FETCH_ASSOC);

                successResponse(['messages' => $messages]);

            } catch(PDOException $e) {
                errorResponse("Mesaj yükleme hatası: " . $e->getMessage(), 500);
            }
            break;

        case 'get_session':
            // Aktif oturum bilgilerini getir
            if (!isset($_GET['group'])) {
                errorResponse('Grup belirtilmedi');
            }

            try {
                $stmt = $pdo->prepare("SELECT * FROM online_lesson_sessions WHERE group_name = ? AND is_active = TRUE ORDER BY created_at DESC LIMIT 1");
                $stmt->execute([$_GET['group']]);
                $session = $stmt->fetch(PDO::FETCH_ASSOC);

                if (!$session) {
                    errorResponse('Aktif ders oturumu bulunamadı');
                }

                successResponse(['session' => $session]);

            } catch(PDOException $e) {
                errorResponse("Oturum bilgisi hatası: " . $e->getMessage(), 500);
            }
            break;

        case 'get_available_lessons':
            // Mevcut aktif dersleri getir
            try {
                $stmt = $pdo->prepare("SELECT id, teacher_name, group_name, lesson_title, lesson_subject, created_at FROM online_lesson_sessions WHERE is_active = TRUE ORDER BY created_at DESC");
                $stmt->execute();
                $lessons = $stmt->fetchAll(PDO::FETCH_ASSOC);

                // Debug için log ekle
                error_log("📚 API: Aktif ders sayısı: " . count($lessons));
                foreach($lessons as $lesson) {
                    error_log("🎯 API: Ders - ID: {$lesson['id']}, Grup: '{$lesson['group_name']}', Başlık: '{$lesson['lesson_title']}'");
                }

                successResponse(['lessons' => $lessons]);

            } catch(PDOException $e) {
                errorResponse("Ders listesi getirme hatası: " . $e->getMessage(), 500);
            }
            break;

        case 'get_canvas':
            // Canvas verisini getir
            if (!isset($_GET['group'])) {
                errorResponse('Grup parametresi gerekli');
            }

            try {
                $stmt = $pdo->prepare("SELECT canvas_data, teacher_name, updated_at FROM online_lesson_sessions WHERE group_name = ? AND is_active = TRUE ORDER BY updated_at DESC LIMIT 1");
                $stmt->execute([$_GET['group']]);
                $session = $stmt->fetch();

                if (!$session) {
                    // Aktif ders yok, boş canvas döndür
                    successResponse([
                        'canvas_data' => null,
                        'message' => 'Aktif ders bulunamadı'
                    ]);
                } else {
                    // Canvas verisini döndür
                    successResponse([
                        'canvas_data' => $session['canvas_data'],
                        'teacher_name' => $session['teacher_name'],
                        'last_updated' => $session['updated_at']
                    ]);
                }

            } catch(PDOException $e) {
                errorResponse("Canvas getirme hatası: " . $e->getMessage(), 500);
            }
            break;

        default:
            errorResponse('Geçersiz işlem');
    }

} else {
    errorResponse('Desteklenmeyen HTTP metodu', 405);
}
?>