import { Component, OnInit, OnDestroy } from '@angular/core';
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
export class OgretmenKonuAnaliziSayfasiComponent implements OnInit, OnDestroy {
  // Teacher information
  teacherInfo: TeacherInfo | null = null;

  // Konu analizi
  konuAnalizleri: KonuAnalizi[] = [];
  loadingKonuAnalizi: boolean = false;
  error: string | null = null;

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.loadData();
    // Add scroll event listener with null check
    window.onscroll = () => this.scrollFunction();
  }

  ngOnDestroy(): void {
    // Clean up scroll event listener
    window.onscroll = null;
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
        console.log('Full response:', response);
        if (response.success && response.data) {
          this.konuAnalizleri = response.data.konu_analizleri || [];
          
          // Veri doğrulama ve temizleme
          this.konuAnalizleri = this.konuAnalizleri.map((konu, index) => {
            console.log(`Konu ${index + 1}:`, {
              konu_id: konu.konu_id,
              konu_adi: konu.konu_adi,
              originalKonu: konu
            });
            
            // Konu adının doğru şekilde set edildiğinden emin ol
            if (!konu.konu_adi || konu.konu_adi.trim() === '') {
              console.warn(`Konu ${index + 1} için konu_adi boş veya undefined:`, konu);
              konu.konu_adi = `Bilinmeyen Konu ${index + 1}`;
            }
            
            // Konu ID'sinin var olduğundan emin ol
            if (!konu.konu_id) {
              konu.konu_id = index + 1;
            }
            
            // Sayısal değerlerin doğru formatta olduğundan emin ol
            konu.ortalama_basari = parseFloat(String(konu.ortalama_basari || '0'));
            konu.toplam_ogrenci = parseInt(String(konu.toplam_ogrenci || '0'));
            konu.cevaplayan_ogrenci = parseInt(String(konu.cevaplayan_ogrenci || '0'));
            
            // Öğrenci dizilerinin var olduğundan emin ol
            konu.mukemmel_ogrenciler = konu.mukemmel_ogrenciler || [];
            konu.iyi_ogrenciler = konu.iyi_ogrenciler || [];
            konu.orta_ogrenciler = konu.orta_ogrenciler || [];
            konu.kotu_ogrenciler = konu.kotu_ogrenciler || [];
            
            console.log(`Processed konu ${index + 1}:`, {
              konu_id: konu.konu_id,
              konu_adi: konu.konu_adi
            });
            
            return konu;
          });
          
          console.log('Konu analizleri loaded:', this.konuAnalizleri.length, 'items');
          console.log('Konu adları:', this.konuAnalizleri.map(k => k.konu_adi));
          console.log('Processed data:', this.konuAnalizleri);
          
          // Force change detection
          setTimeout(() => {
            this.forceUpdate();
          }, 100);
        } else {
          this.konuAnalizleri = [];
          console.log('No data in response');
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
      .filter(konu => konu.ortalama_basari < 70 && konu.cevaplayan_ogrenci > 0)
      .slice(0, 5);
  }

  // Öğrenci listelerini birleştir
  getIyiOgrenciler(konu: KonuAnalizi): any[] {
    return [...(konu.mukemmel_ogrenciler || []), ...(konu.iyi_ogrenciler || [])];
  }

  getKotuOgrenciler(konu: KonuAnalizi): any[] {
    return [...(konu.orta_ogrenciler || []), ...(konu.kotu_ogrenciler || [])];
  }

  getTopStudents() {
    return this.konuAnalizleri
      .filter(konu => konu.ortalama_basari >= 80)
      .slice(0, 5);
  }

  trackByKonu(index: number, konu: any): any {
    // Eğer konu_id varsa onu kullan, yoksa index kullan
    if (konu && konu.konu_id) {
      return konu.konu_id;
    }
    return index;
  }

  getKonuAdlari(): string {
    return this.konuAnalizleri.map(k => k.konu_adi).join(', ');
  }

  // Force change detection
  forceUpdate() {
    this.konuAnalizleri = [...this.konuAnalizleri];
  }

  // Scroll function with null check
  scrollFunction() {
    const scrollBtn = document.getElementById("scrollToTopBtn");
    if (scrollBtn) {
      if (document.body.scrollTop > 20 || document.documentElement.scrollTop > 20) {
        scrollBtn.style.display = "block";
      } else {
        scrollBtn.style.display = "none";
      }
    }
  }

  // Konu kartları için istatistik metodları
  getTotalQuestionsByTopic(konu: KonuAnalizi): number {
    try {
      const allStudents = [
        ...(konu.mukemmel_ogrenciler || []),
        ...(konu.iyi_ogrenciler || []),
        ...(konu.orta_ogrenciler || []),
        ...(konu.kotu_ogrenciler || [])
      ];
      
      if (allStudents.length === 0) return 0;
      
      // Her öğrencinin toplam sorusunu al ve en yüksek değeri döndür
      const questionCounts = allStudents.map(student => {
        const toplamSoru = parseInt(student.toplam_soru_sayisi || student.toplam_soru || student.soru_sayisi || '0');
        return toplamSoru;
      }).filter(count => count > 0);
      
      const result = questionCounts.length > 0 ? Math.max(...questionCounts) : 0;
      console.log(`${konu.konu_adi} - Toplam Soru:`, result, 'Students:', allStudents.length);
      return result;
    } catch (error) {
      console.error('Toplam soru hesaplama hatası:', error);
      return 0;
    }
  }

  getCorrectAnswersByTopic(konu: KonuAnalizi): number {
    try {
      const allStudents = [
        ...(konu.mukemmel_ogrenciler || []),
        ...(konu.iyi_ogrenciler || []),
        ...(konu.orta_ogrenciler || []),
        ...(konu.kotu_ogrenciler || [])
      ];
      
      const result = allStudents.reduce((total, student) => {
        const dogru = parseInt(student.dogru_sayisi || student.dogru || student.dogru_cevap || '0');
        return total + dogru;
      }, 0);
      
      console.log(`${konu.konu_adi} - Doğru Cevap:`, result);
      return result;
    } catch (error) {
      console.error('Doğru cevap hesaplama hatası:', error);
      return 0;
    }
  }

  getWrongAnswersByTopic(konu: KonuAnalizi): number {
    try {
      const allStudents = [
        ...(konu.mukemmel_ogrenciler || []),
        ...(konu.iyi_ogrenciler || []),
        ...(konu.orta_ogrenciler || []),
        ...(konu.kotu_ogrenciler || [])
      ];
      
      const result = allStudents.reduce((total, student) => {
        const yanlis = parseInt(student.yanlis_sayisi || student.yanlis || student.yanlis_cevap || '0');
        return total + yanlis;
      }, 0);
      
      console.log(`${konu.konu_adi} - Yanlış Cevap:`, result);
      return result;
    } catch (error) {
      console.error('Yanlış cevap hesaplama hatası:', error);
      return 0;
    }
  }

  getEmptyAnswersByTopic(konu: KonuAnalizi): number {
    try {
      const allStudents = [
        ...(konu.mukemmel_ogrenciler || []),
        ...(konu.iyi_ogrenciler || []),
        ...(konu.orta_ogrenciler || []),
        ...(konu.kotu_ogrenciler || [])
      ];
      
      const result = allStudents.reduce((total, student) => {
        const bos = parseInt(student.bos_sayisi || student.bos || student.bos_cevap || '0');
        return total + bos;
      }, 0);
      
      console.log(`${konu.konu_adi} - Boş Cevap:`, result);
      return result;
    } catch (error) {
      console.error('Boş cevap hesaplama hatası:', error);
      return 0;
    }
  }

  getBestStudentForTopic(konu: KonuAnalizi): any {
    const allStudents = [
      ...(konu.mukemmel_ogrenciler || []),
      ...(konu.iyi_ogrenciler || []),
      ...(konu.orta_ogrenciler || []),
      ...(konu.kotu_ogrenciler || [])
    ];

    if (allStudents.length === 0) return null;

    // En yüksek başarı yüzdesine sahip öğrenciyi bul
    return allStudents.reduce((best, current) => {
      const currentScore = parseFloat(current.basari_yuzdesi || current.basari_orani || '0');
      const bestScore = parseFloat(best.basari_yuzdesi || best.basari_orani || '0');
      return currentScore > bestScore ? current : best;
    });
  }

  getPoorStudentsForTopic(konu: KonuAnalizi): any[] {
    const poorStudents = [
      ...(konu.orta_ogrenciler || []),
      ...(konu.kotu_ogrenciler || [])
    ];

    // Başarı yüzdesine göre sırala (en düşükten en yükseğe)
    return poorStudents.sort((a, b) => {
      const scoreA = parseFloat(a.basari_yuzdesi || a.basari_orani || '0');
      const scoreB = parseFloat(b.basari_yuzdesi || b.basari_orani || '0');
      return scoreA - scoreB;
    });
  }

  getDefaultAvatar(name: string): string {
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'Öğrenci')}&background=28a745&color=fff&size=40&font-size=0.6&rounded=true`;
  }

  // Debug method to check data integrity
  debugKonuData() {
    console.log('=== KONU ANALIZI DEBUG ===');
    console.log('Total konuAnalizleri:', this.konuAnalizleri.length);
    this.konuAnalizleri.forEach((konu, index) => {
      console.log(`Konu ${index + 1}:`, {
        konu_id: konu.konu_id,
        konu_adi: konu.konu_adi,
        ortalama_basari: konu.ortalama_basari,
        hasKonuAdi: !!konu.konu_adi,
        konuAdiType: typeof konu.konu_adi,
        fullObject: konu
      });
    });
    console.log('=== END DEBUG ===');
  }
}