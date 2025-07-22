<?php
require_once '../config.php';

try {
    $pdo = getConnection();

    // Kullanıcı cevapları sütunu ekle
    $sql = "ALTER TABLE yapay_zeka_testler 
            ADD COLUMN IF NOT EXISTS kullanici_cevaplari JSON NULL";

    $pdo->exec($sql);

    echo "Tablo başarıyla güncellendi";

} catch (PDOException $e) {
    echo "Hata: " . $e->getMessage();
}
?>
```

```text
Adding the test_adi column to the yapay_zeka_testler table.
```

```php
<?php
require_once '../config.php';

try {
    $pdo = getConnection();

    // Kullanıcı cevapları sütunu ekle
    $sql = "ALTER TABLE yapay_zeka_testler 
            ADD COLUMN IF NOT EXISTS kullanici_cevaplari JSON NULL";

    $pdo->exec($sql);

    // test_adi sütunu kontrol et ve ekle
    $check_test_adi = $pdo->query("SHOW COLUMNS FROM yapay_zeka_testler LIKE 'test_adi'");
    if ($check_test_adi->rowCount() == 0) {
        $pdo->exec("ALTER TABLE yapay_zeka_testler ADD COLUMN test_adi VARCHAR(255) DEFAULT NULL AFTER test_id");
        echo "test_adi sütunu eklendi\n";
    }

    // Tablolar ve sütunlar kontrol edilip eklendi
    echo json_encode(['success' => true, 'message' => 'Tüm gerekli sütunlar mevcut']);

} catch (PDOException $e) {
    echo "Hata: " . $e->getMessage();
}
?>
```