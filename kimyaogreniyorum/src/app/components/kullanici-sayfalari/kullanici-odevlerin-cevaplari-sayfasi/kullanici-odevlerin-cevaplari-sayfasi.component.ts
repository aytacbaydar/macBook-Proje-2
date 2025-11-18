import { Component, OnInit } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';

type OdevStatus = 'upcoming' | 'active' | 'expired';

interface OdevDetayi {
  id?: number;
  grup: string;
  konu: string;
  baslangic_tarihi: string;
  bitis_tarihi: string;
  aciklama?: string;
  pdf_url?: string;
  pdf_exists?: boolean;
  ogretmen_adi?: string;
  status?: OdevStatus;
  kalan_gun?: number;
}

@Component({
  selector: 'app-kullanici-odevlerin-cevaplari-sayfasi',
  standalone: false,
  templateUrl: './kullanici-odevlerin-cevaplari-sayfasi.component.html',
  styleUrls: ['./kullanici-odevlerin-cevaplari-sayfasi.component.scss']
})
export class KullaniciOdevlerinCevaplariSayfasiComponent implements OnInit {
  odevler: OdevDetayi[] = [];
  loading: boolean = false;
  error: string | null = null;
  currentUser: any = null;

  constructor(private readonly http: HttpClient) {}

  ngOnInit(): void {
    this.prepareUser();
  }

  private prepareUser(): void {
    const userString = localStorage.getItem('user') || sessionStorage.getItem('user');
    if (!userString) {
      this.error = 'Kullanıcı oturumu bulunamadı.';
      return;
    }

    try {
      this.currentUser = JSON.parse(userString);
      this.loadOdevler();
    } catch (err) {
      console.error('Kullanıcı bilgisi ayrıştırılamadı', err);
      this.error = 'Kullanıcı bilgisi yüklenemedi.';
    }
  }

  private loadOdevler(): void {
    if (!this.currentUser) {
      this.error = 'Kullanıcı bilgisi bulunamadı.';
      return;
    }

    const grup = this.currentUser.grup || this.currentUser.grubu || this.currentUser.sinifi || this.currentUser.sinif;
    if (!grup) {
      this.error = 'Öğrenci grubu bilgisi eksik.';
      return;
    }

    const token = this.currentUser.token || '';
    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    });

    this.loading = true;
    this.error = null;

    this.http
      .get<any>(`./server/api/ogrenci_odevleri.php?grup=${encodeURIComponent(grup)}`, { headers })
      .subscribe({
        next: (response) => {
          this.loading = false;
          if (response?.success && Array.isArray(response?.data)) {
            this.odevler = response.data.map((odev: any) => this.normalizeOdev(odev));
          } else {
            this.error = response?.message || 'Ödevler yüklenemedi.';
          }
        },
        error: (err) => {
          this.loading = false;
          console.error('Ödev yükleme hatası', err);
          this.error = 'Ödev verisi alınırken hata oluştu.';
        }
      });
  }

  private normalizeOdev(odev: any): OdevDetayi {
    const status = this.resolveStatus(odev.baslangic_tarihi, odev.bitis_tarihi);
    const kalan = Number.isFinite(odev.kalan_gun) ? Number(odev.kalan_gun) : this.calculateRemainingDays(odev.bitis_tarihi);

    return {
      id: odev.id,
      grup: odev.grup,
      konu: odev.konu,
      baslangic_tarihi: odev.baslangic_tarihi,
      bitis_tarihi: odev.bitis_tarihi,
      aciklama: odev.aciklama,
      pdf_url: odev.pdf_url,
      pdf_exists: odev.pdf_exists,
      ogretmen_adi: odev.ogretmen_adi,
      status,
      kalan_gun: kalan
    };
  }

  private resolveStatus(baslangic?: string, bitis?: string): OdevStatus {
    const now = new Date();
    if (!baslangic || !bitis) {
      return 'active';
    }

    const start = new Date(baslangic);
    const end = new Date(bitis);

    if (now < start) {
      return 'upcoming';
    }
    if (now > end) {
      return 'expired';
    }
    return 'active';
  }

  private calculateRemainingDays(bitis?: string): number {
    if (!bitis) {
      return 0;
    }
    const now = new Date();
    const end = new Date(bitis);
    const diff = end.getTime() - now.getTime();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }

  formatDate(value?: string): string {
    if (!value) {
      return '-';
    }
    const parsed = new Date(value);
    if (isNaN(parsed.getTime())) {
      return value;
    }
    return parsed.toLocaleDateString('tr-TR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  }

  getStatusText(status?: OdevStatus): string {
    switch (status) {
      case 'upcoming':
        return 'Yaklaşan';
      case 'active':
        return 'Aktif';
      case 'expired':
        return 'Süresi Doldu';
      default:
        return 'Bilgi yok';
    }
  }

  getStatusColor(status?: OdevStatus): string {
    switch (status) {
      case 'upcoming':
        return '#f59e0b';
      case 'active':
        return '#10b981';
      case 'expired':
        return '#ef4444';
      default:
        return '#6b7280';
    }
  }

  get activeCount(): number {
    return this.odevler.filter((odev) => odev.status === 'active').length;
  }

  get upcomingCount(): number {
    return this.odevler.filter((odev) => odev.status === 'upcoming').length;
  }

  get expiredCount(): number {
    return this.odevler.filter((odev) => odev.status === 'expired').length;
  }

  refresh(): void {
    this.loadOdevler();
  }
}
