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
  selectedFilter: string = 'ALL';

  sinavTurleri = [
    { id: 'TYT', label: 'TYT Deneme', icon: 'bi-journal-text', color: '#ff7d04ff' },
    { id: 'AYT', label: 'AYT Deneme', icon: 'bi-journal-code', color: '#218ff0ff' },
    { id: 'TAR', label: 'Tarama', icon: 'bi-search', color: '#14a544ff' },
    { id: 'TEST', label: 'Konu Testi', icon: 'bi-clipboard-check', color: '#fc3873ff' }
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

    console.log('Sınavlar yükleniyor...');
    this.http.get<any>('./server/api/cevap-anahtarlari-listele.php')
      .subscribe({
        next: (response) => {
          this.loading = false;
          console.log('API Response:', response);
          
          if (response.success) {
            const allSinavlar = response.data || [];
            console.log('Tüm sınavlar:', allSinavlar);
            console.log('Debug bilgileri:', response.debug);
            
            if (allSinavlar.length === 0) {
              this.error = 'Veritabanında hiç sınav bulunamadı. Lütfen önce cevap anahtarı oluşturun.';
              return;
            }
            
            // Sadece aktif sınavları göster
            this.sinavlar = allSinavlar.filter((sinav: Sinav) => {
              const isActive = sinav.aktiflik == true || sinav.aktiflik == 1 || sinav.aktiflik === '1';
              console.log(`Sınav ${sinav.sinav_adi}: aktiflik=${sinav.aktiflik}, isActive=${isActive}`);
              return isActive;
            });
            
            console.log('Aktif sınavlar:', this.sinavlar);
            
            if (this.sinavlar.length === 0) {
              this.error = `Toplam ${allSinavlar.length} sınav var ama hiçbiri aktif değil. Aktif sınav bulunmuyor.`;
            }
          } else {
            this.error = response.message || 'Sınavlar yüklenirken hata oluştu.';
            console.error('API Hatası:', response);
            if (response.debug) {
              console.error('Debug bilgisi:', response.debug);
            }
          }
        },
        error: (error) => {
          this.loading = false;
          this.error = 'Sunucu hatası: ' + (error.message || 'Bağlantı hatası');
          console.error('HTTP Hatası:', error);
          console.error('Error details:', error.error);
        }
      });
  }

  getSinavlarByType(type: string): Sinav[] {
    return this.sinavlar.filter(sinav => sinav.sinav_turu === type);
  }

  getFilteredSinavlar(): Sinav[] {
    if (this.selectedFilter === 'ALL') {
      return this.sinavlar;
    }
    return this.getSinavlarByType(this.selectedFilter);
  }

  setFilter(filter: string) {
    this.selectedFilter = filter;
  }

  getSinavTuruInfo(type: string) {
    return this.sinavTurleri.find(tur => tur.id === type) || 
           { id: type, label: type, icon: 'bi-file-text', color: '#6c757d' };
  }

  getTotalQuestions(): number {
    return this.sinavlar.reduce((total, sinav) => total + (sinav.soru_sayisi || 0), 0);
  }

  calculateEstimatedTime(soruSayisi: number): number {
    // Her soru için ortalama 1.5 dakika hesaplama
    return Math.ceil(soruSayisi * 1.5);
  }

  getDifficultyLevel(sinavTuru: string): number {
    const difficultyMap: { [key: string]: number } = {
      'TEST': 1,
      'TAR': 2,
      'TYT': 3,
      'AYT': 3
    };
    return difficultyMap[sinavTuru] || 2;
  }

  trackBySinavId(index: number, sinav: Sinav): any {
    return sinav.id || index;
  }

  // Modal kontrol değişkenleri
  showExamAlreadyTakenModal = false;
  examResult: any = null;

  // Sınav çözme fonksiyonu
  startExam(sinav: any) {
    // Önce sınavın daha önce çözülüp çözülmediğini kontrol et
    this.checkExamStatus(sinav);
  }

  private checkExamStatus(sinav: any) {
    const userStr = localStorage.getItem('user') || sessionStorage.getItem('user');
    if (!userStr) {
      //this.toastr.error('Kullanıcı bilgisi bulunamadı', 'Hata'); // Removed toastr
      console.error('Kullanıcı bilgisi bulunamadı');
      return;
    }

    const user = JSON.parse(userStr);
    const ogrenci_id = user.id;

    this.http.get<any>(`./server/api/sinav_kontrol.php`, {
      params: {
        sinav_id: sinav.id.toString(),
        ogrenci_id: ogrenci_id.toString()
      }
    }).subscribe({
      next: (response) => {
        if (response.success) {
          if (response.sinav_cozulmus) {
            // Sınav daha önce çözülmüş, modal aç
            this.examResult = response.sonuc;
            this.showExamAlreadyTakenModal = true;
          } else {
            // Sınav çözülebilir, optik sayfasına git
            this.router.navigate(
              ['/ogrenci-sayfasi/optik'],
              {
                queryParams: {
                  sinavId: sinav.id,
                  sinavAdi: sinav.sinav_adi,
                  sinavTuru: sinav.sinav_turu,
                  soruSayisi: sinav.soru_sayisi,
                },
              }
            );
          }
        } else {
          //this.toastr.error(response.message || 'Sınav kontrol edilemedi', 'Hata'); // Removed toastr
          console.error(response.message || 'Sınav kontrol edilemedi');
        }
      },
      error: (error) => {
        console.error('Sınav kontrol hatası:', error);
        //this.toastr.error('Sınav kontrol edilirken hata oluştu', 'Hata'); // Removed toastr
        console.error('Sınav kontrol edilirken hata oluştu');
      }
    });
  }

  closeExamAlreadyTakenModal() {
    this.showExamAlreadyTakenModal = false;
    this.examResult = null;
  }

  viewExamResults() {
    this.closeExamAlreadyTakenModal();
    this.router.navigate(['/ogrenci-sayfasi/ogrenci-sinav-islemleri-sayfasi/ogrenci-sinav-sonuclari-sayfasi']);
  }

  calculateNet(sonuc: any): number {
    if (!sonuc) return 0;
    return Math.max(0, sonuc.dogru_sayisi - (sonuc.yanlis_sayisi / 4));
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    const options: Intl.DateTimeFormatOptions = {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    };
    return date.toLocaleDateString('tr-TR', options);
  }

  getAuthHeaders() {
    const token = localStorage.getItem('token');
    return {
      'Authorization': `Bearer ${token}`
    };
  }
}