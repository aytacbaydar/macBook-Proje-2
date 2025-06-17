import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

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
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OgretmenIslenenKonularSayfasiComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
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
  constructor(
    private http: HttpClient,
    private cdr: ChangeDetectorRef
  ) {}

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
    this.error = ''; // Clear previous errors

    this.http
      .get<any>('./server/api/konu_listesi.php', {
        headers: this.getHeaders(),
      })
      .subscribe({
        next: (response) => {
          console.log('Konular API response:', response);
          if (response.success) {
            this.konular = response.konular || [];
          } else {
            this.error = response.message || 'Konular yüklenemedi';
          }
          this.isLoading = false;
          this.cdr.detectChanges();
        },
        error: (error) => {
          console.error('Konular yüklenirken hata:', error);
          this.error = 'Sunucu ile bağlantı kurulamadı. Lütfen tekrar deneyin.';
          this.isLoading = false;
          this.cdr.detectChanges();
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
      this.isLoading = false;
      this.cdr.detectChanges();
      return;
    }

    console.log('İşlenen konular yükleniyor, öğretmen ID:', ogretmenId);

    this.http
      .get<any>(
        `./server/api/islenen_konular.php?ogretmen_id=${ogretmenId}`,
        { headers: this.getHeaders() }
      )
      .subscribe({
        next: (response) => {
          console.log('İşlenen konular API response:', response);
          if (response.success) {
            this.islenenKonular = response.islenen_konular || [];
            this.error = '';
          } else {
            console.error('İşlenen konular yüklenirken hata:', response.message);
            this.error = response.message || 'İşlenen konular yüklenemedi';
          }
          this.isLoading = false;
          this.cdr.detectChanges();
        },
        error: (error) => {
          console.error('İşlenen konular yüklenirken hata:', error);
          this.error = 'Sunucu ile bağlantı kurulamadı. Lütfen tekrar deneyin.';
          this.isLoading = false;
          this.cdr.detectChanges();
        },
      });
  }

  // GRUPUN SINIF SEVİYESİNE GÖRE KONULARI FİLTRELE
  getUnitesByGroup(grupAdi: string): any[] {
    // ÖNCE TÜM KONULARI ID'YE GÖRE SIRALA (Küçükten büyüğe)
    const sortedKonular = [...this.konular].sort((a, b) => (a.id || 0) - (b.id || 0));

    let filteredKonular: Konu[] = [];

    // Grubun sınıf seviyelerini al
    const group = this.groups.find(g => g.name === grupAdi);
    let groupClassLevels: string[] = [];

    if (group && group.students && group.students.length > 0) {
      groupClassLevels = group.students
        .map((student: any) => student.sinifi || student.sinif_seviyesi || student.sinif)
        .filter((level: string) => level)
        .filter((level: string, index: number, arr: string[]) => arr.indexOf(level) === index); // Tekrarları kaldır
    }

    console.log(`${grupAdi} grubu sınıf seviyeleri:`, groupClassLevels);

    // Mezun veya 12.Sınıf varsa tüm konuları göster
    const hasMezunOr12 = groupClassLevels.some(level => 
      level.toLowerCase().includes('mezun') || level === '12' || level === '12.Sınıf'
    );

    if (hasMezunOr12) {
      // 12.Sınıf veya Mezun varsa TÜM konuları göster
      filteredKonular = sortedKonular;
      console.log(`${grupAdi} grubu - 12.Sınıf/Mezun var, tüm konular gösteriliyor:`, filteredKonular.length);
    } else if (groupClassLevels.length > 0) {
      // Belirli sınıf seviyesi varsa sadece o sınıfın konularını göster
      filteredKonular = sortedKonular.filter(konu => {
        return groupClassLevels.some(groupLevel => {
          const konuSinif = konu.sinif_seviyesi;
          // Sınıf seviyesi eşleştirmesi
          const normalizedKonuSinif = konuSinif.replace('.Sınıf', '');
          const normalizedGroupLevel = groupLevel.replace('.Sınıf', '');
          
          return normalizedKonuSinif === normalizedGroupLevel || 
                 konuSinif === groupLevel ||
                 konuSinif === groupLevel + '.Sınıf' ||
                 konuSinif + '.Sınıf' === groupLevel;
        });
      });
      console.log(`${grupAdi} grubu - Sınıf seviyesi filtrelemesi yapıldı:`, filteredKonular.length);
    } else {
      // Sınıf seviyesi bilgisi yoksa tüm konuları göster
      filteredKonular = sortedKonular;
      console.log(`${grupAdi} grubu - Sınıf seviyesi yok, tüm konular gösteriliyor:`, filteredKonular.length);
    }
    const uniteler = new Map();

    // FİLTRELENMİŞ KONULARI ÜNİTELERE GÖRE GRUPLANDI
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

  getIslenenKonularByGrup(grup: string): any[] {
    const filtered = this.islenenKonular.filter(konu => konu.grup_adi === grup);
    // En son işlenen konuları önce göstermek için tarihe göre sırala
    const sorted = filtered.sort((a, b) => {
      const dateA = new Date(a.isleme_tarihi);
      const dateB = new Date(b.isleme_tarihi);
      return dateB.getTime() - dateA.getTime(); // En yeni tarih önce
    });
    console.log(`${grup} grubu için işlenen konular:`, sorted);
    console.log(`${grup} grubu için ilk konunun field'ları:`, sorted[0] ? Object.keys(sorted[0]) : 'Boş array');
    if (sorted.length > 0) {
      console.log(`${grup} grubu için ilk konu verisi:`, sorted[0]);
    }
    return sorted;
  }

  getToplamIslenenKonu(grupAdi: string): number {
    return this.islenenKonular.filter((islenen) => islenen.grup_adi === grupAdi)
      .length;
  }

  getToplamKonuSayisiByGroup(grupAdi: string): number {
    const unites = this.getUnitesByGroup(grupAdi);
    return unites.reduce((total, unite) => total + unite.konular.length, 0);
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('tr-TR');
  }

  getGroupClassLevels(grupAdi: string): string {
    const group = this.groups.find(g => g.name === grupAdi);
    if (!group || !group.students || group.students.length === 0) {
      return 'Sınıf bilgisi yok';
    }

    // Gruptaki öğrencilerin sınıf seviyelerini topla
    const classLevels = group.students
      .map((student: any) => student.sinifi)
      .filter((level: string) => level) // Boş olanları filtrele
      .filter((level: string, index: number, arr: string[]) => arr.indexOf(level) === index) // Tekrarları kaldır
      .sort(); // Sırala

    if (classLevels.length === 0) {
      return 'Sınıf bilgisi yok';
    }

    return classLevels.join();
  }

  getUniqueGroups(): string[] {
    const groups = [...new Set(this.islenenKonular.map(konu => konu.grup_adi))];
    const filteredGroups = groups.filter(group => group && group.trim() !== '');
    console.log('Unique groups found:', filteredGroups);
    console.log('All islenen konular:', this.islenenKonular);
    return filteredGroups;
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}