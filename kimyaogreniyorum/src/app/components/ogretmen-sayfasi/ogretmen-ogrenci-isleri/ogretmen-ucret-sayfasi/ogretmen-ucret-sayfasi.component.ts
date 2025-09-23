import { Component, OnInit } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { ToastrService } from 'ngx-toastr';
import { lastValueFrom, forkJoin } from 'rxjs';

interface Student {
  id: number;
  adi_soyadi: string;
  email: string;
  cep_telefonu: string;
  aktif: boolean;
  ucret: string;
  grubu?: string;
  okulu?: string;
  sinifi?: string;
  ders_sayisi?: number; // Haftalık ders sayısı
}

interface AttendanceRecord {
  id: number;
  ogrenci_id: number;
  ogretmen_id: number;
  grup: string;
  tarih: string;
  durum: string;
  zaman: string;
  yontem: string;
  ders_tipi: string;
}

interface Payment {
  id: number;
  ogrenci_id: number;
  tutar: number;
  odeme_tarihi: string;
  aciklama: string;
  ay: number;
  yil: number;
  ogrenci_adi: string;
}

interface PaymentSummary {
  totalExpected: number;
  totalReceived: number;
  studentsWhoPayThis: Student[];
  studentsWhoDidntPay: Student[];
  currentMonth: number;
  currentYear: number;
}

interface MonthlyAnalysis {
  year: number;
  month: number;
  monthName: string;
  expected: number;
  received: number;
  deficit: number;
  payments: Payment[];
  studentsWhoPaid: Student[];
  studentsWhoDidntPay: Student[];
  paymentCount: number;
  paidStudentCount: number;
  unpaidStudentCount: number;
}

interface YearlyTotals {
  totalExpected: number;
  totalReceived: number;
  totalDeficit: number;
}

interface MonthlyIncome {
  yil: number;
  ay: number;
  ay_adi: string;
  toplam_gelir: number;
  odeme_sayisi: number;
}

interface IncomeOverview {
  aylik_gelirler: MonthlyIncome[];
  toplam_gelir: number;
  son_12_ay_ortalama: number;
}

@Component({
  selector: 'app-ogretmen-ucret-sayfasi',
  standalone: false,
  templateUrl: './ogretmen-ucret-sayfasi.component.html',
  styleUrls: ['./ogretmen-ucret-sayfasi.component.scss']
})
export class OgretmenUcretSayfasiComponent implements OnInit {
  students: Student[] = [];
  payments: Payment[] = [];
  studentAttendanceData: { [studentId: number]: AttendanceRecord[] } = {};
  summary: PaymentSummary = {
    totalExpected: 0,
    totalReceived: 0,
    studentsWhoPayThis: [],
    studentsWhoDidntPay: [],
    currentMonth: new Date().getMonth() + 1,
    currentYear: new Date().getFullYear()
  };

  // Aylık gelir özeti için yeni özellikler
  incomeOverview: IncomeOverview = {
    aylik_gelirler: [],
    toplam_gelir: 0,
    son_12_ay_ortalama: 0
  };

  // Aylık detaylı analiz
  monthlyAnalysis: MonthlyAnalysis[] = [];
  yearlyTotals: YearlyTotals = {
    totalExpected: 0,
    totalReceived: 0,
    totalDeficit: 0
  };

  showPaymentForm = false;
  showMonthlyAnalysis = false;
  selectedStudent: Student | null = null;
  isLoading = true;
  error: string | null = null;

  paymentForm = {
    ogrenci_id: 0,
    tutar: 0,
    odeme_tarihi: new Date().toISOString().split('T')[0],
    aciklama: '',
    ay: new Date().getMonth() + 1,
    yil: new Date().getFullYear()
  };

  constructor(
    private http: HttpClient,
    private toastr: ToastrService
  ) {}

  ngOnInit(): void {
    this.loadAllData();
    this.loadIncomeOverview();
  }
  
