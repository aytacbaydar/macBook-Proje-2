
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
    this.loadTeacherData();
    this.checkScreenSize();
    window.addEventListener('resize', () => {
      this.checkScreenSize();
    });
  }

  toggleSidebar(): void {
    this.isSidebarOpen = !this.isSidebarOpen;
  }

  private loadTeacherData(): void {
    // LocalStorage veya sessionStorage'dan öğretmen bilgilerini al
    const userStr = localStorage.getItem('user') || sessionStorage.getItem('user');
    
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        this.teacherName = user.ogrt_adi_soyadi || user.adi_soyadi || 'Öğretmen';
        
        // Avatar için önce user.avatar'ı kontrol et, yoksa isim baş harflerinden oluştur
        if (user.avatar && user.avatar.trim() !== '') {
          this.teacherAvatar = user.avatar;
        } else {
          // İsimden baş harfleri alarak avatar oluştur
          const names = this.teacherName.split(' ');
          const initials = names.map(name => name.charAt(0)).join('').toUpperCase().substring(0, 2);
          this.teacherAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(this.teacherName)}&background=007bff&color=fff&size=32&font-size=0.6&format=png&rounded=true`;
        }
      } catch (error) {
        console.error('Öğretmen bilgileri yüklenirken hata:', error);
        this.teacherName = 'Öğretmen';
        this.teacherAvatar = 'https://ui-avatars.com/api/?name=Öğretmen&background=007bff&color=fff&size=32&font-size=0.6&format=png&rounded=true';
      }
    } else {
      // Giriş yapılmamışsa varsayılan değerler
      this.teacherName = 'Öğretmen';
      this.teacherAvatar = 'https://ui-avatars.com/api/?name=Öğretmen&background=007bff&color=fff&size=32&font-size=0.6&format=png&rounded=true';
    }
  }

  private checkScreenSize(): void {
    if (window.innerWidth < 768) {
      this.isSidebarOpen = false;
    } else {
      this.isSidebarOpen = true;
    }
  }
}
