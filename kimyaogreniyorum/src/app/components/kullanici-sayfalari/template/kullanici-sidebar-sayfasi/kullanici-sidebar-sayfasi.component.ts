
import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-kullanici-sidebar-sayfasi',
  standalone: false,
  templateUrl: './kullanici-sidebar-sayfasi.component.html',
  styleUrl: './kullanici-sidebar-sayfasi.component.scss'
})
export class KullaniciSidebarSayfasiComponent implements OnInit {
  isSidebarOpen: boolean = false;
  userName: string = 'Kullanıcı';
  userAvatar: string = 'https://ui-avatars.com/api/?name=Kullanici&background=ff6600&color=fff';

  menuItems = [
    { 
      icon: 'bi-house-door', 
      label: 'Ana Sayfa', 
      link: '/kullanici-sayfasi',
      active: true 
    },
    { 
      icon: 'bi-bar-chart', 
      label: 'Konu Analizlerim', 
      link: '/kullanici-sayfasi/konu-analiz',
      active: false 
    },
    { 
      icon: 'bi-file-earmark-text', 
      label: 'Testlerim', 
      link: '/kullanici-sayfasi/testler',
      active: false 
    },
    { 
      icon: 'bi-key', 
      label: 'Cevap Anahtarları', 
      link: '/kullanici-sayfasi/cevap-anahtarlari',
      active: false 
    },
    { 
      icon: 'bi-credit-card', 
      label: 'Ücret Bilgilerim', 
      link: '/kullanici-sayfasi/ucret-bilgileri',
      active: false 
    },
    { 
      icon: 'bi-person-circle', 
      label: 'Profilim', 
      link: '/kullanici-sayfasi/profil',
      active: false 
    }
  ];

  constructor(private router: Router) {}

  ngOnInit(): void {
    this.loadUserData();
    this.checkScreenSize();
    
    // Router değişikliklerini dinle
    this.router.events.subscribe(() => {
      this.updateActiveMenuItem();
    });
  }

  loadUserData(): void {
    const userData = JSON.parse(localStorage.getItem('user') || '{}');
    if (userData && userData.name) {
      this.userName = userData.name;
      if (userData.avatar && userData.avatar.trim() !== '') {
        this.userAvatar = userData.avatar.startsWith('http') 
          ? userData.avatar 
          : `https://www.kimyaogreniyorum.com/${userData.avatar}`;
      } else {
        this.userAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(userData.name)}&background=ff6600&color=fff&size=128`;
      }
    }
  }

  toggleSidebar(): void {
    this.isSidebarOpen = !this.isSidebarOpen;
    localStorage.setItem('sidebarOpen', JSON.stringify(this.isSidebarOpen));
  }

  closeSidebar(): void {
    if (window.innerWidth < 768) {
      this.isSidebarOpen = false;
    }
  }

  updateActiveMenuItem(): void {
    const currentUrl = this.router.url;
    this.menuItems.forEach(item => {
      item.active = currentUrl.includes(item.link);
    });
  }

  private checkScreenSize(): void {
    if (window.innerWidth < 768) {
      this.isSidebarOpen = false;
    } else {
      const savedState = localStorage.getItem('sidebarOpen');
      this.isSidebarOpen = savedState ? JSON.parse(savedState) : true;
    }
  }

  logout(): void {
    localStorage.clear();
    this.router.navigate(['/']);
  }
}
