
import { Component, OnInit } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';

interface Sinav {
  id: number;
  sinav_adi: string;
  sinav_turu: string;
  soru_sayisi: number;
  tarih: string;
  katilimci_sayisi?: number;
}

interface SinavSonuc {
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

@Component({
  selector: 'app-ogretmen-ogrenci-sinav-sonuclari-sayfasi',
  standalone: false,
  templateUrl: './ogretmen-ogrenci-sinav-sonuclari-sayfasi.component.html',
  styleUrl: './ogretmen-ogrenci-sinav-sonuclari-sayfasi.component.scss'
})
export class OgretmenOgrenciSinavSonuclariSayfasiComponent implements OnInit {
  sinavlar: Sinav[] = [];
  selectedSinav: Sinav | null = null;
  studentResults: SinavSonuc[] = [];
  loading = false;
  loadingResults = false;
  error: string | null = null;

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.loadSinavSonuclari();
  }

  loadSinavSonuclari(): void {
    this.loading = true;
    this.error = null;

    const headers = this.getAuthHeaders();

    this.http.get<any>('server/api/cevap-anahtarlari-listele.php', { headers })
      .subscribe({
        next: (response) => {
          this.loading = false;
          if (response.success) {
            this.sinavlar = response.data || [];
            this.loadKatilimciSayilari();
          } else {
            this.error = response.message || 'Sınavlar yüklenirken hata oluştu';
          }
        },
        error: (error) => {
          this.loading = false;
          this.error = 'Sınavlar yüklenirken hata oluştu: ' + (error.message || 'Bilinmeyen hata');
          console.error('Sınavlar yükleme hatası:', error);
        }
      });
  }

  loadKatilimciSayilari(): void {
    this.sinavlar.forEach(sinav => {
      this.http.get<any>(`server/api/sinav_sonucu_getir.php?sinav_id=${sinav.id}&get_count=true`, 
        { headers: this.getAuthHeaders() })
        .subscribe({
          next: (response) => {
            if (response.success) {
              sinav.katilimci_sayisi = response.count || 0;
            }
          },
          error: (error) => {
            console.error(`Sınav ${sinav.id} katılımcı sayısı alınamadı:`, error);
          }
        });
    });
  }

  selectSinav(sinav: Sinav): void {
    this.selectedSinav = sinav;
    this.loadSinavResults(sinav.id);
  }

  loadSinavResults(sinavId: number): void {
    this.loadingResults = true;
    this.studentResults = [];

    const headers = this.getAuthHeaders();

    this.http.get<any>(`server/api/ogretmen_sinav_sonuclari.php?sinav_id=${sinavId}`, { headers })
      .subscribe({
        next: (response) => {
          this.loadingResults = false;
          if (response.success) {
            this.studentResults = response.data || [];
            // Net sayısına göre sırala (büyükten küçüğe)
            this.studentResults.sort((a, b) => b.net_sayisi - a.net_sayisi);
          } else {
            console.error('Sınav sonuçları yüklenirken hata:', response.message);
          }
        },
        error: (error) => {
          this.loadingResults = false;
          console.error('Sınav sonuçları yükleme hatası:', error);
        }
      });
  }

  getAuthHeaders(): HttpHeaders {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
  }

  trackBySinavId(index: number, sinav: Sinav): number {
    return sinav.id;
  }

  trackByStudentResult(index: number, result: SinavSonuc): number {
    return result.id;
  }

  getExamTypeColor(sinavTuru: string): string {
    const colors: { [key: string]: string } = {
      'genel_tekrar': 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      'konu_testi': 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
      'deneme_sinavi': 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
      'odev': 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
      'quiz': 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)'
    };
    return colors[sinavTuru] || 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
  }

  getExamTypeIcon(sinavTuru: string): string {
    const icons: { [key: string]: string } = {
      'genel_tekrar': 'bi-arrow-repeat',
      'konu_testi': 'bi-file-text',
      'deneme_sinavi': 'bi-clipboard-check',
      'odev': 'bi-journal-bookmark',
      'quiz': 'bi-lightning'
    };
    return icons[sinavTuru] || 'bi-file-text';
  }

  getExamTypeLabel(sinavTuru: string): string {
    const labels: { [key: string]: string } = {
      'genel_tekrar': 'Genel Tekrar',
      'konu_testi': 'Konu Testi',
      'deneme_sinavi': 'Deneme Sınavı',
      'odev': 'Ödev',
      'quiz': 'Quiz'
    };
    return labels[sinavTuru] || 'Bilinmeyen';
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
      hour: '2-digit',
      minute: '2-digit'
    };
    return date.toLocaleDateString('tr-TR', options);
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

  getRankClass(index: number): string {
    if (index === 0) return 'gold';
    if (index === 1) return 'silver';
    if (index === 2) return 'bronze';
    return 'regular';
  }

  getPercentageColor(percentage: number): string {
    if (percentage >= 80) return 'linear-gradient(135deg, #28a745, #20c997)';
    if (percentage >= 60) return 'linear-gradient(135deg, #ffc107, #fd7e14)';
    if (percentage >= 40) return 'linear-gradient(135deg, #fd7e14, #dc3545)';
    return 'linear-gradient(135deg, #dc3545, #6f42c1)';
  }
}
