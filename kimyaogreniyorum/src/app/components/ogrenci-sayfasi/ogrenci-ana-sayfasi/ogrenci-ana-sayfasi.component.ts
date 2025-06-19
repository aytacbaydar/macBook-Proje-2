import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';

interface RecentTopic {
  id: number;
  konu_id: number;
  konu_adi: string;
  unite_adi: string;
  sinif_seviyesi: string;
  isleme_tarihi: string;
  grup_adi: string;
}

interface ClassStatus {
  toplam_ogrenci: number;
  bugun_gelen: number;
  bugun_gelmeyen: number;
  son_giris_saati: string;
  aktif_ogrenciler: any[];
}

interface WeeklyPerformance {
  hafta: number;
  yil: number;
  hafta_baslangic: string;
  hafta_adi: string;
  katilim_sayisi: number;
  gelen_gun: number;
  gelmeyen_gun: number;
  basari_orani: number;
}

@Component({
  selector: 'app-ogrenci-ana-sayfasi',
  standalone: false,
  templateUrl: './ogrenci-ana-sayfasi.component.html',
  styleUrl: './ogrenci-ana-sayfasi.component.scss',
})
export class OgrenciAnaSayfasiComponent implements OnInit {
  // Sidebar state
  isSidebarOpen: boolean = true;
  // Math object for template use
  Math = Math;
  
  // Current student property
  public currentStudent: string | null = null;
  // Student information
  studentName: string = '';
  studentAvatar: string = '';
  studentClass: string = '';
  studentTeacher: string = '';
  studentGroup: string = '';

  // Dashboard statistics
  totalAttendance: number = 0;
  thisWeekAttendance: number = 0;
  totalLessons: number = 0;
  completedLessons: number = 0;
  totalExams: number = 0;
  passedExams: number = 0;
  currentGrade: string = '';
  nextLesson: string = '';

  // Recent topics
  recentTopics: RecentTopic[] = [];
  isLoadingTopics: boolean = false;
  topicsError: string = '';

  // Class status
  classStatus: ClassStatus | null = null;
  isLoadingClassStatus: boolean = false;
  classStatusError: string = '';

  // Weekly performance
  weeklyPerformance: WeeklyPerformance[] = [];
  isLoadingPerformance: boolean = false;
  performanceError: string = '';

