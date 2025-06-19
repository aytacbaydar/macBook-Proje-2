
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
  selector: 'app-ogrenci-sinav-islemleri-sayfasi',
  standalone: false,
  templateUrl: './ogrenci-sinav-islemleri-sayfasi.component.html',
  styleUrl: './ogrenci-sinav-islemleri-sayfasi.component.scss'
})
export class OgrenciSinavIslemleriSayfasiComponent implements OnInit {
  sinavlar: Sinav[] = [];
  loading = true;
  error: string | null = null;

  sinavTurleri = [
    { id: 'TYT', label: 'TYT Deneme', icon: 'bi-journal-text', color: '#667eea' },
    { id: 'AYT', label: 'AYT Deneme', icon: 'bi-journal-code', color: '#4facfe' },
    { id: 'TAR', label: 'Tarama Sınavı', icon: 'bi-search', color: '#43e97b' },
    { id: 'TEST', label: 'Konu Testi', icon: 'bi-clipboard-check', color: '#fa709a' }
  ];

  constructor(
    private http: HttpClient,
    private router: Router
  ) {}

  ngOnInit() {
    this.loadSinavlar();
  }

  loadSinavlar() {
    this.loading = true;
    this.error = null;

    this.http.get<any>('./server/api/cevap-anahtarlari-listele.php')
      .subscribe({
        next: (response) => {
          this.loading = false;
          if (response.success) {
            // Sadece aktif sınavları göster
            this.sinavlar = (response.data || []).filter((sinav: Sinav) => sinav.aktiflik);
            console.log('Aktif sınavlar yüklendi:', this.sinavlar);
          } else {
            this.error = 'Sınavlar yüklenirken hata oluştu.';
          }
        },
        error: (error) => {
          this.loading = false;
          this.error = 'Sunucu hatası: ' + (error.message || 'Bağlantı hatası');
          console.error('Sınavlar yüklenirken hata:', error);
        }
      });
  }

  getSinavlarByType(type: string): Sinav[] {
    return this.sinavlar.filter(sinav => sinav.sinav_turu === type);
  }

  getSinavTuruInfo(type: string) {
    return this.sinavTurleri.find(tur => tur.id === type) || 
           { id: type, label: type, icon: 'bi-file-text', color: '#6c757d' };
  }

  startExam(sinav: Sinav) {
    // Optik sayfasına sınav bilgilerini gönder
    this.router.navigate(['/ogrenci/sinav-islemleri/optik'], {
      queryParams: {
        sinavId: sinav.id,
        sinavAdi: sinav.sinav_adi,
        sinavTuru: sinav.sinav_turu,
        soruSayisi: sinav.soru_sayisi
      }
    });
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('tr-TR');
  }
}
