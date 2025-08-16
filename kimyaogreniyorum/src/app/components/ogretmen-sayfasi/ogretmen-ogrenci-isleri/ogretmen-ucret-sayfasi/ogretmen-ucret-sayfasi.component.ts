import { Component, OnInit } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { ToastrService } from 'ngx-toastr';

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
    this.loadPaymentData();
    this.loadIncomeOverview();
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

  loadPaymentData(): void {
    this.isLoading = true;
    const headers = this.getAuthHeaders();

    console.log('API çağrısı yapılıyor...');

    this.http.get<any>('./server/api/ucret_yonetimi.php', { headers })
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

    const headers = this.getAuthHeaders();

    this.http.post('./server/api/ucret_yonetimi.php', this.paymentForm, { headers })
      .subscribe({
        next: (response: any) => {
          if (response && response.success) {
            this.toastr.success('Ödeme başarıyla kaydedildi!');
            this.closePaymentForm();
            this.loadPaymentData(); // Verileri yenile
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
    this.loadPaymentData();
  }

  getCollectionRate(): number {
    if (this.summary.totalExpected === 0) return 0;
    return (this.summary.totalReceived / this.summary.totalExpected) * 100;
  }

  loadIncomeOverview(): void {
    const headers = this.getAuthHeaders();

    console.log('Aylık gelir özeti yükleniyor...');

    this.http.get<any>('./server/api/aylik_gelir_ozeti.php', { headers })
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
}