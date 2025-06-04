import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-ogretmen-navbar-sayfasi',
  standalone: false,
  templateUrl: './ogretmen-navbar-sayfasi.component.html',
  styleUrl: './ogretmen-navbar-sayfasi.component.scss',
})
export class OgretmenNavbarSayfasiComponent implements OnInit {
  // Sidebar state
  isSidebarOpen: boolean = true;

  // Teacher information
  teacherName: string = '';
  teacherAvatar: string = '';

  // Dashboard statistics
  totalStudents: number = 45;
  activeStudents: number = 42;
  totalGroups: number = 8;
  activeGroups: number = 6;
  totalTopics: number = 24;
  completedTopics: number = 18;
  totalExams: number = 12;
  pendingExams: number = 3;

  constructor() {}

  ngOnInit(): void {
    this.loadTeacherInfo();
    this.checkScreenSize();
    window.addEventListener('resize', () => {
      this.checkScreenSize();
    });
  }

  private loadTeacherInfo(): void {
    // localStorage veya sessionStorage'dan giriş yapan kullanıcı bilgilerini al
    const userStr =
      localStorage.getItem('user') || sessionStorage.getItem('user');

    if (userStr) {
      try {
        const user = JSON.parse(userStr);

        // Kullanıcı bilgilerini al (API'den gelen response.data formatına uygun)
        this.teacherName = user.adi_soyadi || 'Öğretmen';

        // Avatar kontrolü - API'den gelen avatar alanını kullan
        if (user.avatar && user.avatar.trim() !== '') {
          this.teacherAvatar = user.avatar;
        } else {
          // Avatar yoksa UI Avatars ile dinamik oluştur
          this.teacherAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(
            this.teacherName
          )}&background=4f46e5&color=fff&size=40&font-size=0.6&rounded=true`;
        }

        console.log('Öğretmen bilgileri yüklendi:', {
          id: user.id,
          name: this.teacherName,
          avatar: this.teacherAvatar,
          userRole: user.rutbe,
        });
      } catch (error) {
        console.error('Kullanıcı bilgileri ayrıştırılırken hata:', error);
        this.setDefaultTeacherInfo();
      }
    } else {
      console.warn('Kullanıcı giriş bilgisi bulunamadı');
      this.setDefaultTeacherInfo();
    }
  }

  private setDefaultTeacherInfo(): void {
    this.teacherName = 'Öğretmen';
    this.teacherAvatar =
      'https://ui-avatars.com/api/?name=Öğretmen&background=6c757d&color=fff&size=40&font-size=0.6&rounded=true';
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
}