  // Tüm verileri senkronize şekilde yükle
  loadAllData(): void {
    this.isLoading = true;
    const headers = this.getAuthHeaders();
    const teacherName = this.getTeacherName();
    
    if (!teacherName) {
      this.error = 'Öğretmen bilgisi bulunamadı';
      this.toastr.error(this.error);
      this.isLoading = false;
      return;
    }

    // Ana API'den tüm verileri al (hem öğrenci hem de ödeme verileri)
    console.log('=== API ÇAĞRI DEBUG ===');
    console.log('API URL:', './server/api/ogretmen_ucret_yonetimi.php');
    console.log('Öğretmen adı:', teacherName);
    console.log('Headers:', headers);
    
    this.http.get<any>('./server/api/ogretmen_ucret_yonetimi.php', { 
      headers,
      params: { ogretmen: teacherName }
    })
      .subscribe({
        next: (response) => {
          console.log('=== API RESPONSE DEBUG ===');
          console.log('Raw API Response:', response);
          console.log('Response success:', response?.success);
          console.log('Response data:', response?.data);
          
          if (response && response.success) {
            // Öğrenci verileri
            this.students = response.data.students || [];
            this.monthlyAnalysis = response.data.monthlyAnalysis || [];
            this.yearlyTotals = response.data.yearlyTotals || this.yearlyTotals;
            
            // Ödeme verileri (bu API'den gelen)
            this.studentPaymentsData = response.data.payments || [];
            
            console.log('=== VERİ PARSE DEBUG ===');
            console.log('Students array:', this.students);
            console.log('Yüklenen öğrenci sayısı:', this.students.length);
            console.log('StudentPaymentsData array:', this.studentPaymentsData);
            console.log('Yüklenen ödeme sayısı:', this.studentPaymentsData.length);
            console.log('Monthly analysis:', this.monthlyAnalysis);
            console.log('=== VERİ PARSE SON ===');
            
            // FIXED: Only set loading false after ALL async operations complete
            Promise.all([
              this.loadPaymentDataFromNew(),
              this.loadStudentAttendanceData()
            ]).then(() => {
              console.log('All payment and attendance data loaded, calculating final totals...');
              this.calculateCompleteSecondaryFromRealData();
              this.isLoading = false;
            }).catch(error => {
              console.error('Error loading additional data:', error);
              this.isLoading = false;
            });
          } else {
            console.error('=== API ERROR ===');
            console.error('Response:', response);
            this.error = 'Veriler yüklenemedi: ' + (response?.message || 'API başarısız response');
            this.toastr.error(this.error);
            this.isLoading = false;
          }
        },
      error: (error) => {
        console.error('Veri yükleme hatası:', error);
        this.error = 'Veriler yüklenemedi: ' + (error.message || 'Bilinmeyen hata');
        this.toastr.error(this.error);
        this.isLoading = false;
      }
    });
  }

  private getAuthHeaders(): HttpHeaders {
    let token = '';
    const userStr = localStorage.getItem('user') || sessionStorage.getItem('user');
    if (userStr) {
      const user = JSON.parse(userStr);
      token = user.token || '';
    }

    return new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
  }

