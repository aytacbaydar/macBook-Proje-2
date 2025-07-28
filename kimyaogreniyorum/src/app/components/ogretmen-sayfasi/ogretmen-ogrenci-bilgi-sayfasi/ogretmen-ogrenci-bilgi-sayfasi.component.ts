import { Component, OnInit, OnDestroy, ChangeDetectorRef, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { ToastrService } from 'ngx-toastr';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

interface OgrenciBilgileri {
  id: number;
  adi_soyadi: string;
  email: string;
  cep_telefonu: string;
  okulu: string;
  sinifi: string;
  grubu: string;
  ders_adi: string;
  ders_gunu: string;
  ders_saati: string;
  ucret: number;
  veli_adi: string;
  veli_cep: string;
  aktif: number;
  avatar?: string;
}

interface SinavSonucu {
  id: number;
  sinav_adi: string;
  tarih: string;
  net_dogru: number;
  net_yanlis: number;
  net_bos: number;
  puan: number;
  basari_yuzdesi: number;
  toplam_soru: number;
}

interface KonuAnalizi {
  konu_adi: string;
  dogru_sayisi: number;
  yanlis_sayisi: number;
  bos_sayisi: number;
  toplam_soru: number;
  basari_orani: number;
}

interface OdemeBilgisi {
  id: number;
  tutar: number;
  odeme_tarihi: string;
  aciklama: string;
  ay: number;
  yil: number;
}

interface DevamsizlikKaydi {
  id: number;
  tarih: string;
  durum: string;
  aciklama: string;
}

@Component({
  selector: 'app-ogretmen-ogrenci-bilgi-sayfasi',
  standalone: false,
  templateUrl: './ogretmen-ogrenci-bilgi-sayfasi.component.html',
  styleUrl: './ogretmen-ogrenci-bilgi-sayfasi.component.scss'
})
export class OgretmenOgrenciBilgiSayfasiComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('sinavChart', { static: false }) sinavChartRef?: ElementRef<HTMLCanvasElement>;

  // Chart instance
  sinavChart: Chart | null = null;

  ogrenciId: number = 0;
  ogrenciBilgileri: OgrenciBilgileri | null = null;
  sinavSonuclari: SinavSonucu[] = [];
  konuAnalizleri: KonuAnalizi[] = [];
  odemeBilgileri: OdemeBilgisi[] = [];
  devamsizlikKayitlari: DevamsizlikKaydi[] = [];
  historicalAttendance: any[] = [];

  isLoading: boolean = true;
  error: string | null = null;

  // Grafik verileri
  chartData: any[] = [];
  chartLabels: string[] = [];

  // Sekmeler
  activeTab: string = 'bilgiler';

  // İstatistikler
  toplamOdenen: number = 0;
  kalanBorc: number = 0;
  devamsizlikSayisi: number = 0;
  ortalamaPuan: number = 0;

  // Öğretmen bilgileri
  teacherName: string = '';
  teacherAvatar: string = '';

  constructor(
    private route: ActivatedRoute,
    private http: HttpClient,
    private toastr: ToastrService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    // Öğretmen bilgilerini yükle
    this.loadTeacherInfo();

    this.route.params.subscribe(async params => {
      const idParam = params['id'];
      this.ogrenciId = parseInt(idParam, 10);

      console.log('Route parametresi:', idParam);
      console.log('Dönüştürülen öğrenci ID:', this.ogrenciId);

      if (!idParam || isNaN(this.ogrenciId) || this.ogrenciId <= 0) {
        this.error = `Geçersiz öğrenci ID: ${idParam}`;
        this.isLoading = false;
        this.toastr.error(`Geçersiz öğrenci ID: ${idParam}`, 'Hata');
        console.error('Geçersiz ID parametresi:', idParam);
        return;
      }

      await this.loadAllData();
    });
  }

  ngAfterViewInit(): void {
    // View init olduktan sonra grafiği render et
    setTimeout(() => {
      if (this.chartData.length > 0 && this.activeTab === 'sinavlar') {
        console.log('AfterViewInit - Grafik render ediliyor');
        this.renderChart();
      }
    }, 500);
  }

  async loadAllData(): Promise<void> {
    this.isLoading = true;
    this.error = null;

    try {
      // Tüm verileri paralel olarak yükle (devamsizlik kayitlari loadStudentAttendanceData'da yüklenecek)
      await Promise.all([
        this.loadOgrenciBilgileri(),
        this.loadSinavSonuclari(),
        this.loadKonuAnalizleri(),
        this.loadOdemeBilgileri()
      ]);

      this.calculateStatistics();
      this.prepareChartData();
      this.toastr.success('Öğrenci bilgileri başarıyla yüklendi', 'Başarılı');
    } catch (error) {
      console.error('Veri yükleme hatası:', error);
      this.error = 'Veriler yüklenirken bir hata oluştu: ' + error;
      this.toastr.error('Veriler yüklenirken bir hata oluştu', 'Hata');
    } finally {
      this.isLoading = false;
    }
  }

  private getAuthHeaders(): HttpHeaders {
    let headers = new HttpHeaders({
      'Content-Type': 'application/json'
    });

    // localStorage ve sessionStorage'ı debug et
    console.log('localStorage user:', localStorage.getItem('user'));
    console.log('sessionStorage user:', sessionStorage.getItem('user'));
    console.log('localStorage token:', localStorage.getItem('token'));
    console.log('sessionStorage token:', sessionStorage.getItem('token'));

    // Önce user objesinden token'ı al
    const userStr = localStorage.getItem('user') || sessionStorage.getItem('user');
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        console.log('User objesi:', user);
        if (user.token) {
          headers = headers.set('Authorization', `Bearer ${user.token}`);
          console.log('Authorization header eklendi (user), tam token:', user.token);
          console.log('Final headers:', headers.keys());
          return headers;
        }
      } catch (error) {
        console.error('User data parse hatası:', error);
      }
    }

    // Fallback olarak doğrudan token'ı al
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
      console.log('Authorization header eklendi (token), tam token:', token);
      console.log('Final headers:', headers.keys());
      return headers;
    }

    console.warn('Token bulunamadı! Giriş yapmanız gerekebilir.');
    console.log('Final headers (no token):', headers.keys());
    return headers;
  }

  loadOgrenciBilgileri(): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log('Öğrenci bilgileri yükleniyor, ID:', this.ogrenciId);

      const headers = this.getAuthHeaders();
      console.log('Headers:', headers.keys());

      console.log('Request headers (before sending):', headers.keys());
      console.log('Authorization header value:', headers.get('Authorization'));

      this.http.get<any>(`server/api/ogrenci_bilgileri.php?id=${this.ogrenciId}`, { headers })
        .subscribe({
          next: (response) => {
            console.log('Öğrenci bilgileri response:', response);
            if (response && response.success) {
              this.ogrenciBilgileri = response.data;
              console.log('Öğrenci bilgileri yüklendi:', this.ogrenciBilgileri);

              // Katılım verilerini yükle
              this.loadStudentAttendanceData();
              resolve();
            } else {
              const errorMsg = response?.message || 'Öğrenci bilgileri alınamadı';
              console.error('Öğrenci bilgileri hatası:', errorMsg);
              reject(errorMsg);
            }
          },
          error: (error) => {
            console.error('HTTP Error - Öğrenci bilgileri:', error);
            if (error.status === 401) {
              this.toastr.error('Oturumunuz sonlanmış. Lütfen tekrar giriş yapın.', 'Yetkilendirme Hatası');
              // Kullanıcıyı giriş sayfasına yönlendir
              localStorage.clear();
              sessionStorage.clear();
              window.location.href = '/';
              reject('Yetkilendirme hatası. Lütfen tekrar giriş yapın.');
            } else {
              reject('Öğrenci bilgileri yüklenirken ağ hatası: ' + error.message);
            }
          }
        });
    });
  }

  loadSinavSonuclari(): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log('Sınav sonuçları yükleniyor...');

      const headers = this.getAuthHeaders();

      this.http.get<any>(`server/api/ogrenci_tum_sinav_sonuclari.php?ogrenci_id=${this.ogrenciId}`, { headers })
        .subscribe({
          next: (response) => {
            console.log('Sınav sonuçları response:', response);
            if (response && response.success && response.data) {
              // API'den gelen veri formatını kontrol et ve öğrenci ID'ye göre filtrele
              if (response.data.sinav_sonuclari && Array.isArray(response.data.sinav_sonuclari)) {
                // Öğrenci ID'ye göre filtrele
                const filteredResults = response.data.sinav_sonuclari.filter((sinav: any) => 
                  sinav && sinav.ogrenci_id && sinav.ogrenci_id == this.ogrenciId
                );

                // SinavSonucu interface'ine uygun formata çevir
                this.sinavSonuclari = filteredResults.map((sinav: any) => ({
                  id: sinav.id || 0,
                  sinav_adi: sinav.sinav_adi || '',
                  tarih: sinav.gonderim_tarihi || sinav.tarih || new Date().toISOString(),
                  net_dogru: sinav.dogru_sayisi || 0,
                  net_yanlis: sinav.yanlis_sayisi || 0,
                  net_bos: sinav.bos_sayisi || 0,
                  puan: sinav.puan || 0,
                  basari_yuzdesi: sinav.yuzde || 0,
                  toplam_soru: (sinav.dogru_sayisi || 0) + (sinav.yanlis_sayisi || 0) + (sinav.bos_sayisi || 0)
                }));
              } else {
                this.sinavSonuclari = [];
              }
              console.log('İşlenen ve filtrelenmiş sınav sonuçları:', this.sinavSonuclari);
              resolve();
            } else {
              console.warn('Sınav sonuçları bulunamadı:', response?.message);
              this.sinavSonuclari = [];
              resolve(); // Boş array ile devam et
            }
          },
          error: (error) => {
            console.error('HTTP Error - Sınav sonuçları:', error);
            this.sinavSonuclari = [];
            resolve(); // Hata olsa da devam et
          }
        });
    });
  }

  loadKonuAnalizleri(): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log('Konu analizleri yükleniyor...');

      const headers = this.getAuthHeaders();

      this.http.get<any>(`server/api/ogrenci_konu_analizi.php?ogrenci_id=${this.ogrenciId}`, { headers })
        .subscribe({
          next: (response) => {
            console.log('Konu analizleri response:', response);
            if (response && response.success && response.data) {
              // API'den gelen veri formatını kontrol et
              if (Array.isArray(response.data.konu_istatistikleri)) {
                this.konuAnalizleri = response.data.konu_istatistikleri;
              } else if (response.data.konu_istatistikleri && typeof response.data.konu_istatistikleri === 'object') {
                // Object ise array'e çevir
                this.konuAnalizleri = Object.values(response.data.konu_istatistikleri).filter((item: any) => 
                  item && typeof item === 'object' && item.konu_adi
                ) as any[];
              } else {
                this.konuAnalizleri = [];
              }
            } else {
              this.konuAnalizleri = [];
            }
            console.log('İşlenen konu analizleri:', this.konuAnalizleri);
            // Change detection'ı manuel olarak tetikle
            this.cdr.detectChanges();
            resolve();
          },
          error: (error) => {
            console.error('HTTP Error - Konu analizleri:', error);
            this.konuAnalizleri = [];
            resolve(); // Hata olsa da devam et
          }
        });
    });
  }

  loadOdemeBilgileri(): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log('Ödeme bilgileri yükleniyor...');

      const headers = this.getAuthHeaders();

      // Öğretmen için özel API endpoint'ini kullan
      this.http.get<any>(`server/api/ogretmen_ucret_yonetimi.php?ogrenci_id=${this.ogrenciId}`, { headers })
        .subscribe({
          next: (response) => {
            console.log('Ödeme bilgileri response:', response);
            if (response && response.success) {
              // API'den gelen veri formatını kontrol et
              if (response.data && response.data.payments && Array.isArray(response.data.payments)) {
                // Sadece bu öğrencinin ödemelerini filtrele
                this.odemeBilgileri = response.data.payments.filter((payment: any) => 
                  payment.ogrenci_id == this.ogrenciId
                );
              } else if (Array.isArray(response.data)) {
                this.odemeBilgileri = response.data.filter((payment: any) => 
                  payment.ogrenci_id == this.ogrenciId
                );
              } else {
                this.odemeBilgileri = [];
              }
              console.log('Filtrelenen ödeme bilgileri:', this.odemeBilgileri);
              resolve();
            } else {
              console.warn('Ödeme bilgileri bulunamadı:', response?.message);
              this.odemeBilgileri = [];
              resolve(); // Boş array ile devam et
            }
          },
          error: (error) => {
            console.error('HTTP Error - Ödeme bilgileri:', error);
            console.warn('Ödeme bilgileri yüklenemedi, boş array ile devam ediliyor');
            this.odemeBilgileri = [];
            resolve(); // Hata olsa da devam et
          }
        });
    });
  }

  

  calculateStatistics(): void {
    // Toplam ödenen hesapla - array kontrolü ile
    this.toplamOdenen = Array.isArray(this.odemeBilgileri) 
      ? this.odemeBilgileri.reduce((total, odeme) => total + (odeme.tutar || 0), 0)
      : 0;

    // Kalan borç hesapla (katılım kayıtlarına göre)
    const stats = this.getStudentAttendanceStats();
    if (stats) {
      const expectedAmount = stats.expectedTotalAmount || 0;
      this.kalanBorc = Math.max(0, expectedAmount - this.toplamOdenen);
    } else {
      this.kalanBorc = 0;
    }

    // Devamsızlık sayısı - historicalAttendance'dan al
    this.devamsizlikSayisi = Array.isArray(this.historicalAttendance) 
      ? this.historicalAttendance.filter((kayit: any) => kayit && kayit.durum === 'absent' && kayit.ogrenci_id === this.ogrenciBilgileri?.id).length
      : 0;

    // Ortalama puan - array kontrolü ile
    if (Array.isArray(this.sinavSonuclari) && this.sinavSonuclari.length > 0) {
      this.ortalamaPuan = this.sinavSonuclari.reduce((total, sinav) => total + (sinav.puan || 0), 0) / this.sinavSonuclari.length;
    } else {
      this.ortalamaPuan = 0;
    }

    console.log('İstatistikler hesaplandı:', {
      toplamOdenen: this.toplamOdenen,
      kalanBorc: this.kalanBorc,
      devamsizlikSayisi: this.devamsizlikSayisi,
      ortalamaPuan: this.ortalamaPuan
    });
  }

  prepareChartData(): void {
    if (Array.isArray(this.sinavSonuclari) && this.sinavSonuclari.length > 0) {
      // Tarihe göre sırala (en eski başta)
      const sortedResults = [...this.sinavSonuclari].sort((a, b) => 
        new Date(a.tarih).getTime() - new Date(b.tarih).getTime()
      );

      this.chartLabels = sortedResults.map(sinav => {
        // Sınav adını kısalt
        return sinav.sinav_adi.length > 20 ? 
          sinav.sinav_adi.substring(0, 20) + '...' : 
          sinav.sinav_adi;
      });

      this.chartData = [{
        label: 'Puan',
        data: sortedResults.map(sinav => sinav.puan),
        borderColor: '#007bff',
        backgroundColor: 'rgba(0, 123, 255, 0.1)',
        fill: true,
        tension: 0.4
      }];

      console.log('Grafik verileri hazırlandı:', this.chartData);

      // Grafik çizimini tetikle - cdr ile birlikte
      this.cdr.detectChanges();

      // Eğer sınav sekmesi aktifse grafiği render et
      if (this.activeTab === 'sinavlar') {
        setTimeout(() => {
          this.renderChart();
          this.createMiniCharts();
        }, 500);
      }
    } else {
      this.chartLabels = [];
      this.chartData = [];
    }
  }

  renderChart(): void {
    console.log('renderChart çağrıldı');
    console.log('sinavChart var mı?', !!this.sinavChart);
    console.log('chartData var mı?', this.chartData.length);

    // ViewChild ile canvas'ı al
    if (!this.sinavChartRef?.nativeElement) {
      console.log('Canvas element bulunamadı');
      return;
    }

    if (!this.sinavSonuclari || this.sinavSonuclari.length === 0) {
      console.log('Sınav sonuçları yok, grafik çizilemiyor');
      return;
    }

    const canvas = this.sinavChartRef.nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.error('Canvas context alınamadı');
      return;
    }

    // Eğer zaten bir chart varsa yok et
    if (this.sinavChart) {
      this.sinavChart.destroy();
      this.sinavChart = null;
    }

    try {
      // Sınav adları ve başarı oranları
      const sinavAdlari = this.sinavSonuclari.map(sinav => {
        // Sınav adını kısalt (çok uzunsa)
        const ad = sinav.sinav_adi;
        return ad.length > 20 ? ad.substring(0, 15) + '...' : ad;
      });

      const basariOranlari = this.sinavSonuclari.map(sinav => this.getSuccessPercentage(sinav));

      // Sınav türlerine göre renkler
      const sinavTuruColors: { [key: string]: string } = {
        'TYT': '#f59e0b',
        'AYT': '#8b5cf6', 
        'TAR': '#10b981',
        'TEST': '#3b82f6'
      };

      const renkler = this.sinavSonuclari.map(sinav => {
        // Sınav adından türü çıkar veya varsayılan renk kullan
        const sinavAdi = sinav.sinav_adi.toUpperCase();
        if (sinavAdi.includes('TYT')) return sinavTuruColors['TYT'];
        if (sinavAdi.includes('AYT')) return sinavTuruColors['AYT'];
        if (sinavAdi.includes('TAR')) return sinavTuruColors['TAR'];
        return sinavTuruColors['TEST'];
      });

      // Chart.js ile modern grafik oluştur
      this.sinavChart = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: sinavAdlari,
          datasets: [{
            label: 'Başarı Oranı (%)',
            data: basariOranlari,
            backgroundColor: renkler.map(color => color + '80'), // %50 şeffaflık
            borderColor: renkler,
            borderWidth: 2,
            borderRadius: 8,
            borderSkipped: false,
            hoverBackgroundColor: renkler.map(color => color + 'cc')
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
              titleFont: {
                size: 14,
                weight: 'bold'
              },
              bodyFont: {
                size: 13
              },
              backgroundColor: 'rgba(0, 0, 0, 0.8)',
              titleColor: '#fff',
              bodyColor: '#fff',
              borderColor: '#ddd',
              borderWidth: 1,
              callbacks: {
                title: (context: any) => {
                  // Tam sınav adını tooltip'te göster
                  const index = context[0].dataIndex;
                  return this.sinavSonuclari[index].sinav_adi;
                },
                label: (context: any) => {
                  const index = context.dataIndex;
                  const sinav = this.sinavSonuclari[index];
                  return [
                    `Başarı Oranı: ${context.parsed.y}%`,
                    `Doğru: ${sinav.net_dogru}`,
                    `Yanlış: ${sinav.net_yanlis}`,
                    `Boş: ${sinav.net_bos}`,
                    `Puan: ${sinav.puan}`,
                    `Tarih: ${this.formatTarih(sinav.tarih)}`
                  ];
                }
              }
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              max: 100,
              ticks: {
                color: '#2d3748',
                font: {
                  size: 12,
                  weight: 'bold'
                },
                callback: function(value: any) {
                  return value + '%';
                }
              },
              title: {
                display: true,
                text: 'Başarı Oranı (%)',
                font: {
                  size: 14,
                  weight: 'bold'
                },
                color: '#2d3748'
              },
              grid: {
                color: '#e2e8f0',
                lineWidth: 1
              }
            },
            x: {
              ticks: {
                color: '#2d3748',
                font: {
                  size: 12,
                  weight: 'bold'
                },
                maxRotation: 15,
                minRotation: 0
              },
              title: {
                display: true,
                text: 'Sınavlar',
                font: {
                  size: 14,
                  weight: 'bold'
                },
                color: '#2d3748'
              },
              grid: {
                display: false
              }
            }
          },
          animation: {
            duration: 1000,
            easing: 'easeInOutQuart'
          },
          interaction: {
            intersect: false,
            mode: 'index'
          }
        }
      });

      console.log('Modern grafik başarıyla çizildi');
    } catch (error) {
      console.error('Grafik çizim hatası:', error);
    }
  }

  getSuccessPercentage(sinav: SinavSonucu): number {
    const totalQuestions = sinav.net_dogru + sinav.net_yanlis + sinav.net_bos;
    if (totalQuestions === 0) return 0;
    return Math.round((sinav.net_dogru / totalQuestions) * 100);
  }

  setActiveTab(tab: string): void {
    this.activeTab = tab;

    // Sınav sekmesi seçildiğinde ve chart data varsa grafiği render et
    if (tab === 'sinavlar' && this.sinavSonuclari.length > 0) {
      setTimeout(() => {
        this.renderChart();
        this.createMiniCharts();
      }, 100);
    }
  }

  formatTarih(tarih: string): string {
    return new Date(tarih).toLocaleDateString('tr-TR');
  }

  createMiniCharts(): void {
    // AfterViewInit'ten sonra çağır
    setTimeout(() => {
      this.sinavSonuclari.forEach((sinav, index) => {
        const canvasId = `miniChart-${index}`;
        const canvas = document.getElementById(canvasId) as HTMLCanvasElement;

        if (!canvas) {
          console.log(`Mini chart canvas bulunamadı: ${canvasId}`);
          return;
        }

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          console.error(`Canvas context alınamadı: ${canvasId}`);
          return;
        }

        const dogru = sinav.net_dogru || 0;
        const yanlis = sinav.net_yanlis || 0;
        const bos = sinav.net_bos || 0;

        new Chart(ctx, {
          type: 'doughnut',
          data: {
            labels: ['Doğru', 'Yanlış', 'Boş'],
            datasets: [{
              data: [dogru, yanlis, bos],
              backgroundColor: ['#28a745', '#dc3545', '#ffc107'],
              borderWidth: 0,
              hoverBackgroundColor: ['#218838', '#c82333', '#e0a800']
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
              legend: {
                display: false
              },
              tooltip: {
                enabled: true,
                callbacks: {
                  label: (context: any) => {
                    const label = context.label || '';
                    const value = context.parsed || 0;
                    return `${label}: ${value}`;
                  }
                }
              }
            },
            elements: {
              arc: {
                borderWidth: 1,
                borderColor: '#fff'
              }
            }
          }
        });
      });
    }, 500);
  }

  ngOnDestroy(): void {
    // Chart instance'ını temizle
    if (this.sinavChart) {
      this.sinavChart.destroy();
    }
  }

  // Öğrenci katılım istatistikleri
  getStudentAttendanceStats(): any {
    if (!this.ogrenciBilgileri || !this.historicalAttendance.length) {
      return null;
    }

    // Bu öğrencinin katılım kayıtlarını filtrele
    const studentRecords = this.historicalAttendance.filter(
      (record: any) => record.ogrenci_id === this.ogrenciBilgileri!.id
    );

    // Katıldığı dersleri say (sadece normal ders ve ek ders)
    const presentCount = studentRecords.filter(
      (record: any) => record.durum === 'present' && 
      (!record.ders_tipi || record.ders_tipi === 'normal' || record.ders_tipi === 'ek_ders')
    ).length;

    // Katılmadığı dersleri say
    const absentCount = studentRecords.filter(
      (record: any) => record.durum === 'absent'
    ).length;

    // Toplam ders sayısı
    const totalLessons = presentCount + absentCount;

    // Katılım yüzdesi
    const attendancePercentage = totalLessons > 0 
      ? Math.round((presentCount / totalLessons) * 100) 
      : 0;

    // Ödeme hesaplamaları
    const ucret = parseFloat(String(this.ogrenciBilgileri?.ucret || 0));
    const expectedPaymentCycles = Math.floor(presentCount / 4);
    const expectedTotalAmount = expectedPaymentCycles * ucret;
    const lessonsUntilNextPayment = presentCount > 0 ? 4 - (presentCount % 4) : 4;

    return {
      presentCount,
      absentCount,
      totalLessons,
      attendancePercentage,
      ucret,
      expectedPaymentCycles,
      expectedTotalAmount,
      lessonsUntilNextPayment: lessonsUntilNextPayment === 4 ? 0 : lessonsUntilNextPayment
    };
  }

  // Son 10 katılım kaydını getir
  getRecentAttendanceRecords(): any[] {
    if (!this.ogrenciBilgileri || !this.historicalAttendance.length) {
      return [];
    }

    return this.historicalAttendance
      .filter((record: any) => record.ogrenci_id === this.ogrenciBilgileri!.id)
      .sort((a: any, b: any) => new Date(b.tarih).getTime() - new Date(a.tarih).getTime())
      .slice(0, 10)
      .map((record: any) => ({
        ...record,
        formatted_date: this.formatDate(record.tarih),
        status_text: record.durum === 'present' ? 'Katıldı' : 'Katılmadı',
        lesson_type_text: this.getLessonTypeText(record.ders_tipi)
      }));
  }

  // Eksik metodları ekle
  loadTeacherInfo(): void {
    const userStr = localStorage.getItem('user') || sessionStorage.getItem('user');
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        this.teacherName = user.name || user.adi_soyadi || 'Öğretmen';
        this.teacherAvatar = user.avatar || '';
      } catch (error) {
        console.error('User data parse hatası:', error);
        this.teacherName = 'Öğretmen';
        this.teacherAvatar = '';
      }
    }
  }

  loadStudentAttendanceData(): void {
    if (!this.ogrenciBilgileri) return;

    const headers = this.getAuthHeaders();
    console.log('Katılım verileri yükleniyor, öğrenci ID:', this.ogrenciBilgileri.id);

    // Yeni API endpoint'ini kullan
    this.http.get<any>(`server/api/ogrenci_devamsizlik_listesi.php?ogrenci_id=${this.ogrenciBilgileri.id}`, { headers })
      .subscribe({
        next: (response) => {
          console.log('Yeni API response:', response);
          if (response && response.success && response.data) {
            // Kayıtları al
            this.historicalAttendance = response.data.kayitlar || [];
            
            // devamsizlikKayitlari'nı da güncelle
            this.devamsizlikKayitlari = this.historicalAttendance.map((record: any) => ({
              id: record.id || 0,
              tarih: record.tarih || '',
              durum: record.durum || '',
              aciklama: record.aciklama || ''
            }));
            
            console.log('Yüklenen katılım kayıtları:', this.historicalAttendance);
            console.log('Güncellenen devamsızlık kayıtları:', this.devamsizlikKayitlari);
            console.log('İstatistikler:', response.data.istatistik);
            
            this.cdr.detectChanges();
          } else {
            console.warn('Katılım verileri bulunamadı:', response?.message);
            this.historicalAttendance = [];
            this.devamsizlikKayitlari = [];
            this.cdr.detectChanges();
          }
        },
        error: (error) => {
          console.error('Katılım verileri yüklenemedi:', error);
          this.historicalAttendance = [];
          this.devamsizlikKayitlari = [];
          this.cdr.detectChanges();
        }
      });
  }

  

  getProgressBarClass(percentage: number): string {
    if (percentage >= 80) return 'progress-bar bg-success';
    if (percentage >= 60) return 'progress-bar bg-warning';
    return 'progress-bar bg-danger';
  }

  trackByKonuAdi(index: number, konu: KonuAnalizi): string {
    return konu.konu_adi;
  }

  formatCurrency(amount: number): string {
    if (amount === 0) return '₺0';
    
    return new Intl.NumberFormat('tr-TR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount) + ' TL';
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('tr-TR');
  }

  getLessonTypeText(type: string): string {
    switch (type) {
      case 'normal': return 'Normal Ders';
      case 'ek_ders': return 'Ek Ders';
      case 'telafi': return 'Telafi Dersi';
      default: return 'Normal Ders';
    }
  }

  // Math nesnesini template'te kullanabilmek için
  Math = Math;

  // Ücret analizi verilerini getir
  getPaymentAnalysisData(): any[] {
    if (!this.ogrenciBilgileri || !this.historicalAttendance.length) {
      return [];
    }

    // Bu öğrencinin katılım kayıtlarını filtrele
    const studentRecords = this.historicalAttendance.filter(
      (record: any) => record.ogrenci_id === this.ogrenciBilgileri!.id
    );

    // Ders tiplerini say
    const normalLessons = studentRecords.filter(
      (record: any) => record.durum === 'present' && 
      (!record.ders_tipi || record.ders_tipi === 'normal')
    ).length;

    const ekDersLessons = studentRecords.filter(
      (record: any) => record.durum === 'present' && record.ders_tipi === 'ek_ders'
    ).length;

    const totalAttendedLessons = normalLessons + ekDersLessons;

    // Ücret hesaplamaları
    const lessonFee = parseFloat(String(this.ogrenciBilgileri.ucret || 0));
    const paymentCycles = Math.floor(totalAttendedLessons / 4);
    const expectedAmount = paymentCycles * lessonFee;

    // Yapılan ödemeler
    const paidAmount = Array.isArray(this.odemeBilgileri) 
      ? this.odemeBilgileri.reduce((total, payment) => total + (payment.tutar || 0), 0)
      : 0;

    // Borç hesaplama
    const debt = expectedAmount - paidAmount;

    // Ödeme yüzdesi
    const paymentPercentage = expectedAmount > 0 
      ? Math.round((paidAmount / expectedAmount) * 100) 
      : 0;

    return [{
      studentName: this.ogrenciBilgileri.adi_soyadi,
      studentEmail: this.ogrenciBilgileri.email,
      lessonFee: lessonFee,
      lessons: {
        total: totalAttendedLessons,
        normal: normalLessons,
        ek_ders: ekDersLessons
      },
      paymentCycles: paymentCycles,
      expectedAmount: expectedAmount,
      paidAmount: paidAmount,
      debt: debt,
      paymentPercentage: paymentPercentage
    }];
  }

  // Ödeme özeti
  getPaymentSummary(): any {
    const analysisData = this.getPaymentAnalysisData();
    
    if (analysisData.length === 0) {
      return {
        totalAttendedLessons: 0,
        totalExpectedAmount: 0,
        totalPaidAmount: 0,
        totalDebt: 0
      };
    }

    const data = analysisData[0];
    return {
      totalAttendedLessons: data.lessons.total,
      totalExpectedAmount: data.expectedAmount,
      totalPaidAmount: data.paidAmount,
      totalDebt: data.debt
    };
  }

  // Varsayılan avatar
  getDefaultAvatar(name: string): string {
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'Student')}&background=007bff&color=fff&size=40`;
  }
}