
import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-kullanici-sidebar-sayfasi',
  standalone: false,
  templateUrl: './kullanici-sidebar-sayfasi.component.html',
  styleUrl: './kullanici-sidebar-sayfasi.component.scss'
})
export class KullaniciSidebarSayfasiComponent implements OnInit {
  isCollapsed = true;
  userName = 'Kullanıcı Adı';
  userRole = 'Öğrenci';
  userAvatar = '';
  notificationCount = 5;

  ngOnInit(): void {
    // Kullanıcı bilgilerini yükle
    this.loadUserInfo();
  }

  loadUserInfo(): void {
    // localStorage veya service'den kullanıcı bilgilerini çek
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (user) {
      this.userName = user.adi_soyadi || user.name || 'Kullanıcı';
      this.userRole = user.rutbe || 'Kullanıcı';
      this.userAvatar = user.avatar || '';
    }
  }

  toggleSidebar(): void {
    this.isCollapsed = !this.isCollapsed;
  }

  logout(): void {
    if (confirm('Çıkış yapmak istediğinize emin misiniz?')) {
      localStorage.clear();
      sessionStorage.clear();
      window.location.href = '/';
    }
  }
}
