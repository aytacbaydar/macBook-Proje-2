<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

require_once '../config.php';

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    try {
        // Kullanıcıyı doğrula
        $user = authorize();

        if ($user['rutbe'] !== 'ogretmen') {
            errorResponse('Bu işlem için yetkiniz yok. Sadece öğretmenler ders programını görebilir.', 403);
        }

        $conn = getConnection();
        $teacherName = $user['adi_soyadi'];

        // Öğretmenin haftalık ders programını getir
        $query = "
            SELECT 
                ob.id,
                o.adi_soyadi,
                ob.grubu,
                ob.sinifi,
                ob.ders_gunu,
                ob.ders_saati,
                ob.ucret
            FROM ogrenci_bilgileri ob
            INNER JOIN ogrenciler o ON ob.ogrenci_id = o.id
            WHERE o.ogretmeni = ? 
                AND o.aktif = 1
                AND ob.ders_gunu IS NOT NULL 
                AND ob.ders_gunu != ''
                AND ob.ders_saati IS NOT NULL 
                AND ob.ders_saati != ''
            ORDER BY 
                CASE ob.ders_gunu
                    WHEN 'Pazartesi' THEN 1
                    WHEN 'Salı' THEN 2
                    WHEN 'Çarşamba' THEN 3
                    WHEN 'Perşembe' THEN 4
                    WHEN 'Cuma' THEN 5
                    WHEN 'Cumartesi' THEN 6
                    WHEN 'Pazar' THEN 7
                    ELSE 8
                END,
                ob.ders_saati
        ";

        $stmt = $conn->prepare($query);
        $stmt->execute([$teacherName]);
        $dersProgram = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Verişri formatla
        $formattedData = [];
        foreach ($dersProgram as $ders) {
            $formattedData[] = [
                'id' => (int)$ders['id'],
                'adi_soyadi' => $ders['adi_soyadi'],
                'grubu' => $ders['grubu'],
                'sinifi' => $ders['sinifi'],
                'ders_gunu' => $ders['ders_gunu'],
                'ders_saati' => $ders['ders_saati'],
                'ucret' => (float)$ders['ucret']
            ];
        }

        // İstatistikleri hesapla
        $gunlukIstatistik = [];
        $gunler = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];

        foreach ($gunler as $gun) {
            $gunlukDersler = array_filter($formattedData, function($ders) use ($gun) {
                return $ders['ders_gunu'] === $gun;
            });

            $gunlukIstatistik[$gun] = [
                'ders_sayisi' => count($gunlukDersler),
                'toplam_ucret' => array_sum(array_column($gunlukDersler, 'ucret'))
            ];
        }

        $response = [
            'success' => true,
            'message' => 'Haftalık ders programı başarıyla getirildi',
            'data' => $formattedData,
            'istatistik' => [
                'toplam_ders' => count($formattedData),
                'haftalik_toplam_ucret' => array_sum(array_column($formattedData, 'ucret')),
                'gunluk_istatistik' => $gunlukIstatistik,
                'benzersiz_grup_sayisi' => count(array_unique(array_map(function($ders) {
                    return $ders['grubu'] . '-' . $ders['sinifi'];
                }, $formattedData)))
            ]
        ];

        echo json_encode($response, JSON_UNESCAPED_UNICODE);

    } catch (Exception $e) {
        errorResponse('Haftalık ders programı getirilirken hata oluştu: ' . $e->getMessage(), 500);
    }
} else {
    errorResponse('Geçersiz istek metodu', 405);
}
?>
```

```php
<?php
require_once '../config.php';

// Yetkilendirme kontrolü
$user = authorizeAdmin();

