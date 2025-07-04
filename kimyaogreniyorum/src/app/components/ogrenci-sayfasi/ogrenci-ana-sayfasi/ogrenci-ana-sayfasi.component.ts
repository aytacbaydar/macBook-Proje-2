import { Component, OnInit, AfterViewInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

interface SinavSonucu {
  sinav_id: number;
  sinav_adi: string;
  sinav_turu: string;
  dogru_sayisi: number;
  yanlis_sayisi: number;
  bos_sayisi: number;
  gonderim_tarihi: string;
  katilimci_sayisi?: number;
  siralama?: number;
}

@Component({
  selector: 'app-ogrenci-ana-sayfasi',
  standalone: false,
  templateUrl: './ogrenci-ana-sayfasi.component.html',
  styleUrl: './ogrenci-ana-sayfasi.component.scss',
})
export class OgrenciAnaSayfasiComponent implements OnInit, AfterViewInit {
  // Sidebar state
  isSidebarOpen: boolean = true;

  // Student information
  studentName: string = '';
  studentAvatar: string = '';
  studentClass: string = '';
  studentTeacher: string = '';
  studentGroup: string = '';

  // Loading state
  isLoading: boolean = false;
  error: string = '';

  // Sınav sonuçları
  sinavSonuclari: SinavSonucu[] = [];
  comparisonChart: any;
  loadingExamResults: boolean = false;

  // Son işlenen konular
  sonIslenenKonular: any[] = [];
  loadingTopics: boolean = false;

  // Konu analizi
  konuAnalizi: any[] = [];
  loadingKonuAnalizi: boolean = false;
  konuAnaliziChart: any;

  sinavTurleri: any = {
    'TYT': { color: '#667eea', label: 'TYT Deneme' },
    'AYT': { color: '#4facfe', label: 'AYT Deneme' },
    'TAR': { color: '#43e97b', label: 'Tarama Sınavı' },
    'TEST': { color: '#fa709a', label: 'Konu Testi' }
  };

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.loadStudentInfo();
    this.checkScreenSize();
    this.loadSinavSonuclari();
    this.loadSonIslenenKonular();
    this.loadKonuAnalizi();
    window.addEventListener('resize', () => {
      this.checkScreenSize();
    });
  }

  ngAfterViewInit() {
    // Grafik için timeout ekle
    setTimeout(() => {
      this.createComparisonChart();
    }, 500);
  }

  private loadStudentInfo(): void {
    const userStr = localStorage.getItem('user') || sessionStorage.getItem('user');

    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        this.studentName = user.adi_soyadi || 'Öğrenci';
        this.studentClass = user.sinif || 'Sınıf Bilgisi Yok';
        this.studentTeacher = user.ogretmeni || 'Öğretmen Bilgisi Yok';
        this.studentGroup = user.grup || user.grubu || '';

        if (user.avatar && user.avatar.trim() !== '') {
          this.studentAvatar = user.avatar;
        } else {
          this.studentAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(
            this.studentName
          )}&background=28a745&color=fff&size=40&font-size=0.6&rounded=true`;
        }
      } catch (error) {
        this.setDefaultStudentInfo();
      }
    } else {
      this.setDefaultStudentInfo();
    }
  }

  private setDefaultStudentInfo(): void {
    this.studentName = 'Öğrenci';
    this.studentClass = 'Sınıf Bilgisi Yok';
    this.studentTeacher = 'Öğretmen Bilgisi Yok';
    this.studentAvatar = 'https://ui-avatars.com/api/?name=Öğrenci&background=6c757d&color=fff&size=40&font-size=0.6&rounded=true';
  }

  toggleSidebar(): void {
    this.isSidebarOpen = !this.isSidebarOpen;
    localStorage.setItem('sidebarOpen', JSON.stringify(this.isSidebarOpen));
  }

  private checkScreenSize(): void {
    if (window.innerWidth < 768) {
      this.isSidebarOpen = false;
    } else {
      const savedState = localStorage.getItem('sidebarOpen');
      this.isSidebarOpen = savedState ? JSON.parse(savedState) : true;
    }
  }

  getCurrentDate(): string {
    const today = new Date();
    const options: Intl.DateTimeFormatOptions = {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    };
    return today.toLocaleDateString('tr-TR', options);
  }

  getCurrentTime(): string {
    const now = new Date();
    const options: Intl.DateTimeFormatOptions = {
      hour: '2-digit',
      minute: '2-digit',
    };
    return now.toLocaleTimeString('tr-TR', options);
  }

  loadSinavSonuclari() {
    this.loadingExamResults = true;

    // localStorage veya sessionStorage'dan öğrenci ID'sini al
    const userStr = localStorage.getItem('user') || sessionStorage.getItem('user');

    if (!userStr) {
      this.loadingExamResults = false;
      return;
    }

    let userData;
    try {
      userData = JSON.parse(userStr);
    } catch (error) {
      this.loadingExamResults = false;
      return;
    }

    const ogrenciId = userData.id;

    if (!ogrenciId) {
      this.loadingExamResults = false;
      return;
    }

    this.http.get<any>(`./server/api/ogrenci_tum_sinav_sonuclari.php?ogrenci_id=${ogrenciId}`).subscribe({
      next: (response) => {
        this.loadingExamResults = false;
        if (response.success && response.data) {
          // Son 5 sınav sonucunu al
          this.sinavSonuclari = (response.data.sinav_sonuclari || []).slice(-5);

          // Grafik oluştur
          setTimeout(() => {
            this.createComparisonChart();
          }, 100);
        }
      },
      error: (error) => {
        this.loadingExamResults = false;
      }
    });
  }

  createComparisonChart() {
    const ctx = document.getElementById('comparisonChart') as HTMLCanvasElement;
    if (!ctx || this.sinavSonuclari.length === 0) return;

    // Destroy existing chart if it exists
    if (this.comparisonChart) {
      this.comparisonChart.destroy();
    }

    // Sınav adları ve başarı oranları
    const sinavAdlari = this.sinavSonuclari.map(sinav => {
      // Sınav adını kısalt (çok uzunsa)
      const ad = sinav.sinav_adi;
      return ad.length > 15 ? ad.substring(0, 12) + '...' : ad;
    });

    const basariOranlari = this.sinavSonuclari.map(sinav => this.getSuccessPercentage(sinav));

    // Sınav türlerine göre renkler
    const renkler = this.sinavSonuclari.map(sinav => this.getSinavTuruColor(sinav.sinav_turu));

    this.comparisonChart = new Chart(ctx, {
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
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        aspectRatio: 2,
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
              title: (context) => {
                // Tam sınav adını tooltip'te göster
                const index = context[0].dataIndex;
                return this.sinavSonuclari[index].sinav_adi;
              },
              label: (context) => {
                const index = context.dataIndex;
                const sinav = this.sinavSonuclari[index];
                return [
                  `Başarı Oranı: ${context.parsed.y}%`,
                  `Doğru: ${sinav.dogru_sayisi}`,
                  `Yanlış: ${sinav.yanlis_sayisi}`,
                  `Boş: ${sinav.bos_sayisi}`,
                  `Tarih: ${this.formatDate(sinav.gonderim_tarihi)}`
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
              callback: function(value) {
                return value + '%';
              },
              font: {
                size: 12,
                weight: 'bold'
              }
            },
            title: {
              display: true,
              text: 'Başarı Oranı (%)',
              font: {
                size: 14,
                weight: 'bold'
              }
            }
          },
          x: {
            title: {
              display: true,
              text: 'Son Sınavlar',
              font: {
                size: 14,
                weight: 'bold'
              }
            },
            ticks: {
              maxRotation: 45,
              minRotation: 0,
              font: {
                size: 12,
                weight: 'bold'
              }
            }
          }
        },
        interaction: {
          intersect: false,
          mode: 'index'
        },
        animation: {
          duration: 1000,
          easing: 'easeInOutQuart'
        }
      }
    });
  }

  getSinavTuruColor(sinavTuru: string): string {
    return this.sinavTurleri[sinavTuru]?.color || '#6c757d';
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

  getSinavTuruLabel(sinavTuru: string): string {
    return this.sinavTurleri[sinavTuru]?.label || sinavTuru;
  }

  calculateNet(sinav: SinavSonucu): number {
    // Net = Doğru - (Yanlış / 4)
    return Math.max(0, Math.round(sinav.dogru_sayisi - (sinav.yanlis_sayisi / 4)));
  }

  loadSonIslenenKonular() {
    this.loadingTopics = true;

    const userStr = localStorage.getItem('user') || sessionStorage.getItem('user');
    if (!userStr) {
      this.loadingTopics = false;
      return;
    }

    let userData;
    try {
      userData = JSON.parse(userStr);
    } catch (error) {
      this.loadingTopics = false;
      return;
    }

    const grupBilgisi = userData.grup || userData.grubu;
    if (!grupBilgisi) {
      this.loadingTopics = false;
      return;
    }

    this.http.get<any>(`./server/api/ogrenci_islenen_konular.php?grup=${grupBilgisi}`).subscribe({
      next: (response) => {
        this.loadingTopics = false;
        if (response.success && response.islenen_konular) {
          // Son 5 konuyu al (tarih sırasına göre)
          this.sonIslenenKonular = response.islenen_konular
            .sort((a: any, b: any) => new Date(b.isleme_tarihi).getTime() - new Date(a.isleme_tarihi).getTime())
            .slice(0, 5);
        }
      },
      error: (error) => {
        this.loadingTopics = false;
      }
    });
  }

  loadKonuAnalizi() {
    this.loadingKonuAnalizi = true;

    const userStr = localStorage.getItem('user') || sessionStorage.getItem('user');
    if (!userStr) {
      this.loadingKonuAnalizi = false;
      return;
    }

    let userData;
    try {
      userData = JSON.parse(userStr);
    } catch (error) {
      this.loadingKonuAnalizi = false;
      return;
    }

    const ogrenciId = userData.id;
    if (!ogrenciId) {
      this.loadingKonuAnalizi = false;
      return;
    }

    this.http.get<any>(`./server/api/ogrenci_konu_analizi.php?ogrenci_id=${ogrenciId}`).subscribe({
      next: (response) => {
        this.loadingKonuAnalizi = false;
        if (response.success && response.data) {
          // En başarılı 10 konuyu al
          this.konuAnalizi = response.data.konu_istatistikleri.slice(0, 10);
          
          setTimeout(() => {
            this.createKonuAnaliziChart();
          }, 100);
        }
      },
      error: (error) => {
        this.loadingKonuAnalizi = false;
      }
    });
  }

  createKonuAnaliziChart() {
    const ctx = document.getElementById('konuAnaliziChart') as HTMLCanvasElement;
    if (!ctx || this.konuAnalizi.length === 0) return;

    // Destroy existing chart if it exists
    if (this.konuAnaliziChart) {
      this.konuAnaliziChart.destroy();
    }

    const konuAdlari = this.konuAnalizi.map(konu => {
      const ad = konu.konu_adi;
      return ad.length > 20 ? ad.substring(0, 17) + '...' : ad;
    });

    const basariOranlari = this.konuAnalizi.map(konu => konu.basari_orani);
    
    // Başarı oranına göre renk gradyanı
    const renkler = basariOranlari.map(oran => {
      if (oran >= 80) return '#28a745'; // Yeşil
      if (oran >= 60) return '#ffc107'; // Sarı
      if (oran >= 40) return '#fd7e14'; // Turuncu
      return '#dc3545'; // Kırmızı
    });

    this.konuAnaliziChart = new Chart(ctx, {
      type: 'horizontalBar',
      data: {
        labels: konuAdlari,
        datasets: [{
          label: 'Başarı Oranı (%)',
          data: basariOranlari,
          backgroundColor: renkler.map(color => color + '80'),
          borderColor: renkler,
          borderWidth: 2,
          borderRadius: 6,
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
              title: (context) => {
                const index = context[0].dataIndex;
                return this.konuAnalizi[index].konu_adi;
              },
              label: (context) => {
                const index = context.dataIndex;
                const konu = this.konuAnalizi[index];
                return [
                  `Başarı Oranı: ${context.parsed.x}%`,
                  `Toplam Soru: ${konu.toplam_soru}`,
                  `Doğru: ${konu.dogru_sayisi}`,
                  `Yanlış: ${konu.yanlis_sayisi}`,
                  `Boş: ${konu.bos_sayisi}`
                ];
              }
            }
          }
        },
        scales: {
          x: {
            beginAtZero: true,
            max: 100,
            ticks: {
              callback: function(value) {
                return value + '%';
              },
              font: {
                size: 12,
                weight: 'bold'
              }
            },
            title: {
              display: true,
              text: 'Başarı Oranı (%)',
              font: {
                size: 14,
                weight: 'bold'
              }
            }
          },
          y: {
            ticks: {
              font: {
                size: 11,
                weight: 'bold'
              }
            }
          }
        },
        animation: {
          duration: 1000,
          easing: 'easeInOutQuart'
        }
      }
    });
  }
}