
import { Component, OnInit, AfterViewInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { Chart } from 'chart.js/auto';

interface SinavSonucu {
  sinav_id: number;
  sinav_adi: string;
  sinav_turu: string;
  sinav_tarihi: string;
  dogru_sayisi: number;
  yanlis_sayisi: number;
  bos_sayisi: number;
  soru_sayisi: number;
}

interface DetaySinavSonucu {
  sinav_id: number;
  sinav_adi: string;
  sinav_turu: string;
  sinav_tarihi: string;
  dogru_sayisi: number;
  yanlis_sayisi: number;
  bos_sayisi: number;
  basari_yuzdesi: number;
  sorular: {
    soru_no: number;
    ogrenci_cevabi: string;
    dogru_cevap: string;
    konu_id?: number;
    is_correct: boolean;
    video_url?: string;
  }[];
}

@Component({
  selector: 'app-ogrenci-sinav-sonuclari-sayfasi',
  standalone: false,
  templateUrl: './ogrenci-sinav-sonuclari-sayfasi.component.html',
  styleUrl: './ogrenci-sinav-sonuclari-sayfasi.component.scss'
})
export class OgrenciSinavSonuclariSayfasiComponent implements OnInit, AfterViewInit {
  sinavSonuclari: SinavSonucu[] = [];
  selectedSinav: SinavSonucu | null = null;
  selectedSinavDetails: DetaySinavSonucu | null = null;
  loading = true;
  loadingDetails = false;
  error: string | null = null;
  chart: any;

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
    // URL'den gelen parametreleri kontrol et
    this.route.queryParams.subscribe(params => {
      const sinavId = params['sinavId'] ? parseInt(params['sinavId']) : undefined;
      this.loadAllSinavSonuclari(sinavId);
    });
  }

  ngAfterViewInit() {
    // Mini grafikler için timeout ekle
    setTimeout(() => {
      this.createMiniCharts();
    }, 500);
  }

  loadAllSinavSonuclari(selectedSinavId?: number) {
    this.loading = true;
    this.error = null;

    // localStorage veya sessionStorage'dan öğrenci ID'sini al
    const userStr = localStorage.getItem('user') || sessionStorage.getItem('user');

    if (!userStr) {
      this.loading = false;
      this.error = 'Kullanıcı oturum bilgisi bulunamadı';
      return;
    }

    let userData;
    try {
      userData = JSON.parse(userStr);
      console.log('User data parsed:', userData);
    } catch (error) {
      this.loading = false;
      this.error = 'Kullanıcı bilgileri ayrıştırılamadı';
      return;
    }

    const ogrenciId = userData.id;

    if (!ogrenciId) {
      this.loading = false;
      this.error = 'Öğrenci ID\'si bulunamadı';
      return;
    }

    console.log('Sınav sonuçları yükleniyor:', { ogrenciId, selectedSinavId });

    this.http.get<any>(`./server/api/ogrenci_tum_sinav_sonuclari.php?ogrenci_id=${ogrenciId}`).subscribe({
      next: (response) => {
        this.loading = false;
        if (response.success && response.data) {
          // Sınav sonuçları listesini al
          this.sinavSonuclari = response.data.sinav_sonuclari || [];

          console.log('Tüm sınav sonuçları yüklendi:', this.sinavSonuclari);

          // Eğer belirli bir sınav ID'si varsa, onu otomatik seç
          if (selectedSinavId) {
            const targetSinav = this.sinavSonuclari.find(s => s.sinav_id == selectedSinavId);
            if (targetSinav) {
              this.selectSinav(targetSinav);
            }
          }

          // Mini grafikler için timeout ekle
          setTimeout(() => {
            this.createMiniCharts();
          }, 100);
        } else {
          this.error = response.message || 'Henüz sınav sonucunuz bulunmuyor';
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
    this.loadingDetails = true;
    this.selectedSinav = sinav;

    // localStorage veya sessionStorage'dan öğrenci ID'sini al
    const userStr = localStorage.getItem('user') || sessionStorage.getItem('user');

    if (!userStr) {
      this.loadingDetails = false;
      console.error('Kullanıcı oturum bilgisi bulunamadı');
      return;
    }

    let userData;
    try {
      userData = JSON.parse(userStr);
    } catch (error) {
      this.loadingDetails = false;
      console.error('Kullanıcı bilgileri ayrıştırılamadı:', error);
      return;
    }

    const ogrenciId = userData.id;

    // Sınav detaylarını yükle (öğrenci cevapları + doğru cevaplar)
    this.http.get<any>(`./server/api/sinav_detay_sonuc.php?sinav_id=${sinav.sinav_id}&ogrenci_id=${ogrenciId}`).subscribe({
      next: (response) => {
        this.loadingDetails = false;
        if (response.success && response.data) {
          this.selectedSinavDetails = response.data;
          
          // Başarı yüzdesini hesapla
          if (this.selectedSinavDetails) {
            const total = this.selectedSinavDetails.dogru_sayisi + this.selectedSinavDetails.yanlis_sayisi + this.selectedSinavDetails.bos_sayisi;
            this.selectedSinavDetails.basari_yuzdesi = total > 0 ? Math.round((this.selectedSinavDetails.dogru_sayisi / total) * 100) : 0;
            
            // Sorulara is_correct property'sini ekle
            if (this.selectedSinavDetails.sorular) {
              this.selectedSinavDetails.sorular.forEach(soru => {
                soru.is_correct = soru.ogrenci_cevabi === soru.dogru_cevap;
              });
            }
          }
          
          console.log('Sınav detayları yüklendi:', this.selectedSinavDetails);

          // Grafik güncelleme
          setTimeout(() => this.createChart(), 100);
        } else {
          console.error('Sınav detayları yüklenemedi:', response.message);
        }
      },
      error: (error) => {
        this.loadingDetails = false;
        console.error('Sınav detayları yükleme hatası:', error);
      }
    });
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
    if (!this.selectedSinavDetails) return;

    const ctx = document.getElementById('resultChart') as HTMLCanvasElement;
    if (!ctx) return;

    // Destroy existing chart if it exists
    if (this.chart) {
      this.chart.destroy();
    }

    const dogru = this.selectedSinavDetails.dogru_sayisi;
    const yanlis = this.selectedSinavDetails.yanlis_sayisi;
    const bos = this.selectedSinavDetails.bos_sayisi;
    const total = dogru + yanlis + bos;

    this.chart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['Doğru', 'Yanlış', 'Boş'],
        datasets: [{
          label: 'Soru Sayısı',
          data: [dogru, yanlis, bos],
          backgroundColor: ['#28a745', '#dc3545', '#ffc107'],
          borderColor: ['#28a745', '#dc3545', '#ffc107'],
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            display: false
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            max: total,
            ticks: {
              stepSize: 1
            }
          }
        }
      }
    });
  }

  createMiniCharts() {
    this.sinavSonuclari.forEach((sinav, index) => {
      const canvasId = `miniChart-${index}`;
      const ctx = document.getElementById(canvasId) as HTMLCanvasElement;
      
      if (!ctx) return;

      const dogru = sinav.dogru_sayisi;
      const yanlis = sinav.yanlis_sayisi;
      const bos = sinav.bos_sayisi;

      new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: ['Doğru', 'Yanlış', 'Boş'],
          datasets: [{
            data: [dogru, yanlis, bos],
            backgroundColor: ['#28a745', '#dc3545', '#ffc107'],
            borderWidth: 0
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              display: false
            },
            tooltip: {
              enabled: false
            }
          },
          elements: {
            arc: {
              borderWidth: 0
            }
          }
        }
      });
    });
  }

  retakeExam(sinav: SinavSonucu | null) {
    if (!sinav) return;

    // Öğrenci daha önce bu sınavı çözmüş mü kontrol et
    const userStr = localStorage.getItem('user') || sessionStorage.getItem('user');
    if (!userStr) {
      alert('Kullanıcı oturum bilgisi bulunamadı');
      return;
    }

    let userData;
    try {
      userData = JSON.parse(userStr);
    } catch (error) {
      alert('Kullanıcı bilgileri ayrıştırılamadı');
      return;
    }

    const ogrenciId = userData.id;

    // Daha önce çözülmüş sınav kontrolü
    this.http.get<any>(`./server/api/sinav_sonucu_getir.php?sinav_id=${sinav.sinav_id}&ogrenci_id=${ogrenciId}`).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          // Daha önce çözülmüş
          alert('Bu sınavı daha önce çözmüşsünüz. Tekrar çözemezsiniz.');
        } else {
          // Sınava git
          this.router.navigate(['/ogrenci-sayfasi/optik'], {
            queryParams: {
              sinavId: sinav.sinav_id,
              sinavAdi: sinav.sinav_adi,
              sinavTuru: sinav.sinav_turu,
              soruSayisi: sinav.soru_sayisi || sinav.dogru_sayisi + sinav.yanlis_sayisi + sinav.bos_sayisi
            }
          });
        }
      },
      error: (error) => {
        console.error('Sınav kontrolü hatası:', error);
        // Hata durumunda da sınava gitmeye izin ver
        this.router.navigate(['/ogrenci-sayfasi/optik'], {
          queryParams: {
            sinavId: sinav.sinav_id,
            sinavAdi: sinav.sinav_adi,
            sinavTuru: sinav.sinav_turu,
            soruSayisi: sinav.soru_sayisi || sinav.dogru_sayisi + sinav.yanlis_sayisi + sinav.bos_sayisi
          }
        });
      }
    });
  }

  openVideo(videoUrl: string) {
    if (videoUrl) {
      window.open(videoUrl, '_blank');
    }
  }

  watchVideo(konuId: number | undefined, soruNo: number) {
    if (konuId) {
      console.log(`Konu ${konuId} videosu açılacak - Soru ${soruNo}`);
      alert(`Soru ${soruNo} için konu videosu yakında eklenecek!`);
    } else {
      console.log(`Soru ${soruNo} için video bulunamadı`);
      alert(`Soru ${soruNo} için video bulunamadı.`);
    }
  }

  goBackToExams() {
    this.router.navigate(['/ogrenci-sayfasi/ogrenci-sinav-islemleri-sayfasi']);
  }

  goToExams() {
    this.router.navigate(['/ogrenci-sayfasi/ogrenci-sinav-islemleri-sayfasi']);
  }
}