try {
    // Veritabanı bağlantısı
    $pdo = getConnection();

    // Haftalık ders programını getir
    $stmt = $pdo->prepare("
        SELECT 
            ders_gunu,
            ders_saati,
            grubu,
            sinifi,
            COUNT(*) as ogrenci_sayisi
        FROM ogrenci_bilgileri 
        WHERE aktif = 1 
        GROUP BY ders_gunu, ders_saati, grubu, sinifi
        ORDER BY 
            FIELD(ders_gunu, 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'),
            ders_saati
    ");
```

```php
<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

require_once '../config.php';

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    try {
        // Kullanıcıyı doğrula
        $user = authorize();

        if ($user['rutbe'] !== 'ogretmen') {
            errorResponse('Bu işlem için yetkiniz yok. Sadece öğretmenler ders programını görebilir.', 403);
        }

        $conn = getConnection();
        $teacherName = $user['adi_soyadi'];

        // Öğretmenin haftalık ders programını getir
        $query = "
            SELECT 
                ob.id,
                o.adi_soyadi,
                ob.grubu,
                ob.sinifi,
                ob.ders_gunu,
                ob.ders_saati,
                ob.ucret
            FROM ogrenci_bilgileri ob
            INNER JOIN ogrenciler o ON ob.ogrenci_id = o.id
            WHERE o.ogretmeni = ? 
                AND o.aktif = 1
                AND ob.ders_gunu IS NOT NULL 
                AND ob.ders_gunu != ''
                AND ob.ders_saati IS NOT NULL 
                AND ob.ders_saati != ''
            ORDER BY 
                CASE ob.ders_gunu
                    WHEN 'Pazartesi' THEN 1
                    WHEN 'Salı' THEN 2
                    WHEN 'Çarşamba' THEN 3
                    WHEN 'Perşembe' THEN 4
                    WHEN 'Cuma' THEN 5
                    WHEN 'Cumartesi' THEN 6
                    WHEN 'Pazar' THEN 7
                    ELSE 8
                END,
                ob.ders_saati
        ";

        $stmt = $conn->prepare($query);
        $stmt->execute([$teacherName]);
        $dersProgram = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Verişri formatla
        $formattedData = [];
        foreach ($dersProgram as $ders) {
            $formattedData[] = [
                'id' => (int)$ders['id'],
                'adi_soyadi' => $ders['adi_soyadi'],
                'grubu' => $ders['grubu'],
                'sinifi' => $ders['sinifi'],
                'ders_gunu' => $ders['ders_gunu'],
                'ders_saati' => $ders['ders_saati'],
                'ucret' => (float)$ders['ucret']
            ];
        }

        // İstatistikleri hesapla
        $gunlukIstatistik = [];
        $gunler = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];

        foreach ($gunler as $gun) {
            $gunlukDersler = array_filter($formattedData, function($ders) use ($gun) {
                return $ders['ders_gunu'] === $gun;
            });

            $gunlukIstatistik[$gun] = [
                'ders_sayisi' => count($gunlukDersler),
                'toplam_ucret' => array_sum(array_column($gunlukDersler, 'ucret'))
            ];
        }

        $response = [
            'success' => true,
            'message' => 'Haftalık ders programı başarıyla getirildi',
            'data' => $formattedData,
            'istatistik' => [
                'toplam_ders' => count($formattedData),
                'haftalik_toplam_ucret' => array_sum(array_column($formattedData, 'ucret')),
                'gunluk_istatistik' => $gunlukIstatistik,
                'benzersiz_grup_sayisi' => count(array_unique(array_map(function($ders) {
                    return $ders['grubu'] . '-' . $ders['sinifi'];
                }, $formattedData)))
            ]
        ];

        echo json_encode($response, JSON_UNESCAPED_UNICODE);

    } catch (Exception $e) {
        errorResponse('Haftalık ders programı getirilirken hata oluştu: ' . $e->getMessage(), 500);
    }
} else {
    errorResponse('Geçersiz istek metodu', 405);
}
?>
```

The provided changes are for admin weekly schedule, and original code is for teacher weekly schedule. I will apply connection to teacher weekly schedule since user mentioned that.

```php
<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

require_once '../config.php';

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    try {
        // Kullanıcıyı doğrula
        $user = authorize();

        if ($user['rutbe'] !== 'ogretmen') {
            errorResponse('Bu işlem için yetkiniz yok. Sadece öğretmenler ders programını görebilir.', 403);
        }

        $conn = getConnection(); // Get database connection
        $teacherName = $user['adi_soyadi'];

        // Öğretmenin haftalık ders programını getir
        $query = "
            SELECT 
                ob.id,
                o.adi_soyadi,
                ob.grubu,
                ob.sinifi,
                ob.ders_gunu,
                ob.ders_saati,
                ob.ucret
            FROM ogrenci_bilgileri ob
            INNER JOIN ogrenciler o ON ob.ogrenci_id = o.id
            WHERE o.ogretmeni = ? 
                AND o.aktif = 1
                AND ob.ders_gunu IS NOT NULL 
                AND ob.ders_gunu != ''
                AND ob.ders_saati IS NOT NULL 
                AND ob.ders_saati != ''
            ORDER BY 
                CASE ob.ders_gunu
                    WHEN 'Pazartesi' THEN 1
                    WHEN 'Salı' THEN 2
                    WHEN 'Çarşamba' THEN 3
                    WHEN 'Perşembe' THEN 4
                    WHEN 'Cuma' THEN 5
                    WHEN 'Cumartesi' THEN 6
                    WHEN 'Pazar' THEN 7
                    ELSE 8
                END,
                ob.ders_saati
        ";

        $stmt = $conn->prepare($query);
        $stmt->execute([$teacherName]);
        $dersProgram = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Verişri formatla
        $formattedData = [];
        foreach ($dersProgram as $ders) {
            $formattedData[] = [
                'id' => (int)$ders['id'],
                'adi_soyadi' => $ders['adi_soyadi'],
                'grubu' => $ders['grubu'],
                'sinifi' => $ders['sinifi'],
                'ders_gunu' => $ders['ders_gunu'],
                'ders_saati' => $ders['ders_saati'],
                'ucret' => (float)$ders['ucret']
            ];
        }

        // İstatistikleri hesapla
        $gunlukIstatistik = [];
        $gunler = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];

        foreach ($gunler as $gun) {
            $gunlukDersler = array_filter($formattedData, function($ders) use ($gun) {
                return $ders['ders_gunu'] === $gun;
            });

            $gunlukIstatistik[$gun] = [
                'ders_sayisi' => count($gunlukDersler),
                'toplam_ucret' => array_sum(array_column($gunlukDersler, 'ucret'))
            ];
        }

        $response = [
            'success' => true,
            'message' => 'Haftalık ders programı başarıyla getirildi',
            'data' => $formattedData,
            'istatistik' => [
                'toplam_ders' => count($formattedData),
                'haftalik_toplam_ucret' => array_sum(array_column($formattedData, 'ucret')),
                'gunluk_istatistik' => $gunlukIstatistik,
                'benzersiz_grup_sayisi' => count(array_unique(array_map(function($ders) {
                    return $ders['grubu'] . '-' . $ders['sinifi'];
                }, $formattedData)))
            ]
        ];

        echo json_encode($response, JSON_UNESCAPED_UNICODE);

    } catch (Exception $e) {
        errorResponse('Haftalık ders programı getirilirken hata oluştu: ' . $e->getMessage(), 500);
    }
} else {
    errorResponse('Geçersiz istek metodu', 405);
}
?>
```

```
<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

