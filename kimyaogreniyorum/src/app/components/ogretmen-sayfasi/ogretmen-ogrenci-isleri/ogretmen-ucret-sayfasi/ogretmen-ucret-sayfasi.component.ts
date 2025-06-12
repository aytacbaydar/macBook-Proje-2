import { Component, OnInit } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { ToastrService } from 'ngx-toastr';

interface Student {
  id: number;
  adi_soyadi: string;
  email: string;
  aktif: boolean;
  ucret?: string;
  ders_gunu?: string;
  ders_saati?: string;
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
  yearlyTotal: number;
  studentsWhoPayThis: Student[];
  studentsWhoDidntPay: Student[];
  currentMonth: number;
  currentYear: number;
}

@Component({
  selector: 'app-ogretmen-ucret-sayfasi',
  standalone: false,
  templateUrl: './ogretmen-ucret-sayfasi.component.html',
  styleUrl: './ogretmen-ucret-sayfasi.component.scss'
})
export class OgretmenUcretSayfasiComponent implements OnInit {

  students: Student[] = [];
  payments: Payment[] = [];
  summary: PaymentSummary = {
    totalExpected: 0,
    totalReceived: 0,
    yearlyTotal: 0,
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

  constructor(
    private http: HttpClient,
    private toastr: ToastrService
  ) { }

  ngOnInit(): void {
    this.loadPaymentData();
  }

  private getAuthHeaders() {
    const userStr = localStorage.getItem('user') || sessionStorage.getItem('user');
    console.log('Getting auth headers, userStr exists:', !!userStr);

    if (!userStr) {
      console.error('No user data found - redirecting to login');
      this.redirectToLogin();
      return {};
    }

    try {
      const user = JSON.parse(userStr);
      console.log('User data parsed, has token:', !!user.token);

      if (!user.token) {
        console.error('No token found in user data - redirecting to login');
        this.redirectToLogin();
        return {};
      }

      console.log('Token found:', user.token.substring(0, 10) + '...');

      return {
        'Authorization': `Bearer ${user.token}`,
        'Content-Type': 'application/json'
      };
    } catch (error) {
      console.error('Error parsing user data:', error);
      this.redirectToLogin();
      return {};
    }
  }

  private redirectToLogin() {
    // Clear invalid session data
    localStorage.removeItem('user');
    sessionStorage.removeItem('user');

    // Show user-friendly message
    alert('Oturum süresi dolmuş. Lütfen tekrar giriş yapın.');

    // Redirect to login page
    window.location.href = '/';
  }

  loadPaymentData(): void {
    this.isLoading = true;
    this.error = null;

    // API URL'ini düzelt
    const apiUrl = 'https://www.kimyaogreniyorum.com/server/api/ogretmen_ucret_yonetimi';
    const token = localStorage.getItem('token');

    console.log('API URL:', apiUrl);
    console.log('Token mevcut:', !!token);

    if (!token) {
      this.error = 'Oturum süresi dolmuş. Lütfen tekrar giriş yapın.';
      this.isLoading = false;
      return;
    }

    const headers = this.getAuthHeaders();

    this.http.get<any>('./server/api/ogretmen_ucret_yonetimi', { headers })
      .subscribe({
        next: (response) => {
          console.log('API Response:', response);
          if (response && response.success) {
            this.students = response.students || [];
            this.payments = response.payments || [];
            this.summary = response.summary || {};
          } else {
            this.error = response?.message || 'Veri yüklenirken hata oluştu.';
          }
          this.isLoading = false;
        },
        error: (error) => {
          console.error('Full API Error:', error);
          console.error('Error status:', error.status);
          console.error('Error body:', error.error);

          let errorMessage = 'Sunucu hatası: ';

          if (error.status === 200 && error.error && error.error.text) {
            // Status 200 ama JSON parse hatası - HTML gelmiş
            errorMessage += 'Sunucu JSON yerine HTML döndürdü. PHP hatası olabilir.';
            console.error('HTML Response:', error.error.text.substring(0, 500));
          } else if (error.status === 0) {
            errorMessage += 'Sunucuya bağlanılamadı. Ağ bağlantınızı kontrol edin.';
          } else if (error.status === 500) {
            errorMessage += 'Sunucu iç hatası. Lütfen daha sonra tekrar deneyin.';
          } else if (error.status === 404) {
            errorMessage += 'API endpoint bulunamadı.';
          } else if (error.error) {
            if (typeof error.error === 'string') {
              // HTML yanıt gelmiş olabilir
              if (error.error.includes('<html>') || error.error.includes('<!DOCTYPE')) {
                errorMessage += 'Sunucu HTML yanıtı döndürdü (PHP hatası olabilir)';
              } else {
                errorMessage += error.error;
              }
            } else if (error.error.message) {
              errorMessage += error.error.message;
            } else {
              errorMessage += 'Bilinmeyen hata';
            }
          } else {
            errorMessage += error.message || 'Bilinmeyen hata';
          }

          this.error = errorMessage;
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
    this.paymentForm.ay = this.selectedMonth;
    this.paymentForm.yil = this.selectedYear;

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
    console.log('Sending payment with headers:', headers);

    this.http.post<any>('./server/api/ogretmen_ucret_yonetimi', this.paymentForm, { headers })
      .subscribe({
        next: (response) => {
          console.log('Payment save response:', response);
          if (response && response.success) {
            this.toastr.success('Ödeme kaydı başarıyla eklendi.');
            this.closePaymentForm();
            this.loadPaymentData();
          } else {
            this.toastr.error(response?.message || 'Ödeme kaydı eklenirken hata oluştu.');
          }
        },
        error: (error) => {
          console.error('Payment Save Error Details:', error);

          let errorMessage = 'Ödeme kaydedilirken hata oluştu: ';

          if (error.status === 0) {
            errorMessage += 'Sunucuya bağlanılamadı.';
          } else if (error.error) {
            if (typeof error.error === 'string' && error.error.includes('<html>')) {
              errorMessage += 'Sunucu PHP hatası döndürdü';
            } else {
              errorMessage += error.error?.message || error.error || error.message;
            }
          } else {
            errorMessage += error.message || 'Bilinmeyen hata';
          }

          this.toastr.error(errorMessage);
        }
      });
  }

  getMonthName(monthNumber: number): string {
    const month = this.months.find(m => m.value === monthNumber);
    return month ? month.name : monthNumber.toString();
  }

  getStudentById(id: number): Student | undefined {
    return this.students.find(s => s.id === id);
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: 'TRY'
    }).format(amount);
  }

  parseFloat(value: string): number {
    return parseFloat(value);
  }

  getCollectionRate(): number {
    if (this.summary.totalExpected === 0) return 0;
    return (this.summary.totalReceived / this.summary.totalExpected) * 100;
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