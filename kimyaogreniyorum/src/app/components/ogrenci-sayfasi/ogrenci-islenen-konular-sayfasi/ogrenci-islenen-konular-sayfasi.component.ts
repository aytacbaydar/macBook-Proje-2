
import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';

interface StudentInfo {
  id: number;
  adi_soyadi: string;
  email: string;
  sinifi: string;
  grup: string;
  okulu: string;
}

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
  konu_adi?: string;
  sinif_seviyesi?: string;
}

@Component({
  selector: 'app-ogrenci-islenen-konular-sayfasi',
  standalone: false,
  templateUrl: './ogrenci-islenen-konular-sayfasi.component.html',
  styleUrl: './ogrenci-islenen-konular-sayfasi.component.scss'
})
export class OgrenciIslenenKonularSayfasiComponent implements OnInit {
  studentInfo: StudentInfo | null = null;
  konular: Konu[] = [];
  islenenKonular: IslenenKonu[] = [];
  isLoading = true;
  error: string | null = null;

  private apiBaseUrl = './server/api';

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.loadData();
  }

  loadData() {
    this.isLoading = true;
    this.error = null;
    
    // Load student info first
    this.loadStudentInfo().then(() => {
      if (this.studentInfo) {
        // Then load topics and processed topics
        Promise.all([
          this.loadKonular(),
          this.loadIslenenKonular()
        ]).then(() => {
          this.isLoading = false;
        }).catch(error => {
          console.error('Error loading data:', error);
          this.error = 'Veriler yüklenirken hata oluştu.';
          this.isLoading = false;
        });
      } else {
        this.error = 'Öğrenci bilgileri alınamadı.';
        this.isLoading = false;
      }
    });
  }

  private loadStudentInfo(): Promise<void> {
    return new Promise((resolve, reject) => {
      let token = '';
      const userStr = localStorage.getItem('user') || sessionStorage.getItem('user');
      if (userStr) {
        try {
          const user = JSON.parse(userStr);
          token = user.token || '';
          console.log('Token found:', token ? 'Yes' : 'No');
        } catch (error) {
          console.error('Error parsing user data:', error);
        }
      }

      if (!token) {
        this.error = 'Oturum bulunamadı. Lütfen tekrar giriş yapın.';
        reject('No token');
        return;
      }

      this.http.post<any>(`${this.apiBaseUrl}/ogrenci_profil.php`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      }).subscribe({
        next: (response) => {
          if (response.success) {
            this.studentInfo = response.data;
            console.log('Student info loaded:', this.studentInfo);
            resolve();
          } else {
            reject(response.message || 'Öğrenci bilgileri alınamadı');
          }
        },
        error: (error) => {
          console.error('Error loading student info:', error);
          reject('Öğrenci bilgileri yüklenemedi');
        }
      });
    });
  }

  private loadKonular(): Promise<void> {
    return new Promise((resolve, reject) => {
      let token = '';
      const userStr = localStorage.getItem('user') || sessionStorage.getItem('user');
      if (userStr) {
        try {
          const user = JSON.parse(userStr);
          token = user.token || '';
        } catch (error) {
          console.error('Error parsing user data:', error);
        }
      }

      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      this.http.get<any>(`${this.apiBaseUrl}/konu_listesi.php`, { headers }).subscribe({
        next: (response) => {
          console.log('Konular API response:', response);
          if (response.success) {
            this.konular = response.konular || [];
            console.log('Topics loaded:', this.konular.length);
            resolve();
          } else {
            reject(response.message || 'Konular yüklenemedi');
          }
        },
        error: (error) => {
          console.error('Error loading topics:', error);
          reject('Konular yüklenirken hata oluştu');
        }
      });
    });
  }

  private loadIslenenKonular(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.studentInfo?.grup) {
        resolve();
        return;
      }

      let token = '';
      let ogretmenId = '';
      const userStr = localStorage.getItem('user') || sessionStorage.getItem('user');
      if (userStr) {
        try {
          const user = JSON.parse(userStr);
          token = user.token || '';
          // Öğrencinin öğretmeninin ID'sini al (öğretmen adı ile eşleştirme gerekebilir)
        } catch (error) {
          console.error('Error parsing user data:', error);
        }
      }

      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      // Önce öğretmen ID'sini bul
      this.http.get<any>(`${this.apiBaseUrl}/ogretmenler_listesi.php`, { headers }).subscribe({
        next: (teachersResponse) => {
          if (teachersResponse.success) {
            const teacher = teachersResponse.data.find((t: any) => 
              t.adi_soyadi === this.studentInfo!.ogretmeni
            );
            
            if (teacher) {
              ogretmenId = teacher.id;
              
              // Şimdi işlenen konuları çek
              this.http.get<any>(`${this.apiBaseUrl}/islenen_konular.php?ogretmen_id=${ogretmenId}`, { headers }).subscribe({
                next: (response) => {
                  console.log('İşlenen konular API response:', response);
                  if (response.success) {
                    // Sadece öğrencinin grubuna ait olan işlenen konuları filtrele
                    this.islenenKonular = (response.islenen_konular || []).filter((islenen: any) => 
                      islenen.grup_adi === this.studentInfo!.grup
                    );
                    console.log('Filtered processed topics for group:', this.islenenKonular.length);
                  }
                  resolve();
                },
                error: (error) => {
                  console.error('Error loading processed topics:', error);
                  resolve();
                }
              });
            } else {
              console.error('Öğretmen bulunamadı:', this.studentInfo!.ogretmeni);
              resolve();
            }
          } else {
            console.error('Öğretmenler listesi alınamadı');
            resolve();
          }
        },
        error: (error) => {
          console.error('Error loading teachers:', error);
          resolve();
        }
      });
    });
  }

  // Grup sınıf seviyesine göre konuları filtrele (öğretmen sayfasından alındı)
  getUnitesByGroup(): any[] {
    if (!this.studentInfo?.grup) {
      return [];
    }

    // Konuları ID'ye göre sırala
    const sortedKonular = [...this.konular].sort((a, b) => (a.id || 0) - (b.id || 0));
    let filteredKonular: Konu[] = [];

    // Öğrencinin sınıf seviyesini al
    const studentClassLevel = this.studentInfo.sinifi;

    console.log(`Öğrenci sınıf seviyesi: ${studentClassLevel}`);

    // Mezun veya 12.Sınıf ise tüm konuları göster
    const isMezunOr12 = studentClassLevel && (
      studentClassLevel.toLowerCase().includes('mezun') || 
      studentClassLevel === '12' || 
      studentClassLevel === '12.Sınıf'
    );

    if (isMezunOr12) {
      filteredKonular = sortedKonular;
      console.log('12.Sınıf/Mezun - tüm konular gösteriliyor:', filteredKonular.length);
    } else if (studentClassLevel) {
      // Belirli sınıf seviyesi için konuları filtrele
      filteredKonular = sortedKonular.filter(konu => {
        const konuSinif = konu.sinif_seviyesi;
        const normalizedKonuSinif = konuSinif.replace('.Sınıf', '');
        const normalizedStudentLevel = studentClassLevel.replace('.Sınıf', '');
        
        return normalizedKonuSinif === normalizedStudentLevel || 
               konuSinif === studentClassLevel ||
               konuSinif === studentClassLevel + '.Sınıf' ||
               konuSinif + '.Sınıf' === studentClassLevel;
      });
      console.log('Sınıf seviyesi filtrelemesi yapıldı:', filteredKonular.length);
    } else {
      filteredKonular = sortedKonular;
      console.log('Sınıf seviyesi yok, tüm konular gösteriliyor:', filteredKonular.length);
    }

    // Ünitelere göre grupla
    const uniteler = new Map();
    filteredKonular.forEach(konu => {
      if (!uniteler.has(konu.unite_adi)) {
        uniteler.set(konu.unite_adi, {
          unite_adi: konu.unite_adi,
          konular: []
        });
      }
      uniteler.get(konu.unite_adi).konular.push(konu);
    });

    return Array.from(uniteler.values());
  }

  // Konu işlenmiş mi kontrol et
  konuIslendi(konuId: number): boolean {
    if (!this.studentInfo?.grup) return false;
    return this.islenenKonular.some(
      islenen => islenen.konu_id === konuId && islenen.grup_adi === this.studentInfo!.grup
    );
  }

  // İşlenen konunun tarihini al
  getKonuIslemeTarihi(konuId: number): string | null {
    if (!this.studentInfo?.grup) return null;
    const islenenKonu = this.islenenKonular.find(
      islenen => islenen.konu_id === konuId && islenen.grup_adi === this.studentInfo!.grup
    );
    return islenenKonu ? islenenKonu.isleme_tarihi : null;
  }

  // Ünitedeki işlenen konu sayısı
  getProcessedTopicsInUnit(unit: any): number {
    return unit.konular.filter((konu: any) => this.konuIslendi(konu.id)).length;
  }

  // Ünite ilerleme yüzdesi
  getUnitProgress(unit: any): number {
    if (unit.konular.length === 0) return 0;
    return Math.round((this.getProcessedTopicsInUnit(unit) / unit.konular.length) * 100);
  }

  // Toplam konu sayısı
  getTotalTopics(): number {
    const unites = this.getUnitesByGroup();
    return unites.reduce((total, unit) => total + unit.konular.length, 0);
  }

  // Toplam işlenen konu sayısı
  getTotalProcessedTopics(): number {
    if (!this.studentInfo?.grup) return 0;
    return this.islenenKonular.filter(
      islenen => islenen.grup_adi === this.studentInfo!.grup
    ).length;
  }

  // Genel ilerleme yüzdesi
  getOverallProgress(): number {
    const total = this.getTotalTopics();
    if (total === 0) return 0;
    return Math.round((this.getTotalProcessedTopics() / total) * 100);
  }

  // Tarihi formatla
  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('tr-TR');
  }

  // Math objesini component'te kullanılabilir hale getir
  Math = Math;
}
