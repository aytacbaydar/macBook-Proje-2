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
  standalone: false,
})
export class OgretmenDevamsizlikSayfasiComponent implements OnInit {
  ogrenciler: Ogrenci[] = [];
  secilenTarih: string = '';
  kaydetmeIsleminde: boolean = false;
  ogretmenId: number = 0;

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
        this.ogrencileriYukle();
      } catch (error) {
        console.error('Öğretmen bilgileri alınırken hata:', error);
        this.router.navigate(['/ogretmen-login']);
      }
    } else {
      console.warn('Öğretmen giriş bilgisi bulunamadı');
      this.router.navigate(['/ogretmen-login']);
    }
  }

  ogrencileriYukle(): void {
    if (!this.ogretmenId) {
      console.error('Öğretmen ID bulunamadı');
      return;
    }

    const apiUrl = `https://www.kimyaogreniyorum.com/api/ogretmen_ogrencileri.php?ogretmen_id=${this.ogretmenId}`;

    this.http.get<any>(apiUrl).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.ogrenciler = response.data.map((ogrenci: any) => ({
            id: ogrenci.id,
            adi_soyadi: ogrenci.adi_soyadi,
            ogrenci_numarasi: ogrenci.ogrenci_numarasi || 'N/A',
            sinif: ogrenci.sinif || 'Belirtilmemiş',
            avatar: ogrenci.avatar,
            devamsiz: false // Varsayılan olarak devam etti
          }));

          // Varolan devamsızlık kayıtlarını yükle
          this.devamsizlikKayitlariniYukle();
        } else {
          console.error('Öğrenci listesi alınamadı:', response.message);
          this.ogrenciler = [];
        }
      },
      error: (error) => {
        console.error('Öğrenci listesi yüklenirken hata:', error);
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
            const kayit = devamsizlikKayitlari.find((k: any) => k.ogrenci_id === ogrenci.id);
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
    // Öğrenci durumu değiştiğinde otomatik güncelleme yapılabilir
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
}