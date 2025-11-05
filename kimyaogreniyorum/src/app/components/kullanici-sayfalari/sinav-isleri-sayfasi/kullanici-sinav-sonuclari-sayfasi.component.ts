import { AfterViewInit, Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { Chart } from 'chart.js/auto';

interface SinavSonucu {
  sinav_id: number;
  sinav_adi: string;
  sinav_turu: string;
  sinav_tarihi: string;
  cozum_tarihi: string;
  dogru_sayisi: number;
  yanlis_sayisi: number;
  bos_sayisi: number;
  soru_sayisi: number;
  ogrenci_id?: number;
}

@Component({
  selector: 'app-kullanici-sinav-sonuclari-sayfasi',
  standalone: false,
  templateUrl: './kullanici-sinav-sonuclari-sayfasi.component.html',
  styleUrl: './kullanici-sinav-sonuclari-sayfasi.component.scss',
})
export class KullaniciSinavSonuclariSayfasiComponent implements OnInit, AfterViewInit {
  sinavSonuclari: SinavSonucu[] = [];
  selectedSinav: SinavSonucu | null = null;
  selectedSinavDetails: any | null = null;
  loading = true;
  loadingDetails = false;
  error: string | null = null;
  comparisonChart: Chart | null = null;

  sinavTurleri: Record<string, { color: string; label: string }> = {
    TYT: { color: '#667eea', label: 'TYT Deneme' },
    AYT: { color: '#4facfe', label: 'AYT Deneme' },
    TAR: { color: '#43e97b', label: 'Tarama Sınavı' },
    TEST: { color: '#fa709a', label: 'Konu Testi' },
  };

  constructor(
    private readonly http: HttpClient,
    private readonly route: ActivatedRoute,
    private readonly router: Router
  ) {}

  ngOnInit(): void {
    this.route.queryParams.subscribe((params) => {
      const sinavId = params['sinavId'] ? Number.parseInt(params['sinavId'], 10) : undefined;
      this.loadAllSinavSonuclari(sinavId);
    });
  }

  ngAfterViewInit(): void {
    setTimeout(() => {
      this.createMiniCharts();
      this.createComparisonChart();
    }, 500);
  }

  loadAllSinavSonuclari(selectedSinavId?: number): void {
    this.loading = true;
    this.error = null;

    const userStr = localStorage.getItem('user') ?? sessionStorage.getItem('user');
    if (!userStr) {
      this.loading = false;
      this.error = 'Kullanıcı oturum bilgisi bulunamadı';
      return;
    }

    let userData: any;
    try {
      userData = JSON.parse(userStr);
    } catch (parseError) {
      this.loading = false;
      this.error = 'Kullanıcı bilgileri ayrıştırılamadı';
      return;
    }

    const ogrenciId = userData?.id;
    if (!ogrenciId) {
      this.loading = false;
      this.error = 'Öğrenci ID\'si bulunamadı';
      return;
    }

    this.http.get<any>('./server/api/ogrenci_tum_sinav_sonuclari.php').subscribe({
      next: (response) => {
        this.loading = false;
        if (response?.success && response?.data) {
          const tumSinavSonuclari = response.data.sinav_sonuclari || [];

          this.sinavSonuclari = tumSinavSonuclari
            .filter((sinav: any) => sinav.ogrenci_id == ogrenciId)
            .map((sinav: any) => ({
              ...sinav,
              ogrenci_id: sinav.ogrenci_id ?? ogrenciId,
            }));

          if (!this.sinavSonuclari.length) {
            this.error = 'Henüz sınav sonucunuz bulunmuyor.';
          }

          if (selectedSinavId) {
            const targetSinav = this.sinavSonuclari.find((s) => s.sinav_id == selectedSinavId);
            if (targetSinav) {
              this.selectSinav(targetSinav);
            }
          }

          setTimeout(() => {
            this.createMiniCharts();
            this.createComparisonChart();
          }, 100);
        } else {
          this.error = response?.message ?? 'Henüz sınav sonucunuz bulunmuyor';
        }
      },
      error: (err) => {
        this.loading = false;
        this.error = 'Sınav sonuçları yüklenirken hata oluştu: ' + (err?.message ?? '');
        console.error('[KullaniciSinavSonuclari] Listeleme hatası', err);
      },
    });
  }

  selectSinav(sinav: SinavSonucu): void {
    this.selectedSinav = sinav;
    this.selectedSinavDetails = null;
    this.loadingDetails = true;

    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';

    this.loadSinavDetails(sinav);
  }

  loadSinavDetails(sinav: SinavSonucu): void {
    this.loadingDetails = true;

    this.http
      .get<any>('./server/api/sinav_detay_sonuc.php', {
        params: {
          sinav_id: String(sinav.sinav_id),
          ogrenci_id: String(sinav.ogrenci_id ?? ''),
        },
      })
      .subscribe({
        next: (response) => {
          this.loadingDetails = false;
          if (response?.success && response?.data) {
            this.selectedSinavDetails = response.data;

            if (!Array.isArray(this.selectedSinavDetails?.sorular)) {
              this.selectedSinavDetails.sorular = [];
              const soruSayisi =
                this.selectedSinavDetails.toplam_soru || sinav.soru_sayisi || 40;

              for (let i = 1; i <= soruSayisi; i++) {
                const dogruKey = `dogru_cevap_${i}`;
                const ogrenciKey = `ogrenci_cevabi_${i}`;

                this.selectedSinavDetails.sorular.push({
                  soru_numarasi: i,
                  soru_no: i,
                  dogru_cevap:
                    this.selectedSinavDetails[dogruKey] ||
                    this.selectedSinavDetails.cevap_anahtari?.[`ca${i}`] ||
                    'A',
                  ogrenci_cevabi:
                    this.selectedSinavDetails[ogrenciKey] ||
                    this.selectedSinavDetails.ogrenci_cevaplari?.[`ca${i}`] ||
                    null,
                  is_correct: false,
                });
              }

              this.selectedSinavDetails.sorular.forEach((soru: any) => {
                soru.is_correct = soru.ogrenci_cevabi === soru.dogru_cevap;
              });
            }
          } else {
            console.error('[KullaniciSinavSonuclari] Detay verisi bulunamadı', response?.message);
          }
        },
        error: (err) => {
          this.loadingDetails = false;
          console.error('[KullaniciSinavSonuclari] Detay hatası', err);
        },
      });
  }

  getSinavTuruColor(sinavTuru: string): string {
    return this.sinavTurleri[sinavTuru]?.color ?? '#6c757d';
  }

  getSinavTuruLabel(sinavTuru: string): string {
    return this.sinavTurleri[sinavTuru]?.label ?? sinavTuru;
  }

  getSuccessPercentage(sinav: SinavSonucu): number {
    const totalQuestions = sinav.dogru_sayisi + sinav.yanlis_sayisi + sinav.bos_sayisi;
    if (!totalQuestions) {
      return 0;
    }
    return Math.round((sinav.dogru_sayisi / totalQuestions) * 100);
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('tr-TR');
  }

  createMiniCharts(): void {
    this.sinavSonuclari.forEach((sinav, index) => {
      const canvas = document.getElementById(`miniChart-${index}`) as HTMLCanvasElement | null;
      if (!canvas) {
        return;
      }

      const existing = Chart.getChart(canvas);
      existing?.destroy();

      // eslint-disable-next-line no-new
      new Chart(canvas, {
        type: 'doughnut',
        data: {
          labels: ['Doğru', 'Yanlış', 'Boş'],
          datasets: [
            {
              data: [sinav.dogru_sayisi, sinav.yanlis_sayisi, sinav.bos_sayisi],
              backgroundColor: ['#28a745', '#dc3545', '#ffc107'],
              borderWidth: 0,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: { enabled: false },
          },
          elements: {
            arc: { borderWidth: 0 },
          },
        },
      });
    });
  }

  createComparisonChart(): void {
    const canvas = document.getElementById('comparisonChart') as HTMLCanvasElement | null;
    if (!canvas || !this.sinavSonuclari.length) {
      return;
    }

    if (this.comparisonChart) {
      this.comparisonChart.destroy();
    }

    const sinavAdlari = this.sinavSonuclari.map((sinav) =>
      sinav.sinav_adi.length > 20 ? sinav.sinav_adi.substring(0, 7) + '...' : sinav.sinav_adi
    );
    const basariOranlari = this.sinavSonuclari.map((sinav) => this.getSuccessPercentage(sinav));
    const renkler = this.sinavSonuclari.map((sinav) => this.getSinavTuruColor(sinav.sinav_turu));

    this.comparisonChart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: sinavAdlari,
        datasets: [
          {
            label: 'Başarı Oranı (%)',
            data: basariOranlari,
            backgroundColor: renkler.map((renk) => renk + '80'),
            borderColor: renkler,
            borderWidth: 2,
            borderRadius: 8,
            borderSkipped: false,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: (context) => {
                const index = context[0].dataIndex;
                return this.sinavSonuclari[index]?.sinav_adi ?? '';
              },
              label: (context) => {
                const index = context.dataIndex;
                const sinav = this.sinavSonuclari[index];
                return [
                  `Başarı Oranı: ${context.parsed.y}%`,
                  `Doğru: ${sinav.dogru_sayisi}`,
                  `Yanlış: ${sinav.yanlis_sayisi}`,
                  `Boş: ${sinav.bos_sayisi}`,
                  `Tarih: ${this.formatDate(sinav.cozum_tarihi)}`,
                ];
              },
            },
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            max: 100,
            ticks: {
              callback(tickValue) {
                const numeric = typeof tickValue === 'string' ? Number.parseFloat(tickValue) : tickValue;
                return `${numeric}%`;
              },
            },
            title: { display: true, text: 'Başarı Oranı (%)' },
          },
          x: {
            title: { display: true, text: 'Sınavlar' },
            ticks: { maxRotation: 15, minRotation: 0 },
          },
        },
        interaction: {
          intersect: false,
          mode: 'index',
        },
        animation: {
          duration: 1000,
          easing: 'easeInOutQuart',
        },
      },
    });
  }

  retakeExam(sinav: SinavSonucu | null): void {
    if (!sinav) {
      return;
    }

    const userStr = localStorage.getItem('user') ?? sessionStorage.getItem('user');
    if (!userStr) {
      alert('Kullanıcı oturum bilgisi bulunamadı');
      return;
    }

    let userData: any;
    try {
      userData = JSON.parse(userStr);
    } catch (error) {
      alert('Kullanıcı bilgileri ayrıştırılamadı');
      return;
    }

    const ogrenciId = userData?.id;
    if (!ogrenciId) {
      alert('Öğrenci bilgisi eksik');
      return;
    }

    this.http
      .get<any>('./server/api/sinav_sonucu_getir.php', {
        params: { sinav_id: String(sinav.sinav_id), ogrenci_id: String(ogrenciId) },
      })
      .subscribe({
        next: (response) => {
          if (response?.success && response?.data) {
            alert('Bu sınavı daha önce çözmüşsünüz. Tekrar çözemezsiniz.');
          } else {
            this.router.navigate(['/ogrenci-sayfasi/optik'], {
              queryParams: {
                sinavId: sinav.sinav_id,
                sinavAdi: sinav.sinav_adi,
                sinavTuru: sinav.sinav_turu,
                soruSayisi:
                  sinav.soru_sayisi ??
                  sinav.dogru_sayisi + sinav.yanlis_sayisi + sinav.bos_sayisi,
              },
            });
          }
        },
        error: (err) => {
          console.error('Sınav kontrolü hatası:', err);
          this.router.navigate(['/ogrenci-sayfasi/optik'], {
            queryParams: {
              sinavId: sinav.sinav_id,
              sinavAdi: sinav.sinav_adi,
              sinavTuru: sinav.sinav_turu,
              soruSayisi:
                sinav.soru_sayisi ??
                sinav.dogru_sayisi + sinav.yanlis_sayisi + sinav.bos_sayisi,
            },
          });
        },
      });
  }

  goToExams(): void {
    this.router.navigate(['/kullanici-sayfasi/sinav-isleri-sayfasi']);
  }

  closeModal(): void {
    document.body.style.overflow = '';
    document.body.style.position = '';
    document.body.style.width = '';
    this.selectedSinav = null;
    this.selectedSinavDetails = null;
    this.loadingDetails = false;
  }

  getQuestionStatus(question: any): string {
    if (!question?.ogrenci_cevabi) {
      return 'Boş';
    }
    return question.ogrenci_cevabi === question.dogru_cevap ? 'Doğru' : 'Yanlış';
  }
}
