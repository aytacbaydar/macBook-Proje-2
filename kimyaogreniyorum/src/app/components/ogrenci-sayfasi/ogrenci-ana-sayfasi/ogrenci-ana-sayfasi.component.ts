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

@Component({
  selector: 'app-ogrenci-ana-sayfasi',
  standalone: false,
  templateUrl: './ogrenci-ana-sayfasi.component.html',
  styleUrl: './ogrenci-ana-sayfasi.component.scss'
})
export class OgrenciAnaSayfasiComponent implements OnInit {

  // Sidebar state
  isSidebarOpen: boolean = true;

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

  private apiBaseUrl = './server/api';

  constructor(private http: HttpClient) { }

  ngOnInit(): void {
    this.loadStudentInfo();
    this.loadStudentStats();
    this.loadRecentTopics();
    this.checkScreenSize();
    window.addEventListener('resize', () => {
      this.checkScreenSize();
    });
  }

  private loadStudentInfo(): void {
    // localStorage veya sessionStorage'dan giriş yapan kullanıcı bilgilerini al
    const userStr = localStorage.getItem('user') || sessionStorage.getItem('user');
    
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        
        // Kullanıcı bilgilerini al (API'den gelen response.data formatına uygun)
        this.studentName = user.adi_soyadi || 'Öğrenci';
        this.studentClass = user.sinif || 'Sınıf Bilgisi Yok';
        this.studentTeacher = user.ogretmeni || 'Öğretmen Bilgisi Yok';
        this.studentGroup = user.grup || user.grubu || '';
        
        // Avatar kontrolü - API'den gelen avatar alanını kullan
        if (user.avatar && user.avatar.trim() !== '') {
          this.studentAvatar = user.avatar;
        } else {
          // Avatar yoksa UI Avatars ile dinamik oluştur
          this.studentAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(this.studentName)}&background=28a745&color=fff&size=40&font-size=0.6&rounded=true`;
        }
        
        console.log('Öğrenci bilgileri yüklendi:', {
          id: user.id,
          name: this.studentName,
          class: this.studentClass,
          teacher: this.studentTeacher,
          avatar: this.studentAvatar,
          userRole: user.rutbe
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
    this.studentAvatar = 'https://ui-avatars.com/api/?name=Öğrenci&background=6c757d&color=fff&size=40&font-size=0.6&rounded=true';
  }

  private loadStudentStats(): void {
    // Örnek istatistik verileri - gerçek uygulamada API'den gelecek
    this.totalAttendance = 85;
    this.thisWeekAttendance = 4;
    this.totalLessons = 24;
    this.completedLessons = 18;
    this.totalExams = 8;
    this.passedExams = 6;
    this.currentGrade = 'B+';
    this.nextLesson = 'Kimya Bağları';
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
    if (!this.studentGroup) {
      this.topicsError = 'Grup bilgisi bulunamadı';
      return;
    }

    this.isLoadingTopics = true;
    this.topicsError = '';

    const apiUrl = `${this.apiBaseUrl}/ogrenci_islenen_konular.php?grup=${encodeURIComponent(this.studentGroup)}`;

    this.http.get<any>(apiUrl).subscribe({
      next: (response) => {
        if (response.success && response.islenen_konular) {
          // Son 5 konuyu al ve tarihe göre sırala
          this.recentTopics = response.islenen_konular
            .sort((a: any, b: any) => new Date(b.isleme_tarihi).getTime() - new Date(a.isleme_tarihi).getTime())
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
      }
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
      const daysDiff = Math.floor((today.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
      if (daysDiff <= 7) {
        return `${daysDiff} gün önce`;
      } else {
        return date.toLocaleDateString('tr-TR', { 
          day: 'numeric', 
          month: 'short' 
        });
      }
    }
  }
}
