import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';

@Component({
  selector: 'app-kullanici-navbar-sayfasi',
  standalone: false,
  templateUrl: './kullanici-navbar-sayfasi.component.html',
  styleUrl: './kullanici-navbar-sayfasi.component.scss'
})
export class KullaniciNavbarSayfasiComponent implements OnInit {
  userName: string = 'Kullanıcı';
  userAvatar: string = 'https://ui-avatars.com/api/?name=Kullanici&background=ff6600&color=fff';
  isBottomSheetOpen: boolean = false;

  constructor(private http: HttpClient, private router: Router) {}

  ngOnInit(): void {
    this.loadUserData();
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

  loadUserData(): void {
    const token = localStorage.getItem('token');
    if (!token) {
      console.log('Token bulunamadı');
      return;
    }

    const userData = JSON.parse(localStorage.getItem('user') || '{}');

    if (userData && userData.name) {
      this.userName = userData.name;

      // Avatar varsa kullan, yoksa UI Avatars kullan
      if (userData.avatar && userData.avatar.trim() !== '') {
        this.userAvatar = userData.avatar.startsWith('http') 
          ? userData.avatar 
          : `https://www.kimyaogreniyorum.com/${userData.avatar}`;
      } else {
        // İsimden avatar oluştur
        const nameParts = userData.name.split(' ');
        const initials = nameParts.map((n: string) => n[0]).join('');
        this.userAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(userData.name)}&background=ff6600&color=fff&size=128`;
      }
    } else {
      // API'den kullanıcı bilgilerini çek
      this.http.get<any>('https://www.kimyaogreniyorum.com/server/api/kullanici_profil.php', {
        headers: { 'Authorization': `Bearer ${token}` }
      }).subscribe({
        next: (response) => {
          if (response.success && response.data) {
            this.userName = response.data.adi_soyadi || response.data.name || 'Kullanıcı';

            if (response.data.avatar && response.data.avatar.trim() !== '') {
              this.userAvatar = response.data.avatar.startsWith('http') 
                ? response.data.avatar 
                : `https://www.kimyaogreniyorum.com/${response.data.avatar}`;
            } else {
              this.userAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(this.userName)}&background=ff6600&color=fff&size=128`;
            }

            // Kullanıcı bilgilerini localStorage'a kaydet
            localStorage.setItem('user', JSON.stringify({
              name: this.userName,
              avatar: response.data.avatar
            }));
          }
        },
        error: (error) => {
          console.error('Kullanıcı bilgileri yüklenirken hata:', error);
        }
      });
    }
  }
}