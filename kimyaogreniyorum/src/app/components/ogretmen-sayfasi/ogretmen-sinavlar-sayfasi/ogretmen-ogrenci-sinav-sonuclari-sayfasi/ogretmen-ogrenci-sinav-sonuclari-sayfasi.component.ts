import { Component, OnInit } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';

interface SinavSonucu {
  id: number;
  ogrenci_id: number;
  ogrenci_adi: string;
  sinav_id: number;
  dogru_sayisi: number;
  yanlis_sayisi: number;
  bos_sayisi: number;
  net: number;
  net_sayisi: number;
  puan: number;
  yuzde: number;
  gonderim_tarihi: string;
}

interface Sinav {
  id: number;
  sinav_adi: string;
  sinav_turu: string;
  soru_sayisi: number;
  tarih: string;
  katilimci_sayisi?: number;
}

@Component({
  selector: 'app-ogretmen-ogrenci-sinav-sonuclari-sayfasi',
  templateUrl: './ogretmen-ogrenci-sinav-sonuclari-sayfasi.component.html',
  styleUrls: ['./ogretmen-ogrenci-sinav-sonuclari-sayfasi.component.scss'],
  standalone: false
})
export class OgretmenOgrenciSinavSonuclariSayfasiComponent implements OnInit {
  sinavlar: Sinav[] = [];
  studentResults: any[] = [];

  // Student detail modal properties
  showStudentDetailModal = false;
  selectedStudentResult: any = null;
  selectedStudentDetail: any = null;
  loadingStudentDetail = false;
  selectedSinav: Sinav | null = null;
  loading = false;
  loadingResults = false;
  error: string | null = null;
  studentQuestionDetails: any[] = [];

  private apiUrl = 'https://www.kimyaogreniyorum.com/server/api';

  constructor(private http: HttpClient) { }

  ngOnInit(): void {
    this.loadSinavlar();
  }

  loadSinavSonuclari(): void {
    this.loadSinavlar();
  }

  trackBySinavId(index: number, sinav: Sinav): any {
    return sinav.id || index;
  }

