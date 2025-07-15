import {
  Component,
  OnInit,
  OnDestroy,
} from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';

interface Student {
  id: number;
  adi_soyadi: string;
  email: string;
  cep_telefonu: string;
  avatar: string;
  sinifi: string;
  okulu: string;
  grubu: string;
  aktif: boolean;
  ucret?: string;
}

interface AttendanceRecord {
  id: number;
  ogrenci_id: number;
  ogretmen_id: number;
  grup: string;
  tarih: string;
  durum: string;
  zaman: string;
  yontem: string;
  ders_tipi: string;
}

interface Payment {
  id: number;
  ogrenci_id: number;
  tutar: number;
  odeme_tarihi: string;
  aciklama: string;
  ay: number;
  yil: number;
}

@Component({
  selector: 'app-ogrenci-ucret-sayfasi',
  standalone: false,
  templateUrl: './ogrenci-ucret-sayfasi.component.html',
  styleUrl: './ogrenci-ucret-sayfasi.component.scss',
})
export class OgrenciUcretSayfasiComponent implements OnInit, OnDestroy {
  // Math nesnesini template'de kullanmak için expose et
  Math = Math;

  private apiBaseUrl = 'http://localhost:8000/api';

  // Data properties - Student specific
  currentStudent: Student | null = null;
  historicalAttendance: AttendanceRecord[] = [];
  groupedAttendanceByDate: any[] = [];
  studentStats: any = null;
  paymentHistory: Payment[] = [];
  error: string | null = null;

  // Payment history
  paymentHistory: any[] = [];

  // UI state
  selectedGroup: string = '';
  viewHistoricalData: boolean = false;
  startDate: string = '';
  endDate: string = '';
  isLoading: boolean = false;

  // Student info
  showStudentStatsModal = false;

  // Error state
  error: string = '';

  constructor(
    private http: HttpClient,
    private route: ActivatedRoute,
    private router: Router,
    private toastr: ToastrService
  ) {}

  ngOnInit() {
    this.loadStudentInfo();
  }

  ngOnDestroy() {
    // Cleanup if needed
  }

