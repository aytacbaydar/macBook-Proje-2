import { Component, OnInit, AfterViewInit } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Chart, registerables } from 'chart.js';
import { MobileDetectionService } from '../../../shared/services/mobile-detection.service';

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
  selector: 'app-kullanici-ana-sayfa-sayfasi',
  templateUrl: './kullanici-ana-sayfa-sayfasi.component.html',
  styleUrls: ['./kullanici-ana-sayfa-sayfasi.component.scss'],
  standalone: false
})
export class KullaniciAnaSayfaSayfasiComponent implements OnInit, AfterViewInit {
  // Sidebar state
  isSidebarOpen: boolean = false;

  // Student information
  studentName: string = '';
  studentAvatar: string = '';
  studentClass: string = '';
  studentTeacher: string = '';
  studentGroup: string = '';

  // Loading state
  isLoading: boolean = false;
  error: string = '';

  // Missing info modal
  showMissingInfoModal: boolean = false;
  missingFields: string[] = [];

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

  // APK download section
  hideAPKSection: boolean = false;

  constructor(
    private http: HttpClient,
    private mobileDetectionService: MobileDetectionService
  ) {}

  ngOnInit(): void {
    this.loadStudentInfo();
    this.checkScreenSize();
    this.loadSinavSonuclari();
    this.loadSonIslenenKonular();
    this.loadKonuAnalizi();
    this.checkMissingInfo();
    window.addEventListener('resize', () => {
      this.checkScreenSize();
    });

    // Mobile app alert now manages itself
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

    this.http.get<any>(`./server/api/ogrenci_tum_sinav_sonuclari.php`).subscribe({
      next: (response) => {
        this.loadingExamResults = false;
        if (response.success && response.data) {
          // Tüm sınav sonuçlarını al ve öğrenci ID'sine göre filtrele
          const tumSinavSonuclari = response.data.sinav_sonuclari || [];
          
          // Sadece bu öğrencinin sınavlarını filtrele
          const ogrenciSinavlari = tumSinavSonuclari.filter((sinav: any) => 
            sinav.ogrenci_id == ogrenciId
          );
          
          // Son 5 sınav sonucunu al
          this.sinavSonuclari = ogrenciSinavlari.slice(-5);

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
      return ad.length > 5 ? ad.substring(0, 12) + '' : ad;
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
          this.konuAnalizi = response.data.konu_istatistikleri || [];
        }
      },
      error: (error) => {
        this.loadingKonuAnalizi = false;
      }
    });
  }

  getKonuSuccessColor(basariOrani: number): string {
    if (basariOrani >= 80) return '#28a745'; // Yeşil
    if (basariOrani >= 60) return '#ffc107'; // Sarı
    if (basariOrani >= 40) return '#fd7e14'; // Turuncu
    return '#dc3545'; // Kırmızı
  }

  getKonuSuccessText(basariOrani: number): string {
    if (basariOrani >= 80) return 'Mükemmel';
    if (basariOrani >= 60) return 'İyi';
    if (basariOrani >= 40) return 'Orta';
    return 'Geliştirilmeli';
  }

  checkMissingInfo(): void {
    const userStr = localStorage.getItem('user') || sessionStorage.getItem('user');
    
    if (!userStr) return;

    try {
      const user = JSON.parse(userStr);
      const token = user.token || '';

      if (!token) {
        console.log('Token bulunamadı, modal kontrolü yapılamıyor');
        return;
      }

      // API'den güncel öğrenci bilgilerini al
      this.http.get<any>(`./server/api/ogrenci_bilgileri.php`, {
        headers: { Authorization: `Bearer ${token}` }
      }).subscribe({
        next: (response) => {
          if (response.success && response.data) {
            const studentData = response.data;
            this.missingFields = [];

            console.log('API\'den gelen öğrenci bilgileri:', {
              okulu: studentData.okulu,
              sinifi: studentData.sinifi,
              veli_adi: studentData.veli_adi,
              veli_cep: studentData.veli_cep
            });

            // Okulu kontrolü
            if (!studentData.okulu || studentData.okulu.trim() === '' || studentData.okulu === null || studentData.okulu === undefined) {
              this.missingFields.push('Okul');
              console.log('Okul bilgisi eksik:', studentData.okulu);
            }

            // Sınıfı kontrolü  
            if (!studentData.sinifi || studentData.sinifi.trim() === '' || studentData.sinifi === null || studentData.sinifi === undefined) {
              this.missingFields.push('Sınıf');
              console.log('Sınıf bilgisi eksik:', studentData.sinifi);
            }

            // Veli Adı kontrolü
            if (!studentData.veli_adi || studentData.veli_adi.trim() === '' || studentData.veli_adi === null || studentData.veli_adi === undefined) {
              this.missingFields.push('Veli Adı');
              console.log('Veli adı bilgisi eksik:', studentData.veli_adi);
            }

            // Veli Cep telefonu kontrolü
            if (!studentData.veli_cep || studentData.veli_cep.trim() === '' || studentData.veli_cep === null || studentData.veli_cep === undefined) {
              this.missingFields.push('Veli Cep Telefonu');
              console.log('Veli cep telefonu bilgisi eksik:', studentData.veli_cep);
            }

            console.log('Eksik alanlar:', this.missingFields);

            // SADECE eksik bilgi varsa modal'ı göster
            if (this.missingFields.length > 0) {
              this.showMissingInfoModal = true;
              console.log('Modal gösteriliyor - Eksik bilgiler:', this.missingFields);
            } else {
              this.showMissingInfoModal = false;
              console.log('Tüm bilgiler tam - Modal gösterilmeyecek');
            }
          } else {
            console.error('API\'den öğrenci bilgileri alınamadı:', response.message);
          }
        },
        error: (error) => {
          console.error('Öğrenci bilgileri kontrol edilirken hata:', error);
        }
      });
    } catch (error) {
      console.error('User bilgisi kontrol edilirken hata:', error);
    }
  }

  closeMissingInfoModal(): void {
    this.showMissingInfoModal = false;
  }

  goToProfile(): void {
    this.showMissingInfoModal = false;
    // Router ile profil sayfasına yönlendir
    window.location.href = '/ogrenci-sayfasi/ogrenci-profil-sayfasi';
  }


  shouldShowAPKDownload(): boolean {
    // Android cihazlarda ve APK section gizlenmemişse göster
    const isHidden = localStorage.getItem('apk-section-hidden');
    if (isHidden && new Date().getTime() < parseInt(isHidden)) {
      return false;
    }
    return this.mobileDetectionService.getPlatform() === 'android' && !this.hideAPKSection;
  }

  downloadAPK(): void {
    // APK indirme işlemi
    const link = document.createElement('a');
    link.href = '/downloads/kimya-ogreniyorum.apk';
    link.download = 'kimya-ogreniyorum.apk';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    console.log('APK download started');
  }

  hideAPKDownload(): void {
    this.hideAPKSection = true;
    // 24 saat boyunca gizle
    const hideTime = new Date().getTime() + (24 * 60 * 60 * 1000);
    localStorage.setItem('apk-section-hidden', hideTime.toString());
  }
}