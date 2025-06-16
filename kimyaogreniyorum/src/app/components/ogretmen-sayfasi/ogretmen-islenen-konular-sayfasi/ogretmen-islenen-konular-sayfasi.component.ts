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
  styleUrl: './ogretmen-islenen-konular-sayfasi.component.scss',
})
export class OgretmenIslenenKonularSayfasiComponent implements OnInit {
  konular: Konu[] = [];
  islenenKonular: IslenenKonu[] = [];
  groups: any[] = [];
  selectedGrup: string = '';
  isLoading: boolean = false;
  error: string = '';

  showKonuModal: boolean = false;
  konuForm: any = {
    unite_adi: '',
    konu_adi: '',
    sinif_seviyesi: '',
    aciklama: '',
  };

  // Grup renkleri
  groupColors = [
    '#4f46e5',
    '#06b6d4',
    '#10b981',
    '#f59e0b',
    '#ef4444',
    '#8b5cf6',
    '#ec4899',
    '#84cc16',
    '#f97316',
    '#6366f1',
    '#14b8a6',
    '#eab308',
  ];

  apiUrl = './server/api';
  constructor(private http: HttpClient) {}

  // Helper method for getting current user data
  private getCurrentUser(): any {
    const userStr = localStorage.getItem('user') || sessionStorage.getItem('user');
    if (userStr) {
      try {
        return JSON.parse(userStr);
      } catch (error) {
        console.error('User data parse error:', error);
        return null;
      }
    }
    return null;
  }

  ngOnInit() {
    this.loadKonular();
    this.loadGroups();
    // loadIslenenKonular() will be called after groups are loaded
  }

