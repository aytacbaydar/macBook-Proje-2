import { Component, OnInit, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';

interface SoruMesaj {
  id: number;
  ogrenci_id: number;
  ogretmen_id: number;
  mesaj_metni: string;
  resim_url?: string;
  gonderim_tarihi: string;
  gonderen_tip: 'ogrenci' | 'ogretmen';
  gonderen_adi: string;
  okundu: boolean;
  ogrenci_adi?: string;
}

@Component({
  selector: 'app-ogretmen-sidebar-sayfasi',
  standalone: false,
  templateUrl: './ogretmen-sidebar-sayfasi.component.html',
  styleUrl: './ogretmen-sidebar-sayfasi.component.scss',
})
export class OgretmenSidebarSayfasiComponent implements OnInit, OnDestroy {
  isClosed = true;
  unreadMessageCount: number = 0;
  refreshInterval: any;
  teacherId: number | null = null;

  menuItems = [
    { icon: 'bi-house-fill', label: 'AnaSayfa', link: 'ogretmen-sayfasi' },
    {
      icon: 'bi-easel-fill',
      label: 'Ders Anlatımı',
      link: 'ogretmen-sayfasi/ogretmen-ders-anlatma-tahtasi-sayfasi',
    },
    {
      icon: 'bi-people-fill',
      label: 'Gruplar',
      link: 'ogretmen-sayfasi/ogretmen-gruplar-sayfasi',
    },
    {
      icon: 'bi-person-lines-fill',
      label: 'Öğrenci Listesi',
      link: 'ogretmen-sayfasi/ogretmen-ogrenci-listesi-sayfasi',
    },
    {
      icon: 'bi-clipboard2-check-fill',
      label: 'Sınavlar',
      link: 'ogretmen-sayfasi/ogretmen-sinavlar-sayfasi',
    },
    {
      icon: 'bi-file-earmark-text-fill',
      label: 'Testler',
      link: 'ogretmen-sayfasi/ogretmen-yapay-zekali-testler-sayfasi',
    },
    {
      icon: 'bi-map-fill',
      label: 'Yol Haritası',
      link: 'ogretmen-sayfasi/ogretmen-islenen-konular-sayfasi',
    },
    /*
    {
      icon: 'bi-map-fill',
      label: 'Online Ders',
      link: 'ogretmen-sayfasi/ogretmen-online-ders-sayfasi',
    },*/
    {
      icon: 'bi-person-badge-fill',
      label: 'Haftalık Program',
      link: 'ogretmen-sayfasi/ogretmen-haftalik-program-sayfasi',
    },
    {
      icon: 'bi-journal-bookmark-fill',
      label: 'İşlenen Konular',
      link: 'ogretmen-sayfasi/ogretmen-islenen-konular-sayfasi',
    },
    {
      icon: 'bi-currency-dollar',
      label: 'Ücretler',
      link: 'ogretmen-sayfasi/ogretmen-ucret-sayfasi',
    },
    {
      icon: 'bi-currency-dollar',
      label: 'Cevap Anahtari',
      link: 'ogretmen-sayfasi/ogretmen-testlerin-cevaplari-sayfasi',
    },
    /*
    {
      icon: 'bi-person-check-fill',
      label: 'Sınıfta Kimler Var',
      link: 'ogretmen-sayfasi/ogretmen-sinifta-kimler-var-sayfasi',
    },*/
    {
      icon: 'bi-chat-dots-fill',
      label: 'Soru Çözümü',
      link: 'ogretmen-sayfasi/ogretmen-soru-cozumu-sayfasi',
      badgeCount: 0,
    },
  ];

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.loadTeacherInfo();
    this.loadUnreadMessageCount();

    // 30 saniyede bir mesaj sayısını güncelle
    this.refreshInterval = setInterval(() => {
      this.loadUnreadMessageCount();
    }, 30000);
  }

  ngOnDestroy(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
  }

  private loadTeacherInfo(): void {
    const userStr =
      localStorage.getItem('user') || sessionStorage.getItem('user');
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        this.teacherId = user.id;
      } catch (error) {
        console.error('Öğretmen bilgileri yüklenirken hata:', error);
      }
    }
  }

  private getTokenFromStorage(): string {
    let token = localStorage.getItem('token');
    if (!token) {
      const userStr =
        localStorage.getItem('user') || sessionStorage.getItem('user');
      if (userStr) {
        try {
          const user = JSON.parse(userStr);
          token = user.token;
        } catch (error) {
          console.error('Error parsing user data:', error);
        }
      }
    }
    return token || '';
  }

  private loadUnreadMessageCount(): void {
    if (!this.teacherId) return;

    const headers = {
      Authorization: `Bearer ${this.getTokenFromStorage()}`,
    };

    this.http
      .get<any>(`./server/api/soru_mesajlari.php`, { headers })
      .subscribe({
        next: (response) => {
          if (response.success && response.data) {
            // Öğrencilerden gelen okunmamış mesajları say
            const unreadMessages = response.data.filter(
              (mesaj: SoruMesaj) =>
                mesaj.gonderen_tip === 'ogrenci' && !mesaj.okundu
            );
            this.unreadMessageCount = unreadMessages.length;

            // Soru Çözümü menü öğesindeki badge sayısını güncelle
            const soruCozumuMenuItem = this.menuItems.find(
              (item) => item.label === 'Soru Çözümü'
            );
            if (soruCozumuMenuItem) {
              soruCozumuMenuItem.badgeCount = this.unreadMessageCount;
            }
          }
        },
        error: (error) => {
          console.error('Mesaj sayısı yüklenirken hata:', error);
        },
      });
  }

  toggleSidebar() {
    this.isClosed = !this.isClosed;
  }
}