  private getTeacherName(): string | null {
    const userStr = localStorage.getItem('user') || sessionStorage.getItem('user');
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        return user.adi_soyadi || null;
      } catch (error) {
        console.error('User parse error:', error);
        return null;
      }
    }
    return null;
  }

  loadPaymentData(): void {
    this.isLoading = true;
    const headers = this.getAuthHeaders();

    // Öğretmen adını al
    const teacherName = this.getTeacherName();
    if (!teacherName) {
      this.error = 'Öğretmen bilgisi bulunamadı';
      this.toastr.error(this.error);
      this.isLoading = false;
      return;
    }

    console.log('API çağrısı yapılıyor...', 'Teacher:', teacherName);

    this.http.get<any>('./server/api/ogretmen_ucret_yonetimi.php', { 
      headers,
      params: { ogretmen: teacherName }
    })
      .subscribe({
        next: (response) => {
          console.log('API Response:', response);

          if (response && response.success) {
            this.students = response.data.students || [];
            this.payments = response.data.payments || [];
            this.summary = response.data.summary || this.summary;
            this.monthlyAnalysis = response.data.monthlyAnalysis || [];
            this.yearlyTotals = response.data.yearlyTotals || this.yearlyTotals;

            console.log('Yüklenen veriler:', {
              students: this.students.length,
              payments: this.payments.length,
              summary: this.summary,
              monthlyAnalysis: this.monthlyAnalysis.length,
              yearlyTotals: this.yearlyTotals
            });
          } else {
            console.error('API başarısız response:', response);
            this.error = 'Veri yüklenemedi: ' + (response?.message || 'Bilinmeyen hata');
            this.toastr.error(this.error);
          }
          this.isLoading = false;
        },
        error: (error) => {
          console.error('API Error:', error);
          this.error = 'Bağlantı hatası: ' + (error.message || 'Bilinmeyen hata');
          this.toastr.error(this.error);
          this.isLoading = false;
        }
      });
  }

  openPaymentForm(student?: Student): void {
    if (student) {
      this.selectedStudent = student;
      this.paymentForm.ogrenci_id = student.id;
      this.paymentForm.tutar = parseFloat(student.ucret || '0');
    } else {
      this.selectedStudent = null;
      this.paymentForm.ogrenci_id = 0;
      this.paymentForm.tutar = 0;
    }

    this.paymentForm.aciklama = '';
    this.paymentForm.odeme_tarihi = new Date().toISOString().split('T')[0];
    this.paymentForm.ay = new Date().getMonth() + 1;
    this.paymentForm.yil = new Date().getFullYear();

    this.showPaymentForm = true;
  }

  closePaymentForm(): void {
    this.showPaymentForm = false;
    this.selectedStudent = null;
  }

  submitPayment(): void {
    if (!this.paymentForm.ogrenci_id || !this.paymentForm.tutar) {
      this.toastr.error('Öğrenci ve tutar alanları zorunludur.');
      return;
    }

    const teacherName = this.getTeacherName();
    if (!teacherName) {
      this.toastr.error('Öğretmen bilgisi bulunamadı');
      return;
    }

    const headers = this.getAuthHeaders();
    const paymentData = {
      ...this.paymentForm,
      ogretmen: teacherName
    };

    this.http.post('./server/api/ogretmen_ucret_yonetimi.php', paymentData, { headers })
      .subscribe({
        next: (response: any) => {
          if (response && response.success) {
            this.toastr.success('Ödeme başarıyla kaydedildi!');
            this.closePaymentForm();
            this.loadAllData(); // Tüm verileri senkronize şekilde yenile
          } else {
            this.toastr.error('Ödeme kaydedilemedi: ' + (response?.message || 'Bilinmeyen hata'));
          }
        },
        error: (error) => {
          console.error('Ödeme kaydetme hatası:', error);
          this.toastr.error('Bağlantı hatası: ' + (error.message || 'Bilinmeyen hata'));
        }
      });
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: 'TRY'
    }).format(amount);
  }

  // parseFloat metodunu template'te kullanabilmek için
  parseFloat(value: string): number {
    return parseFloat(value);
  }

  // Template'te kullanılan metodlar
  loadData(): void {
    this.error = null;
    this.loadAllData(); // Tüm verileri senkronize şekilde yenile
  }

  getCollectionRate(): number {
    if (this.summary.totalExpected === 0) return 0;
    return (this.summary.totalReceived / this.summary.totalExpected) * 100;
  }

  // Öğrenci ödemelerini ogrenci_odemeler tablosundan yükle
  studentPaymentsData: Payment[] = []; // Gerçek ödeme verilerini burada tut

  loadIncomeOverview(): void {
    const headers = this.getAuthHeaders();
    const teacherName = this.getTeacherName();
    
    if (!teacherName) {
      this.toastr.error('Öğretmen bilgisi bulunamadı');
      return;
    }

    console.log('Aylık gelir özeti yükleniyor...', 'Teacher:', teacherName);

    this.http.get<any>('./server/api/aylik_gelir_ozeti.php', { 
      headers,
      params: { ogretmen: teacherName }
    })
      .subscribe({
        next: (response) => {
          console.log('Aylık gelir API response:', response);
          if (response && response.success) {
            this.incomeOverview = response.data;
            console.log('İncome overview yüklendi:', this.incomeOverview);
          } else {
            console.error('Aylık gelir API başarısız:', response);
            this.toastr.warning('Aylık gelir verileri yüklenemedi');
          }
        },
        error: (error) => {
          console.error('Aylık gelir özeti yüklenirken hata:', error);
          this.toastr.error('Aylık gelir verileri yüklenemedi: ' + error.message);
        }
      });
  }

  getHighestMonthlyIncome(): number {
    if (this.incomeOverview.aylik_gelirler.length === 0) return 0;
    return Math.max(...this.incomeOverview.aylik_gelirler.map(m => m.toplam_gelir));
  }

  isCurrentMonth(ay: number, yil: number): boolean {
    const now = new Date();
    return ay === (now.getMonth() + 1) && yil === now.getFullYear();
  }

  getCurrentMonthIncome(): string {
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    const currentMonthData = this.incomeOverview.aylik_gelirler.find(
      m => m.ay === currentMonth && m.yil === currentYear
    );

    return currentMonthData 
      ? this.formatCurrency(currentMonthData.toplam_gelir)
      : this.formatCurrency(0);
  }

  toggleMonthlyAnalysis(): void {
    this.showMonthlyAnalysis = !this.showMonthlyAnalysis;
  }

  getMonthlyCompletionRate(month: MonthlyAnalysis): number {
    if (month.expected === 0) return 0;
    return Math.round((month.received / month.expected) * 100);
  }

  getOverallCompletionRate(): number {
    if (this.yearlyTotals.totalExpected === 0) return 0;
    return Math.round((this.yearlyTotals.totalReceived / this.yearlyTotals.totalExpected) * 100);
  }

  // Tüm özet verilerini gerçek payment verilerinden hesapla
  private calculateCompleteSecondaryFromRealData() {
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();

    // Aktif ve ücreti 0'dan büyük öğrencileri al (tablo ile tutarlı)
    const activeStudents = this.students.filter(student => 
      student.aktif && parseFloat(student.ucret || '0') > 0
    );

    // Bu ayın gerçek ödemelerini filtrele (ogrenci_odemeler tablosundan)
    const currentMonthPayments = this.studentPaymentsData.filter(payment => {
      if (!payment || !payment.odeme_tarihi) return false;
      const paymentDate = new Date(payment.odeme_tarihi);
      return paymentDate.getMonth() + 1 === currentMonth && 
             paymentDate.getFullYear() === currentYear;
    });

    // Bu ay ödeme yapan aktif öğrencilerin ID'lerini al
    const paidStudentIds = [...new Set(currentMonthPayments.map(payment => payment.ogrenci_id))];

    // Aktif öğrencileri ödeme durumuna göre ayır
    this.summary.studentsWhoPayThis = activeStudents.filter(student => 
      paidStudentIds.includes(student.id)
    );

    this.summary.studentsWhoDidntPay = activeStudents.filter(student => 
      !paidStudentIds.includes(student.id)
    );

    // Toplam beklenen gelir hesapla (FIXED: consistent per-lesson pricing)
    this.summary.totalExpected = activeStudents.reduce((total, student) => {
      const monthlyFee = parseFloat(student.ucret || '0');
      const weeklyLessons = student.ders_sayisi || 1;
      const expectedMonthlyLessons = weeklyLessons * 4;
      const perLessonPrice = monthlyFee / expectedMonthlyLessons;
      const attendedLessons = this.getStudentAttendedLessonsCount(student);
      
      const expectedAmount = perLessonPrice * attendedLessons;
      console.log(`Summary: ${student.adi_soyadi} = ${monthlyFee}₺ / ${expectedMonthlyLessons} × ${attendedLessons} = ${expectedAmount}₺`);
      return total + expectedAmount;
    }, 0);

    // Toplam alınan gelir hesapla (bu ayın ödemeleri)
    this.summary.totalReceived = currentMonthPayments.reduce((total, payment) => 
      total + payment.tutar, 0
    );

    // Ay ve yıl bilgilerini güncelle
    this.summary.currentMonth = currentMonth;
    this.summary.currentYear = currentYear;

    // payments array'ini de güncelle (template'te kullanılıyor)
    this.payments = currentMonthPayments;
    
    console.log('Tam özet hesaplandı:', {
      activeStudents: activeStudents.length,
      studentsWhoPaid: this.summary.studentsWhoPayThis.length,
      studentsWhoDidntPay: this.summary.studentsWhoDidntPay.length,
      payments: this.payments.length,
      totalExpected: this.summary.totalExpected,
      totalReceived: this.summary.totalReceived,
      collectionRate: this.getCollectionRate()
    });
  }

  private calculateSummary() {
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();

    // Payments array kontrolü
    if (!Array.isArray(this.payments)) {
      this.payments = [];
    }

    // Students array kontrolü
    if (!Array.isArray(this.students)) {
      this.students = [];
    }

    // Bu ayın ödemelerini filtrele
    this.payments = this.payments.filter(payment => {
      if (!payment || !payment.odeme_tarihi) return false;

      const paymentDate = new Date(payment.odeme_tarihi);
      return paymentDate.getMonth() + 1 === currentMonth && 
             paymentDate.getFullYear() === currentYear;
    });

    // Bu ay ödeme yapan öğrencilerin ID'lerini al
    const paidStudentIds = this.payments.map(payment => payment.ogrenci_id);

    // Öğrencileri ödeme durumuna göre ayır
    this.summary.studentsWhoPayThis = this.students.filter(student => 
      paidStudentIds.includes(student.id)
    );

    this.summary.studentsWhoDidntPay = this.students.filter(student => 
      !paidStudentIds.includes(student.id)
    );
  }

  // Tablo hesaplama metodları
  getBirimUcret(student: Student): number {
    const monthlyFee = parseFloat(student.ucret || '0');
    const weeklyLessons = student.ders_sayisi || 1; // Haftalık ders sayısı
    const expectedMonthlyLessons = weeklyLessons * 4; // Aylık beklenen ders
    const perLessonPrice = monthlyFee / expectedMonthlyLessons; // Ders başına ücret
    
    console.log(`${student.adi_soyadi} pricing: ${monthlyFee}₺ / ${expectedMonthlyLessons} ders = ${perLessonPrice}₺/ders`);
    return perLessonPrice;
  }

  getStudentAttendedLessonsCount(student: Student): number {
    // Bu ayda öğrencinin katıldığı ders sayısını hesapla (ogrenci-ucret-sayfasi mantığı)
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth() + 1;
    const currentYear = currentDate.getFullYear();
    
    const attendanceRecords = this.studentAttendanceData[student.id] || [];
    
    console.log(`=== ${student.adi_soyadi} ATTENDANCE DEBUG ===`);
    console.log(`Öğrenci ID: ${student.id}`);
    console.log(`Bu ay: ${currentMonth}/${currentYear}`);
    console.log(`Ham attendance kayıt sayısı:`, attendanceRecords.length);
    console.log(`Ham attendance kayıtları:`, attendanceRecords);
    
    // Filtrelemeleri adım adım yapalım
    const presentRecords = attendanceRecords.filter(record => record.durum === 'present');
    console.log(`Present kayıt sayısı:`, presentRecords.length);
    
    const thisMonthRecords = presentRecords.filter(record => {
      const recordDate = new Date(record.tarih);
      const recordMonth = recordDate.getMonth() + 1;
      const recordYear = recordDate.getFullYear();
      console.log(`Kayıt: ${record.tarih} -> ${recordMonth}/${recordYear} (durum: ${record.durum}, ders_tipi: ${record.ders_tipi})`);
      return recordMonth === currentMonth && recordYear === currentYear;
    });
    console.log(`Bu ayın present kayıt sayısı:`, thisMonthRecords.length);
    
    const validLessonTypes = thisMonthRecords.filter(record => 
      !record.ders_tipi || record.ders_tipi === 'normal' || record.ders_tipi === 'ek_ders'
    );
    console.log(`Geçerli ders tipi kayıt sayısı:`, validLessonTypes.length);
    console.log(`Geçerli kayıtlar:`, validLessonTypes.map(r => `${r.tarih} (${r.ders_tipi || 'normal'})`));
    
    const thisMonthAttended = validLessonTypes.length;
    console.log(`SONUÇ - ${student.adi_soyadi} bu ay katıldığı ders sayısı:`, thisMonthAttended);
    console.log(`=== SON DEBUG ===`);
    
    // Eğer bu ay için attendance kaydı hiç yoksa, haftalık ders sayısı × 4 kullan
    if (attendanceRecords.length === 0) {
      const weeklyLessons = student.ders_sayisi || 2; // Default 2 haftalık
      const monthlyPlanned = weeklyLessons * 4;
      console.log(`${student.adi_soyadi} attendance kaydı yok, planlanan: ${weeklyLessons} × 4 = ${monthlyPlanned}`);
      return monthlyPlanned;
    }
    
    return thisMonthAttended;
  }

  getDersSayisi(student: Student): number {
    // Öğrencinin bu ay katıldığı ders sayısını hesapla
    const attendedLessons = this.getStudentAttendedLessonsCount(student);
    console.log(`${student.adi_soyadi} bu ay katıldığı ders sayısı:`, attendedLessons);
    return attendedLessons;
  }

  getOdemesiGerekenMiktar(student: Student): number {
    // Katıldığı ders sayısı × birim ücret (ogrenci-ucret-sayfasi mantığı)
    const birimUcret = this.getBirimUcret(student);
    const dersSayisi = this.getDersSayisi(student);
    return birimUcret * dersSayisi;
  }

  getOdedigiMiktar(student: Student): number {
    // Bu ayda öğrencinin ödediği miktar (ogrenci-ucret-sayfasi mantığı)
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth() + 1;
    const currentYear = currentDate.getFullYear();
    
    const studentPayments = this.studentPaymentsData
      .filter(payment => {
        if (!payment.odeme_tarihi) return false;
        const paymentDate = new Date(payment.odeme_tarihi);
        return payment.ogrenci_id === student.id &&
               paymentDate.getMonth() + 1 === currentMonth &&
               paymentDate.getFullYear() === currentYear;
      })
      .reduce((total, payment) => total + payment.tutar, 0);
      
    console.log(`${student.adi_soyadi} bu ay ödediği miktar:`, studentPayments);
    return studentPayments;
  }

  getKalanMiktar(student: Student): number {
    // Kalan borç = Beklenen ödeme - Yapılan ödemeler (ogrenci-ucret-sayfasi mantığı)
    const beklenen = this.getOdemesiGerekenMiktar(student);
    const odenen = this.getOdedigiMiktar(student);
    return beklenen - odenen;
  }

  getAllStudentsTableData(): Student[] {
    return this.students.filter(student => student.aktif && parseFloat(student.ucret || '0') > 0);
  }

  // Toplam hesaplama metodları
  getTotalOdemesiGereken(): number {
    return this.getAllStudentsTableData()
      .reduce((total, student) => total + this.getOdemesiGerekenMiktar(student), 0);
  }

  getTotalOdedigiMiktar(): number {
    return this.getAllStudentsTableData()
      .reduce((total, student) => total + this.getOdedigiMiktar(student), 0);
  }

  getTotalKalanMiktar(): number {
    return this.getAllStudentsTableData()
      .reduce((total, student) => total + this.getKalanMiktar(student), 0);
  }

  // Yeni API'den ödeme verilerini yükle
  private async loadPaymentDataFromNew(): Promise<void> {
    const headers = this.getAuthHeaders();
    
    console.log('=== ÖDEME API DEBUG ===');
    console.log('Ödeme API URL:', './server/api/ogretmen_odemeler.php');
    console.log('Headers sent (token masked):', { 
      Authorization: headers.get('Authorization') ? 'Bearer [MASKED]' : 'none' 
    });
    
    try {
      const response = await lastValueFrom(
        this.http.get<any>('./server/api/ogretmen_odemeler.php', { headers })
      );
      
      console.log('=== ÖDEME API RESPONSE ===');
      console.log('Raw Payment Response:', response);
      
      if (response && response.success) {
        // CRITICAL FIX: Payment.tutar'ları string'den number'a çevir
        this.studentPaymentsData = (response.data.all_payments || []).map((payment: any) => ({
          ...payment,
          tutar: Number(payment.tutar) || 0, // String'den number'a çevir
          ay: Number(payment.ay) || 0,
          yil: Number(payment.yil) || 0,
          ogrenci_id: Number(payment.ogrenci_id) || 0
        }));
        
        console.log('Yeni API\'den yüklenen ödeme sayısı:', this.studentPaymentsData.length);
        console.log('Ödeme verileri (number converted):', this.studentPaymentsData);
        
        // Bu ayın ödemelerini ayrı tut
        const currentMonthPayments = (response.data.current_month_payments || []).map((payment: any) => ({
          ...payment,
          tutar: Number(payment.tutar) || 0
        }));
        console.log('Bu ayın ödeme sayısı:', currentMonthPayments.length);
        
      } else {
        console.error('Ödeme API hatası:', response?.message);
        this.studentPaymentsData = [];
      }
    } catch (error) {
      console.error('Ödeme API çağrı hatası:', error);
      this.studentPaymentsData = [];
    }
    console.log('=== ÖDEME API SON ===');
  }

  // Her öğrenci için attendance verilerini yükle (ogrenci-ucret-sayfasi mantığı)
  private async loadStudentAttendanceData(): Promise<void> {
    if (!this.students || this.students.length === 0) {
      console.log('Öğrenci listesi boş, attendance verisi yüklenmedi');
      return;
    }

    const currentDate = new Date();
    const currentMonth = currentDate.getMonth() + 1;
    const currentYear = currentDate.getFullYear();
    
    // Bu ayın başlangıç ve bitiş tarihleri
    const startDate = new Date(currentYear, currentMonth - 1, 1);
    const endDate = new Date(currentYear, currentMonth, 0);
    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];

    console.log(`Attendance verilerini yüklüyorum: ${startDateStr} - ${endDateStr}`);

    const headers = this.getAuthHeaders();
    const requests = this.students.map(student => 
      this.http.get<any>('./server/api/devamsizlik_kayitlari.php', {
        headers,
        params: {
          ogrenci_id: student.id.toString(),
          baslangic_tarih: startDateStr,
          bitis_tarih: endDateStr
        }
      })
    );

    try {
      const responses = await lastValueFrom(forkJoin(requests));
      
      responses.forEach((response, index) => {
        const student = this.students[index];
        if (response && response.success && response.data) {
          this.studentAttendanceData[student.id] = response.data.kayitlar || [];
          console.log(`${student.adi_soyadi} attendance yüklendi:`, response.data.kayitlar?.length || 0);
        } else {
          this.studentAttendanceData[student.id] = [];
          console.log(`${student.adi_soyadi} attendance verisi yok`);
        }
      });
      
      console.log('Tüm attendance verileri yüklendi:', Object.keys(this.studentAttendanceData).length);
    } catch (error) {
      console.error('Attendance yükleme sırasında hata:', error);
      // Hata durumunda tüm öğrenciler için boş array ata
      this.students.forEach(student => {
        this.studentAttendanceData[student.id] = [];
      });
    }
  }
}