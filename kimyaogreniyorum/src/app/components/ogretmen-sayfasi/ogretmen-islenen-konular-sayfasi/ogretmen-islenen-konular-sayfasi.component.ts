
import { Component, OnInit } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';

interface Konu {
  id?: number;
  unite_adi: string;
  konu_adi: string;
  sinif_seviyesi: string;
  aciklama?: string;
  olusturma_tarihi?: string;
}

interface IslenenKonu {
  id?: number;
  konu_id: number;
  grup_adi: string;
  isleme_tarihi: string;
  ogretmen_id: number;
  konu_baslik?: string;
  sinif_seviyesi?: string;
}

interface Grup {
  name: string;
}

@Component({
  selector: 'app-ogretmen-islenen-konular-sayfasi',
  standalone: false,
  templateUrl: './ogretmen-islenen-konular-sayfasi.component.html',
  styleUrl: './ogretmen-islenen-konular-sayfasi.component.scss'
})
export class OgretmenIslenenKonularSayfasiComponent implements OnInit {
  konular: Konu[] = [];
  islenenKonular: IslenenKonu[] = [];
  groups: Grup[] = [];
  
  showKonuModal = false;
  showIslenenKonuModal = false;
  
  selectedSinifSeviyesi = '';
  selectedGrup = '';
  
  konuForm: Konu = {
    unite_adi: '',
    konu_adi: '',
    sinif_seviyesi: '9',
    aciklama: ''
  };
  
  sinifSeviyeleri = [
    { value: '9', label: '9. Sınıf' },
    { value: '10', label: '10. Sınıf' },
    { value: '11', label: '11. Sınıf' },
    { value: '12', label: '12. Sınıf' }
  ];
  
  isLoading = false;
  error = '';

