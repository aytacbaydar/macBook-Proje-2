
<?php
require_once '../config.php';

try {
    $user = authorize();
    
    if ($user['rutbe'] !== 'ogretmen') {
        errorResponse('Bu işlem için yetkiniz yok.', 403);
    }
    
    $conn = getConnection();
    $teacherName = $user['adi_soyadi'];
    
    // Son 12 ay için aylık gelir hesapla
    $aylikGelirler = [];
    
    // Son 12 ayın tarihlerini oluştur
    for ($i = 9; $i >= 0; $i--) {
        $tarih = new DateTime();
        $tarih->modify("+$i months");
        $ay = (int)$tarih->format('m');
        $yil = (int)$tarih->format('Y');
        $ayAdi = $tarih->format('F Y');
        
        // Bu ay için ödemeleri al
        $stmt = $conn->prepare("
            SELECT SUM(op.tutar) as toplam_gelir, COUNT(*) as odeme_sayisi
            FROM ogrenci_odemeler op
            INNER JOIN ogrenciler o ON op.ogrenci_id = o.id
            WHERE o.ogretmeni = ? AND op.ay = ? AND op.yil = ?
        ");
        $stmt->execute([$teacherName, $ay, $yil]);
        $result = $stmt->fetch(PDO::FETCH_ASSOC);
        
        $aylikGelirler[] = [
            'ay' => $ay,
            'yil' => $yil,
            'ay_adi' => $ayAdi,
            'toplam_gelir' => (float)($result['toplam_gelir'] ?? 0),
            'odeme_sayisi' => (int)($result['odeme_sayisi'] ?? 0)
        ];
    }
    
    // Toplam gelir hesapla
    $toplamGelir = array_sum(array_column($aylikGelirler, 'toplam_gelir'));
    
    // Son 12 ay ortalaması
    $son12AyOrtalama = $toplamGelir / 12;
    
    $data = [
        'aylik_gelirler' => $aylikGelirler,
        'toplam_gelir' => $toplamGelir,
        'son_12_ay_ortalama' => $son12AyOrtalama
    ];
    
    successResponse($data, 'Aylık gelir özeti başarıyla getirildi');
    
} catch (PDOException $e) {
    error_log("DB error: " . $e->getMessage());
    errorResponse('Veritabanı hatası: ' . $e->getMessage(), 500);
} catch (Exception $e) {
    error_log("General error: " . $e->getMessage());
    errorResponse('Beklenmeyen bir hata oluştu: ' . $e->getMessage(), 500);
}
?>
