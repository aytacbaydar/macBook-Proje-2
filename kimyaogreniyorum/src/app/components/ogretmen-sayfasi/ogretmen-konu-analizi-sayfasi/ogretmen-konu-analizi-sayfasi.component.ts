
import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';

interface KonuAnalizi {
  konu_id: number;
  konu_adi: string;
  toplam_ogrenci: number;
  cevaplayan_ogrenci: number;
  ortalama_basari: number;
  mukemmel_ogrenciler: any[];
  iyi_ogrenciler: any[];
  orta_ogrenciler: any[];
  kotu_ogrenciler: any[];
}

interface TeacherInfo {
  id: number;
  adi_soyadi: string;
  email: string;
  avatar?: string;
}

@Component({
  selector: 'app-ogretmen-konu-analizi-sayfasi',
  standalone: false,
  templateUrl: './ogretmen-konu-analizi-sayfasi.component.html',
  styleUrl: './ogretmen-konu-analizi-sayfasi.component.scss'
})
export class OgretmenKonuAnaliziSayfasiComponent implements OnInit {
  // Teacher information
  teacherInfo: TeacherInfo | null = null;
  
  // Konu analizi
  konuAnalizleri: KonuAnalizi[] = [];
  loadingKonuAnalizi: boolean = false;
  error: string | null = null;

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.loadData();
  }

  loadData() {
    this.loadingKonuAnalizi = true;
    this.error = null;

    // Load teacher info first
    this.loadTeacherInfo().then(() => {
      if (this.teacherInfo) {
        // Then load topic analysis
        this.loadKonuAnalizi();
      } else {
        this.error = 'Öğretmen bilgileri alınamadı.';
        this.loadingKonuAnalizi = false;
      }
    }).catch(error => {
      console.error('Error loading teacher info:', error);
      this.error = 'Öğretmen bilgileri yüklenirken hata oluştu.';
      this.loadingKonuAnalizi = false;
    });
  }

  private loadTeacherInfo(): Promise<void> {
    return new Promise((resolve, reject) => {
      const userStr = localStorage.getItem('user') || sessionStorage.getItem('user');

      if (userStr) {
        try {
          const user = JSON.parse(userStr);
          this.teacherInfo = {
            id: user.id,
            adi_soyadi: user.adi_soyadi || 'Öğretmen',
            email: user.email || '',
            avatar: user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.adi_soyadi || 'Öğretmen')}&background=28a745&color=fff&size=40&font-size=0.6&rounded=true`
          };
          resolve();
        } catch (error) {
          reject(error);
        }
      } else {
        reject('Kullanıcı bilgisi bulunamadı.');
      }
    });
  }

  loadKonuAnalizi() {
    this.loadingKonuAnalizi = true;
    this.error = null;

    if (!this.teacherInfo) {
      this.loadingKonuAnalizi = false;
      this.error = 'Öğretmen bilgileri bulunamadı';
      return;
    }

    const ogretmenId = this.teacherInfo.id;
    if (!ogretmenId) {
      this.loadingKonuAnalizi = false;
      this.error = 'Öğretmen ID bulunamadı';
      return;
    }

    this.http.get<any>(`./server/api/ogretmen_konu_analizi.php?ogretmen_id=${ogretmenId}`).subscribe({
      next: (response) => {
        this.loadingKonuAnalizi = false;
        if (response.success && response.data) {
          this.konuAnalizleri = response.data.konu_analizleri || [];
        } else {
          this.konuAnalizleri = [];
        }
      },
      error: (error) => {
        this.loadingKonuAnalizi = false;
        this.error = 'Konu analizi yüklenirken hata oluştu: ' + (error.error?.message || error.message);
        console.error('Error loading konu analizi:', error);
      }
    });
  }

  getKonuSuccessColor(basariOrani: number): string {
    if (basariOrani >= 80) return '#28a745'; // Yeşil
    if (basariOrani >= 60) return '#ffc107'; // Sarı
    if (basariOrani >= 40) return '#fd7e14'; // Turuncu
    return '#dc3545'; // Kırmızı
  }

  getKonuSuccessText(basariOrani: number): string {
    if (basariOrani >= 80) return 'Mükemmel';
    if (basariOrani >= 60) return 'İyi';
    if (basariOrani >= 40) return 'Orta';
    return 'Geliştirilmeli';
  }

  // Genel istatistikler
  getTotalTopics(): number {
    return this.konuAnalizleri.length;
  }

  getAverageSuccess(): number {
    if (this.konuAnalizleri.length === 0) return 0;
    const totalSuccess = this.konuAnalizleri.reduce((sum, konu) => sum + konu.ortalama_basari, 0);
    return Math.round(totalSuccess / this.konuAnalizleri.length);
  }

  getTotalStudents(): number {
    if (this.konuAnalizleri.length === 0) return 0;
    return Math.max(...this.konuAnalizleri.map(konu => konu.toplam_ogrenci));
  }

  getActiveStudents(): number {
    if (this.konuAnalizleri.length === 0) return 0;
    return Math.max(...this.konuAnalizleri.map(konu => konu.cevaplayan_ogrenci));
  }

  // Başarı seviyelerine göre konu sayısı
  getMukemmelKonuSayisi(): number {
    return this.konuAnalizleri.filter(konu => konu.ortalama_basari >= 80).length;
  }

  getIyiKonuSayisi(): number {
    return this.konuAnalizleri.filter(konu => konu.ortalama_basari >= 60 && konu.ortalama_basari < 80).length;
  }

  getOrtaKonuSayisi(): number {
    return this.konuAnalizleri.filter(konu => konu.ortalama_basari >= 40 && konu.ortalama_basari < 60).length;
  }

  getGelistirilmeliKonuSayisi(): number {
    return this.konuAnalizleri.filter(konu => konu.ortalama_basari < 40).length;
  }

  // En iyi ve en kötü konular
  getEnIyiKonular(): KonuAnalizi[] {
    return this.konuAnalizleri
      .filter(konu => konu.ortalama_basari > 0)
      .sort((a, b) => b.ortalama_basari - a.ortalama_basari)
      .slice(0, 3);
  }

  getGelistirilmesiGerekenKonular(): KonuAnalizi[] {
    return this.konuAnalizleri
      .filter(konu => konu.ortalama_basari < 60)
      .sort((a, b) => a.ortalama_basari - b.ortalama_basari)
      .slice(0, 3);
  }

  // Öğrenci listelerini birleştir
  getIyiOgrenciler(konu: KonuAnalizi): any[] {
    return [...(konu.mukemmel_ogrenciler || []), ...(konu.iyi_ogrenciler || [])];
  }

  getKotuOgrenciler(konu: KonuAnalizi): any[] {
    return [...(konu.orta_ogrenciler || []), ...(konu.kotu_ogrenciler || [])];
  }
}
