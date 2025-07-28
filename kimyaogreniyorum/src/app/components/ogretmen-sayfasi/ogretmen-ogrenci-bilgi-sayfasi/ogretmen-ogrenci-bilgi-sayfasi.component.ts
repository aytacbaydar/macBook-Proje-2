import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { ToastrService } from 'ngx-toastr';

interface OgrenciBilgileri {
  id: number;
  adi_soyadi: string;
  email: string;
  cep_telefonu: string;
  okulu: string;
  sinifi: string;
  grubu: string;
  ders_adi: string;
  ders_gunu: string;
  ders_saati: string;
  ucret: number;
  veli_adi: string;
  veli_cep: string;
  aktif: number;
}

interface SinavSonucu {
  id: number;
  sinav_adi: string;
  tarih: string;
  net_dogru: number;
  net_yanlis: number;
  net_bos: number;
  puan: number;
  basari_yuzdesi: number;
  toplam_soru: number;
}

interface KonuAnalizi {
  konu_adi: string;
  dogru_sayisi: number;
  yanlis_sayisi: number;
  bos_sayisi: number;
  toplam_soru: number;
  basari_orani: number;
}

interface OdemeBilgisi {
  id: number;
  tutar: number;
  odeme_tarihi: string;
  aciklama: string;
  ay: number;
  yil: number;
}

interface DevamsizlikKaydi {
  id: number;
  tarih: string;
  durum: string;
  aciklama: string;
}

@Component({
  selector: 'app-ogretmen-ogrenci-bilgi-sayfasi',
  standalone: false,
  templateUrl: './ogretmen-ogrenci-bilgi-sayfasi.component.html',
  styleUrl: './ogretmen-ogrenci-bilgi-sayfasi.component.scss'
})
export class OgretmenOgrenciBilgiSayfasiComponent implements OnInit {
  ogrenciId: number = 0;
  ogrenciBilgileri: OgrenciBilgileri | null = null;
  sinavSonuclari: SinavSonucu[] = [];
  konuAnalizleri: KonuAnalizi[] = [];
  odemeBilgileri: OdemeBilgisi[] = [];
  devamsizlikKayitlari: DevamsizlikKaydi[] = [];

  isLoading: boolean = true;
  error: string | null = null;

  // Grafik verileri
  chartData: any[] = [];
  chartLabels: string[] = [];

  // Sekmeler
  activeTab: string = 'bilgiler';

  // İstatistikler
  toplamOdenen: number = 0;
  kalanBorc: number = 0;
  devamsizlikSayisi: number = 0;
  ortalamaPuan: number = 0;

  constructor(
    private route: ActivatedRoute,
    private http: HttpClient,
    private toastr: ToastrService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.route.params.subscribe(async params => {
      const idParam = params['id'];
      this.ogrenciId = parseInt(idParam, 10);

      console.log('Route parametresi:', idParam);
      console.log('Dönüştürülen öğrenci ID:', this.ogrenciId);

      if (!idParam || isNaN(this.ogrenciId) || this.ogrenciId <= 0) {
        this.error = `Geçersiz öğrenci ID: ${idParam}`;
        this.isLoading = false;
        this.toastr.error(`Geçersiz öğrenci ID: ${idParam}`, 'Hata');
        console.error('Geçersiz ID parametresi:', idParam);
        return;
      }

      await this.loadAllData();
    });
  }

  async loadAllData(): Promise<void> {
    this.isLoading = true;
    this.error = null;

    try {
      // Tüm verileri paralel olarak yükle
      await Promise.all([
        this.loadOgrenciBilgileri(),
        this.loadSinavSonuclari(),
        this.loadKonuAnalizleri(),
        this.loadOdemeBilgileri(),
        this.loadDevamsizlikKayitlari()
      ]);

      this.calculateStatistics();
      this.prepareChartData();
      this.toastr.success('Öğrenci bilgileri başarıyla yüklendi', 'Başarılı');
    } catch (error) {
      console.error('Veri yükleme hatası:', error);
      this.error = 'Veriler yüklenirken bir hata oluştu: ' + error;
      this.toastr.error('Veriler yüklenirken bir hata oluştu', 'Hata');
    } finally {
      this.isLoading = false;
    }
  }

