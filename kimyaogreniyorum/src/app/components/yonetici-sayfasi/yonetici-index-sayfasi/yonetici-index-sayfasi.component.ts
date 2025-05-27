import { HttpClient } from '@angular/common/http';
import { Component, OnInit, HostListener } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-yonetici-index-sayfasi',
  standalone: false,
  templateUrl: './yonetici-index-sayfasi.component.html',
  styleUrl: './yonetici-index-sayfasi.component.scss',
})
export class YoneticiIndexSayfasiComponent implements OnInit {
  sidebarExpanded = true;
  admin = {
    adi_soyadi: '',
    email: '',
    avatar: '',
  };
  isLoading = true;
  currentDate = new Date();
  currentPage = 'Dashboard';
  showNotifications = false;
  showMessages = false;
  showUserMenu = false;
  isSettingsOpen = false;
  isStudentsOpen = false;
  windowWidth = window.innerWidth;

  constructor(private http: HttpClient, public router: Router) {
    // Router olaylarını dinleyerek aktif sayfa adını güncelle
    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe(() => {
        this.updateCurrentPage();
        // Mobil görünümde sayfa değiştikçe sidebar'ı otomatik kapat
        if (this.windowWidth < 992) {
          this.sidebarExpanded = false;
        }
        // Sayfa değiştiğinde açık dropdown'ları kapat
        this.closeAllDropdowns();
      });
  }

  ngOnInit(): void {
    // Pencere boyutuna göre başlangıç durumunu ayarla
    this.checkWindowSize();

    // Saat ve tarihi periyodik olarak güncelle
    setInterval(() => {
      this.currentDate = new Date();
    }, 60000);

    // LocalStorage ve sessionStorage'dan kullanıcı bilgilerini kontrol et
    let userStr = localStorage.getItem('user');

    if (!userStr) {
      userStr = sessionStorage.getItem('user');
    }

    if (!userStr) {
      this.router.navigate(['/']);
      return;
    }

    try {
      const user = JSON.parse(userStr);

      // Kullanıcı admin değilse yönlendir
      if (user.rutbe !== 'admin') {
        this.router.navigate(['/']);
        return;
      }

      // Kullanıcı bilgilerini ayarla
      this.admin = {
        adi_soyadi: user.adi_soyadi || 'Admin',
        email: user.email || '',
        avatar:
          user.avatar ||
          'https://ui-avatars.com/api/?name=' +
            encodeURIComponent(user.adi_soyadi || 'Admin') +
            '&background=random',
      };

      this.isLoading = false;
    } catch (error) {
      this.router.navigate(['/']);
    }

    // Aktif sayfa başlığını ayarla
    this.updateCurrentPage();
  }

  @HostListener('window:resize', ['$event'])
  onResize(event: any) {
    this.windowWidth = event.target.innerWidth;
    this.checkWindowSize();
  }

  // Pencere boyutuna göre sidebar durumunu ayarla
  checkWindowSize(): void {
    if (this.windowWidth < 992) {
      this.sidebarExpanded = false;
    } else {
      this.sidebarExpanded = true;
    }
  }

  // Sidebar için
  submenuHeight = 0;

  toggleSidebar() {
    this.sidebarExpanded = !this.sidebarExpanded;
    // localStorage'a kullanıcı tercihini kaydet
    localStorage.setItem('sidebarExpanded', this.sidebarExpanded.toString());
  }

  toggleNotifications() {
    this.showNotifications = !this.showNotifications;
    this.showMessages = false;
    this.showUserMenu = false;
  }

  toggleMessages() {
    this.showMessages = !this.showMessages;
    this.showNotifications = false;
    this.showUserMenu = false;
  }

  toggleUserMenu() {
    this.showUserMenu = !this.showUserMenu;
    this.showNotifications = false;
    this.showMessages = false;
  }

  toggleSettings(event?: Event) {
    if (event) {
      event.preventDefault();
    }
    this.isSettingsOpen = !this.isSettingsOpen;
  }

  toggleStudents(event?: Event) {
    if (event) {
      event.preventDefault();
    }
    this.isStudentsOpen = !this.isStudentsOpen;
  }

  getSubmenuHeight(): number {
    // Submenu yüksekliğini hesapla - her bir öğe için 40px
    return 40 * 3; // 3 submenu öğesi için 120px
  }

  // Döküman tıklamalarını dinle ve açık dropdown'ları kapat
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;

    // Eğer tıklanan eleman dropdown veya toggle butonlarından biri değilse
    if (
      !target.closest('.notification-dropdown') &&
      !target.closest('.message-dropdown') &&
      !target.closest('.admin-profile')
    ) {
      this.closeAllDropdowns();
    }
  }

  // Tüm açık dropdown'ları kapat
  closeAllDropdowns(): void {
    this.showNotifications = false;
    this.showMessages = false;
    this.showUserMenu = false;
  }

  // Aktif sayfa başlığını güncelle
  updateCurrentPage(): void {
    const url = this.router.url;

    if (url.includes('/ogrenci-liste-sayfasi')) {
      this.currentPage = 'Öğrenciler';
    } else if (url.includes('/teachers')) {
      this.currentPage = 'Öğretmenler';
    } else if (url.includes('/konu-anlatım-sayfasi')) {
      this.currentPage = 'Dersler';
    } else if (url.includes('/reports')) {
      this.currentPage = 'Raporlar';
    } else if (url.includes('/settings')) {
      this.currentPage = 'Ayarlar';
    } else if (url.includes('/mysql-sayfasi')) {
      this.currentPage = 'MySQL Araçları';
    } else {
      this.currentPage = 'Dashboard';
    }
  }

  // Çıkış yap
  logout(): void {
    // LocalStorage ve sessionStorage'dan kullanıcı bilgilerini temizle
    localStorage.removeItem('user');
    sessionStorage.removeItem('user');

    // Kullanıcıyı ana sayfaya yönlendir
    this.router.navigate(['/']);
  }
}