import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';

interface SinavSonucu {
  id: number;
  sinav_id: number;
  sinav_adi: string;
  sinav_turu: string;
  sinav_tarihi: string;
  dogru_sayisi: number;
  yanlis_sayisi: number;
  bos_sayisi: number;
  soru_sayisi?: number;
}

interface DetaySinavSonucu extends SinavSonucu {
  sorular: {
    soru_no: number;
    ogrenci_cevabi: string;
    dogru_cevap: string;
    konu_id?: number;
  }[];
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
  selectedSinavDetails: DetaySinavSonucu | null = null;
  loading = true;
  loadingDetails = false;
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
    // URL'den gelen parametreleri kontrol et
    this.route.queryParams.subscribe(params => {
      const sinavId = params['sinavId'] ? parseInt(params['sinavId']) : undefined;
      this.loadAllSinavSonuclari(sinavId);
    });
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

    this.createDoughnutChart();
    this.createBarChart();
  }

  createDoughnutChart() {
    if (!this.selectedSinavDetails) return;

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
            this.selectedSinavDetails.dogru_sayisi,
            this.selectedSinavDetails.yanlis_sayisi,
            this.selectedSinavDetails.bos_sayisi
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

  createBarChart() {
    if (!this.selectedSinavDetails) return;

    const barCtx = document.getElementById('barChart') as HTMLCanvasElement;
    if (!barCtx) return;

    // Eski grafik varsa temizle
    const existingBarChart = (window as any).Chart.getChart(barCtx);
    if (existingBarChart) {
      existingBarChart.destroy();
    }

    new (window as any).Chart(barCtx, {
      type: 'bar',
      data: {
        labels: ['Doğru', 'Yanlış', 'Boş'],
        datasets: [{
          label: 'Soru Sayıları',
          data: [
            this.selectedSinavDetails.dogru_sayisi,
            this.selectedSinavDetails.yanlis_sayisi,
            this.selectedSinavDetails.bos_sayisi
          ],
          backgroundColor: [
            'rgba(40, 167, 69, 0.8)',
            'rgba(220, 53, 69, 0.8)',
            'rgba(108, 117, 125, 0.8)'
          ],
          borderColor: [
            'rgba(40, 167, 69, 1)',
            'rgba(220, 53, 69, 1)',
            'rgba(108, 117, 125, 1)'
          ],
          borderWidth: 2,
          borderRadius: 6,
          borderSkipped: false
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
            callbacks: {
              label: (context: any) => {
                const total = this.selectedSinavDetails!.toplam_soru;
                const percentage = ((context.parsed.y / total) * 100).toFixed(1);
                return `${context.parsed.y} soru (${percentage}%)`;
              }
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            max: this.selectedSinavDetails.toplam_soru,
            ticks: {
              stepSize: 1
            },
            title: {
              display: true,
              text: 'Soru Sayısı'
            }
          },
          x: {
            title: {
              display: true,
              text: 'Sonuç Türü'
            }
          }
        }
      }
    });
  }

  retakeExam(sinav: SinavSonucu) {
    // Sınavın daha önce çözülüp çözülmediğini kontrol et
    if (this.isExamAlreadySolved(sinav.sinav_id)) {
      // Uyarı mesajı göster
      const shouldContinue = confirm(
        `"${sinav.sinav_adi}" sınavını daha önce çözmüşsünüz.\n\n` +
        `Önceki sonucunuz:\n` +
        `• Doğru: ${sinav.dogru_sayisi}\n` +
        `• Yanlış: ${sinav.yanlis_sayisi}\n` +
        `• Boş: ${sinav.bos_sayisi}\n` +
        `• Başarı: ${this.getSuccessPercentage(sinav)}%\n\n` +
        `Tekrar çözmek istediğinize emin misiniz? Bu işlem önceki sonucunuzu değiştirecektir.`
      );
      
      if (!shouldContinue) {
        return;
      }
    }

    this.router.navigate(['/ogrenci-sayfasi/optik'], {
      queryParams: {
        sinavId: sinav.sinav_id,
        sinavAdi: sinav.sinav_adi,
        sinavTuru: sinav.sinav_turu,
        soruSayisi: sinav.soru_sayisi || sinav.toplam_soru || 0,
        retake: 'true' // Tekrar çözüldüğünü belirt
      }
    });
  }

  isExamAlreadySolved(sinavId: number): boolean {
    return this.sinavSonuclari.some(sonuc => sonuc.sinav_id === sinavId);
  }

  openVideo(videoUrl: string) {
    if (videoUrl) {
      window.open(videoUrl, '_blank');
    }
  }inav.dogru_sayisi + sinav.yanlis_sayisi + sinav.bos_sayisi)
      }
    });
  }

  watchVideo(konuId: number | undefined, soruNo: number) {
    if (konuId) {
      // Konu videosu sayfasına git
      console.log(`Konu ${konuId} videosu açılacak - Soru ${soruNo}`);
      // Bu bölümü gelecekte video sayfası oluşturulduğunda implement edilebilir
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