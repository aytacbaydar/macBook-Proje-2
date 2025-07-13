import { Component, OnInit } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { ToastrService } from 'ngx-toastr';
import { ActivatedRoute, Router } from '@angular/router';

interface Student {
  id: number;
  adi_soyadi: string;
  email: string;
  grubu: string;
  avatar?: string;
  attendance?: 'geldi' | 'gelmedi' | null;
}

interface EkDersKayit {
  id: number;
  ogrenci_id: number;
  ogrenci_adi: string;
  grubu: string;
  ders_tarihi: string;
  durum: 'geldi' | 'gelmedi';
  not: string;
  olusturma_zamani: string;
}

@Component({
  selector: 'app-ogretmen-ek-ders-girisi-sayfasi',
  standalone: false,
  templateUrl: './ogretmen-ek-ders-girisi-sayfasi.component.html',
  styleUrl: './ogretmen-ek-ders-girisi-sayfasi.component.scss',
})
export class OgretmenEkDersGirisiSayfasiComponent implements OnInit {
  selectedGroup: string = '';
  selectedDate: string = '';
  groups: string[] = [];
  groupStudents: Student[] = [];
  ekDersKayitlari: EkDersKayit[] = [];
  isLoading: boolean = false;
  isSaving: boolean = false;

  constructor(
    private http: HttpClient, 
    private toastr: ToastrService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    // URL parametresinden grup bilgisini al
    this.route.params.subscribe((params) => {
      if (params['grupAdi']) {
        this.selectedGroup = decodeURIComponent(params['grupAdi']);
        console.log('Route\'dan alınan grup:', this.selectedGroup);
      }
    });

    this.setDefaultDate();
    this.loadGroups();
  }

  private setDefaultDate(): void {
    const today = new Date();
    this.selectedDate = today.toISOString().split('T')[0];
  }

