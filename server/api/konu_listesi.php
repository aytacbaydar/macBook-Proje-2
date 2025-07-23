<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

require_once '../config.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

try {
    $pdo = getConnection();

    // Konular tablosunu kontrol et ve oluştur
    $createTableSQL = "
    CREATE TABLE IF NOT EXISTS konular (
        id INT PRIMARY KEY AUTO_INCREMENT,
        konu_adi VARCHAR(255) NOT NULL UNIQUE,
        sinif_seviyesi VARCHAR(50) DEFAULT '9',
        unite_adi VARCHAR(255) DEFAULT NULL,
        aciklama TEXT DEFAULT NULL,
        olusturma_tarihi TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )";

    $pdo->exec($createTableSQL);

    // Tablo boşsa örnek konular ekle
    $checkSQL = "SELECT COUNT(*) as count FROM konular";
    $checkStmt = $pdo->prepare($checkSQL);
    $checkStmt->execute();
    $count = $checkStmt->fetch(PDO::FETCH_ASSOC)['count'];

    if ($count == 0) {
        $ornekKonular = [
            ['Asitler ve Bazlar', '9', 'Asit-Baz Dengesi'],
            ['Periyodik Sistem', '9', 'Atom ve Periyodik Özellikler'],
            ['Kimyasal Bağlar', '9', 'Kimyasal Bağlanma'],
            ['Karışımlar', '9', 'Maddenin Halleri'],
            ['Atom Modelleri', '9', 'Atom Yapısı'],
            ['Elektron Dizilimi', '9', 'Atom Yapısı'],
            ['İyonik Bağ', '10', 'Kimyasal Bağlar'],
            ['Kovalent Bağ', '10', 'Kimyasal Bağlar'],
            ['Metalik Bağ', '10', 'Kimyasal Bağlar'],
            ['Çözeltiler', '10', 'Çözelti Kimyası'],
            ['Kimyasal Tepkimeler', '10', 'Tepkime Türleri'],
            ['Organik Kimya', '11', 'Organik Bileşikler'],
            ['Hidrokarbon', '11', 'Organik Kimya'],
            ['Fonksiyonel Gruplar', '11', 'Organik Kimya'],
            ['Termodinamik', '12', 'Enerji ve Kimya'],
            ['Kimyasal Denge', '12', 'Kimyasal Denge'],
            ['Elektrokimya', '12', 'Elektrokimya']
        ];

        $insertSQL = "INSERT INTO konular (konu_adi, sinif_seviyesi, unite_adi) VALUES (?, ?, ?)";
        $insertStmt = $pdo->prepare($insertSQL);

        foreach ($ornekKonular as $konu) {
            $insertStmt->execute($konu);
        }
    }

    // Konuları getir
    $sql = "SELECT * FROM konular ORDER BY sinif_seviyesi, konu_adi";
    $stmt = $pdo->prepare($sql);
    $stmt->execute();
    $konular = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode([
        'success' => true,
        'konular' => $konular,
        'message' => 'Konular başarıyla getirildi'
    ]);

} catch (PDOException $e) {
    echo json_encode([
        'success' => false,
        'message' => 'Konular getirilemedi: ' . $e->getMessage()
    ]);
}
?>