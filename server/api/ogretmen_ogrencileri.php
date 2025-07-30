php
<?php
require_once '../config.php';

// Debug logging
error_log("ogretmen_ogrencileri.php called");

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    try {
        // Token doğrulama
        $headers = getallheaders();
        $authHeader = $headers['Authorization'] ?? '';

        error_log("Auth header: " . $authHeader);

        if (!$authHeader || !str_starts_with($authHeader, 'Bearer ')) {
            error_log("Missing or invalid auth header");
            errorResponse('Yetkilendirme token\'ı gerekli', 401);
            return;
        }

        $token = substr($authHeader, 7);
        $conn = getConnection();

        error_log("Token: " . substr($token, 0, 20) . "...");

        // Token'dan öğretmen bilgilerini al
        $stmt = $conn->prepare("SELECT id, adi_soyadi, rutbe FROM ogrenciler WHERE MD5(CONCAT(id, email, sifre)) = ? AND rutbe = 'ogretmen'");
        $stmt->execute([$token]);
        $teacher = $stmt->fetch(PDO::FETCH_ASSOC);

        error_log("Teacher query result: " . json_encode($teacher));

        if (!$teacher) {
            error_log("Teacher not found or invalid role");
            errorResponse('Geçersiz token veya yetki', 401);
            return;
        }

        $teacherName = $teacher['adi_soyadi'];
        $teacherId = $teacher['id'];

        error_log("Teacher name: " . $teacherName);
        error_log("Teacher ID: " . $teacherId);

        // Öğretmene ait öğrencileri bul - önce ogretmeni alanına göre
        $stmt = $conn->prepare("
            SELECT o.id, o.adi_soyadi, o.email, o.cep_telefonu, o.rutbe, o.aktif, o.avatar, o.created_at, o.ogretmeni,
                   ob.okulu, ob.sinifi, ob.grubu, ob.ders_gunu, ob.ders_saati, ob.ucret,
                   ob.veli_adi, ob.veli_cep
            FROM ogrenciler o
            LEFT JOIN ogrenci_bilgileri ob ON o.id = ob.ogrenci_id
            WHERE o.rutbe = 'ogrenci' AND o.ogretmeni = ?
            ORDER BY o.id DESC
        ");
        $stmt->execute([$teacherName]);

        $students = $stmt->fetchAll(PDO::FETCH_ASSOC);

        error_log("Students found by teacher name (" . $teacherName . "): " . count($students));

        // Eğer öğretmen adına göre bulamazsa, tüm öğrencileri kontrol et
        if (empty($students)) {
            error_log("No students found by teacher name, trying all students");

            $stmt = $conn->prepare("
                SELECT o.id, o.adi_soyadi, o.email, o.cep_telefonu, o.rutbe, o.aktif, o.avatar, o.created_at, o.ogretmeni,
                       ob.okulu, ob.sinifi, ob.grubu, ob.ders_gunu, ob.ders_saati, ob.ucret,
                       ob.veli_adi, ob.veli_cep
                FROM ogrenciler o
                LEFT JOIN ogrenci_bilgileri ob ON o.id = ob.ogrenci_id
                WHERE o.rutbe = 'ogrenci'
                ORDER BY o.id DESC
                LIMIT 50
            ");
            $stmt->execute();

            $allStudents = $stmt->fetchAll(PDO::FETCH_ASSOC);
            error_log("Total students in database: " . count($allStudents));

            // Debug: show first few students
            foreach (array_slice($allStudents, 0, 5) as $student) {
                error_log("Student: " . $student['adi_soyadi'] . ", Teacher: " . ($student['ogretmeni'] ?? 'NULL'));
            }
        }

        // Debug: log the students we're returning
        error_log("Returning " . count($students) . " students");
        foreach (array_slice($students, 0, 3) as $student) {
            error_log("Returning student: " . $student['adi_soyadi'] . " (ID: " . $student['id'] . ")");
        }

        successResponse($students);

    } catch (PDOException $e) {
        error_log("Database error: " . $e->getMessage());
        errorResponse('Veritabanı hatası: ' . $e->getMessage(), 500);
    } catch (Exception $e) {
        error_log("General error: " . $e->getMessage());
        errorResponse('Beklenmeyen bir hata oluştu: ' . $e->getMessage(), 500);
    }
} else {
    errorResponse('Bu endpoint sadece GET metodunu desteklemektedir', 405);
}
?>