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
}

@Component({
  selector: 'app-ogrenci-sidebar-sayfasi',
  standalone: false,
  templateUrl: './ogrenci-sidebar-sayfasi.component.html',
  styleUrl: './ogrenci-sidebar-sayfasi.component.scss'
})
export class OgrenciSidebarSayfasiComponent implements OnInit, OnDestroy {
  unreadMessageCount: number = 0;
  refreshInterval: any;
  studentId: number | null = null;
  isClosed = true;

  menuItems: Array<{
    icon: string;
    label: string;
    link: string;
    badgeCount?: number;
  }> = [
    {
      icon: 'bi-house',
      label: 'AnaSayfa',
      link: 'ogrenci-sayfasi',
    },

    {
      icon: 'bi-filetype-pdf',
      label: 'İşlenen Konular',
      link: 'ogrenci-sayfasi/ogrenci-islene-konularin-pdf-sayfasi',
    },

    {
      icon: 'bi-diagram-3',
      label: 'Yol Haritası',
      link: 'ogrenci-sayfasi/ogrenci-islene-konular-sayfasi',
    },
    {
      icon: 'bi-camera-reels',
      label: 'Konu Anlatımı Video',
      link: 'ogrenci-sayfasi',
    },
    {
      icon: 'bi-pencil-square',
      label: 'Sınavlar',
      link: 'ogrenci-sayfasi/ogrenci-sinav-islemleri-sayfasi',
    },
    {
      icon: 'bi-archive',
      label: 'Testler',
      link: 'ogrenci-sayfasi/sinav-sonuclari',
    },
    {
      icon: 'bi-graph-up-arrow',
      label: 'Konu Analizi',
      link: 'ogrenci-sayfasi/ogrenci-konu-analiz-sayfasi',
    },
    {
      icon: 'bi-pencil',
      label: 'Soru Çözümü',
      link: 'ogrenci-sayfasi/ogrenci-soru-cozumu-sayfasi',
      badgeCount: 0
    },
    {
      icon: 'bi-credit-card-2-back',
      label: 'Ücretler',
      link: 'ogrenci-sayfasi',
    },
    {
      icon: 'bi-qr-code-scan',
      label: 'QR Kod',
      link: 'ogrenci-sayfasi/ogrenci-qr-kod-sayfasi',
    },
  ];

  constructor(private http: HttpClient) { }

  ngOnInit(): void {
    this.loadStudentInfo();
    this.loadUnreadMessageCount();
    // Her 30 saniyede bir mesaj sayısını güncelle
    this.refreshInterval = setInterval(() => {
      this.loadUnreadMessageCount();
    }, 30000);
  }

  ngOnDestroy(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
  }

  private loadUnreadMessageCount(): void {
    if (!this.studentId) return;

    const headers = {
      'Authorization': `Bearer ${this.getTokenFromStorage()}`
    };

    this.http.get<any>(`./server/api/soru_mesajlari.php?ogrenci_id=${this.studentId}`, { headers })
      .toPromise()
      .then((response) => {
        if (response && response.success && response.data) {
          // Öğretmenden gelen okunmamış mesajları say
          const unreadMessages = response.data.filter((mesaj: SoruMesaj) => 
            mesaj.gonderen_tip === 'ogretmen' && !mesaj.okundu
          );
          this.unreadMessageCount = unreadMessages.length;
          
          // Soru Çözümü menü öğesindeki badge sayısını güncelle
          const soruCozumuMenuItem = this.menuItems.find(item => item.label === 'Soru Çözümü');
          if (soruCozumuMenuItem) {
            soruCozumuMenuItem.badgeCount = this.unreadMessageCount;
          }
        } else {
          // Başarısız response durumunda badge'i 0 yap
          const soruCozumuMenuItem = this.menuItems.find(item => item.label === 'Soru Çözümü');
          if (soruCozumuMenuItem) {
            soruCozumuMenuItem.badgeCount = 0;
          }
        }
      })
      .catch((error) => {
        console.error('Mesaj sayısı yüklenirken hata:', error);
        // Hata durumunda badge'i 0 yap
        const soruCozumuMenuItem = this.menuItems.find(item => item.label === 'Soru Çözümü');
        if (soruCozumuMenuItem) {
          soruCozumuMenuItem.badgeCount = 0;
        }
      });
  }

  private loadStudentInfo(): void {
    const userStr = localStorage.getItem('user') || sessionStorage.getItem('user');
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        this.studentId = user.id;
      } catch (error) {
        console.error('Öğrenci bilgileri yüklenirken hata:', error);
      }
    }
  }

  private getTokenFromStorage(): string {
    let token = localStorage.getItem('token');
    if (!token) {
      const userStr = localStorage.getItem('user') || sessionStorage.getItem('user');
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


  toggleSidebar() {
    this.isClosed = !this.isClosed;
  }
}