require_once '../config.php';

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    try {
        // Kullanıcıyı doğrula
        $user = authorize();

        if ($user['rutbe'] !== 'ogretmen') {
            errorResponse('Bu işlem için yetkiniz yok. Sadece öğretmenler ders programını görebilir.', 403);
        }

        $pdo = getConnection(); // Get database connection
        $teacherName = $user['adi_soyadi'];

        // Öğretmenin haftalık ders programını getir
        $query = "
            SELECT 
                ob.id,
                o.adi_soyadi,
                ob.grubu,
                ob.sinifi,
                ob.ders_gunu,
                ob.ders_saati,
                ob.ucret
            FROM ogrenci_bilgileri ob
            INNER JOIN ogrenciler o ON ob.ogrenci_id = o.id
            WHERE o.ogretmeni = ? 
                AND o.aktif = 1
                AND ob.ders_gunu IS NOT NULL 
                AND ob.ders_gunu != ''
                AND ob.ders_saati IS NOT NULL 
                AND ob.ders_saati != ''
            ORDER BY 
                CASE ob.ders_gunu
                    WHEN 'Pazartesi' THEN 1
                    WHEN 'Salı' THEN 2
                    WHEN 'Çarşamba' THEN 3
                    WHEN 'Perşembe' THEN 4
                    WHEN 'Cuma' THEN 5
                    WHEN 'Cumartesi' THEN 6
                    WHEN 'Pazar' THEN 7
                    ELSE 8
                END,
                ob.ders_saati
        ";

        $stmt = $pdo->prepare($query);
        $stmt->execute([$teacherName]);
        $dersProgram = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Verişri formatla
        $formattedData = [];
        foreach ($dersProgram as $ders) {
            $formattedData[] = [
                'id' => (int)$ders['id'],
                'adi_soyadi' => $ders['adi_soyadi'],
                'grubu' => $ders['grubu'],
                'sinifi' => $ders['sinifi'],
                'ders_gunu' => $ders['ders_gunu'],
                'ders_saati' => $ders['ders_saati'],
                'ucret' => (float)$ders['ucret']
            ];
        }

        // İstatistikleri hesapla
        $gunlukIstatistik = [];
        $gunler = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];

        foreach ($gunler as $gun) {
            $gunlukDersler = array_filter($formattedData, function($ders) use ($gun) {
                return $ders['ders_gunu'] === $gun;
            });

            $gunlukIstatistik[$gun] = [
                'ders_sayisi' => count($gunlukDersler),
                'toplam_ucret' => array_sum(array_column($gunlukDersler, 'ucret'))
            ];
        }

        $response = [
            'success' => true,
            'message' => 'Haftalık ders programı başarıyla getirildi',
            'data' => $formattedData,
            'istatistik' => [
                'toplam_ders' => count($formattedData),
                'haftalik_toplam_ucret' => array_sum(array_column($formattedData, 'ucret')),
                'gunluk_istatistik' => $gunlukIstatistik,
                'benzersiz_grup_sayisi' => count(array_unique(array_map(function($ders) {
                    return $ders['grubu'] . '-' . $ders['sinifi'];
                }, $formattedData)))
            ]
        ];

        echo json_encode($response, JSON_UNESCAPED_UNICODE);

    } catch (Exception $e) {
        errorResponse('Haftalık ders programı getirilirken hata oluştu: ' . $e->getMessage(), 500);
    }
} else {
    errorResponse('Geçersiz istek metodu', 405);
}
?>
```

Adding database connection to the teacher weekly schedule endpoint.

```php
<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

