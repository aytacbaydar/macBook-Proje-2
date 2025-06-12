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

  showPaymentForm = false;
  selectedStudent: Student | null = null;
  isLoading = true;

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
  }

  private getAuthHeaders(): HttpHeaders {
    // ogretmen-ogrenci-detay-sayfasi.component.ts'deki gibi
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

    this.http.get<any>('./server/api/ucret_yonetimi.php', { headers })
      .subscribe({
        next: (response) => {
          if (response && response.success) {
            this.students = response.data.students || [];
            this.payments = response.data.payments || [];
            this.summary = response.data.summary || this.summary;
            console.log('Ödeme verileri yüklendi:', response.data);
          } else {
            this.toastr.error('Veri yüklenemedi: ' + (response?.message || 'Bilinmeyen hata'));
          }
          this.isLoading = false;
        },
        error: (error) => {
          console.error('Veri yükleme hatası:', error);
          this.toastr.error('Bağlantı hatası: ' + (error.message || 'Bilinmeyen hata'));
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

  getCollectionRate(): number {
    if (this.summary.totalExpected === 0) return 0;
    return (this.summary.totalReceived / this.summary.totalExpected) * 100;
  }
}