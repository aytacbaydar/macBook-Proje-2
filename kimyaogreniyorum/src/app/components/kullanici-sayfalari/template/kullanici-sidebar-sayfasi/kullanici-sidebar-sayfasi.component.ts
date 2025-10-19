
import { Component, OnInit } from '@angular/core';
import { AlertService } from '../../../../services/alert.service';

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

  constructor(private readonly alertService: AlertService) {}

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

  async logout(): Promise<void> {
    const confirmed = await this.alertService.confirm({
      title: 'Çıkış Yap',
      text: 'Çıkış yapmak istediğinize emin misiniz?',
      icon: 'question',
      confirmButtonText: 'Evet, çıkış yap',
      cancelButtonText: 'Vazgeç',
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#2563eb',
      reverseButtons: true,
    });
    if (!confirmed) {
      return;
    }
    localStorage.clear();
    sessionStorage.clear();
    window.location.href = '/';
  }
}
