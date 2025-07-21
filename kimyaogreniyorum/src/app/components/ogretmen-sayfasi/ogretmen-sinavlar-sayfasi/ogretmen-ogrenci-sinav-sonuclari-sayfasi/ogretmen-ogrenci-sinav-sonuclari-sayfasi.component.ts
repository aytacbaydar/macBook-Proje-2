import { Component, OnInit } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';

interface SinavSonucu {
  id: number;
  sinav_id: number;
  ogrenci_id: number;
  ogrenci_adi: string;
  sinav_adi: string;
  sinav_turu: string;
  soru_sayisi: number;
  dogru_sayisi: number;
  yanlis_sayisi: number;
  bos_sayisi: number;
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
  selectedSinav: Sinav | null = null;
  studentResults: SinavSonucu[] = [];
  loading = false;
  loadingResults = false;
  error = '';

  private apiUrl = 'server/api';

  constructor(private http: HttpClient) { }

  ngOnInit(): void {
    this.loadSinavlar();
  }

  loadSinavSonuclari(): void {
    this.loadSinavlar();
  }

  trackBySinavId(index: number, sinav: any): any {
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

  trackByStudentResult(index: number, result: any): any {
    return result.id || index;
  }

  loadSinavlar() {
    this.loading = true;
    this.error = '';

    const headers = this.getAuthHeaders();

    this.http.get<any>(`${this.apiUrl}/cevap-anahtarlari-listele.php`, { headers })
      .subscribe({
        next: (response) => {
          if (response.success) {
            this.sinavlar = response.data.map((item: any) => ({
              id: item.id,
              sinav_adi: item.sinav_adi,
              sinav_turu: item.sinav_turu,
              soru_sayisi: item.soru_sayisi,
              tarih: item.olusturma_tarihi,
              katilimci_sayisi: 0
            }));
          } else {
            this.error = response.message || 'Sınavlar yüklenirken hata oluştu';
          }
          this.loading = false;
        },
        error: (error) => {
          console.error('Sınavlar yüklenirken hata:', error);
          this.error = 'Sınavlar yüklenirken hata oluştu';
          this.loading = false;
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
          if (response.success) {
            this.studentResults = response.data;
            // Katılımcı sayısını güncelle
            if (this.selectedSinav) {
              this.selectedSinav.katilimci_sayisi = this.studentResults.length;
            }
          } else {
            console.error('Sonuç yüklenirken hata:', response.message);
          }
          this.loadingResults = false;
        },
        error: (error) => {
          console.error('Sonuçlar yüklenirken hata:', error);
          this.loadingResults = false;
        }
      });
  }

  calculateAverageNet(): number {
    if (this.studentResults.length === 0) return 0;
    const totalNet = this.studentResults.reduce((sum, result) => sum + result.net_sayisi, 0);
    return totalNet / this.studentResults.length;
  }

  getHighestNet(): number {
    if (this.studentResults.length === 0) return 0;
    return Math.max(...this.studentResults.map(result => result.net_sayisi));
  }

  getPercentageColor(percentage: number): string {
    if (percentage >= 80) return '#28a745'; // Green
    if (percentage >= 60) return '#ffc107'; // Yellow
    if (percentage >= 40) return '#fd7e14'; // Orange
    return '#dc3545'; // Red
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

  trackByStudentResult(index: number, result: SinavSonucu): number {
    return result.id;
  }

  private getAuthHeaders(): HttpHeaders {
    const token = localStorage.getItem('token');
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
  }
}