  private apiBaseUrl = './server/api';

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.loadStudentInfo();
    this.loadStudentStats();
    this.loadRecentTopics();
    this.loadClassStatus();
    this.loadWeeklyPerformance();
    this.checkScreenSize();
    window.addEventListener('resize', () => {
      this.checkScreenSize();
    });
  }

  private loadStudentInfo(): void {
    // localStorage veya sessionStorage'dan giriş yapan kullanıcı bilgilerini al
    const userStr =
      localStorage.getItem('user') || sessionStorage.getItem('user');

    if (userStr) {
      try {
        const user = JSON.parse(userStr);

        // Kullanıcı bilgilerini al (API'den gelen response.data formatına uygun)
        this.studentName = user.adi_soyadi || 'Öğrenci';
        this.currentStudent = this.studentName; // Set currentStudent property
        this.studentClass = user.sinif || 'Sınıf Bilgisi Yok';
        this.studentTeacher = user.ogretmeni || 'Öğretmen Bilgisi Yok';
        this.studentGroup = user.grup || user.grubu || '';

        // Avatar kontrolü - API'den gelen avatar alanını kullan
        if (user.avatar && user.avatar.trim() !== '') {
          this.studentAvatar = user.avatar;
        } else {
          // Avatar yoksa UI Avatars ile dinamik oluştur
          this.studentAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(
            this.studentName
          )}&background=28a745&color=fff&size=40&font-size=0.6&rounded=true`;
        }

        console.log('Öğrenci bilgileri yüklendi:', {
          id: user.id,
          name: this.studentName,
          class: this.studentClass,
          teacher: this.studentTeacher,
          avatar: this.studentAvatar,
          userRole: user.rutbe,
        });
      } catch (error) {
        console.error('Kullanıcı bilgileri ayrıştırılırken hata:', error);
        this.setDefaultStudentInfo();
      }
    } else {
      console.warn('Kullanıcı giriş bilgisi bulunamadı');
      this.setDefaultStudentInfo();
    }
  }

  private setDefaultStudentInfo(): void {
    this.studentName = 'Öğrenci';
    this.studentClass = 'Sınıf Bilgisi Yok';
    this.studentTeacher = 'Öğretmen Bilgisi Yok';
    this.studentAvatar =
      'https://ui-avatars.com/api/?name=Öğrenci&background=6c757d&color=fff&size=40&font-size=0.6&rounded=true';
  }

  private loadStudentStats(): void {
    // Gerçek kullanıcı bilgilerini al
    const userStr = localStorage.getItem('user') || sessionStorage.getItem('user');
    if (!userStr) return;

    try {
      const user = JSON.parse(userStr);
      const studentId = user.id;

      // Devamsızlık istatistiklerini getir
      this.loadAttendanceStats(studentId);
      
      // İşlenen konular istatistiklerini getir
      this.loadLessonStats();
      
      // Ödeme durumunu getir
      this.loadPaymentStats(studentId);
      
    } catch (error) {
      console.error('Kullanıcı bilgileri ayrıştırılırken hata:', error);
      this.setDefaultStats();
    }
  }

  private loadAttendanceStats(studentId: number): void {
    const apiUrl = `${this.apiBaseUrl}/devamsizlik_istatistik.php?ogrenci_id=${studentId}`;
    
    this.http.get<any>(apiUrl).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          const stats = response.data;
          this.totalAttendance = stats.toplam_ders || 0;
          this.thisWeekAttendance = stats.bu_hafta_katilim || 0;
          
          console.log('Devamsızlık istatistikleri yüklendi:', stats);
        }
      },
      error: (error) => {
        console.error('Devamsızlık istatistikleri yüklenirken hata:', error);
      }
    });
  }

  private loadLessonStats(): void {
    if (!this.hasValidGroup()) return;

    // Önce tüm konuları yükle
    this.loadAllTopics().then((allTopics) => {
      // Sonra işlenen konuları yükle
      const apiUrl = `${this.apiBaseUrl}/ogrenci_islenen_konular.php?grup=${encodeURIComponent(this.studentGroup)}`;
      
      this.http.get<any>(apiUrl).subscribe({
        next: (response) => {
          if (response.success && response.islenen_konular) {
            this.completedLessons = response.islenen_konular.length;
            this.totalLessons = allTopics.length;
            
            console.log('Ders istatistikleri yüklendi:', {
              toplamKonu: this.totalLessons,
              islenenKonu: this.completedLessons,
              ilerlemeyuzdesi: this.getLessonProgress()
            });
          }
        },
        error: (error) => {
          console.error('Ders istatistikleri yüklenirken hata:', error);
        }
      });
    }).catch((error) => {
      console.error('Konu listesi yüklenirken hata:', error);
    });
  }

  // Öğrencinin sınıf seviyesine göre filtrelenmiş tüm konuları yükle
  private loadAllTopics(): Promise<any[]> {
    return new Promise((resolve, reject) => {
      const userStr = localStorage.getItem('user') || sessionStorage.getItem('user');
      if (!userStr) {
        reject('Kullanıcı bilgisi bulunamadı');
        return;
      }

      let token = '';
      let studentClass = '';
      try {
        const user = JSON.parse(userStr);
        token = user.token || '';
        studentClass = user.sinif || '';
      } catch (error) {
        console.error('Kullanıcı bilgileri ayrıştırılırken hata:', error);
        reject('Kullanıcı bilgileri ayrıştırılamadı');
        return;
      }

      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      this.http.get<any>(`${this.apiBaseUrl}/konu_listesi.php`, { headers }).subscribe({
        next: (response) => {
          if (response.success && response.konular) {
            let filteredTopics = response.konular;

            // Sınıf seviyesine göre filtrele
            if (studentClass) {
              // Mezun veya 12.Sınıf ise tüm konuları göster
              const isMezunOr12 = studentClass && (
                studentClass.toLowerCase().includes('mezun') || 
                studentClass === '12' || 
                studentClass === '12.Sınıf'
              );

              if (!isMezunOr12) {
                // Belirli sınıf seviyesi için konuları filtrele
                filteredTopics = response.konular.filter((konu: any) => {
                  const konuSinif = konu.sinif_seviyesi;
                  const normalizedKonuSinif = konuSinif.replace('.Sınıf', '');
                  const normalizedStudentLevel = studentClass.replace('.Sınıf', '');
                  
                  return normalizedKonuSinif === normalizedStudentLevel || 
                         konuSinif === studentClass ||
                         konuSinif === studentClass + '.Sınıf' ||
                         konuSinif + '.Sınıf' === studentClass;
                });
              }
            }

            resolve(filteredTopics);
          } else {
            reject('Konular yüklenemedi');
          }
        },
        error: (error) => {
          console.error('Konu listesi yüklenirken hata:', error);
          reject('Konu listesi yüklenemedi');
        }
      });
    });
  }

  private loadPaymentStats(studentId: number): void {
    // Ödeme bilgilerini öğretmen API'sinden al (öğrenci kendi ödeme durumunu görebilir)
    const apiUrl = `${this.apiBaseUrl}/ogrenci_detay_istatistik.php?ogrenci_id=${studentId}`;
    
    this.http.get<any>(apiUrl).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          const student = response.data.student_info;
          // Ödeme durumuna göre not ortalaması simülasyonu
          if (student.son_odeme_tarihi) {
            this.currentGrade = 'A-';
          } else {
            this.currentGrade = 'B';
          }
        }
      },
      error: (error) => {
        console.error('Ödeme istatistikleri yüklenirken hata:', error);
        this.currentGrade = 'B+';
      }
    });
  }

  private setDefaultStats(): void {
    this.totalAttendance = 0;
    this.thisWeekAttendance = 0;
    this.totalLessons = 0;
    this.completedLessons = 0;
    this.totalExams = 0;
    this.passedExams = 0;
    this.currentGrade = 'N/A';
    this.nextLesson = 'Henüz planlanmadı';
  }

  toggleSidebar(): void {
    this.isSidebarOpen = !this.isSidebarOpen;
    // Kullanıcının tercihini kaydet
    localStorage.setItem('sidebarOpen', JSON.stringify(this.isSidebarOpen));
  }

  private checkScreenSize(): void {
    if (window.innerWidth < 768) {
      this.isSidebarOpen = false;
    } else {
      // Desktop'ta kullanıcının son tercihini localStorage'dan al
      const savedState = localStorage.getItem('sidebarOpen');
      this.isSidebarOpen = savedState ? JSON.parse(savedState) : true;
    }
  }

  // Yardımcı metotlar
  getAttendancePercentage(): number {
    return Math.round((this.thisWeekAttendance / 5) * 100);
  }

  getLessonProgress(): number {
    return Math.round((this.completedLessons / this.totalLessons) * 100);
  }

  getExamSuccessRate(): number {
    return Math.round((this.passedExams / this.totalExams) * 100);
  }

  // Son işlenen konuları yükle
  loadRecentTopics(): void {
    if (!this.hasValidGroup()) {
      this.topicsError = 'Grup bilgisi bulunamadı. Lütfen öğretmeninizle iletişime geçin.';
      return;
    }

    this.isLoadingTopics = true;
    this.topicsError = '';

    const apiUrl = `${
      this.apiBaseUrl
    }/ogrenci_islenen_konular.php?grup=${encodeURIComponent(
      this.studentGroup
    )}`;

    this.http.get<any>(apiUrl).subscribe({
      next: (response) => {
        if (response.success && response.islenen_konular) {
          // Son 5 konuyu al ve tarihe göre sırala
          this.recentTopics = response.islenen_konular
            .sort(
              (a: any, b: any) =>
                new Date(b.isleme_tarihi).getTime() -
                new Date(a.isleme_tarihi).getTime()
            )
            .slice(0, 5);
        } else {
          this.recentTopics = [];
        }
        this.isLoadingTopics = false;
      },
      error: (error) => {
        console.error('Son konular yüklenirken hata:', error);
        this.topicsError = 'Konular yüklenirken hata oluştu';
        this.isLoadingTopics = false;
      },
    });
  }

  // Tarihi formatla
  formatDate(dateString: string): string {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    // Bugün mü?
    if (date.toDateString() === today.toDateString()) {
      return 'Bugün';
    }
    // Dün mü?
    else if (date.toDateString() === yesterday.toDateString()) {
      return 'Dün';
    }
    // Bu hafta mı?
    else {
      const daysDiff = Math.floor(
        (today.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)
      );
      if (daysDiff <= 7) {
        return `${daysDiff} gün önce`;
      } else {
        return date.toLocaleDateString('tr-TR', {
          day: 'numeric',
          month: 'short',
        });
      }
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

  // Retry method for better error handling
  retryLoadTopics(): void {
    this.topicsError = '';
    this.loadRecentTopics();
  }

  // Sınıf durumunu yükle
  loadClassStatus(): void {
    if (!this.hasValidGroup()) {
      this.classStatusError = 'Grup bilgisi bulunamadı';
      return;
    }

    this.isLoadingClassStatus = true;
    this.classStatusError = '';

    const apiUrl = `${this.apiBaseUrl}/sinif_durumu.php?grup=${encodeURIComponent(this.studentGroup)}`;

    this.http.get<any>(apiUrl).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.classStatus = response.data;
          console.log('Sınıf durumu yüklendi:', this.classStatus);
        } else {
          this.classStatusError = 'Sınıf durumu bilgisi alınamadı';
        }
        this.isLoadingClassStatus = false;
      },
      error: (error) => {
        console.error('Sınıf durumu yüklenirken hata:', error);
        this.classStatusError = 'Sınıf durumu yüklenirken hata oluştu';
        this.isLoadingClassStatus = false;
      }
    });
  }

  // Helper method for safe navigation
  hasValidGroup(): boolean {
    return !!(this.studentGroup && this.studentGroup.trim());
  }

  // Haftalık performansı yükle
  loadWeeklyPerformance(): void {
    const userStr = localStorage.getItem('user') || sessionStorage.getItem('user');
    if (!userStr) return;

    try {
      const user = JSON.parse(userStr);
      const studentId = user.id;

      this.isLoadingPerformance = true;
      this.performanceError = '';

      const apiUrl = `${this.apiBaseUrl}/haftalik_performans.php?ogrenci_id=${studentId}&hafta_sayisi=4`;

      this.http.get<any>(apiUrl).subscribe({
        next: (response) => {
          if (response.success && response.data) {
            this.weeklyPerformance = response.data.haftalik_performans || [];
            console.log('Haftalık performans yüklendi:', this.weeklyPerformance);
          } else {
            this.performanceError = 'Performans verileri alınamadı';
          }
          this.isLoadingPerformance = false;
        },
        error: (error) => {
          console.error('Haftalık performans yüklenirken hata:', error);
          this.performanceError = 'Performans verileri yüklenirken hata oluştu';
          this.isLoadingPerformance = false;
        }
      });
    } catch (error) {
      console.error('Kullanıcı bilgileri ayrıştırılırken hata:', error);
      this.isLoadingPerformance = false;
    }
  }

  // Chart yardımcı metotları
  getMaxPerformance(): number {
    if (this.weeklyPerformance.length === 0) return 100;
    return Math.max(...this.weeklyPerformance.map(w => w.basari_orani), 100);
  }

  getAveragePerformance(): number {
    if (this.weeklyPerformance.length === 0) return 0;
    const total = this.weeklyPerformance.reduce((sum, w) => sum + w.basari_orani, 0);
    return Math.round(total / this.weeklyPerformance.length);
  }
}
