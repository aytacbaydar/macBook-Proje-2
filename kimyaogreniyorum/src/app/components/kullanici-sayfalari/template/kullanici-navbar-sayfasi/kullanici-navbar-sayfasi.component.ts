import { Component, OnInit, Output, EventEmitter } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';

@Component({
  selector: 'app-kullanici-navbar-sayfasi',
  standalone: false,
  templateUrl: './kullanici-navbar-sayfasi.component.html',
  styleUrl: './kullanici-navbar-sayfasi.component.scss'
})
export class KullaniciNavbarSayfasiComponent implements OnInit {
  @Output() sidebarToggle = new EventEmitter<void>();

  userName: string = 'Kullanıcı';
  userAvatar: string = 'https://ui-avatars.com/api/?name=Kullanici&background=ff6600&color=fff';
  isBottomSheetOpen: boolean = false;


    // Student information
  studentName: string = '';
  studentAvatar: string = '';
  studentClass: string = '';
  studentGrup: string = '';
  studentTeacher: string = '';
  studentKategori: string = '';

  // Dashboard statistics
  totalAttendance: number = 0;
  thisWeekAttendance: number = 0;
  totalLessons: number = 0;
  completedLessons: number = 0;
  totalExams: number = 0;
  passedExams: number = 0;
  currentGrade: string = '';
  nextLesson: string = '';




  constructor(private http: HttpClient, private router: Router) {}


  ngOnInit(): void {
    this.loadStudentInfo();
    this.loadStudentStats();
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
        this.studentKategori = user.kategori || 'kategori bilgisi yok';
        this.studentGrup = user.grubu || 'grup bilgisi yok';

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
          kategori: this.studentKategori,
          userRole: user.rutbe,
          grup: this.studentGrup
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

  toggleBottomSheet(): void {
    this.isBottomSheetOpen = !this.isBottomSheetOpen;
    if (this.isBottomSheetOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
  }

  closeBottomSheet(): void {
    this.isBottomSheetOpen = false;
    document.body.style.overflow = '';
  }

  logout(): void {
    localStorage.clear();
    this.closeBottomSheet();
    this.router.navigate(['/']);
  }

  toggleSidebar(): void {
    this.sidebarToggle.emit();
  }

}