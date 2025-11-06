import { Component, OnInit } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { ToastrService } from 'ngx-toastr';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

interface KullaniciInfo {
  id: number;
  adi_soyadi?: string;
  email?: string;
  rutbe?: string;
}

interface UcretNotu {
  id: number;
  baslik?: string | null;
  icerik?: string | null;
  created_at: string;
  ekleyen: {
    id: number | null;
    adi_soyadi?: string | null;
  };
}

interface UcretIslemi {
  id: number;
  kullanici_id: number;
  islem_tipi: string;
  tutar: number;
  para_birimi: string;
  odeme_tarihi: string;
  aciklama?: string | null;
  durum: string;
  etiketi?: string | null;
  created_at: string;
  updated_at: string;
  ekleyen: {
    id: number | null;
    adi_soyadi?: string | null;
  };
  notlar: UcretNotu[];
}

interface UcretIstatistikleri {
  toplam_islem: number;
  toplam_odenen: number;
  toplam_bekleyen: number;
  toplam_iptal: number;
  beklenen_toplam?: number;
  kalan_borc?: number;
  fazla_odeme?: number;
  ucret?: number;
  ucret_per_ders?: number;
  katildigi_ders?: number;
  toplam_ders?: number;
  sonraki_odemeye_kalan_ders?: number;
}

@Component({
  selector: 'app-kullanici-ucret-sayfasi',
  standalone: false,
  templateUrl: './kullanici-ucret-sayfasi.component.html',
  styleUrls: ['./kullanici-ucret-sayfasi.component.scss'],
})
export class KullaniciUcretSayfasiComponent implements OnInit {
  Math = Math;

  isLoading = false;
  error: string | null = null;

  currentUser: KullaniciInfo | null = null;
  islemler: UcretIslemi[] = [];
  istatistikler: UcretIstatistikleri | null = null;

  durumFilter = 'tum';
  tarihAraligi = 'last90';
  customBaslangic = '';
  customBitis = '';
  sonucLimit = 100;

  constructor(private http: HttpClient, private toastr: ToastrService) {}

  ngOnInit(): void {
    this.loadData();
  }

  refresh(): void {
    this.loadData();
  }

  resetFilters(): void {
    this.durumFilter = 'tum';
    this.tarihAraligi = 'last90';
    this.customBaslangic = '';
    this.customBitis = '';
    this.loadData();
  }

  tarihAraligiDegisti(): void {
    if (this.tarihAraligi !== 'custom') {
      this.customBaslangic = '';
      this.customBitis = '';
      this.loadData();
    }
  }

  loadData(): void {
    this.isLoading = true;
    this.error = null;

    const headers = this.getAuthHeaders();
    let params = new HttpParams().set('limit', this.sonucLimit.toString());

    if (this.durumFilter !== 'tum') {
      params = params.set('durum', this.durumFilter);
    }

    const { baslangic, bitis } = this.buildDateFilters();
    if (baslangic) {
      params = params.set('baslangic', baslangic);
    }
    if (bitis) {
      params = params.set('bitis', bitis);
    }

    this.http
      .get<any>('./server/api/database/ucret_islemleri/kullanici_ucret_bilgileri.php', {
        headers,
        params,
      })
      .subscribe({
        next: (response) => {
          if (response?.success) {
            const data = response.data || {};
            this.currentUser = data.kullanici ?? null;
            this.islemler = Array.isArray(data.items) ? data.items : [];
            this.istatistikler = data.stats ?? null;
          } else {
            this.error = response?.message ?? 'Veriler alınamadı';
            this.toastr.error(this.error ?? undefined, 'Ücret işlemleri');
          }
          this.isLoading = false;
        },
        error: (err) => {
          this.error = err?.message ?? 'Beklenmeyen hata meydana geldi';
          this.toastr.error(this.error ?? undefined, 'Ücret işlemleri');
          this.isLoading = false;
        },
      });
  }

