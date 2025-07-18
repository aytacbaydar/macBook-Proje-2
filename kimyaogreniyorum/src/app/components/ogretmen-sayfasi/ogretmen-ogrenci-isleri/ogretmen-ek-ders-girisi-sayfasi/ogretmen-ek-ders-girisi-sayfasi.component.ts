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
            //this.loadEkDersKayitlari();
          }
          this.isLoading = false;
        },
        error: (error) => {
          this.toastr.error('Öğrenciler yüklenemedi', 'Hata');
          this.isLoading = false;
        },
      });
  }

  onDateChange(): void {
    // Tarih değiştiğinde özel bir işlem yapmıyoruz
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

  // Ek ders kayıtları yükleme metodunu kaldırdık - bireysel sistem kullanıyoruz

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
    const student = this.groupStudents.find((s) => s.id === studentId);
    if (!student) {
      this.toastr.error('Öğrenci bulunamadı', 'Hata');
      return;
    }

    // devamsizlik_kaydet.php'nin beklediği format
    const data = {
      records: [{
        ogrenci_id: studentId,
        grup: student.grubu || 'Grup bilgisi yok',
        tarih: this.selectedDate,
        durum: durum === 'geldi' ? 'present' : 'absent',
        yontem: 'manual',
        zaman: new Date().toISOString(),
        ders_tipi: 'ek_ders'
      }]
    };

    console.log('Ek ders kaydı gönderiliyor:', data);

    this.http
      .post<any>('./server/api/devamsizlik_kaydet.php', data, {
        headers: this.getAuthHeaders(),
      })
      .subscribe({
        next: (response) => {
          if (response.success) {
            const durumText = durum === 'geldi' ? 'katıldı' : 'katılmadı';
            this.toastr.success(
              `${student.adi_soyadi} ek derse ${durumText} olarak işaretlendi`,
              'Başarılı'
            );
          } else {
            this.toastr.error(response.message || 'Yoklama kaydedilirken hata oluştu', 'Hata');
          }
        },
        error: (error) => {
        
          let errorMessage = 'Yoklama kaydedilirken hata oluştu';
          if (error.error && error.error.message) {
            errorMessage = error.error.message;
          }
          
          this.toastr.error(errorMessage, 'Hata');
          
          // Hata durumunda öğrencinin attendance durumunu geri al
          if (student) {
            student.attendance = student.attendance === durum ? null : student.attendance;
          }
        },
      });
  }

  saveAllAttendance(): void {
    if (!this.selectedDate) {
      this.toastr.warning('Lütfen tarih seçin', 'Uyarı');
      return;
    }

    const attendanceRecords = this.groupStudents.filter(
      (student) => student.attendance
    );

    if (attendanceRecords.length === 0) {
      this.toastr.warning('Yoklama işaretlenmemiş öğrenci var', 'Uyarı');
      return;
    }

    this.isSaving = true;

    // devamsizlik_kaydet.php'nin beklediği format - records dizisi içinde
    const records = attendanceRecords.map(student => ({
      ogrenci_id: student.id,
      grup: student.grubu || 'Grup bilgisi yok',
      tarih: this.selectedDate,
      durum: student.attendance === 'geldi' ? 'present' : 'absent',
      yontem: 'manual',
      zaman: new Date().toISOString(),
      ders_tipi: 'ek_ders'
    }));


    this.http
      .post<any>('./server/api/ek_ders_yoklama_kaydet.php', { records }, {
        headers: this.getAuthHeaders(),
      })
      .subscribe({
        next: (response) => {
          if (response.success) {
            this.toastr.success('Tüm ek ders yoklamaları başarıyla kaydedildi', 'Başarılı');
            // Attendance durumlarını temizle
            this.groupStudents.forEach(student => {
              student.attendance = null;
            });
          } else {
            this.toastr.error(response.message || 'Ek ders yoklamaları kaydedilirken hata oluştu', 'Hata');
          }
          this.isSaving = false;
        },
        error: (error) => {
          
          let errorMessage = 'Ek ders yoklamaları kaydedilirken hata oluştu';
          if (error.error && error.error.message) {
            errorMessage = error.error.message;
          }
          
          this.toastr.error(errorMessage, 'Hata');
          this.isSaving = false;
        }
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
      return null;
    }
  }

  markEkDersAttendance(studentId: number, durum: 'geldi' | 'gelmedi'): void {
    if (!this.selectedDate) {
      this.toastr.warning('Lütfen tarih seçin', 'Uyarı');
      return;
    }

    // Öğrencinin attendance durumunu güncelle
    const student = this.groupStudents.find((s) => s.id === studentId);
    if (student) {
      student.attendance = durum;
    }

    // Bireysel ek ders kaydı için veri hazırla
    const records = [{
      ogrenci_id: studentId,
      grup: student?.grubu || this.selectedGroup,
      tarih: this.selectedDate,
      durum: durum === 'geldi' ? 'present' : 'absent',
      yontem: 'manual',
      zaman: new Date().toISOString()
    }];

    this.http
      .post<any>('./server/api/ek_ders_yoklama_kaydet.php', { records }, {
        headers: this.getAuthHeaders(),
      })
      .subscribe({
        next: (response) => {
          if (response.success) {
            const durumText = durum === 'geldi' ? 'katıldı' : 'katılmadı';
            this.toastr.success(
              `${student?.adi_soyadi} ek derse ${durumText} olarak kaydedildi`,
              'Başarılı'
            );
          }
        },
        error: (error) => {
          console.error('Ek ders kaydı hatası:', error);
          this.toastr.error('Ek ders kaydı yapılırken hata oluştu', 'Hata');
          // Hata durumunda öğrencinin attendance durumunu geri al
          if (student) {
            student.attendance = student.attendance === durum ? null : student.attendance;
          }
        },
      });
  }
}