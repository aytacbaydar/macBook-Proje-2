import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';

interface SinavSonucu {
  sinav_id: number;
  sinav_adi: string;
  sinav_turu: string;
  dogru_sayisi: number;
  yanlis_sayisi: number;
  bos_sayisi: number;
  net_sayisi: number;
  gonderim_tarihi: string;
  soru_sayisi?: number;
}

@Component({
  selector: 'app-ogrenci-sinav-sonuclari-sayfasi',
  standalone: false,
  templateUrl: './ogrenci-sinav-sonuclari-sayfasi.component.html',
  styleUrl: './ogrenci-sinav-sonuclari-sayfasi.component.scss'
})
export class OgrenciSinavSonuclariSayfasiComponent implements OnInit {
  sinavSonuclari: SinavSonucu[] = [];
  selectedSinav: SinavSonucu | null = null;
  loading = true;
  error: string | null = null;

  sinavTurleri: any = {
    'TYT': { color: '#667eea', label: 'TYT Deneme' },
    'AYT': { color: '#4facfe', label: 'AYT Deneme' },
    'TAR': { color: '#43e97b', label: 'Tarama Sınavı' },
    'TEST': { color: '#fa709a', label: 'Konu Testi' }
  };

  constructor(
    private http: HttpClient,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit() {
    // URL'den gelen sınav ID'sini kontrol et
    this.route.queryParams.subscribe(params => {
      const sinavId = params['sinavId'];
      this.loadAllSinavSonuclari(sinavId);
    });
  }

  loadAllSinavSonuclari(selectedSinavId?: number) {
    this.loading = true;
    this.error = null;

    // localStorage'dan öğrenci ID'sini al
    const userData = JSON.parse(localStorage.getItem('user') || '{}');
    const ogrenciId = userData.id;

    if (!ogrenciId) {
      this.error = 'Öğrenci bilgisi bulunamadı';
      this.loading = false;
      return;
    }

    this.http.get<any>(`./server/api/ogrenci_tum_sinav_sonuclari.php?ogrenci_id=${ogrenciId}`)
      .subscribe({
        next: (response) => {
          this.loading = false;
          if (response.success && response.data) {
            this.sinavSonuclari = response.data;

            // Eğer belirli bir sınav ID'si varsa, onu seç
            if (selectedSinavId) {
              this.selectedSinav = this.sinavSonuclari.find(s => s.sinav_id == selectedSinavId) || null;
            } else if (this.sinavSonuclari.length > 0) {
              // İlk sınavı varsayılan olarak seç
              this.selectedSinav = this.sinavSonuclari[0];
            }
          } else {
            this.error = response.message || 'Sınav sonucu bulunamadı';
          }
        },
        error: (error) => {
          this.loading = false;
          this.error = 'Sınav sonuçları yüklenirken hata oluştu: ' + error.message;
          console.error('Sınav sonuçları yükleme hatası:', error);
        }
      });
  }

  selectSinav(sinav: SinavSonucu) {
    this.selectedSinav = sinav;
    // Grafik güncelleme
    setTimeout(() => this.createChart(), 100);
  }

  getSinavTuruColor(sinavTuru: string): string {
    return this.sinavTurleri[sinavTuru]?.color || '#6c757d';
  }

  getSinavTuruLabel(sinavTuru: string): string {
    return this.sinavTurleri[sinavTuru]?.label || sinavTuru;
  }

  getSuccessPercentage(sinav: SinavSonucu): number {
    const totalQuestions = sinav.dogru_sayisi + sinav.yanlis_sayisi + sinav.bos_sayisi;
    if (totalQuestions === 0) return 0;
    return Math.round((sinav.dogru_sayisi / totalQuestions) * 100);
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('tr-TR');
  }

  createChart() {
    if (!this.selectedSinav) return;

    const ctx = document.getElementById('resultChart') as HTMLCanvasElement;
    if (!ctx) return;

    // Eski grafik varsa temizle
    const existingChart = (window as any).Chart.getChart(ctx);
    if (existingChart) {
      existingChart.destroy();
    }

    new (window as any).Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Doğru', 'Yanlış', 'Boş'],
        datasets: [{
          data: [
            this.selectedSinav.dogru_sayisi,
            this.selectedSinav.yanlis_sayisi,
            this.selectedSinav.bos_sayisi
          ],
          backgroundColor: ['#28a745', '#dc3545', '#6c757d'],
          borderWidth: 2,
          borderColor: '#fff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom'
          }
        }
      }
    });
  }

  retakeExam() {
    if (!this.selectedSinav) return;

    this.router.navigate(['/ogrenci-sayfasi/optik'], {
      queryParams: {
        sinavId: this.selectedSinav.sinav_id,
        sinavAdi: this.selectedSinav.sinav_adi,
        sinavTuru: this.selectedSinav.sinav_turu,
        soruSayisi: this.selectedSinav.soru_sayisi || (this.selectedSinav.dogru_sayisi + this.selectedSinav.yanlis_sayisi + this.selectedSinav.bos_sayisi)
      }
    });
  }

  analyzeResults() {
    // Gelecekte detaylı analiz sayfası için
    console.log('Detaylı analiz özelliği yakında eklenecek');
  }

  goBackToExams() {
    this.router.navigate(['/ogrenci-sayfasi/sinav-islemleri']);
  }
}