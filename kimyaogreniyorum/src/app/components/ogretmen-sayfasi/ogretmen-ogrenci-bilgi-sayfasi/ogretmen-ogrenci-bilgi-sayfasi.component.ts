
import { Component, OnInit } from '@angular/core';
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
    private toastr: ToastrService
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
    const userStr = localStorage.getItem('user') || sessionStorage.getItem('user');
    let headers = new HttpHeaders({
      'Content-Type': 'application/json'
    });
    
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        if (user.token) {
          headers = headers.set('Authorization', `Bearer ${user.token}`);
        }
      } catch (error) {
        console.error('User data parse hatası:', error);
      }
    }
    
    // Fallback olarak localStorage'dan token'ı kontrol et
    const token = localStorage.getItem('token');
    if (token && !headers.has('Authorization')) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }
    
    return headers;
  }

  loadOgrenciBilgileri(): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log('Öğrenci bilgileri yükleniyor, ID:', this.ogrenciId);
      
      const headers = this.getAuthHeaders();
      console.log('Headers:', headers.keys());
      
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
              this.sinavSonuclari = response.data || [];
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
            if (response && response.success) {
              this.konuAnalizleri = response.data || [];
              resolve();
            } else {
              console.warn('Konu analizleri bulunamadı:', response?.message);
              this.konuAnalizleri = [];
              resolve(); // Boş array ile devam et
            }
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
              this.odemeBilgileri = response.data || [];
              resolve();
            } else {
              console.warn('Ödeme bilgileri bulunamadı:', response?.message);
              this.odemeBilgileri = [];
              resolve(); // Boş array ile devam et
            }
          },
          error: (error) => {
            console.error('HTTP Error - Ödeme bilgileri:', error);
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
              this.devamsizlikKayitlari = response.data || [];
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
    // Toplam ödenen hesapla
    this.toplamOdenen = this.odemeBilgileri.reduce((total, odeme) => total + odeme.tutar, 0);
    
    // Kalan borç hesapla (örnek hesaplama)
    const aylikUcret = this.ogrenciBilgileri?.ucret || 0;
    const bugunTarihi = new Date();
    const baslangicAyi = 9; // Eylül ayından başladığını varsayalım
    const gecenAy = bugunTarihi.getMonth() + 1 - baslangicAyi + 1;
    this.kalanBorc = Math.max(0, (gecenAy * aylikUcret) - this.toplamOdenen);
    
    // Devamsızlık sayısı
    this.devamsizlikSayisi = this.devamsizlikKayitlari.filter(kayit => kayit.durum === 'absent').length;
    
    // Ortalama puan
    if (this.sinavSonuclari.length > 0) {
      this.ortalamaPuan = this.sinavSonuclari.reduce((total, sinav) => total + sinav.puan, 0) / this.sinavSonuclari.length;
    }
  }

  prepareChartData(): void {
    this.chartLabels = this.sinavSonuclari.map(sinav => sinav.sinav_adi);
    this.chartData = this.sinavSonuclari.map(sinav => sinav.puan);
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