  getExamTypeColor(sinavTuru: string): string {
    const colorMap: { [key: string]: string } = {
      'TEST': 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
      'TAR': 'linear-gradient(135deg, #10b981 0%, #059669 100%)', 
      'TYT': 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
      'AYT': 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)'
    };
    return colorMap[sinavTuru] || 'linear-gradient(135deg, #6b7280 0%, #4b5563 100%)';
  }

  getExamTypeIcon(sinavTuru: string): string {
    const iconMap: { [key: string]: string } = {
      'TEST': 'bi bi-file-earmark-text',
      'TAR': 'bi bi-clock-history',
      'TYT': 'bi bi-mortarboard',
      'AYT': 'bi bi-trophy'
    };
    return iconMap[sinavTuru] || 'bi bi-file-earmark-text';
  }

  getExamTypeLabel(sinavTuru: string): string {
    const labelMap: { [key: string]: string } = {
      'TEST': 'Test',
      'TAR': 'Tarama',
      'TYT': 'TYT',
      'AYT': 'AYT'
    };
    return labelMap[sinavTuru] || 'Test';
  }

  getRankClass(index: number): string {
    if (index === 0) return 'gold';
    if (index === 1) return 'silver';
    if (index === 2) return 'bronze';
    return '';
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    const options: Intl.DateTimeFormatOptions = {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    };
    return date.toLocaleDateString('tr-TR', options);
  }

  formatDateTime(dateString: string): string {
    const date = new Date(dateString);
    const options: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    };
    return date.toLocaleDateString('tr-TR', options);
  }

  showStudentDetail(studentResult: any) {
    this.selectedStudentResult = studentResult;
    this.showStudentDetailModal = true;
    this.loadingStudentDetail = true;
    this.selectedStudentDetail = null;
    this.studentQuestionDetails = [];

    // Load student detail from API
    this.http.get<any>(`./server/api/sinav_detay_sonuc.php?sinav_id=${studentResult.sinav_id}&ogrenci_id=${studentResult.ogrenci_id}`)
      .subscribe({
        next: (response) => {
          this.loadingStudentDetail = false;
          if (response.success && response.data) {
            this.selectedStudentDetail = response.data;
            // Soru detayları zaten API'den geliyor
            if (response.data.sorular && response.data.sorular.length > 0) {
              this.studentQuestionDetails = response.data.sorular;
              console.log('Soru detayları yüklendi:', this.studentQuestionDetails);
            } else {
              console.warn('API\'den soru detayları gelmedi');
              this.studentQuestionDetails = [];
            }
            console.log('Student detail loaded:', this.selectedStudentDetail);
          } else {
            console.error('Failed to load student detail:', response.message);
          }
        },
        error: (error) => {
          this.loadingStudentDetail = false;
          console.error('Error loading student detail:', error);
        }
      });
  }

  closeStudentDetailModal() {
    this.showStudentDetailModal = false;
    this.selectedStudentResult = null;
    this.selectedStudentDetail = null;
    this.loadingStudentDetail = false;
    this.studentQuestionDetails = [];
  }

  openVideo(videoUrl: string) {
    if (videoUrl) {
      window.open(videoUrl, '_blank');
    }
  }

  calculateAverageNet(): number {
    if (this.studentResults.length === 0) return 0;
    const totalNet = this.studentResults.reduce((sum, result) => sum + result.net, 0);
    return totalNet / this.studentResults.length;
  }

  getHighestNet(): number {
    if (this.studentResults.length === 0) return 0;
    return Math.max(...this.studentResults.map(result => result.net));
  }

  getPercentageColor(yuzde: number): string {
    if (yuzde >= 85) return 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
    if (yuzde >= 70) return 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)';
    if (yuzde >= 50) return 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)';
    return 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)';
  }

  trackByStudentResult(index: number, result: SinavSonucu): number {
    return result.id || index;
  }

  loadSinavlar() {
    this.loading = true;
    this.error = null;

    const headers = this.getAuthHeaders();

    this.http.get<any>(`${this.apiUrl}/cevap-anahtarlari-listele.php`, { headers })
      .subscribe({
        next: (response) => {
          this.loading = false;
          if (response.success) {
            this.sinavlar = response.data || [];
          } else {
            this.error = response.message || 'Sınavlar yüklenirken hata oluştu';
            if (response.message === 'Yetkisiz erişim') {
              localStorage.removeItem('token');
              sessionStorage.removeItem('token');
              window.location.href = '/';
            }
          }
        },
        error: (error) => {
          this.loading = false;
          this.error = 'Sınavlar yüklenirken hata oluştu';
          console.error('Sınavlar yükleme hatası:', error);
          if (error.status === 401 || error.status === 403) {
            localStorage.removeItem('token');
            sessionStorage.removeItem('token');
            window.location.href = '/';
          }
        }
      });
  }

  selectSinav(sinav: Sinav) {
    this.selectedSinav = sinav;
    this.loadStudentResults(sinav.id);
  }

  loadStudentResults(sinavId: number) {
    this.loadingResults = true;
    this.studentResults = [];

    const headers = this.getAuthHeaders();

    this.http.get<any>(`${this.apiUrl}/ogretmen_sinav_sonuclari.php?sinav_id=${sinavId}`, { headers })
      .subscribe({
        next: (response) => {
          this.loadingResults = false;
          if (response.success) {
            this.studentResults = response.data || [];
          } else {
            this.error = response.message || 'Sonuçlar yüklenirken hata oluştu';
            if (response.message === 'Yetkisiz erişim') {
              localStorage.removeItem('token');
              sessionStorage.removeItem('token');
              window.location.href = '/';
            }
          }
        },
        error: (error) => {
          this.loadingResults = false;
          this.error = 'Sonuçlar yüklenirken hata oluştu';
          console.error('Sonuçlar yükleme hatası:', error);
          if (error.status === 401 || error.status === 403) {
            localStorage.removeItem('token');
            sessionStorage.removeItem('token');
            window.location.href = '/';
          }
        }
      });
  }

  private getAuthHeaders(): HttpHeaders {
    // Önce user bilgilerinden token al
    const userStr = localStorage.getItem('user') || sessionStorage.getItem('user');
    let token = '';

    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        token = user.token || '';
      } catch (error) {
        console.error('User bilgileri parse edilemedi:', error);
      }
    }

    // Eğer user'dan token alınamazsa, direkt token'ı kontrol et
    if (!token) {
      token = localStorage.getItem('token') || sessionStorage.getItem('token') || '';
    }

    if (!token) {
      console.error('Token bulunamadı - login sayfasına yönlendiriliyor');
      // Token yoksa login sayfasına yönlendir
      window.location.href = '/ogrenci-giris';
      return new HttpHeaders();
    }

    console.log('Token bulundu, Authorization header oluşturuluyor');
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
  }

  // Öğrenci soru detaylarını yükle
  loadStudentQuestionDetails(ogrenciId: number) {
    if (!this.selectedSinav) {
      return;
    }

    const headers = this.getAuthHeaders();

    // sinav_detay_sonuc.php API'sini kullan - bu zaten soru detaylarını da döndürüyor
    this.http.get<any>(`./server/api/sinav_detay_sonuc.php?sinav_id=${this.selectedSinav.id}&ogrenci_id=${ogrenciId}`, { headers })
      .subscribe({
        next: (response) => {
          if (response.success && response.data && response.data.sorular) {
            this.studentQuestionDetails = response.data.sorular;
            console.log('Soru detayları yüklendi:', this.studentQuestionDetails);
          } else {
            console.error('Soru detayları yüklenemedi:', response.message);
            this.studentQuestionDetails = [];
          }
        },
        error: (error) => {
          console.error('Soru detayları yükleme hatası:', error);
          this.studentQuestionDetails = [];
        }
      });
  }

  

  // Soru detayları için yardımcı metodlar
  getQuestionRowClass(soru: any): string {
    if (!soru.ogrenci_cevabi) {
      return 'table-warning'; // Boş cevap
    }
    return soru.ogrenci_cevabi === soru.dogru_cevap ? 'table-success' : 'table-danger';
  }

  getAnswerBadgeClass(ogrenciCevabi: string): string {
    if (!ogrenciCevabi) {
      return 'bg-warning text-dark';
    }
    return 'bg-primary';
  }

  getStatusBadgeClass(soru: any): string {
    if (!soru.ogrenci_cevabi) {
      return 'bg-warning text-dark';
    }
    return soru.ogrenci_cevabi === soru.dogru_cevap ? 'bg-success' : 'bg-danger';
  }

  getStatusIcon(soru: any): string {
    if (!soru.ogrenci_cevabi) {
      return 'bi bi-dash-circle';
    }
    return soru.ogrenci_cevabi === soru.dogru_cevap ? 'bi bi-check-circle' : 'bi bi-x-circle';
  }

  getStatusText(soru: any): string {
    if (!soru.ogrenci_cevabi) {
      return 'BOŞ';
    }
    return soru.ogrenci_cevabi === soru.dogru_cevap ? 'DOĞRU' : 'YANLIŞ';
  }

  // Net hesaplama metodu
  calculateNet(studentDetail: any): number {
    if (!studentDetail) return 0;
    return Math.max(0, studentDetail.dogru_sayisi - (studentDetail.yanlis_sayisi / 4));
  }
}