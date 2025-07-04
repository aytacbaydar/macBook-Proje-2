import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-ogrenci-navbar-sayfasi',
  standalone: false,
  templateUrl: './ogrenci-navbar-sayfasi.component.html',
  styleUrl: './ogrenci-navbar-sayfasi.component.scss',
})
export class OgrenciNavbarSayfasiComponent implements OnInit {
  // Sidebar state
  isSidebarOpen: boolean = true;

  // Student information
  studentName: string = '';
  studentAvatar: string = '';
  studentClass: string = '';
  studentTeacher: string = '';

  // Dashboard statistics
  totalAttendance: number = 0;
  thisWeekAttendance: number = 0;
  totalLessons: number = 0;
  completedLessons: number = 0;
  totalExams: number = 0;
  passedExams: number = 0;
  currentGrade: string = '';
  nextLesson: string = '';

  constructor() {}

  ngOnInit(): void {
    this.loadStudentInfo();
    this.loadStudentStats();
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
        this.studentClass = user.sinifi || 'Sınıf Bilgisi Yok';
        this.studentTeacher = user.ogretmeni || 'Öğretmen Bilgisi Yok';

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
    const isMobile = window.innerWidth < 768;

    if (isMobile) {
      // Mobile'da sidebar kapalı başlasın
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
}
