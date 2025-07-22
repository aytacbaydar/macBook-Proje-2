<?php
require_once '../config.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

try {
    $pdo = getConnection();
} catch (Exception $e) {
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
        @page { size: A4; margin: 15mm; }
        body { 
            font-family: Arial, sans-serif; 
            margin: 0; 
            padding: 0;
            font-size: 11px;
            line-height: 1.3;
        }
        .header { 
            text-align: center; 
            margin-bottom: 20px; 
            padding-bottom: 10px;
            border-bottom: 2px solid #333;
        }
        .header h1 { font-size: 16px; margin: 5px 0; }
        .header p { font-size: 10px; margin: 2px 0; }
        
        .container {
            column-count: 2;
            column-gap: 20px;
            column-rule: 1px solid #ddd;
        }
        
        .soru { 
            margin-bottom: 15px; 
            page-break-inside: avoid;
            break-inside: avoid;
            padding: 8px;
            border: 1px solid #e0e0e0;
            border-radius: 5px;
            display: flex;
            flex-direction: column;
        }
        
        .soru-header {
            display: flex;
            align-items: flex-start;
            margin-bottom: 8px;
        }
        
        .soru-numara {
            font-weight: bold;
            font-size: 11px;
            margin-right: 8px;
            min-width: 25px;
            flex-shrink: 0;
            color: #333;
        }
        
        .soru-metin { 
            font-weight: bold; 
            font-size: 11px;
            line-height: 1.4;
            flex: 1;
        }
        
        .badges {
            margin-bottom: 8px;
        }
        
        .konu-badge { 
            background: #e3f2fd; 
            padding: 1px 6px; 
            border-radius: 8px; 
            font-size: 9px; 
            color: #1976d2;
            display: inline-block;
            margin-right: 5px;
        }
        
        .zorluk-badge { 
            padding: 1px 6px; 
            border-radius: 8px; 
            font-size: 9px; 
            color: white;
            display: inline-block;
        }
        
        .kolay { background: #4caf50; }
        .orta { background: #ff9800; }
        .zor { background: #f44336; }
        
        .secenekler { 
            margin-left: 33px; 
            font-size: 10px;
            margin-top: 5px;
        }
        
        .secenek { 
            margin-bottom: 4px; 
            line-height: 1.4;
            display: flex;
            align-items: flex-start;
        }
        
        .secenek-harf {
            font-weight: bold;
            margin-right: 6px;
            min-width: 15px;
            flex-shrink: 0;
        }
        
        .secenek-metin {
            flex: 1;
        }
        
        .soru-resim {
            text-align: center;
            margin: 8px 0;
        }
        
        .soru-resim img {
            max-width: 100%;
            max-height: 80px;
            border-radius: 3px;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>Yapay Zeka Destekli Test</h1>
        <p>Test Adı: ' . htmlspecialchars($test['test_adi']) . '</p>
        <p>Test ID: ' . $test_id . ' | Tarih: ' . date('d.m.Y H:i', strtotime($test['olusturma_tarihi'])) . ' | Toplam Soru: ' . count($sorular) . '</p>
    </div>
    
    <div class="container">
';

foreach ($sorular as $index => $soru) {
    $soru_no = $index + 1;
    $html_content .= '
    <div class="soru">
        <div class="badges">
            <span class="konu-badge">' . htmlspecialchars($soru['konu_adi']) . '</span>
            <span class="zorluk-badge ' . $soru['zorluk_derecesi'] . '">' . ucfirst($soru['zorluk_derecesi']) . '</span>
        </div>
        <div class="soru-header">
            <span class="soru-numara">' . $soru_no . '.</span>
            <span class="soru-metin">' . htmlspecialchars($soru['soru_metni']) . '</span>
        </div>';
    
    // Soru resmi varsa ekle
    if (!empty($soru['soru_resmi'])) {
        $resim_yolu = '../../uploads/soru_resimleri/' . $soru['soru_resmi'];
        if (file_exists($resim_yolu)) {
            $html_content .= '
            <div class="soru-resim">
                <img src="data:image/jpeg;base64,' . base64_encode(file_get_contents($resim_yolu)) . '" alt="Soru Resmi">
            </div>';
        }
    }
    
    $html_content .= '
        <div class="secenekler">';

    // Seçenekleri daha kompakt formatta yazdır
    $secenekler_array = [];
    if (is_array($soru['secenekler'])) {
        foreach (['A', 'B', 'C', 'D', 'E'] as $harf) {
            if (isset($soru['secenekler'][$harf]) && !empty($soru['secenekler'][$harf])) {
                $secenekler_array[] = $harf . ') ' . htmlspecialchars($soru['secenekler'][$harf]);
            }
        }
    }
    
    foreach ($secenekler_array as $secenek) {
        // A) formatından harfi ve metni ayır
        if (preg_match('/^([A-E])\)\s*(.*)$/', $secenek, $matches)) {
            $harf = $matches[1];
            $metin = $matches[2];
            $html_content .= '
            <div class="secenek">
                <span class="secenek-harf">' . $harf . ')</span>
                <span class="secenek-metin">' . htmlspecialchars($metin) . '</span>
            </div>';
        } else {
            $html_content .= '<div class="secenek">' . $secenek . '</div>';
        }
    }

    $html_content .= '
        </div>
    </div>';
}

$html_content .= '
    </div>
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