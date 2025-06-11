<?php
// Local Arduino Bridge Server
// Bu dosyayı 192.168.0.30 IP'li bilgisayarınızda çalıştırın: php -S 0.0.0.0:8080 arduino_bridge_local.php

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

// Arduino ile haberleşme fonksiyonu
function controlArduinoLocal($action, $classroom, $student_name = 'Manual') {
    error_log("Local Arduino kontrol: $action, $classroom, $student_name");

    // Windows COM port (Arduino IDE'den kontrol edin: Tools > Port)
    $com_port = 'COM5'; // BURAYA GERÇEK PORT NUMARANIZI YAZIN

    try {
        $serial = @fopen($com_port, "r+b");

        if (!$serial) {
            return [
                'success' => false,
                'message' => "COM5 port açılamadı. Arduino bağlantısını kontrol edin.",
                'port' => $com_port
            ];
        }

        // Arduino'ya komut gönder
        $command = json_encode([
            'action' => $action,
            'classroom' => $classroom,
            'student_name' => $student_name,
            'timestamp' => date('Y-m-d H:i:s')
        ]) . "\n";

        error_log("Arduino'ya gönderilen komut: " . trim($command));

        $bytes_written = fwrite($serial, $command);
        fflush($serial);

        if ($bytes_written === false || $bytes_written === 0) {
            fclose($serial);
            return [
                'success' => false,
                'message' => 'Arduino\'ya komut gönderilemedi'
            ];
        }

        // Arduino'dan yanıt bekle
        $response = '';
        $start_time = time();
        $timeout = 3;

        while ((time() - $start_time) < $timeout) {
            $char = fgetc($serial);
            if ($char !== false) {
                $response .= $char;
                if ($char === "\n") break;
            }
            usleep(50000);
        }

        fclose($serial);

        error_log("Arduino'dan alınan yanıt: " . trim($response));

        if (empty($response)) {
            return [
                'success' => false,
                'message' => 'Arduino\'dan yanıt alınamadı (timeout)',
                'port' => $com_port,
                'command_sent' => trim($command)
            ];
        }

        $trimmed_response = trim($response);
        $arduino_response = json_decode($trimmed_response, true);

        if (json_last_error() !== JSON_ERROR_NONE) {
            return [
                'success' => true,
                'message' => 'Arduino komutu gönderildi',
                'port' => $com_port,
                'raw_response' => $trimmed_response
            ];
        }

        return [
            'success' => $arduino_response['success'] ?? true,
            'message' => $arduino_response['message'] ?? 'Kapı kontrolü tamamlandı',
            'port' => $com_port,
            'door_status' => $arduino_response['status'] ?? 'unknown'
        ];

    } catch (Exception $e) {
        return [
            'success' => false,
            'message' => 'Arduino haberleşme hatası: ' . $e->getMessage()
        ];
    }
}

// Ana endpoint
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $json = file_get_contents('php://input');
    $data = json_decode($json, true);

    if (!$data || !isset($data['action'])) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Geçersiz JSON veya action eksik']);
        exit;
    }

    $action = $data['action'];
    $classroom = $data['classroom'] ?? 'DEFAULT';
    $student_name = $data['student_name'] ?? 'Manual';

    $result = controlArduinoLocal($action, $classroom, $student_name);
    echo json_encode($result);

} elseif ($_SERVER['REQUEST_METHOD'] === 'GET') {
    // Status endpoint
    echo json_encode([
        'status' => 'running',
        'message' => 'Local Arduino Bridge Server (192.168.0.30)',
        'platform' => PHP_OS,
        'version' => PHP_VERSION,
        'arduino_port' => 'COM5'
    ]);

} else {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Sadece POST ve GET istekleri desteklenir']);
}
?>