  getAuthHeaders() {
    // localStorage veya sessionStorage'dan user objesini al
    const userStr = localStorage.getItem('user') || sessionStorage.getItem('user');
    let token = '';

    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        token = user.token || '';
        console.log('Token bulundu:', token ? 'Evet' : 'Hayır');
        console.log('Token uzunluğu:', token.length);
      } catch (error) {
        console.error('User parse hatası:', error);
      }
    } else {
      console.error('User data bulunamadı!');
    }

    return new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
  }

  loadGroups(): void {
    this.isLoading = true;

    this.http
      .get<any>('./server/api/ogretmen_ogrencileri.php', {
        headers: this.getAuthHeaders(),
      })
      .subscribe({
        next: (response) => {
          console.log('Gruplar API yanıtı:', response);
          if (response.success && response.data) {
            // Giriş yapan öğretmenin bilgilerini al
            const loggedInUser = this.getLoggedInUser();
            const loggedInTeacherName = loggedInUser?.adi_soyadi || '';

            // Sadece öğrencileri filtrele ve öğretmenine göre filtrele
            const actualStudents = response.data.filter(
              (student: any) =>
                student.rutbe === 'ogrenci' &&
                student.ogretmeni === loggedInTeacherName
            );

            // Tüm grupları al
            this.groups = [
              'Tüm Gruplar',
              ...Array.from(new Set(actualStudents.map((student: any) => String(student.grubu)))) as string[],
            ];
            console.log('Yüklenen gruplar:', this.groups);
            console.log('Filtrelenen öğrenci sayısı:', actualStudents.length);

            // Eğer route'dan grup bilgisi geldiyse otomatik olarak yükle
            if (this.selectedGroup && this.groups.includes(this.selectedGroup)) {
              this.onGroupChange();
            }
          } else {
            console.error('Grup verisi alınamadı:', response);
          }
          this.isLoading = false;
        },
        error: (error) => {
          console.error('Gruplar yüklenirken hata:', error);
          this.toastr.error('Gruplar yüklenirken hata oluştu', 'Hata');
          this.isLoading = false;
        },
      });
  }

  onGroupChange(): void {
    if (!this.selectedGroup) {
      this.groupStudents = [];
      return;
    }

    this.isLoading = true;

    this.http
      .get<any>('./server/api/ogrenciler_listesi.php', {
        headers: this.getAuthHeaders(),
      })
      .subscribe({
        next: (response) => {
          if (response.success && response.data) {
            // Giriş yapan öğretmenin bilgilerini al
            const loggedInUser = this.getLoggedInUser();
            const loggedInTeacherName = loggedInUser?.adi_soyadi || '';

            let filteredStudents = response.data.filter(
              (student: any) =>
                student.rutbe === 'ogrenci' &&
                student.ogretmeni === loggedInTeacherName
            );

            if (this.selectedGroup === 'Tüm Gruplar') {
              this.groupStudents = filteredStudents;
            } else {
              this.groupStudents = filteredStudents.filter(
                (student: any) => student.grubu === this.selectedGroup
              );
            }

            console.log('Yüklenen öğrenci sayısı:', this.groupStudents.length);
            this.loadEkDersKayitlari();
          }
          this.isLoading = false;
        },
        error: (error) => {
          console.error('Öğrenciler yüklenirken hata:', error);
          this.toastr.error('Öğrenciler yüklenemedi', 'Hata');
          this.isLoading = false;
        },
      });
  }

  onDateChange(): void {
    if (this.selectedGroup && this.selectedDate) {
      this.loadEkDersKayitlari();
    }
  }

  loadGroupStudents(): void {
    if (!this.selectedGroup) return;

    this.isLoading = true;
    this.http
      .get<any>('./server/api/ogretmen_ogrencileri_listesi.php', {
        headers: this.getAuthHeaders(),
        params: { grup: this.selectedGroup },
      })
      .subscribe({
        next: (response) => {
          if (response.success && response.data) {
            this.groupStudents = response.data.map((student: any) => ({
              ...student,
              attendance: null,
              avatar:
                student.avatar || this.getDefaultAvatar(student.adi_soyadi),
            }));
          }
          this.isLoading = false;
        },
        error: (error) => {
          this.toastr.error('Öğrenciler yüklenirken hata oluştu', 'Hata');
          this.isLoading = false;
        },
      });
  }

  loadEkDersKayitlari(): void {
    if (!this.selectedDate) return;

    this.http
      .get<any>(`./server/api/devamsizlik_kayitlari.php`, {
        headers: this.getAuthHeaders(),
        params: {
          grup: this.selectedGroup,
          tarih: this.selectedDate,
        },
      })
      .subscribe({
        next: (response) => {
          if (response.success && response.data) {
            this.ekDersKayitlari = response.data;
            this.updateStudentAttendanceFromRecords();
          }
        },
        error: (error) => {
          this.toastr.error(
            'Ek ders kayıtları yüklenirken hata oluştu',
            'Hata'
          );
        },
      });
  }

  private updateStudentAttendanceFromRecords(): void {
    this.groupStudents.forEach((student) => {
      const record = this.ekDersKayitlari.find(
        (r) => r.ogrenci_id === student.id
      );
      student.attendance = record ? record.durum : null;
    });
  }

  markAttendance(studentId: number, durum: 'geldi' | 'gelmedi'): void {
    const student = this.groupStudents.find((s) => s.id === studentId);
    if (!student) return;

    if (student.attendance === durum) {
      student.attendance = null;
      durum = 'gelmedi'; // Varsayılan durum
    } else {
      student.attendance = durum;
    }

    this.saveAttendance(studentId, durum);
  }

  private saveAttendance(studentId: number, durum: 'geldi' | 'gelmedi'): void {
    const data = {
      ogrenci_id: studentId,
      durum: durum,
      ders_tarihi: this.selectedDate,
      not: '',
    };

    this.http
      .post<any>('./server/api/ek_ders_yoklama_kaydet.php', data, {
        headers: this.getAuthHeaders(),
      })
      .subscribe({
        next: (response) => {
          if (response.success) {
            const student = this.groupStudents.find((s) => s.id === studentId);
            const durumText = durum === 'geldi' ? 'katıldı' : 'katılmadı';
            this.toastr.success(
              `${student?.adi_soyadi} ek derse ${durumText} olarak işaretlendi`,
              'Başarılı'
            );
            this.loadEkDersKayitlari(); // Kayıtları yeniden yükle
          }
        },
        error: (error) => {
          this.toastr.error('Yoklama kaydedilirken hata oluştu', 'Hata');
          // Hata durumunda öğrencinin attendance durumunu geri al
          const student = this.groupStudents.find((s) => s.id === studentId);
          if (student) {
            student.attendance =
              student.attendance === durum ? null : student.attendance;
          }
        },
      });
  }

  saveAllAttendance(): void {
    if (!this.selectedGroup || !this.selectedDate) {
      this.toastr.warning('Lütfen grup ve tarih seçin', 'Uyarı');
      return;
    }

    this.isSaving = true;
    const promises: Promise<any>[] = [];

    this.groupStudents.forEach((student) => {
      if (student.attendance) {
        const data = {
          ogrenci_id: student.id,
          durum: student.attendance,
          ders_tarihi: this.selectedDate,
          not: '',
        };

        const promise = this.http
          .post<any>('./server/api/devamsizlik_kaydet.php', data, {
            headers: this.getAuthHeaders(),
          })
          .toPromise();

        promises.push(promise);
      }
    });

    Promise.all(promises)
      .then(() => {
        this.toastr.success('Tüm yoklamalar başarıyla kaydedildi', 'Başarılı');
        this.loadEkDersKayitlari();
        this.isSaving = false;
      })
      .catch((error) => {
        this.toastr.error('Yoklamalar kaydedilirken hata oluştu', 'Hata');
        this.isSaving = false;
      });
  }

  getAttendanceStatus(studentId: number): string {
    const student = this.groupStudents.find((s) => s.id === studentId);
    if (student?.attendance === 'geldi') return 'present';
    if (student?.attendance === 'gelmedi') return 'absent';
    return 'not-marked';
  }

  getAttendanceStatusText(studentId: number): string {
    const student = this.groupStudents.find((s) => s.id === studentId);
    if (student?.attendance === 'geldi') return 'Katıldı';
    if (student?.attendance === 'gelmedi') return 'Katılmadı';
    return 'İşaretlenmedi';
  }

  getPresentCount(): number {
    return this.groupStudents.filter((s) => s.attendance === 'geldi').length;
  }

  getAbsentCount(): number {
    return this.groupStudents.filter((s) => s.attendance === 'gelmedi').length;
  }

  getNotMarkedCount(): number {
    return this.groupStudents.filter((s) => !s.attendance).length;
  }

  getDefaultAvatar(name: string): string {
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(
      name
    )}&background=4f46e5&color=fff&size=40&font-size=0.6&rounded=true`;
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('tr-TR');
  }

  getDayName(dateString: string): string {
    const date = new Date(dateString);
    const days = [
      'Pazar',
      'Pazartesi',
      'Salı',
      'Çarşamba',
      'Perşembe',
      'Cuma',
      'Cumartesi',
    ];
    return days[date.getDay()];
  }

    getLoggedInUser(): any {
    const userStr = localStorage.getItem('user') || sessionStorage.getItem('user');
    if (userStr) {
      try {
        return JSON.parse(userStr);
      } catch (error) {
        console.error('Kullanıcı parse hatası:', error);
        return null;
      }
    } else {
      console.log('Kullanıcı bilgisi bulunamadı!');
      return null;
    }
  }
}