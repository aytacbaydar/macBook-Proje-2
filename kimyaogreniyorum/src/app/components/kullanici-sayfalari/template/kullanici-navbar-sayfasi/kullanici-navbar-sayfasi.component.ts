
import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-kullanici-navbar-sayfasi',
  standalone: false,
  templateUrl: './kullanici-navbar-sayfasi.component.html',
  styleUrl: './kullanici-navbar-sayfasi.component.scss'
})
export class KullaniciNavbarSayfasiComponent implements OnInit {
  userName: string = 'Kullanıcı';
  userAvatar: string = 'ogrenci/ogrenci-1.webp';

  ngOnInit(): void {
    this.loadUserInfo();
  }

  loadUserInfo(): void {
    // LocalStorage'dan kullanıcı bilgilerini al
    const userDataString = localStorage.getItem('userData');
    if (userDataString) {
      try {
        const userData = JSON.parse(userDataString);
        this.userName = userData.name || 'Kullanıcı';
        this.userAvatar = userData.avatar || 'ogrenci/ogrenci-1.webp';
      } catch (error) {
        console.error('Kullanıcı bilgileri yüklenemedi:', error);
      }
    }
  }
}
