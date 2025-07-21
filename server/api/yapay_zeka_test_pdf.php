
<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

require_once '../config.php';

try {
    $pdo = new PDO("mysql:host=$servername;dbname=$dbname;charset=utf8mb4", $username, $password);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
} catch (PDOException $e) {
    echo json_encode(['success' => false, 'message' => 'Veritabanı bağlantısı başarısız: ' . $e->getMessage()]);
    exit;
}

$test_id = $_GET['test_id'] ?? null;

if (!$test_id) {
    echo json_encode(['success' => false, 'message' => 'Test ID gerekli']);
    exit;
}

// Test bilgilerini getir
$sql = "SELECT * FROM yapay_zeka_testler WHERE id = ?";
$stmt = $pdo->prepare($sql);
$stmt->execute([$test_id]);
$test = $stmt->fetch(PDO::FETCH_ASSOC);

if (!$test) {
    echo json_encode(['success' => false, 'message' => 'Test bulunamadı']);
    exit;
}

$sorular = json_decode($test['sorular'], true);

// HTML içeriği oluştur
$html_content = '
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Yapay Zeka Test - ' . $test_id . '</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { text-align: center; margin-bottom: 30px; }
        .soru { margin-bottom: 25px; page-break-inside: avoid; }
        .soru-baslik { font-weight: bold; margin-bottom: 10px; }
        .secenekler { margin-left: 20px; }
        .secenek { margin-bottom: 5px; }
        .konu-badge { 
            background: #e3f2fd; 
            padding: 2px 8px; 
            border-radius: 12px; 
            font-size: 12px; 
            color: #1976d2;
            display: inline-block;
            margin-bottom: 10px;
        }
        .zorluk-badge { 
            padding: 2px 8px; 
            border-radius: 12px; 
            font-size: 12px; 
            color: white;
            display: inline-block;
            margin-left: 10px;
        }
        .kolay { background: #4caf50; }
        .orta { background: #ff9800; }
        .zor { background: #f44336; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Yapay Zeka Destekli Test</h1>
        <p>Test ID: ' . $test_id . '</p>
        <p>Oluşturulma Tarihi: ' . date('d.m.Y H:i', strtotime($test['olusturma_tarihi'])) . '</p>
        <p>Toplam Soru: ' . count($sorular) . '</p>
    </div>
';

foreach ($sorular as $index => $soru) {
    $soru_no = $index + 1;
    $html_content .= '
    <div class="soru">
        <div class="soru-baslik">
            ' . $soru_no . '. ' . htmlspecialchars($soru['soru_metni']) . '
            <br>
            <span class="konu-badge">' . htmlspecialchars($soru['konu_adi']) . '</span>
            <span class="zorluk-badge ' . $soru['zorluk_derecesi'] . '">' . ucfirst($soru['zorluk_derecesi']) . '</span>
        </div>
        <div class="secenekler">';
    
    $secenekler = ['A', 'B', 'C', 'D'];
    foreach ($secenekler as $harf) {
        if (isset($soru['secenekler'][$harf])) {
            $html_content .= '<div class="secenek">' . $harf . ') ' . htmlspecialchars($soru['secenekler'][$harf]) . '</div>';
        }
    }
    
    $html_content .= '
        </div>
    </div>';
}

$html_content .= '
</body>
</html>';

// PDF oluşturma için geçici HTML dosyası
$temp_file = tempnam(sys_get_temp_dir(), 'test_') . '.html';
file_put_contents($temp_file, $html_content);

echo json_encode([
    'success' => true,
    'html_content' => $html_content,
    'temp_file' => $temp_file
]);
?>
