import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
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
  styleUrl: './ogrenci-sidebar-sayfasi.component.scss',
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
    { icon: 'bi-house-fill', label: 'AnaSayfa', link: 'ogrenci-sayfasi' },
    {
      icon: 'bi-diagram-3',
      label: 'Yol Haritası',
      link: 'ogrenci-sayfasi/ogrenci-islene-konular-sayfasi',
    },
    /*
    {
      icon: 'bi-play-circle-fill',
      label: 'Konu Anlatımı Video',
      link: 'ogrenci-sayfasi',
    },
    {
      icon: 'bi-play-circle-fill',
      label: 'Online Canlı Ders',
      link: 'ogrenci-sayfasi/ogrenci-online-ders-sayfasi',
    },
    */
    {
      icon: 'bi-filetype-pdf',
      label: 'İşlenen konular',
      link: 'ogrenci-sayfasi/ogrenci-islene-konularin-pdf-sayfasi',
    },
    {
      icon: 'bi-clipboard2-check-fill',
      label: 'Sınavlar',
      link: 'ogrenci-sayfasi/sinav-sonuclari-sayfasi',
    },
    {
      icon: 'bi-key',
      label: 'Testlerin Cevapları',
      link: 'ogrenci-sayfasi/ogrenci-testlerin-cevaplari-sayfasi',
    },
    {
      icon: 'bi-file-earmark-text-fill',
      label: 'Testler',
      link: 'ogrenci-sayfasi/ogrenci-yapay-zekali-testler-sayfasi',
    },
    {
      icon: 'bi-bar-chart-fill',
      label: 'Konu Analizi',
      link: 'ogrenci-sayfasi/ogrenci-konu-analiz-sayfasi',
    },
    {
      icon: 'bi-chat-dots-fill',
      label: 'Soru Çözümü',
      link: 'ogrenci-sayfasi/ogrenci-soru-cozumu-sayfasi',
      badgeCount: 0,
    },
    {
      icon: 'bi-cash-coin',
      label: 'Ücretler',
      link: 'ogrenci-sayfasi/ogrenci-ucret-sayfasi',
    },
    {
      icon: 'bi-qr-code-scan',
      label: 'QR Kod',
      link: 'ogrenci-sayfasi/ogrenci-qr-kod-sayfasi',
    },
    {
      icon: 'bi-gear-fill',
      label: 'Ayarlar',
      link: 'ogrenci-sayfasi/ogrenci-profil-sayfasi',
    },
  ];

  constructor(private http: HttpClient, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.loadStudentInfo();
    this.loadUnreadMessageCount();

    // 5 saniyede bir mesaj sayısını güncelle - daha hızlı güncelleme
    this.refreshInterval = setInterval(() => {
      this.loadUnreadMessageCount();
    }, 5000);

    // Custom event listener for immediate updates
    window.addEventListener('updateUnreadCount', () => {
      this.loadUnreadMessageCount();
    });
  }

  ngOnDestroy(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
  }

  private loadUnreadMessageCount(): void {
    // Önce badge'i 0 olarak ayarla
    const soruCozumuMenuItem = this.menuItems.find(
      (item) => item.label === 'Soru Çözümü'
    );
    if (soruCozumuMenuItem) {
      soruCozumuMenuItem.badgeCount = 0;
      this.cdr.detectChanges();
    }

    if (!this.studentId) {
      return;
    }

    const headers = {
      Authorization: `Bearer ${this.getTokenFromStorage()}`,
    };

    this.http
      .get<any>(
        `./server/api/soru_mesajlari.php?ogrenci_id=${this.studentId}`,
        { headers }
      )
      .subscribe({
        next: (response) => {
          if (response && response.success && response.data) {
            // Öğretmenden gelen okunmamış mesajları say
            const unreadMessages = response.data.filter(
              (mesaj: SoruMesaj) =>
                mesaj.gonderen_tip === 'ogretmen' && !mesaj.okundu
            );

            this.unreadMessageCount = unreadMessages.length;

            // Badge sayısını güncelle
            if (soruCozumuMenuItem) {
              soruCozumuMenuItem.badgeCount = this.unreadMessageCount;
              this.cdr.detectChanges();
            }
          } else {
            console.log('Response başarısız veya data yok - badge 0 kalacak');
          }
        },
        error: (error) => {
          console.error('Mesaj sayısı yüklenirken hata:', error);
          console.log('Hata durumunda badge 0 olarak kalacak');
        },
      });
  }

  private loadStudentInfo(): void {
    const userStr =
      localStorage.getItem('user') || sessionStorage.getItem('user');
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

  toggleSidebar() {
    this.isClosed = !this.isClosed;
  }
}