  private getAuthHeaders() {
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

  private getLoggedInUser(): any {
    const userStr = localStorage.getItem('user') || sessionStorage.getItem('user');
    if (userStr) {
      return JSON.parse(userStr);
    }
    return null;
  }

  loadStudentInfo() {
    this.isLoading = true;
    const loggedInUser = this.getLoggedInUser();

    if (!loggedInUser || !loggedInUser.id) {
      this.toastr.error('Giriş bilgileri bulunamadı', 'Hata');
      this.isLoading = false;
      return;
    }

    // Get student info
    this.http.get<any>(`./server/api/ogrenci_bilgileri.php`, {
      headers: this.getAuthHeaders(),
      params: { ogrenci_id: loggedInUser.id.toString() }
    }).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.currentStudent = response.data;
          this.selectedGroup = response.data.grubu || '';
          this.loadStudentAttendanceData();
          this.loadStudentDetailedStats();
        } else {
          this.toastr.error('Öğrenci bilgileri yüklenemedi', 'Hata');
        }
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Öğrenci bilgileri yüklenirken hata:', error);
        this.toastr.error('Öğrenci bilgileri yüklenemedi', 'Hata');
        this.isLoading = false;
      }
    });
  }

  loadStudentAttendanceData() {
    if (!this.currentStudent) return;

    this.http.get<any>(`./server/api/devamsizlik_kayitlari.php`, {
      headers: this.getAuthHeaders(),
      params: {
        ogrenci_id: this.currentStudent.id.toString()
      }
    }).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.historicalAttendance = response.data.kayitlar || [];

          // Group by date
          this.groupedAttendanceByDate = this.groupAttendanceByDate(this.historicalAttendance);
        } else {
          this.historicalAttendance = [];
          this.groupedAttendanceByDate = [];
        }
      },
      error: (error) => {
        console.error('Devamsızlık verileri yüklenirken hata:', error);
        this.historicalAttendance = [];
        this.groupedAttendanceByDate = [];
      }
    });
  }

  private groupAttendanceByDate(records: AttendanceRecord[]): any[] {
    const grouped: { [key: string]: any } = {};

    records.forEach(record => {
      const date = record.tarih;
      if (!grouped[date]) {
        grouped[date] = {
          tarih: date,
          kayitlar: [],
          katilan_sayisi: 0,
          katilmayan_sayisi: 0
        };
      }

      grouped[date].kayitlar.push(record);

      if (record.durum === 'present') {
        grouped[date].katilan_sayisi++;
      } else if (record.durum === 'absent') {
        grouped[date].katilmayan_sayisi++;
      }
    });

    return Object.values(grouped).sort((a: any, b: any) => 
      new Date(b.tarih).getTime() - new Date(a.tarih).getTime()
    );
  }

  loadHistoricalAttendanceByDateRange() {
    if (!this.currentStudent || !this.startDate || !this.endDate) {
      return;
    }

    this.http.get<any>(`./server/api/devamsizlik_kayitlari.php`, {
      headers: this.getAuthHeaders(),
      params: {
        ogrenci_id: this.currentStudent.id.toString(),
        baslangic_tarih: this.startDate,
        bitis_tarih: this.endDate,
      },
    }).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.historicalAttendance = response.data.kayitlar || [];
          this.groupedAttendanceByDate = this.groupAttendanceByDate(this.historicalAttendance);

          if (this.groupedAttendanceByDate.length === 0) {
            this.toastr.info('Seçilen tarih aralığında kayıt bulunamadı', 'Bilgi');
          } else {
            this.toastr.success(`${this.groupedAttendanceByDate.length} günlük kayıt yüklendi`, 'Başarılı');
          }
        } else {
          this.historicalAttendance = [];
          this.groupedAttendanceByDate = [];
          this.toastr.warning('Seçilen tarih aralığında kayıt bulunamadı', 'Uyarı');
        }
      },
      error: (error) => {
        console.error('Tarih aralığına göre devamsızlık verileri yüklenirken hata:', error);
        this.historicalAttendance = [];
        this.groupedAttendanceByDate = [];
        this.toastr.error('Veriler yüklenirken hata oluştu', 'Hata');
      },
    });
  }

  loadAllAttendanceRecords() {
    if (!this.currentStudent) return;

    this.http.get<any>(`./server/api/devamsizlik_kayitlari.php`, {
      headers: this.getAuthHeaders(),
      params: {
        ogrenci_id: this.currentStudent.id.toString(),
        butun_kayitlar: 'true'
      },
    }).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.historicalAttendance = response.data.kayitlar || [];
          this.groupedAttendanceByDate = this.groupAttendanceByDate(this.historicalAttendance);

          this.startDate = '';
          this.endDate = '';

          this.toastr.success('Tüm devamsızlık kayıtları yüklendi', 'Başarılı');
        } else {
          this.historicalAttendance = [];
          this.groupedAttendanceByDate = [];
          this.toastr.warning('Herhangi bir kayıt bulunamadı', 'Uyarı');
        }
      },
      error: (error) => {
        console.error('Tüm devamsızlık kayıtları yüklenirken hata:', error);
        this.historicalAttendance = [];
        this.groupedAttendanceByDate = [];
        this.toastr.error('Kayıtlar yüklenirken hata oluştu', 'Hata');
      },
    });
  }

  // Quick date filters
  setDateRangeLastWeek() {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - 7);

    this.startDate = startDate.toISOString().split('T')[0];
    this.endDate = endDate.toISOString().split('T')[0];

    this.loadHistoricalAttendanceByDateRange();
  }

  setDateRangeThisMonth() {
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    this.startDate = startDate.toISOString().split('T')[0];
    this.endDate = endDate.toISOString().split('T')[0];

    this.loadHistoricalAttendanceByDateRange();
  }

  setDateRangeThisYear() {
    const now = new Date();
    const startDate = new Date(now.getFullYear(), 0, 1);
    const endDate = new Date(now.getFullYear(), 11, 31);

    this.startDate = startDate.toISOString().split('T')[0];
    this.endDate = endDate.toISOString().split('T')[0];

    this.loadHistoricalAttendanceByDateRange();
  }

  getDayName(date: string): string {
    const days = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
    const day = new Date(date).getDay();
    return days[day];
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('tr-TR');
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: 'TRY'
    }).format(amount);
  }

  getDefaultAvatar(name: string): string {
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=4f46e5&color=fff&size=40&font-size=0.6&rounded=true`;
  }

  // Ders tipine göre filtreleme
  getLessonsByType(lessons: AttendanceRecord[], lessonType: string): AttendanceRecord[] {
    if (!lessons) return [];

    return lessons.filter(lesson => {
      if (lessonType === 'normal') {
        return !lesson.ders_tipi || lesson.ders_tipi === 'normal';
      }
      return lesson.ders_tipi === lessonType;
    });
  }

  // Statistics methods
  getTotalPresentCount(): number {
    return this.historicalAttendance.filter(record => record.durum === 'present').length;
  }

  getTotalAbsentCount(): number {
    return this.historicalAttendance.filter(record => record.durum === 'absent').length;
  }

  getTotalLessonsCount(): number {
    return this.groupedAttendanceByDate.length;
  }

  getAttendancePercentage(): number {
    const totalPresent = this.getTotalPresentCount();
    const totalAbsent = this.getTotalAbsentCount();
    const total = totalPresent + totalAbsent;

    if (total === 0) return 0;
    return Math.round((totalPresent / total) * 100);
  }

  // Student detailed statistics
  async loadStudentDetailedStats() {
    if (!this.currentStudent) return;

    this.isLoading = true;

    try {
      const response = await this.http.get<any>(`./server/api/ogrenci_detay_istatistik.php`, {
        headers: this.getAuthHeaders(),
        params: {
          grup: this.selectedGroup,
          ogrenci_id: this.currentStudent.id.toString()
        },
        responseType: 'json'
      }).toPromise();

      if (response && response.success) {
        this.studentStats = response.data;
      } else {
        console.error('Öğrenci istatistikleri yüklenemedi:', response?.message);
      }
    } catch (error: any) {
      console.error('Öğrenci istatistikleri yüklenirken hata:', error);
    } finally {
      this.isLoading = false;
    }
  }

  openStudentStatsModal() {
    this.showStudentStatsModal = true;
  }

  closeStudentStatsModal() {
    this.showStudentStatsModal = false;
  }

  // Get student attendance analysis for the current student
  getStudentAttendanceAnalysis(): any[] {
    if (!this.currentStudent || this.historicalAttendance.length === 0) {
      return [];
    }

    const studentRecords = this.historicalAttendance;

    // Present records by lesson type
    const presentRecords = studentRecords.filter(record => record.durum === 'present');
    const presentNormal = presentRecords.filter(record => !record.ders_tipi || record.ders_tipi === 'normal').length;
    const presentEkDers = presentRecords.filter(record => record.ders_tipi === 'ek_ders').length;
    const presentEtutDersi = presentRecords.filter(record => record.ders_tipi === 'etut_dersi').length;
    const totalPresent = presentRecords.length;

    // Absent records by lesson type
    const absentRecords = studentRecords.filter(record => record.durum === 'absent');
    const absentNormal = absentRecords.filter(record => !record.ders_tipi || record.ders_tipi === 'normal').length;
    const absentEkDers = absentRecords.filter(record => record.ders_tipi === 'ek_ders').length;
    const absentEtutDersi = absentRecords.filter(record => record.ders_tipi === 'etut_dersi').length;
    const totalAbsent = absentRecords.length;

    // Total
    const totalRecords = studentRecords.length;
    const attendancePercentage = totalRecords > 0 ? Math.round((totalPresent / totalRecords) * 100) : 0;

    return [{
      id: this.currentStudent.id,
      name: this.currentStudent.adi_soyadi,
      email: this.currentStudent.email,
      avatar: this.currentStudent.avatar,
      totalRecords: totalRecords,
      present: {
        total: totalPresent,
        normal: presentNormal,
        ek_ders: presentEkDers,
        etut_dersi: presentEtutDersi
      },
      absent: {
        total: totalAbsent,
        normal: absentNormal,
        ek_ders: absentEkDers,
        etut_dersi: absentEtutDersi
      },
      attendancePercentage: attendancePercentage
    }];
  }

  // Get student attendance stats for payment calculation
  getStudentAttendanceStats(): any[] {
    if (!this.currentStudent || this.historicalAttendance.length === 0) {
      return [];
    }

    const studentRecords = this.historicalAttendance;

    // Count present lessons (normal + ek ders)
    const presentCount = studentRecords.filter(
      record => record.durum === 'present' && 
      (!record.ders_tipi || record.ders_tipi === 'normal' || record.ders_tipi === 'ek_ders')
    ).length;

    // Count absent lessons
    const absentCount = studentRecords.filter(
      record => record.durum === 'absent'
    ).length;

    const totalLessons = presentCount + absentCount;
    const attendancePercentage = totalLessons > 0 
      ? Math.round((presentCount / totalLessons) * 100) 
      : 0;

    // Payment calculations
    const ucret = parseFloat(this.currentStudent.ucret || '0');
    const expectedPaymentCycles = Math.floor(presentCount / 4);
    const expectedTotalAmount = expectedPaymentCycles * ucret;
    const lessonsUntilNextPayment = presentCount > 0 ? 4 - (presentCount % 4) : 4;

    return [{
      id: this.currentStudent.id,
      name: this.currentStudent.adi_soyadi,
      email: this.currentStudent.email,
      avatar: this.currentStudent.avatar,
      ucret: ucret,
      presentCount: presentCount,
      absentCount: absentCount,
      totalLessons: totalLessons,
      attendancePercentage: attendancePercentage,
      expectedPaymentCycles: expectedPaymentCycles,
      expectedTotalAmount: expectedTotalAmount,
      lessonsUntilNextPayment: lessonsUntilNextPayment === 4 ? 0 : lessonsUntilNextPayment
    }];
  }

  loadPaymentData(): void {
    this.isLoading = true;
    const headers = this.getAuthHeaders();

    this.http.get<any>('./server/api/ogrenci_ucret_bilgileri.php', { headers })
      .subscribe({
        next: (response) => {
          console.log('API Response:', response);

          if (response && response.success) {
            this.currentStudent = response.data.student_info;
            this.historicalAttendance = response.data.attendance_records || [];
            this.paymentHistory = response.data.payments || [];
            this.groupedAttendanceByDate = this.convertGroupedAttendance(response.data.grouped_attendance || {});

            console.log('Loaded data:', {
              student: this.currentStudent,
              attendance: this.historicalAttendance.length,
              payments: this.paymentHistory.length,
              grouped: Object.keys(this.groupedAttendanceByDate).length
            });
          } else {
            console.error('API failed response:', response);
            this.error = 'Veri yüklenemedi: ' + (response?.message || 'Bilinmeyen hata');
          }
          this.isLoading = false;
        },
        error: (error) => {
          console.error('API Error:', error);
          this.error = 'Bağlantı hatası: ' + (error.message || 'Bilinmeyen hata');
          this.isLoading = false;
        }
      });
  }
  
  convertGroupedAttendance(groupedAttendance: any): any[] {
    return Object.entries(groupedAttendance).map(([date, data]: [string, any]) => ({
      tarih: date,
      kayitlar: data.kayitlar,
      katilan_sayisi: data.katilan_sayisi,
      katilmayan_sayisi: data.katilmayan_sayisi
    })).sort((a: any, b: any) => new Date(b.tarih).getTime() - new Date(a.tarih).getTime());
  }
}