import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';

interface StudentInfo {
  id: number;
  adi_soyadi: string;
  email: string;
  sinifi: string;
  grup?: string;
  grubu?: string;
  okulu: string;
  ogretmeni?: string;
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
  selector: 'app-kullanici-islene-konular-sayfasi',
  standalone: false,
  templateUrl: './kullanici-islene-konular-sayfasi.component.html',
  styleUrl: './kullanici-islene-konular-sayfasi.component.scss',
})
export class KullaniciIsleneKonularSayfasiComponent implements OnInit {
  studentInfo: StudentInfo | null = null;
  konular: Konu[] = [];
  islenenKonular: IslenenKonu[] = [];
  isLoading = true;
  error: string | null = null;

  private readonly apiBaseUrl = './server/api';

  constructor(private readonly http: HttpClient) {}

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.isLoading = true;
    this.error = null;

    this.loadStudentInfo()
      .then(() => {
        if (!this.studentInfo) {
          this.error = 'Öğrenci bilgileri alınamadı.';
          this.isLoading = false;
          return;
        }

        return Promise.all([this.loadKonular(), this.loadIslenenKonular()])
          .then(() => {
            this.isLoading = false;
          })
          .catch((error) => {
            console.error('[KullaniciIsleneKonular] Data load error', error);
            this.error = 'Veriler yüklenirken hata oluştu.';
            this.isLoading = false;
          });
      })
      .catch((error) => {
        console.error('[KullaniciIsleneKonular] Student info error', error);
        if (!this.error) {
          this.error = 'Öğrenci bilgileri alınamadı.';
        }
        this.isLoading = false;
      });
  }

  private loadStudentInfo(): Promise<void> {
    return new Promise((resolve, reject) => {
      let token = '';
      const userStr = localStorage.getItem('user') ?? sessionStorage.getItem('user');
      if (userStr) {
        try {
          const user = JSON.parse(userStr);
          token = user.token ?? '';
        } catch (error) {
          console.error('[KullaniciIsleneKonular] parse user error', error);
        }
      }

      if (!token) {
        this.error = 'Oturum bulunamadı. Lütfen tekrar giriş yapın.';
        reject('No token');
        return;
      }

      this.http
        .post<any>(`${this.apiBaseUrl}/ogrenci_profil.php`, {}, {
          headers: { Authorization: `Bearer ${token}` },
        })
        .subscribe({
          next: (response) => {
            if (response?.success) {
              this.studentInfo = response.data;
              resolve();
            } else {
              reject(response?.message ?? 'Öğrenci bilgileri alınamadı');
            }
          },
          error: (err) => {
            console.error('[KullaniciIsleneKonular] student info request error', err);
            reject('Öğrenci bilgileri yüklenemedi');
          },
        });
    });
  }

  private loadKonular(): Promise<void> {
    return new Promise((resolve, reject) => {
      let token = '';
      const userStr = localStorage.getItem('user') ?? sessionStorage.getItem('user');
      if (userStr) {
        try {
          const user = JSON.parse(userStr);
          token = user.token ?? '';
        } catch (error) {
          console.error('[KullaniciIsleneKonular] parse user error', error);
        }
      }

      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      this.http
        .get<any>(`${this.apiBaseUrl}/konu_listesi.php`, { headers })
        .subscribe({
          next: (response) => {
            if (response?.success) {
              this.konular = response.konular ?? [];
              resolve();
            } else {
              reject(response?.message ?? 'Konular yüklenemedi');
            }
          },
          error: (err) => {
            console.error('[KullaniciIsleneKonular] konu listesi error', err);
            reject('Konular yüklenirken hata oluştu');
          },
        });
    });
  }

  private loadIslenenKonular(): Promise<void> {
    return new Promise((resolve) => {
      const grupBilgisi = this.studentInfo?.grup ?? this.studentInfo?.grubu;
      if (!grupBilgisi) {
        resolve();
        return;
      }

      let token = '';
      const userStr = localStorage.getItem('user') ?? sessionStorage.getItem('user');
      if (userStr) {
        try {
          const user = JSON.parse(userStr);
          token = user.token ?? '';
        } catch (error) {
          console.error('[KullaniciIsleneKonular] parse user error', error);
        }
      }

      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const apiUrl = `${this.apiBaseUrl}/ogrenci_islenen_konular.php?grup=${encodeURIComponent(grupBilgisi)}`;

      this.http.get<any>(apiUrl, { headers }).subscribe({
        next: (response) => {
          if (response?.success && response.islenen_konular) {
            this.islenenKonular = response.islenen_konular.map((konu: any) => ({
              ...konu,
              ogretmen_adi: this.studentInfo?.ogretmeni ?? 'Bilinmeyen Öğretmen',
            }));
          } else {
            this.islenenKonular = [];
          }
          resolve();
        },
        error: (err) => {
          console.error('[KullaniciIsleneKonular] islenen konular error', err);
          this.islenenKonular = [];
          resolve();
        },
      });
    });
  }

  getUnitesByGroup(): any[] {
    const grupBilgisi = this.studentInfo?.grup ?? this.studentInfo?.grubu;
    if (!grupBilgisi) {
      return [];
    }

    const sortedKonular = [...this.konular].sort((a, b) => (a.id ?? 0) - (b.id ?? 0));
    let filteredKonular: Konu[] = [];

    const studentClassLevel = this.studentInfo ? this.studentInfo.sinifi : '';
    const isMezunOr12 =
      studentClassLevel &&
      (studentClassLevel.toLowerCase().includes('mezun') ||
        studentClassLevel === '12' ||
        studentClassLevel === '12.Sınıf');

    if (isMezunOr12) {
      filteredKonular = sortedKonular;
    } else if (studentClassLevel) {
      filteredKonular = sortedKonular.filter((konu) => {
        const konuSinif = konu.sinif_seviyesi;
        const normalizedKonuSinif = konuSinif.replace('.Sınıf', '');
        const normalizedStudentLevel = studentClassLevel.replace('.Sınıf', '');

        return (
          normalizedKonuSinif === normalizedStudentLevel ||
          konuSinif === studentClassLevel ||
          konuSinif === `${studentClassLevel}.Sınıf` ||
          `${konuSinif}.Sınıf` === studentClassLevel
        );
      });
    } else {
      filteredKonular = sortedKonular;
    }

    const uniteler = new Map<string, { unite_adi: string; konular: Konu[] }>();
    filteredKonular.forEach((konu) => {
      if (!uniteler.has(konu.unite_adi)) {
        uniteler.set(konu.unite_adi, {
          unite_adi: konu.unite_adi,
          konular: [],
        });
      }
      uniteler.get(konu.unite_adi)!.konular.push(konu);
    });

    return Array.from(uniteler.values());
  }

  konuIslendi(konuId: number): boolean {
    const grupBilgisi = this.studentInfo?.grup ?? this.studentInfo?.grubu;
    if (!grupBilgisi) {
      return false;
    }

    return this.islenenKonular.some(
      (islenen) => islenen.konu_id === konuId && islenen.grup_adi === grupBilgisi
    );
  }

  getKonuIslemeTarihi(konuId: number): string | null {
    const grupBilgisi = this.studentInfo?.grup ?? this.studentInfo?.grubu;
    if (!grupBilgisi) {
      return null;
    }
    const islenenKonu = this.islenenKonular.find(
      (islenen) => islenen.konu_id === konuId && islenen.grup_adi === grupBilgisi
    );
    return islenenKonu ? islenenKonu.isleme_tarihi : null;
  }

  getProcessedTopicsInUnit(unit: any): number {
    return unit.konular.filter((konu: any) => this.konuIslendi(konu.id)).length;
  }

  getUnitProgress(unit: any): number {
    if (unit.konular.length === 0) {
      return 0;
    }
    return Math.round((this.getProcessedTopicsInUnit(unit) / unit.konular.length) * 100);
  }

  getTotalTopics(): number {
    return this.getUnitesByGroup().reduce((total, unit) => total + unit.konular.length, 0);
  }

  getTotalProcessedTopics(): number {
    const grupBilgisi = this.studentInfo?.grup ?? this.studentInfo?.grubu;
    if (!grupBilgisi) {
      return 0;
    }
    return this.islenenKonular.filter((islenen) => islenen.grup_adi === grupBilgisi).length;
  }

  getOverallProgress(): number {
    const total = this.getTotalTopics();
    if (total === 0) {
      return 0;
    }
    return Math.round((this.getTotalProcessedTopics() / total) * 100);
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('tr-TR');
  }

  Math = Math;
}
