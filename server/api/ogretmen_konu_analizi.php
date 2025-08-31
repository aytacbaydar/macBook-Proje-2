
<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit();
}

require_once 'config.php';

function successResponse($data, $message = 'İşlem başarılı') {
    echo json_encode([
        'success' => true,
        'message' => $message,
        'data' => $data
    ], JSON_UNESCAPED_UNICODE);
}

function errorResponse($message, $code = 400) {
    http_response_code($code);
    echo json_encode([
        'success' => false,
        'message' => $message
    ], JSON_UNESCAPED_UNICODE);
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    try {
        $ogretmenId = $_GET['ogretmen_id'] ?? null;

        if (!$ogretmenId) {
            errorResponse('Öğretmen ID gerekli');
            exit();
        }

        // Öğretmenin öğrencilerini bul
        $stmt = $pdo->prepare("
            SELECT DISTINCT o.id, o.adi_soyadi, o.grubu
            FROM ogrenciler o 
            WHERE o.ogretmeni = (
                SELECT adi_soyadi 
                FROM ogretmenler 
                WHERE id = ?
            )
        ");
        $stmt->execute([$ogretmenId]);
        $ogrenciler = $stmt->fetchAll(PDO::FETCH_ASSOC);

        if (empty($ogrenciler)) {
            successResponse([
                'konu_analizleri' => [],
                'message' => 'Bu öğretmene ait öğrenci bulunamadı'
            ]);
            exit();
        }

        $ogrenciIds = array_column($ogrenciler, 'id');
        $placeholders = str_repeat('?,', count($ogrenciIds) - 1) . '?';

        // Tüm konuları al
        $stmt = $pdo->prepare("
            SELECT DISTINCT k.id as konu_id, k.konu_adi
            FROM konular k
            ORDER BY k.id
        ");
        $stmt->execute();
        $konular = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $konuAnalizleri = [];

        foreach ($konular as $konu) {
            // Bu konu için sinav sonuçlarını al
            $stmt = $pdo->prepare("
                SELECT 
                    ss.ogrenci_id,
                    o.adi_soyadi,
                    COUNT(*) as toplam_soru,
                    SUM(CASE WHEN ss.dogru_mu = 1 THEN 1 ELSE 0 END) as dogru_sayisi,
                    ROUND((SUM(CASE WHEN ss.dogru_mu = 1 THEN 1 ELSE 0 END) * 100.0 / COUNT(*)), 2) as basari_orani
                FROM sinav_sonuclari ss
                INNER JOIN ogrenciler o ON ss.ogrenci_id = o.id
                WHERE ss.konu_id = ? 
                AND ss.ogrenci_id IN ($placeholders)
                GROUP BY ss.ogrenci_id, o.adi_soyadi
                HAVING toplam_soru > 0
            ");
            
            $params = array_merge([$konu['konu_id']], $ogrenciIds);
            $stmt->execute($params);
            $sonuclar = $stmt->fetchAll(PDO::FETCH_ASSOC);

            if (empty($sonuclar)) {
                continue; // Bu konu için veri yoksa geç
            }

            // İstatistikleri hesapla
            $toplamOgrenci = count($ogrenciler);
            $cevaplayanOgrenci = count($sonuclar);
            $toplamBasari = array_sum(array_column($sonuclar, 'basari_orani'));
            $ortalamaBasari = $cevaplayanOgrenci > 0 ? round($toplamBasari / $cevaplayanOgrenci, 2) : 0;

            // Öğrencileri başarı seviyelerine göre kategorize et
            $mukemmelOgrenciler = [];
            $iyiOgrenciler = [];
            $ortaOgrenciler = [];
            $kotuOgrenciler = [];

            foreach ($sonuclar as $sonuc) {
                $ogrenci = [
                    'id' => $sonuc['ogrenci_id'],
                    'adi_soyadi' => $sonuc['adi_soyadi'],
                    'basari_orani' => $sonuc['basari_orani'],
                    'dogru_sayisi' => $sonuc['dogru_sayisi'],
                    'toplam_soru' => $sonuc['toplam_soru']
                ];

                if ($sonuc['basari_orani'] >= 80) {
                    $mukemmelOgrenciler[] = $ogrenci;
                } elseif ($sonuc['basari_orani'] >= 60) {
                    $iyiOgrenciler[] = $ogrenci;
                } elseif ($sonuc['basari_orani'] >= 40) {
                    $ortaOgrenciler[] = $ogrenci;
                } else {
                    $kotuOgrenciler[] = $ogrenci;
                }
            }

            $konuAnalizleri[] = [
                'konu_id' => $konu['konu_id'],
                'konu_adi' => $konu['konu_adi'],
                'toplam_ogrenci' => $toplamOgrenci,
                'cevaplayan_ogrenci' => $cevaplayanOgrenci,
                'ortalama_basari' => $ortalamaBasari,
                'mukemmel_ogrenciler' => $mukemmelOgrenciler,
                'iyi_ogrenciler' => $iyiOgrenciler,
                'orta_ogrenciler' => $ortaOgrenciler,
                'kotu_ogrenciler' => $kotuOgrenciler
            ];
        }

        // Başarı oranına göre sırala
        usort($konuAnalizleri, function($a, $b) {
            return $b['ortalama_basari'] <=> $a['ortalama_basari'];
        });

        successResponse([
            'konu_analizleri' => $konuAnalizleri
        ], 'Konu analizi başarıyla getirildi');

    } catch (Exception $e) {
        error_log("Öğretmen konu analizi hatası: " . $e->getMessage());
        errorResponse('Konu analizi getirme hatası: ' . $e->getMessage(), 500);
    }
} else {
    errorResponse('Sadece GET istekleri destekleniyor', 405);
}
?>