require_once '../config.php';

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    try {
        // Kullanıcıyı doğrula
        $user = authorize();

        if ($user['rutbe'] !== 'ogretmen') {
            errorResponse('Bu işlem için yetkiniz yok. Sadece öğretmenler ders programını görebilir.', 403);
        }

        $pdo = getConnection(); // Get database connection
        $teacherName = $user['adi_soyadi'];

        // Öğretmenin haftalık ders programını getir
        $query = "
            SELECT 
                ob.id,
                o.adi_soyadi,
                ob.grubu,
                ob.sinifi,
                ob.ders_gunu,
                ob.ders_saati,
                ob.ucret
            FROM ogrenci_bilgileri ob
            INNER JOIN ogrenciler o ON ob.ogrenci_id = o.id
            WHERE o.ogretmeni = ? 
                AND o.aktif = 1
                AND ob.ders_gunu IS NOT NULL 
                AND ob.ders_gunu != ''
                AND ob.ders_saati IS NOT NULL 
                AND ob.ders_saati != ''
            ORDER BY 
                CASE ob.ders_gunu
                    WHEN 'Pazartesi' THEN 1
                    WHEN 'Salı' THEN 2
                    WHEN 'Çarşamba' THEN 3
                    WHEN 'Perşembe' THEN 4
                    WHEN 'Cuma' THEN 5
                    WHEN 'Cumartesi' THEN 6
                    WHEN 'Pazar' THEN 7
                    ELSE 8
                END,
                ob.ders_saati
        ";

        $stmt = $pdo->prepare($query);
        $stmt->execute([$teacherName]);
        $dersProgram = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Verişri formatla
        $formattedData = [];
        foreach ($dersProgram as $ders) {
            $formattedData[] = [
                'id' => (int)$ders['id'],
                'adi_soyadi' => $ders['adi_soyadi'],
                'grubu' => $ders['grubu'],
                'sinifi' => $ders['sinifi'],
                'ders_gunu' => $ders['ders_gunu'],
                'ders_saati' => $ders['ders_saati'],
                'ucret' => (float)$ders['ucret']
            ];
        }

        // İstatistikleri hesapla
        $gunlukIstatistik = [];
        $gunler = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];

        foreach ($gunler as $gun) {
            $gunlukDersler = array_filter($formattedData, function($ders) use ($gun) {
                return $ders['ders_gunu'] === $gun;
            });

            $gunlukIstatistik[$gun] = [
                'ders_sayisi' => count($gunlukDersler),
                'toplam_ucret' => array_sum(array_column($gunlukDersler, 'ucret'))
            ];
        }

        $response = [
            'success' => true,
            'message' => 'Haftalık ders programı başarıyla getirildi',
            'data' => $formattedData,
            'istatistik' => [
                'toplam_ders' => count($formattedData),
                'haftalik_toplam_ucret' => array_sum(array_column($formattedData, 'ucret')),
                'gunluk_istatistik' => $gunlukIstatistik,
                'benzersiz_grup_sayisi' => count(array_unique(array_map(function($ders) {
                    return $ders['grubu'] . '-' . $ders['sinifi'];
                }, $formattedData)))
            ]
        ];

        echo json_encode($response, JSON_UNESCAPED_UNICODE);

    } catch (Exception $e) {
        errorResponse('Haftalık ders programı getirilirken hata oluştu: ' . $e->getMessage(), 500);
    }
} else {
    errorResponse('Geçersiz istek metodu', 405);
}
?>
```

Final Answer:
```php
<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

