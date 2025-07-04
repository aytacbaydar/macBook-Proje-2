
import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';

interface StudentInfo {
  id: number;
  adi_soyadi: string;
  email: string;
  sinifi: string;
  grup?: string;
  grubu?: string;
  ogretmeni?: string;
  avatar?: string;
}

@Component({
  selector: 'app-ogrenci-konu-analiz-sayfasi',
  standalone: false,
  templateUrl: './ogrenci-konu-analiz-sayfasi.component.html',
  styleUrl: './ogrenci-konu-analiz-sayfasi.component.scss'
})
export class OgrenciKonuAnalizSayfasiComponent implements OnInit {
  // Student information
  studentInfo: StudentInfo | null = null;
  
  // Konu analizi
  konuAnalizi: any[] = [];
  loadingKonuAnalizi: boolean = false;
  error: string | null = null;

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.loadData();
  }

  loadData() {
    this.loadingKonuAnalizi = true;
    this.error = null;

    // Load student info first
    this.loadStudentInfo().then(() => {
      if (this.studentInfo) {
        // Then load topic analysis
        this.loadKonuAnalizi();
      } else {
        this.error = 'Öğrenci bilgileri alınamadı.';
        this.loadingKonuAnalizi = false;
      }
    }).catch(error => {
      console.error('Error loading student info:', error);
      this.error = 'Öğrenci bilgileri yüklenirken hata oluştu.';
      this.loadingKonuAnalizi = false;
    });
  }

  private loadStudentInfo(): Promise<void> {
    return new Promise((resolve, reject) => {
      const userStr = localStorage.getItem('user') || sessionStorage.getItem('user');

      if (userStr) {
        try {
          const user = JSON.parse(userStr);
          this.studentInfo = {
            id: user.id,
            adi_soyadi: user.adi_soyadi || 'Öğrenci',
            email: user.email || '',
            sinifi: user.sinifi || user.sinif || 'Sınıf Bilgisi Yok',
            grup: user.grup || user.grubu || '',
            ogretmeni: user.ogretmeni || 'Öğretmen Bilgisi Yok',
            avatar: user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.adi_soyadi || 'Öğrenci')}&background=28a745&color=fff&size=40&font-size=0.6&rounded=true`
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

    if (!this.studentInfo) {
      this.loadingKonuAnalizi = false;
      this.error = 'Öğrenci bilgileri bulunamadı';
      return;
    }

    const ogrenciId = this.studentInfo.id;
    if (!ogrenciId) {
      this.loadingKonuAnalizi = false;
      this.error = 'Öğrenci ID bulunamadı';
      return;
    }

    this.http.get<any>(`./server/api/ogrenci_konu_analizi.php?ogrenci_id=${ogrenciId}`).subscribe({
      next: (response) => {
        this.loadingKonuAnalizi = false;
        if (response.success && response.data) {
          this.konuAnalizi = response.data.konu_istatistikleri || [];
        } else {
          this.konuAnalizi = [];
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
    return this.konuAnalizi.length;
  }

  getAverageSuccess(): number {
    if (this.konuAnalizi.length === 0) return 0;
    const totalSuccess = this.konuAnalizi.reduce((sum, konu) => sum + konu.basari_orani, 0);
    return Math.round(totalSuccess / this.konuAnalizi.length);
  }

  getTotalQuestions(): number {
    return this.konuAnalizi.reduce((sum, konu) => sum + konu.toplam_soru, 0);
  }

  getTotalCorrect(): number {
    return this.konuAnalizi.reduce((sum, konu) => sum + konu.dogru_sayisi, 0);
  }

  // Başarı seviyelerine göre konu sayısı
  getMukemmelKonuSayisi(): number {
    return this.konuAnalizi.filter(konu => konu.basari_orani >= 80).length;
  }

  getIyiKonuSayisi(): number {
    return this.konuAnalizi.filter(konu => konu.basari_orani >= 60 && konu.basari_orani < 80).length;
  }

  getOrtaKonuSayisi(): number {
    return this.konuAnalizi.filter(konu => konu.basari_orani >= 40 && konu.basari_orani < 60).length;
  }

  getGelistirilmeliKonuSayisi(): number {
    return this.konuAnalizi.filter(konu => konu.basari_orani < 40).length;
  }

  // En iyi ve en kötü konular
  getEnIyiKonular(): any[] {
    return this.konuAnalizi
      .filter(konu => konu.basari_orani > 0)
      .sort((a, b) => b.basari_orani - a.basari_orani)
      .slice(0, 3);
  }

  getGelistirilmesiGerekenKonular(): any[] {
    return this.konuAnalizi
      .filter(konu => konu.basari_orani < 60)
      .sort((a, b) => a.basari_orani - b.basari_orani)
      .slice(0, 3);
  }
}
