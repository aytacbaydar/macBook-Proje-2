
import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';

interface Ogrenci {
  id: number;
  adi_soyadi: string;
  ogrenci_numarasi: string;
  sinif: string;
  avatar?: string;
  devamsiz: boolean;
}

@Component({
  selector: 'app-ogretmen-devamsizlik-sayfasi',
  templateUrl: './ogretmen-devamsizlik-sayfasi.component.html',
  styleUrls: ['./ogretmen-devamsizlik-sayfasi.component.scss'],
  standalone: false
})
export class OgretmenDevamsizlikSayfasiComponent implements OnInit {
  ogrenciler: Ogrenci[] = [];
  secilenTarih: string = '';
  kaydetmeIsleminde: boolean = false;
  ogretmenId: number = 0;
  yukleniyor: boolean = false;
  hataVar: boolean = false;
  hataMesaji: string = '';

  constructor(
    private http: HttpClient,
    private router: Router
  ) {
    // Bugünün tarihini varsayılan olarak ayarla
    const today = new Date();
    this.secilenTarih = today.toISOString().split('T')[0];
  }

  ngOnInit(): void {
    this.ogretmenBilgileriniAl();
  }

  private ogretmenBilgileriniAl(): void {
    // localStorage veya sessionStorage'dan öğretmen bilgilerini al
    const userStr = localStorage.getItem('user') || sessionStorage.getItem('user');

    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        this.ogretmenId = user.id;
        console.log('Öğretmen ID:', this.ogretmenId);
        this.ogrencileriYukle();
      } catch (error) {
        console.error('Öğretmen bilgileri alınırken hata:', error);
        this.hataVar = true;
        this.hataMesaji = 'Öğretmen bilgileri alınamadı';
      }
    } else {
      console.warn('Öğretmen giriş bilgisi bulunamadı');
      this.hataVar = true;
      this.hataMesaji = 'Giriş bilgisi bulunamadı';
    }
  }

  ogrencileriYukle(): void {
    if (!this.ogretmenId) {
      console.error('Öğretmen ID bulunamadı');
      this.hataVar = true;
      this.hataMesaji = 'Öğretmen ID bulunamadı';
      return;
    }

    this.yukleniyor = true;
    this.hataVar = false;
    this.hataMesaji = '';

    const apiUrl = `https://www.kimyaogreniyorum.com/api/ogretmen_ogrencileri.php?ogretmen_id=${this.ogretmenId}`;
    console.log('API URL:', apiUrl);

    this.http.get<any>(apiUrl).subscribe({
      next: (response) => {
        this.yukleniyor = false;
        console.log('API Response:', response);
        
        if (response.success && response.data && Array.isArray(response.data)) {
          this.ogrenciler = response.data.map((ogrenci: any) => ({
            id: Number(ogrenci.id),
            adi_soyadi: ogrenci.adi_soyadi || 'İsimsiz Öğrenci',
            ogrenci_numarasi: ogrenci.ogrenci_numarasi || 'N/A',
            sinif: ogrenci.sinif || 'Belirtilmemiş',
            avatar: ogrenci.avatar,
            devamsiz: false // Varsayılan olarak devam etti
          }));

          console.log('Yüklenen öğrenciler:', this.ogrenciler);

          // Varolan devamsızlık kayıtlarını yükle
          if (this.ogrenciler.length > 0) {
            this.devamsizlikKayitlariniYukle();
          }
        } else {
          console.error('Öğrenci listesi alınamadı:', response);
          this.hataVar = true;
          this.hataMesaji = response.message || 'Öğrenci listesi bulunamadı';
          this.ogrenciler = [];
        }
      },
      error: (error) => {
        this.yukleniyor = false;
        console.error('Öğrenci listesi yüklenirken hata:', error);
        this.hataVar = true;
        this.hataMesaji = 'Öğrenci listesi yüklenemedi';
        this.ogrenciler = [];
      }
    });
  }

  devamsizlikKayitlariniYukle(): void {
    if (!this.secilenTarih || !this.ogretmenId) {
      return;
    }

    const apiUrl = `https://www.kimyaogreniyorum.com/api/devamsizlik_kayitlari.php?ogretmen_id=${this.ogretmenId}&tarih=${this.secilenTarih}`;

    this.http.get<any>(apiUrl).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          const devamsizlikKayitlari = response.data;

          // Öğrenci listesini devamsızlık kayıtlarına göre güncelle
          this.ogrenciler.forEach(ogrenci => {
            const kayit = devamsizlikKayitlari.find((k: any) => Number(k.ogrenci_id) === ogrenci.id);
            ogrenci.devamsiz = kayit ? kayit.devamsiz === '1' : false;
          });
        }
      },
      error: (error) => {
        console.error('Devamsızlık kayıtları yüklenirken hata:', error);
        // Hata durumunda tüm öğrencileri devam etti olarak işaretle
        this.ogrenciler.forEach(ogrenci => {
          ogrenci.devamsiz = false;
        });
      }
    });
  }

  tarihDegisti(): void {
    if (this.secilenTarih) {
      this.devamsizlikKayitlariniYukle();
    }
  }

  devamsizlikDegisti(ogrenci: Ogrenci): void {
    console.log(`${ogrenci.adi_soyadi} - ${ogrenci.devamsiz ? 'Devamsız' : 'Devam Etti'}`);
  }

  tumunuIsaretle(devamsiz: boolean): void {
    this.ogrenciler.forEach(ogrenci => {
      ogrenci.devamsiz = devamsiz;
    });
  }

  devamsizliklariKaydet(): void {
    if (!this.secilenTarih) {
      alert('Lütfen tarih seçiniz!');
      return;
    }

    if (this.ogrenciler.length === 0) {
      alert('Kaydedilecek öğrenci bulunamadı!');
      return;
    }

    this.kaydetmeIsleminde = true;

    const devamsizlikVerileri = this.ogrenciler.map(ogrenci => ({
      ogrenci_id: ogrenci.id,
      ogretmen_id: this.ogretmenId,
      tarih: this.secilenTarih,
      devamsiz: ogrenci.devamsiz ? 1 : 0
    }));

    const apiUrl = 'https://www.kimyaogreniyorum.com/api/devamsizlik_kaydet.php';

    this.http.post<any>(apiUrl, {
      kayitlar: devamsizlikVerileri
    }).subscribe({
      next: (response) => {
        this.kaydetmeIsleminde = false;

        if (response.success) {
          alert('Devamsızlık kayıtları başarıyla kaydedildi!');
          console.log('Kaydet işlemi başarılı:', response.message);
        } else {
          alert('Kayıt sırasında hata oluştu: ' + response.message);
          console.error('Kaydet hatası:', response.message);
        }
      },
      error: (error) => {
        this.kaydetmeIsleminde = false;
        console.error('Kaydet işlemi sırasında hata:', error);
        alert('Kayıt sırasında bir hata oluştu. Lütfen tekrar deneyin.');
      }
    });
  }

  getDefaultAvatar(name: string): string {
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=6366f1&color=fff&size=60&font-size=0.6&rounded=true`;
  }

  getDevamEdenSayisi(): number {
    return this.ogrenciler.filter(ogrenci => !ogrenci.devamsiz).length;
  }

  getDevamsizSayisi(): number {
    return this.ogrenciler.filter(ogrenci => ogrenci.devamsiz).length;
  }

  trackByFn(index: number, item: Ogrenci): number {
    return item.id;
  }

  geriDon(): void {
    this.router.navigate(['/ogretmen-sayfasi']);
  }

  yenidenDene(): void {
    this.hataVar = false;
    this.hataMesaji = '';
    this.ogrencileriYukle();
  }
}
