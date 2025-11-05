import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';

interface Sinav {
  id?: number;
  sinav_adi: string;
  sinav_turu: string;
  soru_sayisi: number;
  tarih: string;
  sinav_kapagi?: string;
  aktiflik: boolean;
}

@Component({
  selector: 'app-kullanici-sinav-isleri-sayfasi',
  standalone: false,
  templateUrl: './kullanici-sinav-isleri-sayfasi.component.html',
  styleUrl: './kullanici-sinav-isleri-sayfasi.component.scss',
})
export class KullaniciSinavIsleriSayfasiComponent implements OnInit {
  sinavlar: Sinav[] = [];
  loading = true;
  error: string | null = null;
  selectedFilter = 'ALL';

  sinavTurleri = [
    { id: 'TYT', label: 'TYT Deneme', icon: 'bi-journal-text', color: '#ff7d04ff' },
    { id: 'AYT', label: 'AYT Deneme', icon: 'bi-journal-code', color: '#218ff0ff' },
    { id: 'TAR', label: 'Tarama', icon: 'bi-search', color: '#14a544ff' },
    { id: 'TEST', label: 'Konu Testi', icon: 'bi-clipboard-check', color: '#fc3873ff' },
  ];

  // Modal kontrol değişkenleri
  showExamAlreadyTakenModal = false;
  examResult: any = null;

  constructor(
    private readonly http: HttpClient,
    private readonly router: Router
  ) {}

  ngOnInit(): void {
    this.loadSinavlar();
  }

  loadSinavlar(): void {
    this.loading = true;
    this.error = null;

    this.http.get<any>('./server/api/cevap-anahtarlari-listele.php').subscribe({
      next: (response) => {
        this.loading = false;

        if (!response?.success) {
          this.error = response?.message ?? 'Sınavlar yüklenirken hata oluştu.';
          console.error('[KullaniciSinavIsleri] API hata', response);
          return;
        }

        const allSinavlar: Sinav[] = response.data ?? [];
        if (!allSinavlar.length) {
          this.error = 'Veritabanında hiç sınav bulunamadı. Lütfen önce cevap anahtarı oluşturun.';
          return;
        }

        this.sinavlar = allSinavlar.filter((sinav) => sinav.aktiflik === true || String(sinav.aktiflik) === '1');
        if (!this.sinavlar.length) {
          this.error = `Toplam ${allSinavlar.length} sınav var ama hiçbiri aktif değil. Aktif sınav bulunmuyor.`;
        }
      },
      error: (err) => {
        this.loading = false;
        this.error = 'Sunucu hatası: ' + (err?.message ?? 'Bağlantı hatası');
        console.error('[KullaniciSinavIsleri] HTTP hata', err);
      },
    });
  }

  getSinavlarByType(type: string): Sinav[] {
    return this.sinavlar.filter((sinav) => sinav.sinav_turu === type);
  }

  getFilteredSinavlar(): Sinav[] {
    return this.selectedFilter === 'ALL'
      ? this.sinavlar
      : this.getSinavlarByType(this.selectedFilter);
  }

  setFilter(filter: string): void {
    this.selectedFilter = filter;
  }

  getSinavTuruInfo(type: string) {
    return (
      this.sinavTurleri.find((tur) => tur.id === type) ?? {
        id: type,
        label: type,
        icon: 'bi-file-text',
        color: '#6c757d',
      }
    );
  }

  getTotalQuestions(): number {
    return this.sinavlar.reduce((total, sinav) => total + (sinav.soru_sayisi ?? 0), 0);
  }

  calculateEstimatedTime(soruSayisi: number): number {
    return Math.ceil((soruSayisi ?? 0) * 1.5);
  }

  getDifficultyLevel(sinavTuru: string): number {
    const difficultyMap: Record<string, number> = {
      TEST: 1,
      TAR: 2,
      TYT: 3,
      AYT: 3,
    };
    return difficultyMap[sinavTuru] ?? 2;
  }

  trackBySinavId(index: number, sinav: Sinav): number | undefined {
    return sinav.id ?? index;
  }

  startExam(sinav: Sinav): void {
    this.checkExamStatus(sinav);
  }

  private checkExamStatus(sinav: Sinav): void {
    const userStr = localStorage.getItem('user') ?? sessionStorage.getItem('user');
    if (!userStr) {
      console.error('[KullaniciSinavIsleri] Kullanıcı bilgisi bulunamadı');
      return;
    }

    const user = JSON.parse(userStr);
    const ogrenciId = user.id;
    if (!ogrenciId) {
      console.error('[KullaniciSinavIsleri] Kullanıcı ID bulunamadı');
      return;
    }

    this.http
      .get<any>('./server/api/sinav_kontrol.php', {
        params: {
          sinav_id: String(sinav.id ?? ''),
          ogrenci_id: String(ogrenciId),
        },
      })
      .subscribe({
        next: (response) => {
          if (!response?.success) {
            console.error(response?.message ?? 'Sınav kontrol edilemedi');
            return;
          }

          if (response.sinav_cozulmus) {
            this.examResult = response.sonuc;
            this.showExamAlreadyTakenModal = true;
            return;
          }

          this.router.navigate(['/kullanici-sayfasi/optik'], {
            queryParams: {
              sinavId: sinav.id,
              sinavAdi: sinav.sinav_adi,
              sinavTuru: sinav.sinav_turu,
              soruSayisi: sinav.soru_sayisi,
            },
          });
        },
        error: (err) => {
          console.error('[KullaniciSinavIsleri] Sınav kontrol hatası', err);
        },
      });
  }

  closeExamAlreadyTakenModal(): void {
    this.showExamAlreadyTakenModal = false;
    this.examResult = null;
  }

  viewExamResults(): void {
    this.closeExamAlreadyTakenModal();
    const hedefSinavId =
      this.examResult?.sinav_id ??
      this.examResult?.sinavId ??
      this.examResult?.sinavID ??
      null;

    this.router.navigate(
      ['/kullanici-sayfasi/sinav-sonuclari-sayfasi'],
      hedefSinavId ? { queryParams: { sinavId: hedefSinavId } } : undefined
    );
  }

  calculateNet(sonuc: any): number {
    if (!sonuc) {
      return 0;
    }
    return Math.max(0, (sonuc.dogru_sayisi ?? 0) - (sonuc.yanlis_sayisi ?? 0) / 4);
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('tr-TR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }
}