  loadGroups() {
    const loggedInUser = this.getCurrentUser();
    const token = loggedInUser?.token || '';

    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`,
    });

    this.http
      .get<any>('./server/api/ogrenciler_listesi.php', { headers })
      .subscribe({
        next: (response) => {
          if (response.success) {
            this.organizeStudentsByGroups(
              response.data,
              loggedInUser?.adi_soyadi || ''
            );
            // Load islenen konular after groups are loaded
            this.loadIslenenKonular();
          }
        },
        error: (error) => {
          console.error('Gruplar yüklenirken hata:', error);
        },
      });
  }

  organizeStudentsByGroups(students: any[], loggedInTeacherName: string) {
    const groupMap = new Map<string, any[]>();

    // Sadece öğrencileri filtrele
    const actualStudents = students.filter(
      (student) =>
        student.rutbe === 'ogrenci' && student.ogretmeni === loggedInTeacherName
    );

    // Öğrencileri gruplara ayır
    actualStudents.forEach((student) => {
      const groupName = student.grubu || 'Grup Atanmamış';
      if (!groupMap.has(groupName)) {
        groupMap.set(groupName, []);
      }
      groupMap.get(groupName)!.push(student);
    });

    // Grup objelerini oluştur
    this.groups = Array.from(groupMap.entries()).map(
      ([name, students], index) => ({
        name,
        students,
        studentCount: students.length,
        color: this.groupColors[index % this.groupColors.length],
      })
    );

    // Grupları sırala
    this.groups.sort((a, b) => {
      if (a.name === 'Grup Atanmamış') return 1;
      if (b.name === 'Grup Atanmamış') return -1;
      return a.name.localeCompare(b.name);
    });
  }

  selectGroup(groupName: string) {
    this.selectedGrup = groupName;
  }

  private getHeaders(): HttpHeaders {
    return new HttpHeaders({
      'Content-Type': 'application/json',
    });
  }

  loadKonular() {
    this.isLoading = true;
    this.http
      .get<any>('./server/api/konu_listesi.php', {
        headers: this.getHeaders(),
      })
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
        },
      });
  }

  // Math objesini component'te kullanılabilir hale getir
  Math = Math;

  loadIslenenKonular() {
    const userData = this.getCurrentUser();
    const ogretmenId = userData?.id;

    if (!ogretmenId) {
      console.error('Öğretmen ID bulunamadı');
      this.error = 'Kullanıcı bilgileri bulunamadı. Lütfen tekrar giriş yapın.';
      return;
    }

    this.http
      .get<any>(
        `./server/api/islenen_konular.php?ogretmen_id=${ogretmenId}`,
        { headers: this.getHeaders() }
      )
      .subscribe({
        next: (response) => {
          if (response.success) {
            this.islenenKonular = response.islenen_konular || [];
          } else {
            console.error('İşlenen konular yüklenirken hata:', response.message);
          }
        },
        error: (error) => {
          console.error('İşlenen konular yüklenirken hata:', error);
        },
      });
  }

  // Tüm konuları filtresi olmadan döndürür
  getUnitesByGroup(grupAdi: string): any[] {
    console.log('Grup:', grupAdi, '- Tüm konular filtresiz gösteriliyor. Toplam konu sayısı:', this.konular.length);
    
    const uniteler = new Map();

    // Tüm konuları filtresiz olarak işle
    this.konular.forEach(konu => {
      if (!uniteler.has(konu.unite_adi)) {
        uniteler.set(konu.unite_adi, {
          unite_adi: konu.unite_adi,
          konular: []
        });
      }
      uniteler.get(konu.unite_adi).konular.push(konu);
    });

    const result = Array.from(uniteler.values());
    console.log('Döndürülen ünite sayısı:', result.length);
    
    return result;
  }

  

  konuIslendi(konuId: number, grupAdi: string): boolean {
    return this.islenenKonular.some(
      (islenen) => islenen.konu_id === konuId && islenen.grup_adi === grupAdi
    );
  }

  toggleKonuDurumu(konu: Konu, grupAdi: string) {
    const islendi = this.konuIslendi(konu.id!, grupAdi);

    if (islendi) {
      // İşlenmiş konuyu kaldır
      const islenenKonu = this.islenenKonular.find(
        (islenen) => islenen.konu_id === konu.id && islenen.grup_adi === grupAdi
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
    const userData = this.getCurrentUser();
    const ogretmenId = userData?.id;

    if (!konuId || !grupAdi || !ogretmenId) {
      this.error = 'Konu ID, grup adı ve öğretmen ID gerekli';
      console.error('Eksik veri:', { konuId, grupAdi, ogretmenId });
      return;
    }

    const data = {
      konu_id: konuId,
      grup_adi: grupAdi,
      ogretmen_id: ogretmenId,
      isleme_tarihi: new Date().toISOString().split('T')[0],
    };

    console.log('Gönderilen veri:', data);

    this.http
      .post<any>('./server/api/islenen_konu_ekle.php', data, {
        headers: this.getHeaders(),
      })
      .subscribe({
        next: (response) => {
          if (response.success) {
            this.loadIslenenKonular();
            this.error = '';
          } else {
            this.error = response.message || 'Konu işaretlenirken hata oluştu';
            console.error('API hatası:', response.message);
          }
        },
        error: (error) => {
          console.error('Konu işaretlenirken hata:', error);
          this.error = 'Konu işaretlenirken hata oluştu';
        },
      });
  }

  removeIslenenKonu(islenenKonuId: number) {
    this.http
      .delete<any>(`./server/api/islenen_konu_sil.php?id=${islenenKonuId}`, {
        headers: this.getHeaders(),
      })
      .subscribe({
        next: (response) => {
          if (response.success) {
            this.loadIslenenKonular();
          } else {
            this.error =
              response.message || 'Konu işareti kaldırılırken hata oluştu';
          }
        },
        error: (error) => {
          console.error('Konu işareti kaldırılırken hata:', error);
          this.error = 'Konu işareti kaldırılırken hata oluştu';
        },
      });
  }

  openKonuModal() {
    this.konuForm = {
      unite_adi: '',
      konu_adi: '',
      sinif_seviyesi: '',
      aciklama: '',
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

    if (!this.konuForm.sinif_seviyesi) {
      this.error = 'Sınıf seviyesi seçimi zorunludur';
      return;
    }

    this.isLoading = true;
    this.http
      .post<any>('./server/api/konu_ekle.php', this.konuForm, {
        headers: this.getHeaders(),
      })
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
        },
      });
  }

  getIslenenKonularByGrup(grupAdi: string): any[] {
    return this.islenenKonular
      .filter((islenen) => islenen.grup_adi === grupAdi)
      .map((islenen) => {
        const konu = this.konular.find((k) => k.id === islenen.konu_id);
        return {
          ...islenen,
          konu_baslik: konu
            ? `${konu.unite_adi} - ${konu.konu_adi}`
            : 'Bilinmeyen Konu',
          sinif_seviyesi: konu?.sinif_seviyesi || '',
        };
      });
  }

  getToplamIslenenKonu(grupAdi: string): number {
    return this.islenenKonular.filter((islenen) => islenen.grup_adi === grupAdi)
      .length;
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('tr-TR');
  }
}