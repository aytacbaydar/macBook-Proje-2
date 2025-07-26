
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
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
    this.route.params.subscribe(params => {
      this.ogrenciId = +params['id'];
      if (this.ogrenciId) {
        this.loadAllData();
      }
    });
  }

  loadAllData(): void {
    this.isLoading = true;
    this.error = null;

    // Tüm verileri paralel olarak yükle
    Promise.all([
      this.loadOgrenciBilgileri(),
      this.loadSinavSonuclari(),
      this.loadKonuAnalizleri(),
      this.loadOdemeBilgileri(),
      this.loadDevamsizlikKayitlari()
    ]).then(() => {
      this.calculateStatistics();
      this.prepareChartData();
      this.isLoading = false;
    }).catch(error => {
      console.error('Veri yükleme hatası:', error);
      this.error = 'Veriler yüklenirken bir hata oluştu.';
      this.isLoading = false;
    });
  }

  loadOgrenciBilgileri(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.http.get<any>(`server/api/ogrenci_bilgileri.php?id=${this.ogrenciId}`)
        .subscribe({
          next: (response) => {
            if (response.success) {
              this.ogrenciBilgileri = response.data;
              resolve();
            } else {
              reject(response.message);
            }
          },
          error: (error) => reject(error)
        });
    });
  }

  loadSinavSonuclari(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.http.get<any>(`server/api/ogrenci_tum_sinav_sonuclari.php?ogrenci_id=${this.ogrenciId}`)
        .subscribe({
          next: (response) => {
            if (response.success) {
              this.sinavSonuclari = response.data;
              resolve();
            } else {
              reject(response.message);
            }
          },
          error: (error) => reject(error)
        });
    });
  }

  loadKonuAnalizleri(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.http.get<any>(`server/api/ogrenci_konu_analizi.php?ogrenci_id=${this.ogrenciId}`)
        .subscribe({
          next: (response) => {
            if (response.success) {
              this.konuAnalizleri = response.data;
              resolve();
            } else {
              reject(response.message);
            }
          },
          error: (error) => reject(error)
        });
    });
  }

  loadOdemeBilgileri(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.http.get<any>(`server/api/ogrenci_ucret_bilgileri.php?ogrenci_id=${this.ogrenciId}`)
        .subscribe({
          next: (response) => {
            if (response.success) {
              this.odemeBilgileri = response.data;
              resolve();
            } else {
              reject(response.message);
            }
          },
          error: (error) => reject(error)
        });
    });
  }

  loadDevamsizlikKayitlari(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.http.get<any>(`server/api/devamsizlik_kayitlari.php?ogrenci_id=${this.ogrenciId}`)
        .subscribe({
          next: (response) => {
            if (response.success) {
              this.devamsizlikKayitlari = response.data;
              resolve();
            } else {
              reject(response.message);
            }
          },
          error: (error) => reject(error)
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