  private apiUrl = 'https://www.kimyaogreniyorum.com/server/api';

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.loadKonular();
    this.loadIslenenKonular();
    this.loadGroups();
  }

  private getHeaders(): HttpHeaders {
    return new HttpHeaders({
      'Content-Type': 'application/json'
    });
  }

  loadKonular() {
    this.isLoading = true;
    this.http.get<any>(`${this.apiUrl}/konu_listesi.php`, { headers: this.getHeaders() })
      .subscribe({
        next: (response) => {
          if (response.success) {
            this.konular = response.konular || [];
          }
          this.isLoading = false;
        },
        error: (error) => {
          console.error('Konular yüklenirken hata:', error);
          this.error = 'Konular yüklenirken hata oluştu';
          this.isLoading = false;
        }
      });
  }

  loadIslenenKonular() {
    const userData = JSON.parse(localStorage.getItem('userData') || '{}');
    const ogretmenId = userData.id;
    
    this.http.get<any>(`${this.apiUrl}/islenen_konular.php?ogretmen_id=${ogretmenId}`, { headers: this.getHeaders() })
      .subscribe({
        next: (response) => {
          if (response.success) {
            this.islenenKonular = response.islenen_konular || [];
          }
        },
        error: (error) => {
          console.error('İşlenen konular yüklenirken hata:', error);
        }
      });
  }

  loadGroups() {
    const userData = JSON.parse(localStorage.getItem('userData') || '{}');
    const ogretmenId = userData.id;
    
    this.http.get<any>(`${this.apiUrl}/ogretmen_ogrencileri.php?ogretmen_id=${ogretmenId}`, { headers: this.getHeaders() })
      .subscribe({
        next: (response) => {
          if (response.success && response.groups) {
            this.groups = response.groups.map((group: string) => ({ name: group }));
          }
        },
        error: (error) => {
          console.error('Gruplar yüklenirken hata:', error);
        }
      });
  }

  getKonularBySinif(sinifSeviyesi: string): Konu[] {
    return this.konular.filter(konu => konu.sinif_seviyesi === sinifSeviyesi);
  }

  konuIslendi(konuId: number, grupAdi: string): boolean {
    return this.islenenKonular.some(islenen => 
      islenen.konu_id === konuId && islenen.grup_adi === grupAdi
    );
  }

  toggleKonuDurumu(konu: Konu, grupAdi: string) {
    const islendi = this.konuIslendi(konu.id!, grupAdi);
    
    if (islendi) {
      // İşlenmiş konuyu kaldır
      const islenenKonu = this.islenenKonular.find(islenen => 
        islenen.konu_id === konu.id && islenen.grup_adi === grupAdi
      );
      
      if (islenenKonu) {
        this.removeIslenenKonu(islenenKonu.id!);
      }
    } else {
      // Konuyu işlenmiş olarak işaretle
      this.addIslenenKonu(konu.id!, grupAdi);
    }
  }

  addIslenenKonu(konuId: number, grupAdi: string) {
    const userData = JSON.parse(localStorage.getItem('userData') || '{}');
    const ogretmenId = userData.id;
    
    const data = {
      konu_id: konuId,
      grup_adi: grupAdi,
      ogretmen_id: ogretmenId,
      isleme_tarihi: new Date().toISOString().split('T')[0]
    };

    this.http.post<any>(`${this.apiUrl}/islenen_konu_ekle.php`, data, { headers: this.getHeaders() })
      .subscribe({
        next: (response) => {
          if (response.success) {
            this.loadIslenenKonular();
          } else {
            this.error = response.message || 'Konu işaretlenirken hata oluştu';
          }
        },
        error: (error) => {
          console.error('Konu işaretlenirken hata:', error);
          this.error = 'Konu işaretlenirken hata oluştu';
        }
      });
  }

  removeIslenenKonu(islenenKonuId: number) {
    this.http.delete<any>(`${this.apiUrl}/islenen_konu_sil.php?id=${islenenKonuId}`, { headers: this.getHeaders() })
      .subscribe({
        next: (response) => {
          if (response.success) {
            this.loadIslenenKonular();
          } else {
            this.error = response.message || 'Konu işareti kaldırılırken hata oluştu';
          }
        },
        error: (error) => {
          console.error('Konu işareti kaldırılırken hata:', error);
          this.error = 'Konu işareti kaldırılırken hata oluştu';
        }
      });
  }

  openKonuModal() {
    this.konuForm = {
      unite_adi: '',
      konu_adi: '',
      sinif_seviyesi: '9',
      aciklama: ''
    };
    this.showKonuModal = true;
  }

  closeKonuModal() {
    this.showKonuModal = false;
    this.error = '';
  }

  submitKonu() {
    if (!this.konuForm.unite_adi.trim()) {
      this.error = 'Ünite adı zorunludur';
      return;
    }
    
    if (!this.konuForm.konu_adi.trim()) {
      this.error = 'Konu adı zorunludur';
      return;
    }

    this.isLoading = true;
    this.http.post<any>(`${this.apiUrl}/konu_ekle.php`, this.konuForm, { headers: this.getHeaders() })
      .subscribe({
        next: (response) => {
          if (response.success) {
            this.loadKonular();
            this.closeKonuModal();
          } else {
            this.error = response.message || 'Konu eklenirken hata oluştu';
          }
          this.isLoading = false;
        },
        error: (error) => {
          console.error('Konu eklenirken hata:', error);
          this.error = 'Konu eklenirken hata oluştu';
          this.isLoading = false;
        }
      });
  }

  getIslenenKonularByGrup(grupAdi: string): any[] {
    return this.islenenKonular
      .filter(islenen => islenen.grup_adi === grupAdi)
      .map(islenen => {
        const konu = this.konular.find(k => k.id === islenen.konu_id);
        return {
          ...islenen,
          konu_baslik: konu ? `${konu.unite_adi} - ${konu.konu_adi}` : 'Bilinmeyen Konu',
          sinif_seviyesi: konu?.sinif_seviyesi || ''
        };
      });
  }

  getToplamIslenenKonu(grupAdi: string): number {
    return this.islenenKonular.filter(islenen => islenen.grup_adi === grupAdi).length;
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('tr-TR');
  }
}
