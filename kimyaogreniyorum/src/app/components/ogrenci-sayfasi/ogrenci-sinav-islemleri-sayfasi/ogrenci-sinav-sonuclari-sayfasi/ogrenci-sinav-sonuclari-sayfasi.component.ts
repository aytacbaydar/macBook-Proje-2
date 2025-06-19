
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';

interface SinavSonucu {
  sinav_id: number;
  ogrenci_id: number;
  sinav_adi: string;
  sinav_turu: string;
  soru_sayisi: number;
  dogru_sayisi: number;
  yanlis_sayisi: number;
  bos_sayisi: number;
  puan: number;
  yuzde: number;
  detaylar: any;
  gonderim_tarihi: string;
}

@Component({
  selector: 'app-ogrenci-sinav-sonuclari-sayfasi',
  standalone: false,
  templateUrl: './ogrenci-sinav-sonuclari-sayfasi.component.html',
  styleUrl: './ogrenci-sinav-sonuclari-sayfasi.component.scss'
})
export class OgrenciSinavSonuclariSayfasiComponent implements OnInit {
  sinavSonucu: SinavSonucu | null = null;
  loading = true;
  error: string | null = null;
  
  chartData: any = null;
  chartOptions: any = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom'
      }
    }
  };

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private http: HttpClient
  ) {}

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      const sinavId = parseInt(params['sinavId']) || 0;
      const ogrenciId = parseInt(params['ogrenciId']) || 0;
      
      if (!sinavId || !ogrenciId) {
        this.router.navigate(['/ogrenci/sinav-islemleri']);
        return;
      }
      
      this.loadSinavSonucu(sinavId, ogrenciId);
    });
  }

  loadSinavSonucu(sinavId: number, ogrenciId: number) {
    this.loading = true;
    this.error = null;

    this.http.get<any>(`./server/api/sinav_sonucu_getir.php?sinav_id=${sinavId}&ogrenci_id=${ogrenciId}`)
      .subscribe({
        next: (response) => {
          this.loading = false;
          if (response.success) {
            this.sinavSonucu = response.data;
            this.setupChart();
            console.log('Sınav sonucu yüklendi:', this.sinavSonucu);
          } else {
            this.error = response.message || 'Sınav sonucu yüklenirken hata oluştu.';
          }
        },
        error: (error) => {
          this.loading = false;
          this.error = 'Sunucu hatası: ' + (error.message || 'Bağlantı hatası');
          console.error('Sınav sonucu yükleme hatası:', error);
        }
      });
  }

  setupChart() {
    if (!this.sinavSonucu) return;

    this.chartData = {
      labels: ['Doğru', 'Yanlış', 'Boş'],
      datasets: [{
        data: [
          this.sinavSonucu.dogru_sayisi,
          this.sinavSonucu.yanlis_sayisi,
          this.sinavSonucu.bos_sayisi
        ],
        backgroundColor: [
          '#28a745',
          '#dc3545',
          '#ffc107'
        ],
        borderColor: [
          '#1e7e34',
          '#c82333',
          '#e0a800'
        ],
        borderWidth: 2
      }]
    };
  }

  getSinavTuruColor(): string {
    if (!this.sinavSonucu) return '#6c757d';
    
    const colors: { [key: string]: string } = {
      'TYT': '#667eea',
      'AYT': '#4facfe',
      'TAR': '#43e97b',
      'TEST': '#fa709a'
    };
    return colors[this.sinavSonucu.sinav_turu] || '#6c757d';
  }

  getPerformanceLevel(): { text: string, color: string, icon: string } {
    if (!this.sinavSonucu) return { text: 'Belirsiz', color: '#6c757d', icon: 'bi-question' };
    
    const yuzde = this.sinavSonucu.yuzde;
    
    if (yuzde >= 85) return { text: 'Mükemmel', color: '#28a745', icon: 'bi-trophy-fill' };
    if (yuzde >= 70) return { text: 'İyi', color: '#20c997', icon: 'bi-hand-thumbs-up-fill' };
    if (yuzde >= 55) return { text: 'Orta', color: '#ffc107', icon: 'bi-hand-thumbs-up' };
    if (yuzde >= 40) return { text: 'Geliştirilmeli', color: '#fd7e14', icon: 'bi-exclamation-triangle-fill' };
    return { text: 'Yetersiz', color: '#dc3545', icon: 'bi-x-circle-fill' };
  }

  getQuestionStatus(soruNo: number): { status: string, color: string, icon: string } {
    if (!this.sinavSonucu?.detaylar) return { status: 'bilinmiyor', color: '#6c757d', icon: 'bi-question' };
    
    const soru = this.sinavSonucu.detaylar[`soru${soruNo}`];
    if (!soru) return { status: 'bilinmiyor', color: '#6c757d', icon: 'bi-question' };
    
    if (soru.durum === 'dogru') return { status: 'doğru', color: '#28a745', icon: 'bi-check-circle-fill' };
    if (soru.durum === 'yanlis') return { status: 'yanlış', color: '#dc3545', icon: 'bi-x-circle-fill' };
    return { status: 'boş', color: '#ffc107', icon: 'bi-dash-circle-fill' };
  }

  getSorular(): number[] {
    if (!this.sinavSonucu) return [];
    return Array(this.sinavSonucu.soru_sayisi).fill(0).map((_, i) => i + 1);
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleString('tr-TR');
  }

  goBackToExams() {
    this.router.navigate(['/ogrenci/sinav-islemleri']);
  }

  retakeExam() {
    if (!this.sinavSonucu) return;
    
    this.router.navigate(['/ogrenci/sinav-islemleri/optik'], {
      queryParams: {
        sinavId: this.sinavSonucu.sinav_id,
        sinavAdi: this.sinavSonucu.sinav_adi,
        sinavTuru: this.sinavSonucu.sinav_turu,
        soruSayisi: this.sinavSonucu.soru_sayisi
      }
    });
  }
}
