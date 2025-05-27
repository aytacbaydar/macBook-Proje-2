
<?php
require_once '../config.php';

// CORS ayarları header bilgileri config.php'de zaten tanımlanmış

// Preflight OPTIONS isteğini yanıtla
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Sadece POST isteklerini kabul et
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['success' => false, 'message' => 'Sadece POST metodu kabul edilir.']);
    exit;
}

// JSON verilerini al
$jsonData = file_get_contents("php://input");
$data = json_decode($jsonData, true);

// Verileri doğrula
if (!isset($data['tableName']) || !isset($data['columns']) || empty($data['columns'])) {
    echo json_encode(['success' => false, 'message' => 'Gerekli alanlar eksik.']);
    exit;
}

// Tablo adını doğrula
if (!preg_match('/^[a-zA-Z][a-zA-Z0-9_]*$/', $data['tableName'])) {
    echo json_encode(['success' => false, 'message' => 'Geçersiz tablo adı formatı.']);
    exit;
}

// Veritabanı bağlantısı - config.php'deki getConnection fonksiyonunu kullan
try {
    $conn = getConnection();
} catch(PDOException $e) {
    echo json_encode(['success' => false, 'message' => 'Veritabanı bağlantı hatası: ' . $e->getMessage()]);
    exit;
}

// SQL oluştur
$tableName = $data['tableName'];
$sql = "CREATE TABLE IF NOT EXISTS `$tableName` (";

$columnDefinitions = [];
$hasPrimaryKey = false;

foreach ($data['columns'] as $column) {
    if (empty($column['name'])) {
        continue;
    }
    
    // Kolon adını doğrula
    if (!preg_match('/^[a-zA-Z][a-zA-Z0-9_]*$/', $column['name'])) {
        echo json_encode(['success' => false, 'message' => 'Geçersiz kolon adı: ' . $column['name']]);
        exit;
    }
    
    $columnDef = "`" . $column['name'] . "` " . $column['type'];
    
    // Uzunluk ekle (VARCHAR, CHAR, DECIMAL, INT vb. için)
    if (in_array($column['type'], ['VARCHAR', 'CHAR', 'DECIMAL', 'INT']) && !empty($column['length'])) {
        $columnDef .= "(" . $column['length'] . ")";
    }
    
    // NOT NULL ekle
    if (isset($column['notNull']) && $column['notNull']) {
        $columnDef .= " NOT NULL";
    }
    
    // PRIMARY KEY ekle
    if (isset($column['primaryKey']) && $column['primaryKey']) {
        $columnDef .= " PRIMARY KEY";
        $hasPrimaryKey = true;
    }
    
    // AUTO_INCREMENT ekle (sadece PRIMARY KEY ile kullanılabilir)
    if (isset($column['autoIncrement']) && $column['autoIncrement'] && isset($column['primaryKey']) && $column['primaryKey']) {
        $columnDef .= " AUTO_INCREMENT";
    }
    
    $columnDefinitions[] = $columnDef;
}

// En az bir kolon olmalı
if (empty($columnDefinitions)) {
    echo json_encode(['success' => false, 'message' => 'En az bir geçerli kolon tanımlanmalıdır.']);
    exit;
}

$sql .= implode(", ", $columnDefinitions);
$sql .= ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;";

// SQL'i çalıştır
try {
    $conn->exec($sql);
    echo json_encode(['success' => true, 'message' => 'Tablo başarıyla oluşturuldu.', 'sql' => $sql]);
} catch(PDOException $e) {
    echo json_encode(['success' => false, 'message' => 'Tablo oluşturma hatası: ' . $e->getMessage(), 'sql' => $sql]);
}
$conn = null;
?>