  private getAuthHeaders(): HttpHeaders {
    let headers = new HttpHeaders({
      'Content-Type': 'application/json'
    });

    // localStorage ve sessionStorage'ı debug et
    console.log('localStorage user:', localStorage.getItem('user'));
    console.log('sessionStorage user:', sessionStorage.getItem('user'));
    console.log('localStorage token:', localStorage.getItem('token'));
    console.log('sessionStorage token:', sessionStorage.getItem('token'));

    // Önce user objesinden token'ı al
    const userStr = localStorage.getItem('user') || sessionStorage.getItem('user');
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        console.log('User objesi:', user);
        if (user.token) {
          headers = headers.set('Authorization', `Bearer ${user.token}`);
          console.log('Authorization header eklendi (user), tam token:', user.token);
          console.log('Final headers:', headers.keys());
          return headers;
        }
      } catch (error) {
        console.error('User data parse hatası:', error);
      }
    }

    // Fallback olarak doğrudan token'ı al
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
      console.log('Authorization header eklendi (token), tam token:', token);
      console.log('Final headers:', headers.keys());
      return headers;
    }

    console.warn('Token bulunamadı! Giriş yapmanız gerekebilir.');
    console.log('Final headers (no token):', headers.keys());
    return headers;
  }

  loadOgrenciBilgileri(): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log('Öğrenci bilgileri yükleniyor, ID:', this.ogrenciId);

      const headers = this.getAuthHeaders();
      console.log('Headers:', headers.keys());

      console.log('Request headers (before sending):', headers.keys());
      console.log('Authorization header value:', headers.get('Authorization'));

      this.http.get<any>(`server/api/ogrenci_bilgileri.php?id=${this.ogrenciId}`, { headers })
        .subscribe({
          next: (response) => {
            console.log('Öğrenci bilgileri response:', response);
            if (response && response.success) {
              this.ogrenciBilgileri = response.data;
              console.log('Öğrenci bilgileri yüklendi:', this.ogrenciBilgileri);
              resolve();
            } else {
              const errorMsg = response?.message || 'Öğrenci bilgileri alınamadı';
              console.error('Öğrenci bilgileri hatası:', errorMsg);
              reject(errorMsg);
            }
          },
          error: (error) => {
            console.error('HTTP Error - Öğrenci bilgileri:', error);
            if (error.status === 401) {
              this.toastr.error('Oturumunuz sonlanmış. Lütfen tekrar giriş yapın.', 'Yetkilendirme Hatası');
              // Kullanıcıyı giriş sayfasına yönlendir
              localStorage.clear();
              sessionStorage.clear();
              window.location.href = '/';
              reject('Yetkilendirme hatası. Lütfen tekrar giriş yapın.');
            } else {
              reject('Öğrenci bilgileri yüklenirken ağ hatası: ' + error.message);
            }
          }
        });
    });
  }

  loadSinavSonuclari(): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log('Sınav sonuçları yükleniyor...');

      const headers = this.getAuthHeaders();

      this.http.get<any>(`server/api/ogrenci_tum_sinav_sonuclari.php?ogrenci_id=${this.ogrenciId}`, { headers })
        .subscribe({
          next: (response) => {
            console.log('Sınav sonuçları response:', response);
            if (response && response.success) {
              // API'den gelen veri formatını kontrol et
              if (Array.isArray(response.data)) {
                this.sinavSonuclari = response.data;
              } else if (response.data && typeof response.data === 'object') {
                // Object ise array'e çevir
                this.sinavSonuclari = Object.values(response.data).filter((item: any) => 
                  item && typeof item === 'object' && item.id
                ) as SinavSonucu[];
              } else {
                this.sinavSonuclari = [];
              }
              resolve();
            } else {
              console.warn('Sınav sonuçları bulunamadı:', response?.message);
              this.sinavSonuclari = [];
              resolve(); // Boş array ile devam et
            }
          },
          error: (error) => {
            console.error('HTTP Error - Sınav sonuçları:', error);
            this.sinavSonuclari = [];
            resolve(); // Hata olsa da devam et
          }
        });
    });
  }

  loadKonuAnalizleri(): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log('Konu analizleri yükleniyor...');

      const headers = this.getAuthHeaders();

      this.http.get<any>(`server/api/ogrenci_konu_analizi.php?ogrenci_id=${this.ogrenciId}`, { headers })
        .subscribe({
          next: (response) => {
            console.log('Konu analizleri response:', response);
            if (response && response.success && response.data) {
              // API'den gelen veri formatını kontrol et
              if (Array.isArray(response.data.konu_istatistikleri)) {
                this.konuAnalizleri = response.data.konu_istatistikleri;
              } else if (response.data.konu_istatistikleri && typeof response.data.konu_istatistikleri === 'object') {
                // Object ise array'e çevir
                this.konuAnalizleri = Object.values(response.data.konu_istatistikleri).filter((item: any) => 
                  item && typeof item === 'object' && item.konu_adi
                ) as any[];
              } else {
                this.konuAnalizleri = [];
              }
            } else {
              this.konuAnalizleri = [];
            }
            console.log('İşlenen konu analizleri:', this.konuAnalizleri);
            // Change detection'ı manuel olarak tetikle
            this.cdr.detectChanges();
            resolve();
          },
          error: (error) => {
            console.error('HTTP Error - Konu analizleri:', error);
            this.konuAnalizleri = [];
            resolve(); // Hata olsa da devam et
          }
        });
    });
  }

  loadOdemeBilgileri(): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log('Ödeme bilgileri yükleniyor...');

      const headers = this.getAuthHeaders();

      this.http.get<any>(`server/api/ogrenci_ucret_bilgileri.php?ogrenci_id=${this.ogrenciId}`, { headers })
        .subscribe({
          next: (response) => {
            console.log('Ödeme bilgileri response:', response);
            if (response && response.success) {
              // API'den gelen veri formatını kontrol et
              if (Array.isArray(response.data)) {
                this.odemeBilgileri = response.data;
              } else if (response.data && typeof response.data === 'object') {
                // Object ise array'e çevir
                this.odemeBilgileri = Object.values(response.data).filter((item: any) => 
                  item && typeof item === 'object' && item.id
                ) as OdemeBilgisi[];
              } else {
                this.odemeBilgileri = [];
              }
              resolve();
            } else {
              console.warn('Ödeme bilgileri bulunamadı:', response?.message);
              this.odemeBilgileri = [];
              resolve(); // Boş array ile devam et
            }
          },
          error: (error) => {
            console.error('HTTP Error - Ödeme bilgileri:', error);
            if (error.status === 403) {
              console.warn('Ödeme bilgileri erişim reddedildi - öğretmen yetkilendirme sorunu');
              this.toastr.warning('Ödeme bilgilerine erişim için özel yetki gerekli', 'Uyarı');
            }
            this.odemeBilgileri = [];
            resolve(); // Hata olsa da devam et
          }
        });
    });
  }

  loadDevamsizlikKayitlari(): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log('Devamsızlık kayıtları yükleniyor...');

      const headers = this.getAuthHeaders();

      this.http.get<any>(`server/api/devamsizlik_kayitlari.php?ogrenci_id=${this.ogrenciId}`, { headers })
        .subscribe({
          next: (response) => {
            console.log('Devamsızlık kayıtları response:', response);
            if (response && response.success) {
              // API'den gelen veri object ise array'e çevir
              if (response.data && Array.isArray(response.data)) {
                this.devamsizlikKayitlari = response.data;
              } else if (response.data && typeof response.data === 'object') {
                // Eğer object ise, values'larını al ve DevamsizlikKaydi tipine cast et
                const objectValues = Object.values(response.data);
                this.devamsizlikKayitlari = objectValues.filter((item: any) => 
                  item && typeof item === 'object' && item.id
                ) as DevamsizlikKaydi[];
              } else {
                this.devamsizlikKayitlari = [];
              }
              console.log('İşlenmiş devamsızlık kayıtları:', this.devamsizlikKayitlari);
              resolve();
            } else {
              console.warn('Devamsızlık kayıtları bulunamadı:', response?.message);
              this.devamsizlikKayitlari = [];
              resolve(); // Boş array ile devam et
            }
          },
          error: (error) => {
            console.error('HTTP Error - Devamsızlık kayıtları:', error);
            this.devamsizlikKayitlari = [];
            resolve(); // Hata olsa da devam et
          }
        });
    });
  }

  calculateStatistics(): void {
    // Toplam ödenen hesapla - array kontrolü ile
    this.toplamOdenen = Array.isArray(this.odemeBilgileri) 
      ? this.odemeBilgileri.reduce((total, odeme) => total + (odeme.tutar || 0), 0)
      : 0;

    // Kalan borç hesapla (örnek hesaplama)
    const aylikUcret = this.ogrenciBilgileri?.ucret || 0;
    const bugunTarihi = new Date();
    const baslangicAyi = 9; // Eylül ayından başladığını varsayalım
    const gecenAy = bugunTarihi.getMonth() + 1 - baslangicAyi + 1;
    this.kalanBorc = Math.max(0, (gecenAy * aylikUcret) - this.toplamOdenen);

    // Devamsızlık sayısı - array kontrolü ile
    this.devamsizlikSayisi = Array.isArray(this.devamsizlikKayitlari) 
      ? this.devamsizlikKayitlari.filter(kayit => kayit && kayit.durum === 'absent').length
      : 0;

    // Ortalama puan - array kontrolü ile
    if (Array.isArray(this.sinavSonuclari) && this.sinavSonuclari.length > 0) {
      this.ortalamaPuan = this.sinavSonuclari.reduce((total, sinav) => total + (sinav.puan || 0), 0) / this.sinavSonuclari.length;
    } else {
      this.ortalamaPuan = 0;
    }

    console.log('İstatistikler hesaplandı:', {
      toplamOdenen: this.toplamOdenen,
      kalanBorc: this.kalanBorc,
      devamsizlikSayisi: this.devamsizlikSayisi,
      ortalamaPuan: this.ortalamaPuan
    });
  }

  prepareChartData(): void {
    if (Array.isArray(this.sinavSonuclari) && this.sinavSonuclari.length > 0) {
      this.chartLabels = this.sinavSonuclari.map(sinav => sinav.sinav_adi);
      this.chartData = this.sinavSonuclari.map(sinav => sinav.puan);
    } else {
      this.chartLabels = [];
      this.chartData = [];
    }
  }

  setActiveTab(tab: string): void {
    this.activeTab = tab;
  }

  formatTarih(tarih: string): string {
    return new Date(tarih).toLocaleDateString('tr-TR');
  }

  getProgressBarClass(oran: number): string {
    if (oran >= 80) return 'bg-success';
    if (oran >= 60) return 'bg-warning';
    return 'bg-danger';
  }
}