import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';

interface KullaniciBilgi {
  id: number;
  adi_soyadi: string;
  email: string;
  sinifi: string;
  avatar: string;
  rol?: string;
}

interface KonuAnalizDetay {
  id: number;
  konu_adi: string;
  basari_orani: number;
  dogru_sayisi: number;
  yanlis_sayisi: number;
  bos_sayisi: number;
  toplam_soru: number;
}

@Component({
  selector: 'app-kullanici-analiz-sayfasi',
  standalone: false,
  templateUrl: './kullanici-analiz-sayfasi.component.html',
  styleUrls: ['./kullanici-analiz-sayfasi.component.scss']
})
export class KullaniciAnalizSayfasiComponent implements OnInit {
  kullaniciBilgi: KullaniciBilgi | null = null;
  konuAnaliz: KonuAnalizDetay[] = [];
  loading: boolean = false;
  error: string | null = null;

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.refreshAnaliz();
  }

  refreshAnaliz(): void {
    this.loading = true;
    this.error = null;

    this.loadKullaniciBilgi()
      .then(() => {
        if (!this.kullaniciBilgi) {
          this.error = 'Kullanıcı bilgileri bulunamadı.';
          this.loading = false;
          return;
        }

        this.http
          .get<any>(`./server/api/ogrenci_konu_analizi.php?ogrenci_id=${this.kullaniciBilgi.id}`)
          .subscribe({
            next: (response) => {
              this.loading = false;
              if (response?.success && Array.isArray(response?.data?.konu_istatistikleri)) {
                this.konuAnaliz = response.data.konu_istatistikleri;
              } else {
                this.konuAnaliz = [];
              }
            },
            error: (err) => {
              this.loading = false;
              this.konuAnaliz = [];
              this.error = 'Konu analiz verisi yüklenemedi.';
              console.error('Kullanici analiz hatası:', err);
            }
          });
      })
      .catch((err) => {
        this.loading = false;
        this.error = 'Kullanıcı bilgileri alınırken hata oluştu.';
        console.error('Kullanici bilgisi hatası:', err);
      });
  }

  private loadKullaniciBilgi(): Promise<void> {
    return new Promise((resolve, reject) => {
      const bilgi = localStorage.getItem('user') || sessionStorage.getItem('user');

      if (!bilgi) {
        reject('Kullanıcı oturumu yok.');
        return;
      }

      try {
        const parsed = JSON.parse(bilgi);
        this.kullaniciBilgi = {
          id: parsed.id,
          adi_soyadi: parsed.adi_soyadi || 'Kullanıcı',
          email: parsed.email || 'bilgi@kimyaogreniyorum.com',
          sinifi: parsed.sinifi || parsed.sinif || 'Sınıf bilgisi yok',
          avatar:
            parsed.avatar ||
            `https://ui-avatars.com/api/?name=${encodeURIComponent(parsed.adi_soyadi || 'Kullanıcı')}&background=2d3748&color=fff&size=64&font-size=0.7`,
          rol: parsed.rol || 'Öğrenci'
        };
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  }

  get ortalamaBasari(): number {
    if (!this.konuAnaliz.length) {
      return 0;
    }
    const toplam = this.konuAnaliz.reduce((acc, konu) => acc + (konu.basari_orani || 0), 0);
    return Math.round(toplam / this.konuAnaliz.length);
  }

  get answeredQuestions(): number {
    return this.konuAnaliz.reduce((sum, konu) => sum + konu.dogru_sayisi + konu.yanlis_sayisi, 0);
  }

  get toplamSorular(): number {
    return this.konuAnaliz.reduce((sum, konu) => sum + konu.toplam_soru, 0);
  }

  get completionRate(): number {
    if (!this.toplamSorular) {
      return 0;
    }
    return Math.round((this.answeredQuestions / this.toplamSorular) * 100);
  }

  get focusTopics(): KonuAnalizDetay[] {
    return this.konuAnaliz
      .filter((konu) => konu.basari_orani < 65)
      .sort((a, b) => a.basari_orani - b.basari_orani)
      .slice(0, 3);
  }

  get highlightTopics(): KonuAnalizDetay[] {
    return this.konuAnaliz
      .filter((konu) => konu.basari_orani >= 80)
      .sort((a, b) => b.basari_orani - a.basari_orani)
      .slice(0, 2);
  }

  get orderedKonuAnaliz(): KonuAnalizDetay[] {
    return [...this.konuAnaliz].sort((a, b) => b.basari_orani - a.basari_orani);
  }

  get trendMessage(): string {
    if (!this.konuAnaliz.length) {
      return 'Yeni veriler için sınav çözümüne başla.';
    }
    if (this.completionRate >= 90 && this.ortalamaBasari >= 80) {
      return 'Yüksek başarı ve düzenli çözüm, zirve grafiğinizi sürdürmeye hazır.';
    }
    if (this.completionRate >= 70 && this.ortalamaBasari >= 60) {
      return 'İyi bir tempo var; odak konularınıza biraz daha zaman ayırın.';
    }
    return 'Bazı konular tekrar ister; zayıf alanlar için plan hazırla.';
  }

  getTrendColor(pct: number): string {
    if (pct >= 80) {
      return '#10b981';
    }
    if (pct >= 60) {
      return '#f59e0b';
    }
    if (pct >= 40) {
      return '#f97316';
    }
    return '#ef4444';
  }

  getTrendTag(pct: number): string {
    if (pct >= 85) {
      return 'Uzmanlık';
    }
    if (pct >= 70) {
      return 'İstikrarlı';
    }
    if (pct >= 50) {
      return 'İnşa ediliyor';
    }
    return 'Destek gerekli';
  }
}