  pdfKaydet(): void {
    const element = document.getElementById('kullaniciUcretSayfasi');
    if (!element) {
      return;
    }

    html2canvas(element, { scale: 2 }).then((canvas) => {
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const margin = 10;
      const usableWidth = pdfWidth - margin * 2;
      const imgHeight = (canvas.height * usableWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = margin;

      pdf.addImage(imgData, 'PNG', margin, position, usableWidth, imgHeight);
      heightLeft -= pdfHeight - margin * 2;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight + margin;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', margin, position, usableWidth, imgHeight);
        heightLeft -= pdfHeight - margin * 2;
      }

      pdf.save('ucret-islemleri.pdf');
    });
  }

  formatCurrency(value: number, currency: string = 'TRY'): string {
    if (Number.isNaN(value)) {
      return '₺0,00';
    }

    try {
      return new Intl.NumberFormat('tr-TR', {
        style: 'currency',
        currency,
        minimumFractionDigits: 2,
      }).format(value);
    } catch (error) {
      return `${value.toFixed(2)} ${currency}`;
    }
  }

  formatDate(value: string): string {
    if (!value) {
      return '-';
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return date.toLocaleDateString('tr-TR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  getDurumEtiketi(durum: string): string {
    switch ((durum || '').toLowerCase()) {
      case 'tamamlandi':
      case 'odendi':
        return 'Ödendi';
      case 'beklemede':
        return 'Beklemede';
      case 'taslak':
        return 'Taslak';
      case 'iptal':
        return 'İptal';
      case 'iade':
        return 'İade';
      default:
        return durum;
    }
  }

  getDurumClass(durum: string): string {
    switch ((durum || '').toLowerCase()) {
      case 'tamamlandi':
      case 'odendi':
        return 'status-chip success';
      case 'beklemede':
      case 'taslak':
        return 'status-chip warning';
      case 'iptal':
      case 'iade':
        return 'status-chip danger';
      default:
        return 'status-chip neutral';
    }
  }

  hasNotlar(item: UcretIslemi): boolean {
    return Array.isArray(item?.notlar) && item.notlar.length > 0;
  }

  trackByIslemId(_index: number, item: UcretIslemi): number {
    return item.id;
  }

  private getAuthHeaders(): HttpHeaders {
    const userStr =
      localStorage.getItem('user') || sessionStorage.getItem('user');
    let token = '';

    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        token = user?.token ?? '';
      } catch (error) {
        console.error('Kullanıcı bilgileri okunamadı:', error);
      }
    }

    return new HttpHeaders({
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    });
  }

  private buildDateFilters(): { baslangic: string | null; bitis: string | null } {
    if (this.tarihAraligi === 'custom') {
      const baslangic = this.safeDateString(this.customBaslangic, false);
      const bitis = this.safeDateString(this.customBitis, true);
      return { baslangic, bitis };
    }

    const now = new Date();
    let start: Date | null = null;

    switch (this.tarihAraligi) {
      case 'last30':
        start = new Date(now);
        start.setDate(now.getDate() - 30);
        break;
      case 'last90':
        start = new Date(now);
        start.setDate(now.getDate() - 90);
        break;
      case 'year':
        start = new Date(now.getFullYear(), 0, 1);
        break;
      case 'all':
        start = null;
        break;
      default:
        start = new Date(now);
        start.setDate(now.getDate() - 90);
        break;
    }

    return {
      baslangic: start ? this.formatFilterDate(start, false) : null,
      bitis: this.formatFilterDate(now, true),
    };
  }

  private formatFilterDate(date: Date, endOfDay: boolean): string {
    const d = new Date(date);
    if (endOfDay) {
      d.setHours(23, 59, 59, 999);
    } else {
      d.setHours(0, 0, 0, 0);
    }

    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');

    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  }

  private safeDateString(value: string, endOfDay: boolean): string | null {
    if (!value) {
      return null;
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return null;
    }

    return this.formatFilterDate(date, endOfDay);
  }
}