require_once '../config.php';

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    try {
        // Kullanıcıyı doğrula
        $user = authorize();

        if ($user['rutbe'] !== 'ogretmen') {
            errorResponse('Bu işlem için yetkiniz yok. Sadece öğretmenler ders programını görebilir.', 403);
        }

        $pdo = getConnection(); // Get database connection
        $teacherName = $user['adi_soyadi'];

        // Öğretmenin haftalık ders programını getir
        $query = "
            SELECT 
                ob.id,
                o.adi_soyadi,
                ob.grubu,
                ob.sinifi,
                ob.ders_gunu,
                ob.ders_saati,
                ob.ucret
            FROM ogrenci_bilgileri ob
            INNER JOIN ogrenciler o ON ob.ogrenci_id = o.id
            WHERE o.ogretmeni = ? 
                AND o.aktif = 1
                AND ob.ders_gunu IS NOT NULL 
                AND ob.ders_gunu != ''
                AND ob.ders_saati IS NOT NULL 
                AND ob.ders_saati != ''
            ORDER BY 
                CASE ob.ders_gunu
                    WHEN 'Pazartesi' THEN 1
                    WHEN 'Salı' THEN 2
                    WHEN 'Çarşamba' THEN 3
                    WHEN 'Perşembe' THEN 4
                    WHEN 'Cuma' THEN 5
                    WHEN 'Cumartesi' THEN 6
                    WHEN 'Pazar' THEN 7
                    ELSE 8
                END,
                ob.ders_saati
        ";

        $stmt = $pdo->prepare($query);
        $stmt->execute([$teacherName]);
        $dersProgram = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Verişri formatla
        $formattedData = [];
        foreach ($dersProgram as $ders) {
            $formattedData[] = [
                'id' => (int)$ders['id'],
                'adi_soyadi' => $ders['adi_soyadi'],
                'grubu' => $ders['grubu'],
                'sinifi' => $ders['sinifi'],
                'ders_gunu' => $ders['ders_gunu'],
                'ders_saati' => $ders['ders_saati'],
                'ucret' => (float)$ders['ucret']
            ];
        }

        // İstatistikleri hesapla
        $gunlukIstatistik = [];
        $gunler = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];

        foreach ($gunler as $gun) {
            $gunlukDersler = array_filter($formattedData, function($ders) use ($gun) {
                return $ders['ders_gunu'] === $gun;
            });

            $gunlukIstatistik[$gun] = [
                'ders_sayisi' => count($gunlukDersler),
                'toplam_ucret' => array_sum(array_column($gunlukDersler, 'ucret'))
            ];
        }

        $response = [
            'success' => true,
            'message' => 'Haftalık ders programı başarıyla getirildi',
            'data' => $formattedData,
            'istatistik' => [
                'toplam_ders' => count($formattedData),
                'haftalik_toplam_ucret' => array_sum(array_column($formattedData, 'ucret')),
                'gunluk_istatistik' => $gunlukIstatistik,
                'benzersiz_grup_sayisi' => count(array_unique(array_map(function($ders) {
                    return $ders['grubu'] . '-' . $ders['sinifi'];
                }, $formattedData)))
            ]
        ];

        echo json_encode($response, JSON_UNESCAPED_UNICODE);

    } catch (Exception $e) {
        errorResponse('Haftalık ders programı getirilirken hata oluştu: ' . $e->getMessage(), 500);
    }
} else {
    errorResponse('Geçersiz istek metodu', 405);
}
?>