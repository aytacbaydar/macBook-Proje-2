
<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

try {
    require_once '../config.php';
} catch (Exception $e) {
    echo json_encode(['success' => false, 'error' => 'Config dosyası hatası: ' . $e->getMessage()]);
    exit();
}

function errorResponse($message) {
    echo json_encode(['success' => false, 'message' => $message]);
}

function successResponse($data, $message = '') {
    echo json_encode(['success' => true, 'data' => $data, 'message' => $message]);
}

try {
    if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
        errorResponse('Sadece GET istekleri kabul edilir');
        exit();
    }

    $ogretmenId = isset($_GET['ogretmen_id']) ? intval($_GET['ogretmen_id']) : 0;

    if (!$ogretmenId) {
        errorResponse('Öğretmen ID gerekli');
        exit();
    }

    // Veritabanı bağlantısını kontrol et
    try {
        if (!isset($conn)) {
            $conn = getConnection();
        }
    } catch (Exception $e) {
        errorResponse('Veritabanı bağlantı hatası: ' . $e->getMessage());
        exit();
    }

    // Öğretmenin varlığını kontrol et
    try {
        $stmt = $conn->prepare("SELECT adi_soyadi FROM ogrenciler WHERE id = :ogretmen_id AND rutbe = 'ogretmen'");
        $stmt->bindParam(':ogretmen_id', $ogretmenId);
        $stmt->execute();
        $ogretmen = $stmt->fetch(PDO::FETCH_ASSOC);
    } catch (Exception $e) {
        errorResponse('Öğretmen kontrol hatası: ' . $e->getMessage());
        exit();
    }

    if (!$ogretmen) {
        errorResponse('Öğretmen bulunamadı');
        exit();
    }

    $ogretmenAdi = $ogretmen['adi_soyadi'];

    // Bu öğretmenin öğrencilerini al (rutbe kontrolü ile)
    try {
        $ogrencilerQuery = "SELECT id, adi_soyadi FROM ogrenciler WHERE ogretmeni = :ogretmen_adi AND rutbe = 'ogrenci' AND aktif = 1";
        $stmt = $conn->prepare($ogrencilerQuery);
        $stmt->bindParam(':ogretmen_adi', $ogretmenAdi);
        $stmt->execute();
        $ogrenciler = $stmt->fetchAll(PDO::FETCH_ASSOC);
    } catch (Exception $e) {
        errorResponse('Öğrenciler getirme hatası: ' . $e->getMessage());
        exit();
    }

    if (empty($ogrenciler)) {
        errorResponse('Bu öğretmene ait aktif öğrenci bulunamadı');
        exit();
    }

    // Tüm konuları al (sadece bu öğretmene ait değil, genel konular)
    try {
        $konularQuery = "SELECT DISTINCT konu_adi FROM konular ORDER BY konu_adi";
        $stmt = $conn->prepare($konularQuery);
        $stmt->execute();
        $konularResult = $stmt->fetchAll(PDO::FETCH_ASSOC);
        $konular = array_column($konularResult, 'konu_adi');
    } catch (Exception $e) {
        errorResponse('Konular getirme hatası: ' . $e->getMessage());
        exit();
    }

    if (empty($konular)) {
        errorResponse('Sistemde konu bulunamadı');
        exit();
    }

    $konuAnalizleri = [];

    foreach ($konular as $konuAdi) {
        $ogrenciPerformanslari = [];
        
        foreach ($ogrenciler as $ogrenci) {
            $ogrenciId = $ogrenci['id'];
            $ogrenciAdi = $ogrenci['adi_soyadi'];
            
            $toplamSoru = 0;
            $dogruSayisi = 0;
            $yanlisSayisi = 0;
            $bosSayisi = 0;
            
            // 1. sinav_cevaplari tablosundan analiz
            try {
                $sinavCevaplariQuery = "
                    SELECT sc.cevaplar, sc.soru_konulari, ca.cevaplar as dogru_cevaplar
                    FROM sinav_cevaplari sc
                    LEFT JOIN cevapAnahtari ca ON sc.sinav_id = ca.id
                    WHERE sc.ogrenci_id = :ogrenci_id
                ";
                $stmt = $conn->prepare($sinavCevaplariQuery);
                $stmt->bindParam(':ogrenci_id', $ogrenciId);
                $stmt->execute();
                $sinavlar = $stmt->fetchAll(PDO::FETCH_ASSOC);
                
                foreach ($sinavlar as $sinav) {
                    $ogrenciCevaplar = json_decode($sinav['cevaplar'], true);
                    $soruKonulari = json_decode($sinav['soru_konulari'], true);
                    $dogruCevaplar = json_decode($sinav['dogru_cevaplar'], true);
                    
                    if (!$soruKonulari || !$dogruCevaplar) continue;
                    
                    foreach ($soruKonulari as $soruKey => $soruKonuAdi) {
                        // Konu adı eşleşmesi kontrolü (case insensitive ve trim)
                        if (strcasecmp(trim($soruKonuAdi), trim($konuAdi)) === 0) {
                            $soruNo = str_replace('soru', '', $soruKey);
                            $ogrenciCevap = $ogrenciCevaplar[$soruKey] ?? '';
                            $dogruCevap = $dogruCevaplar["ca{$soruNo}"] ?? '';
                            
                            $toplamSoru++;
                            
                            if (empty($ogrenciCevap)) {
                                $bosSayisi++;
                            } elseif ($ogrenciCevap === $dogruCevap) {
                                $dogruSayisi++;
                            } else {
                                $yanlisSayisi++;
                            }
                        }
                    }
                }
            } catch (Exception $e) {
                error_log('Sınav cevapları analiz hatası: ' . $e->getMessage());
            }
            
            // 2. yapay_zeka_testler tablosundan analiz
            try {
                $yapayZekaQuery = "
                    SELECT sorular, sonuc 
                    FROM yapay_zeka_testler 
                    WHERE ogrenci_id = :ogrenci_id 
                    AND sonuc IS NOT NULL 
                    AND tamamlanma_tarihi IS NOT NULL
                ";
                $stmt = $conn->prepare($yapayZekaQuery);
                $stmt->bindParam(':ogrenci_id', $ogrenciId);
                $stmt->execute();
                $yapayZekaTestler = $stmt->fetchAll(PDO::FETCH_ASSOC);
                
                foreach ($yapayZekaTestler as $test) {
                    $sorular = json_decode($test['sorular'], true);
                    $sonuc = json_decode($test['sonuc'], true);
                    
                    if (!$sonuc || !isset($sonuc['details'])) continue;
                    
                    foreach ($sonuc['details'] as $detay) {
                        if (!isset($detay['soru']) || !isset($detay['soru']['konu_adi'])) continue;
                        
                        $testKonuAdi = $detay['soru']['konu_adi'];
                        
                        // Konu adı eşleşmesi kontrolü (case insensitive ve trim)
                        if (strcasecmp(trim($testKonuAdi), trim($konuAdi)) === 0) {
                            $isCorrect = $detay['is_correct'] ?? false;
                            $userAnswer = $detay['user_answer'] ?? '';
                            
                            $toplamSoru++;
                            
                            if (empty($userAnswer)) {
                                $bosSayisi++;
                            } elseif ($isCorrect) {
                                $dogruSayisi++;
                            } else {
                                $yanlisSayisi++;
                            }
                        }
                    }
                }
            } catch (Exception $e) {
                error_log('Yapay zeka testleri analiz hatası: ' . $e->getMessage());
            }
            
            // Öğrenci bu konuda soru çözdüyse performans hesapla
            if ($toplamSoru > 0) {
                $basariOrani = round(($dogruSayisi / $toplamSoru) * 100, 2);
                $ogrenciPerformanslari[] = [
                    'ogrenci_id' => $ogrenciId,
                    'adi_soyadi' => $ogrenciAdi,
                    'toplam_soru' => $toplamSoru,
                    'dogru_sayisi' => $dogruSayisi,
                    'yanlis_sayisi' => $yanlisSayisi,
                    'bos_sayisi' => $bosSayisi,
                    'basari_orani' => $basariOrani
                ];
            }
        }
        
        // Bu konu için öğrenci varsa analiz ekle
        if (!empty($ogrenciPerformanslari)) {
            // Performans gruplarını ayır
            $mukemmelOgrenciler = array_filter($ogrenciPerformanslari, fn($p) => $p['basari_orani'] >= 80);
            $iyiOgrenciler = array_filter($ogrenciPerformanslari, fn($p) => $p['basari_orani'] >= 60 && $p['basari_orani'] < 80);
            $ortaOgrenciler = array_filter($ogrenciPerformanslari, fn($p) => $p['basari_orani'] >= 40 && $p['basari_orani'] < 60);
            $kotuOgrenciler = array_filter($ogrenciPerformanslari, fn($p) => $p['basari_orani'] < 40);
            
            // Ortalama başarı hesapla
            $toplamBasari = array_sum(array_column($ogrenciPerformanslari, 'basari_orani'));
            $ortalamaBasari = round($toplamBasari / count($ogrenciPerformanslari), 2);
            
            $konuAnalizleri[] = [
                'konu_adi' => $konuAdi,
                'toplam_ogrenci' => count($ogrenciPerformanslari),
                'cevaplayan_ogrenci' => count($ogrenciPerformanslari),
                'ortalama_basari' => $ortalamaBasari,
                'mukemmel_ogrenciler' => array_map(fn($p) => ['adi_soyadi' => $p['adi_soyadi'], 'basari_orani' => $p['basari_orani']], $mukemmelOgrenciler),
                'iyi_ogrenciler' => array_map(fn($p) => ['adi_soyadi' => $p['adi_soyadi'], 'basari_orani' => $p['basari_orani']], $iyiOgrenciler),
                'orta_ogrenciler' => array_map(fn($p) => ['adi_soyadi' => $p['adi_soyadi'], 'basari_orani' => $p['basari_orani']], $ortaOgrenciler),
                'kotu_ogrenciler' => array_map(fn($p) => ['adi_soyadi' => $p['adi_soyadi'], 'basari_orani' => $p['basari_orani']], $kotuOgrenciler)
            ];
        }
    }

    // Başarı oranına göre sırala (yüksekten düşüğe)
    usort($konuAnalizleri, function($a, $b) {
        return $b['ortalama_basari'] <=> $a['ortalama_basari'];
    });

    // Debug bilgisi ekle
    $debugInfo = [
        'ogretmen_adi' => $ogretmenAdi,
        'toplam_ogrenci' => count($ogrenciler),
        'bulunan_konular' => count($konular),
        'analiz_edilen_konular' => count($konuAnalizleri)
    ];

    successResponse([
        'konu_analizleri' => $konuAnalizleri,
        'debug_info' => $debugInfo
    ], 'Konu analizi başarıyla getirildi');

} catch (Exception $e) {
    errorResponse('Sistem hatası: ' . $e->getMessage());
}
?>
