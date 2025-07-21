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
  studentResults: SinavSonucu[] = [];
  selectedSinav: Sinav | null = null;
  loading = false;
  loadingResults = false;
  error: string | null = null;

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
      'TEST': 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      'TAR': 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
      'TYT': 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
      'AYT': 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)'
    };
    return colorMap[sinavTuru] || 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
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
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    };
    return date.toLocaleDateString('tr-TR', options);
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

  getPercentageColor(percentage: number): string {
    if (percentage >= 80) return '#28a745';
    if (percentage >= 60) return '#ffc107';
    if (percentage >= 40) return '#fd7e14';
    return '#dc3545';
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
          }
        },
        error: (error) => {
          this.loading = false;
          this.error = 'Sınavlar yüklenirken hata oluştu';
          console.error('Sınavlar yükleme hatası:', error);
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
          }
        },
        error: (error) => {
          this.loadingResults = false;
          this.error = 'Sonuçlar yüklenirken hata oluştu';
          console.error('Sonuçlar yükleme hatası:', error);
        }
      });
  }

  private getAuthHeaders(): HttpHeaders {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
  }
}