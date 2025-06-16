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

  sinifSeviyeleri = [
    { value: '9', label: '9.Sınıf' },
    { value: '10', label: '10.Sınıf' },
    { value: '11', label: '11.Sınıf' },
    { value: '12', label: '12.Sınıf' },
  ];

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

  getKonularBySinif(sinifSeviyesi: string): Konu[] {
    // sinifSeviyesi '9.Sınıf' formatında gelirse '9' formatına çevir
    const dbFormat = sinifSeviyesi.includes('.Sınıf') ? 
      sinifSeviyesi.replace('.Sınıf', '') : sinifSeviyesi;
    return this.konular.filter((konu) => konu.sinif_seviyesi === dbFormat);
  }

  getUnitesBySinif(sinifSeviyesi: string): any[] {
    // sinifSeviyesi '9.Sınıf' formatında gelirse '9' formatına çevir
    const dbFormat = sinifSeviyesi.includes('.Sınıf') ? 
      sinifSeviyesi.replace('.Sınıf', '') : sinifSeviyesi;

    const konularBySinif = this.konular.filter((konu) => konu.sinif_seviyesi === dbFormat);
    const uniteler = new Map();

    konularBySinif.forEach(konu => {
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

  getFilteredUnitesByGroup(grupAdi: string): any[] {
    const grup = this.groups.find(g => g.name === grupAdi);
    if (!grup || !grup.students || grup.students.length === 0) {
      return [];
    }

    // Grupta bulunan en yüksek sınıf seviyesini bul
    const maxClassLevel = this.getMaxClassLevelInGroup(grup.students);

    console.log('Grup:', grupAdi, 'Max Sınıf Seviyesi:', maxClassLevel);

    // Eğer 12. sınıf veya mezun varsa tüm konuları getir
    if (maxClassLevel === '12' || maxClassLevel === 'Mezun') {
      console.log('Tüm konular getiriliyor...');
      return this.getAllUnites();
    }

    // Diğer sınıflar için sadece o sınıfın konularını getir
    console.log('Belirli sınıf konuları getiriliyor:', maxClassLevel);
    return this.getUnitesBySpecificClassLevel(maxClassLevel);
  }

  getMinClassLevelInGroup(students: any[]): string {
    const classLevels = students
      .map(student => student.sinif_seviyesi || student.sinif || '9.Sınıf')
      .filter(level => level);

    // Mezun varsa tüm konuları göster
    if (classLevels.includes('Mezun')) {
      return 'Mezun';
    }

    // Sınıf seviyelerini parse et ('12.Sınıf' -> 12)
    const numericLevels = classLevels
      .map(level => {
        // '12.Sınıf' formatından sayıyı çıkar
        const match = level.match(/^(\d+)\.Sınıf$/);
        return match ? parseInt(match[1]) : parseInt(level);
      })
      .filter(level => !isNaN(level))
      .sort((a, b) => a - b);

    return numericLevels.length > 0 ? numericLevels[0].toString() : '9';
  }

  getMaxClassLevelInGroup(students: any[]): string {
    const classLevels = students
      .map(student => student.sinif_seviyesi || student.sinif || '9.Sınıf')
      .filter(level => level);

    // Mezun varsa tüm konuları göster
    if (classLevels.includes('Mezun')) {
      return 'Mezun';
    }

    // Sınıf seviyelerini parse et ('12.Sınıf' -> 12)
    const numericLevels = classLevels
      .map(level => {
        // '12.Sınıf' formatından sayıyı çıkar
        const match = level.match(/^(\d+)\.Sınıf$/);
        return match ? parseInt(match[1]) : parseInt(level);
      })
      .filter(level => !isNaN(level))
      .sort((a, b) => b - a);

    return numericLevels.length > 0 ? numericLevels[0].toString() : '9';
  }

  getAllUnites(): any[] {
    const uniteler = new Map();

    this.konular.forEach(konu => {
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

  getUnitesByClassLevel(classLevel: string): any[] {
    const uniteler = new Map();

    // Belirtilen sınıf seviyesi ve altındaki tüm konuları getir
    const allowedLevels = this.getAllowedClassLevelsForDB(classLevel);

    this.konular
      .filter(konu => allowedLevels.includes(konu.sinif_seviyesi))
      .forEach(konu => {
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

  getAllowedClassLevels(maxLevel: string): string[] {
    const levels = ['9.Sınıf', '10.Sınıf', '11.Sınıf', '12.Sınıf'];
    const numericLevels = ['9', '10', '11', '12'];
    const maxIndex = numericLevels.indexOf(maxLevel);
    return maxIndex !== -1 ? levels.slice(0, maxIndex + 1) : ['9.Sınıf'];
  }

  getAllowedClassLevelsForDB(maxLevel: string): string[] {
    const levels = ['9', '10', '11', '12'];
    const maxIndex = levels.indexOf(maxLevel);
    return maxIndex !== -1 ? levels.slice(0, maxIndex + 1) : ['9'];
  }

  getUnitesBySpecificClassLevel(classLevel: string): any[] {
    const uniteler = new Map();

    // Veritabanında sınıf seviyeleri sadece sayı olarak saklandığı için direkt classLevel kullan
    // Hiçbir format dönüşümü yapmadan doğrudan classLevel'ı kullan
    console.log('Aranan sınıf seviyesi:', classLevel, 'DB Format:', classLevel);
    console.log('Mevcut konular:', this.konular.length);
    console.log('Konulardaki sınıf seviyeleri:', this.konular.map(k => k.sinif_seviyesi));

    // Sadece belirtilen sınıf seviyesindeki konuları getir
    const filteredKonular = this.konular.filter(konu => konu.sinif_seviyesi === classLevel);
    console.log('Filtrelenmiş konular:', filteredKonular.length);

    filteredKonular.forEach(konu => {
      if (!uniteler.has(konu.unite_adi)) {
        uniteler.set(konu.unite_adi, {
          unite_adi: konu.unite_adi,
          konular: []
        });
      }
      uniteler.get(konu.unite_adi).konular.push(konu);
    });

    const result = Array.from(uniteler.values());
    console.log('Dönen üniteler:', result.length);
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