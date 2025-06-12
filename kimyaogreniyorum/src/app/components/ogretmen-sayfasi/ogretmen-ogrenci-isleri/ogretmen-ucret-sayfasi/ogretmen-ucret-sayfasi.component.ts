import { Component, OnInit } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { ToastrService } from 'ngx-toastr';

interface Student {
  id: number;
  adi_soyadi: string;
  email: string;
  aktif: boolean;
  ucret?: string;
  grubu?: string;
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

@Component({
  selector: 'app-ogretmen-ucret-sayfasi',
  standalone: false,
  templateUrl: './ogretmen-ucret-sayfasi.component.html',
  styleUrl: './ogretmen-ucret-sayfasi.component.scss',
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

  isLoading: boolean = true;
  error: string | null = null;

  // Form variables
  showPaymentForm: boolean = false;
  selectedStudent: Student | null = null;
  paymentForm = {
    ogrenci_id: 0,
    tutar: 0,
    aciklama: '',
    odeme_tarihi: new Date().toISOString().split('T')[0],
    ay: new Date().getMonth() + 1,
    yil: new Date().getFullYear()
  };

  // Filter variables
  selectedMonth: number = new Date().getMonth() + 1;
  selectedYear: number = new Date().getFullYear();

  months = [
    { value: 1, name: 'Ocak' },
    { value: 2, name: 'Şubat' },
    { value: 3, name: 'Mart' },
    { value: 4, name: 'Nisan' },
    { value: 5, name: 'Mayıs' },
    { value: 6, name: 'Haziran' },
    { value: 7, name: 'Temmuz' },
    { value: 8, name: 'Ağustos' },
    { value: 9, name: 'Eylül' },
    { value: 10, name: 'Ekim' },
    { value: 11, name: 'Kasım' },
    { value: 12, name: 'Aralık' }
  ];

  constructor(private http: HttpClient, private toastr: ToastrService) { }

  ngOnInit(): void {
    this.loadData();
    this.loadStudentsForPayment();
  }

  loadStudentsForPayment(): void {
    const headers = this.getAuthHeaders();

    if (!headers || Object.keys(headers).length === 0) {
      return;
    }

    // Öğretmenin öğrencilerini getir
    this.http.get<any>('./server/api/ogrenciler_listesi.php', { headers })
      .subscribe({
        next: (response) => {
          if (response && response.success) {
            // Sadece öğrencileri filtrele (öğretmenleri değil)
            this.students = response.data.filter((student: any) => student.rutbe === 'ogrenci');
            console.log('Payment form için öğrenciler yüklendi:', this.students.length);
          } else {
            console.error('Öğrenci listesi alınamadı:', response?.message);
          }
        },
        error: (error) => {
          console.error('Öğrenci listesi yüklenirken hata:', error);
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

  loadData(): void {
    this.isLoading = true;
    this.error = null;

    const headers = this.getAuthHeaders();

    this.http.get<any>('./server/api/ucret_yonetimi.php', { headers })
      .subscribe({
        next: (response) => {
          console.log('API Response:', response);
          if (response && response.success) {
            this.students = response.data.students || [];
            this.payments = response.data.payments || [];
            this.summary = response.data.summary || this.summary;

            console.log('Loaded data:', {
              studentsCount: this.students.length,
              paymentsCount: this.payments.length,
              summary: this.summary
            });
          } else {
            this.error = response?.message || 'Veri yüklenirken hata oluştu.';
          }
          this.isLoading = false;
        },
        error: (error) => {
          console.error('API Error:', error);
          this.error = 'Veriler yüklenirken hata oluştu: ' + (error.error?.message || error.message);
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

    this.http.post<any>('./server/api/ucret_yonetimi.php', this.paymentForm, { headers })
      .subscribe({
        next: (response) => {
          console.log('Payment save response:', response);
          if (response && response.success) {
            this.toastr.success('Ödeme kaydı başarıyla eklendi.');
            this.closePaymentForm();
            this.loadData(); // Verileri yenile
          } else {
            this.toastr.error('Ödeme kaydı eklenirken hata oluştu: ' + (response?.message || 'Bilinmeyen hata'));
          }
        },
        error: (error) => {
          console.error('Payment Save Error:', error);
          this.toastr.error('Ödeme kaydedilirken hata oluştu: ' + (error.error?.message || error.message));
        }
      });
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: 'TRY'
    }).format(amount);
  }

  getCollectionRate(): number {
    if (this.summary.totalExpected === 0) return 0;
    return (this.summary.totalReceived / this.summary.totalExpected) * 100;
  }

  getStudentById(id: number): Student | undefined {
    return this.students.find(s => s.id === id);
  }

  getMonthName(monthNumber: number): string {
    const month = this.months.find(m => m.value === monthNumber);
    return month ? month.name : monthNumber.toString();
  }

  parseFloat(value: string): number {
    return parseFloat(value);
  }

  getActiveStudentsCount(): number {
    return this.students.filter(s => s.aktif && s.ucret).length;
  }

  getTotalExpectedMonthly(): number {
    return this.students
      .filter(s => s.aktif && s.ucret)
      .reduce((total, s) => total + parseFloat(s.ucret || '0'), 0);
  }
}