import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-ogretmen-index-sayfasi',
  templateUrl: './ogretmen-index-sayfasi.component.html',
  styleUrls: ['./ogretmen-index-sayfasi.component.scss'],
  standalone: false,
})
export class OgretmenIndexSayfasiComponent implements OnInit {

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

  constructor() { }

  ngOnInit(): void {
    this.loadTeacherInfo();
    this.checkScreenSize();
    window.addEventListener('resize', () => {
      this.checkScreenSize();
    });
  }

  private loadTeacherInfo(): void {
    // LocalStorage veya sessionStorage'dan giriş yapan öğretmen bilgilerini al
    const userStr = localStorage.getItem('user') || sessionStorage.getItem('user');
    if (userStr) {
      try {
        const loggedInUser = JSON.parse(userStr);
        this.teacherName = loggedInUser.adi_soyadi || 'Öğretmen';

        // Avatar varsa kullan, yoksa UI Avatars ile dinamik oluştur
        if (loggedInUser.avatar) {
          this.teacherAvatar = loggedInUser.avatar;
        } else {
          // İsim ve soyismin ilk harflerini al
          const nameParts = this.teacherName.split(' ');
          const initials = nameParts.map(part => part.charAt(0)).join('').toUpperCase();
          this.teacherAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(this.teacherName)}&background=4f46e5&color=fff&size=32&font-size=0.6`;
        }
      } catch (error) {
        console.error('Kullanıcı bilgileri yüklenirken hata:', error);
        this.teacherName = 'Öğretmen';
        this.teacherAvatar = 'https://ui-avatars.com/api/?name=Öğretmen&background=4f46e5&color=fff&size=32&font-size=0.6';
      }
    } else {
      // Giriş bilgisi bulunamadı
      this.teacherName = 'Öğretmen';
      this.teacherAvatar = 'https://ui-avatars.com/api/?name=Öğretmen&background=4f46e5&color=fff&size=32&font-size=0.6';
    }
  }

  toggleSidebar(): void {
    this.isSidebarOpen = !this.isSidebarOpen;
  }

  private checkScreenSize(): void {
    if (window.innerWidth < 768) {
      this.isSidebarOpen = false;
    } else {
      this.isSidebarOpen = true;
    }
  }
}