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
      icon: 'bi-book',
      label: 'Konu Anlatımı Video',
      link: 'ogrenci-sayfasi',
    },
    {
      icon: 'bi-pencil-square',
      label: 'Sınavlar',
      link: 'ogrenci-sayfasi/sinav-sonuclari-sayfasi',
    },
    {
      icon: 'bi-clipboard2-check',
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
      badgeCount: 0,
    },
    {
      icon: 'bi-credit-card-2-back',
      label: 'Ücretler',
      link: 'ogrenci-sayfasi/ogrenci-ucret-sayfasi',
    },
    {
      icon: 'bi-qr-code-scan',
      label: 'QR Kod',
      link: 'ogrenci-sayfasi/ogrenci-qr-kod-sayfasi',
    },
    {
      icon: 'bi-person-fill-gear',
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
    console.log('loadUnreadMessageCount çağrıldı, studentId:', this.studentId);

    // Önce badge'i 0 olarak ayarla
    const soruCozumuMenuItem = this.menuItems.find(
      (item) => item.label === 'Soru Çözümü'
    );
    if (soruCozumuMenuItem) {
      soruCozumuMenuItem.badgeCount = 0;
      this.cdr.detectChanges();
    }

    if (!this.studentId) {
      console.log('Student ID yok, badge 0 olarak ayarlandı');
      return;
    }

    const headers = {
      Authorization: `Bearer ${this.getTokenFromStorage()}`,
    };

    console.log(
      'API çağrısı yapılıyor:',
      `./server/api/soru_mesajlari.php?ogrenci_id=${this.studentId}`
    );

    this.http
      .get<any>(
        `./server/api/soru_mesajlari.php?ogrenci_id=${this.studentId}`,
        { headers }
      )
      .subscribe({
        next: (response) => {
          console.log('API Response:', response);
          if (response && response.success && response.data) {
            // Öğretmenden gelen okunmamış mesajları say
            const unreadMessages = response.data.filter(
              (mesaj: SoruMesaj) =>
                mesaj.gonderen_tip === 'ogretmen' && !mesaj.okundu
            );

            this.unreadMessageCount = unreadMessages.length;
            console.log('Okunmamış mesaj sayısı:', this.unreadMessageCount);

            // Badge sayısını güncelle
            if (soruCozumuMenuItem) {
              soruCozumuMenuItem.badgeCount = this.unreadMessageCount;
              console.log(
                'Badge count güncellendi:',
                soruCozumuMenuItem.badgeCount
              );
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