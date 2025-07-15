
import { Component, OnInit } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { ToastrService } from 'ngx-toastr';

interface StudentStats {
  id: number;
  name: string;
  email: string;
  avatar?: string;
  ucret: number;
  presentCount: number;
  absentCount: number;
  totalLessons: number;
  attendancePercentage: number;
  expectedPaymentCycles: number;
  expectedTotalAmount: number;
  lessonsUntilNextPayment: number;
}

interface AttendanceRecord {
  tarih: string;
  durum: string;
  zaman: string;
  ders_tipi: string;
}

@Component({
  selector: 'app-ogrenci-ucret-sayfasi',
  standalone: false,
  templateUrl: './ogrenci-ucret-sayfasi.component.html',
  styleUrl: './ogrenci-ucret-sayfasi.component.scss'
})
export class OgrenciUcretSayfasiComponent implements OnInit {
  // Math nesnesini template'de kullanmak için expose et
  Math = Math;
  
  // Öğrenci bilgileri
  selectedStudentStats: any = null;
  showStudentStatsModal = false;
  selectedStudentId: number | null = null;
  isLoading = false;
  studentAnalysis: StudentStats[] = [];
  
  // Kullanıcı bilgileri
  currentUser: any = null;
  
  // Öğrenci istatistik kartları
  studentStats: any[] = [];
  
  // Devamsızlık kayıtları
  historicalAttendance: any[] = [];
  groupedAttendanceByDate: any[] = [];
  viewHistoricalData: boolean = false;
  startDate: string = '';
  endDate: string = '';

  constructor(
    private http: HttpClient,
    private toastr: ToastrService
  ) {}

  ngOnInit() {
    this.loadUserData();
    this.loadStudentStats();
    this.loadStudentHistoricalAttendance();
  }

  private loadUserData() {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        this.currentUser = {
          id: payload.user_id,
          name: payload.adi_soyadi,
          rutbe: payload.rutbe
        };
      } catch (error) {
        console.error('Token parsing error:', error);
      }
    }
  }

  // Öğrenci istatistiklerini yükle (kendi bilgilerini görmek için)
  async loadStudentStats() {
    if (!this.currentUser || !this.currentUser.id) {
      return;
    }

    this.isLoading = true;

    try {
      // Öğrencinin kendi istatistiklerini getir
      const response = await this.http.get<any>(`server/api/ogrenci_detay_istatistik.php?ogrenci_id=${this.currentUser.id}&grup=`, {
        headers: this.getAuthHeaders()
      }).toPromise();

      if (response && response.success) {
        // Öğrenci bilgilerini student stats formatına çevir
        const stats = response.data;
        this.studentStats = [{
          id: stats.student_info.id,
          name: stats.student_info.name,
          email: stats.student_info.email,
          avatar: this.getDefaultAvatar(stats.student_info.name),
          ucret: stats.student_info.ucret,
          presentCount: stats.attendance_stats.present_count,
          absentCount: stats.attendance_stats.absent_count,
          totalLessons: stats.attendance_stats.total_lessons,
          attendancePercentage: stats.attendance_stats.attendance_percentage,
          expectedPaymentCycles: stats.payment_stats.expected_payment_cycles,
          expectedTotalAmount: stats.payment_stats.expected_total_amount,
          lessonsUntilNextPayment: stats.payment_stats.lessons_until_next_payment
        }];
      }
    } catch (error: any) {
      console.error('Öğrenci istatistikleri yüklenirken hata:', error);
    } finally {
      this.isLoading = false;
    }
  }

  // Detaylı öğrenci istatistiklerini getir (kendi bilgilerini görmek için)
  async loadStudentDetailedStats(studentId?: number) {
    this.isLoading = true;

    // Öğrenci kendi bilgilerini görüyor, kendi ID'sini kullan
    const targetStudentId = this.currentUser?.id || studentId;

    if (!targetStudentId) {
      this.toastr.error('Öğrenci bilgisi bulunamadı', 'Hata');
      this.isLoading = false;
      return;
    }

    try {
      const response = await this.http.get<any>(`server/api/ogrenci_detay_istatistik.php?ogrenci_id=${targetStudentId}&grup=`, {
        headers: this.getAuthHeaders()
      }).toPromise();

      if (response.success) {
        this.selectedStudentStats = response.data;
        this.selectedStudentId = targetStudentId;
        this.showStudentStatsModal = true;
      } else {
        this.toastr.error(response.message || 'İstatistik yüklenemedi', 'Hata');
      }
    } catch (error: any) {
      console.error('İstatistik yükleme hatası:', error);
      this.toastr.error('İstatistik yüklenirken bir hata oluştu', 'Hata');
    } finally {
      this.isLoading = false;
    }
  }

  closeStudentStatsModal() {
    this.showStudentStatsModal = false;
    this.selectedStudentStats = null;
    this.selectedStudentId = null;
  }

  // Yardımcı fonksiyonlar
  getAuthHeaders(): HttpHeaders {
    const token = localStorage.getItem('token');
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: 'TRY'
    }).format(amount);
  }

  getDefaultAvatar(name: string): string {
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=0d6efd&color=fff&size=40`;
  }

  getAttendanceColor(percentage: number): string {
    if (percentage >= 80) return 'success';
    if (percentage >= 60) return 'warning';
    return 'danger';
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }

  formatTime(timeString: string): string {
    return timeString.substring(0, 5);
  }

  // Öğrencinin geçmiş devamsızlık kayıtlarını yükle
  async loadStudentHistoricalAttendance() {
    if (!this.currentUser || !this.currentUser.id) {
      return;
    }

    try {
      const response = await this.http.get<any>(`./server/api/devamsizlik_kayitlari.php`, {
        headers: this.getAuthHeaders(),
        params: {
          ogrenci_id: this.currentUser.id.toString()
        }
      }).toPromise();

      if (response && response.success && response.data) {
        this.historicalAttendance = response.data.kayitlar || [];
        
        // Tarihlere göre gruplanan verileri al
        this.groupedAttendanceByDate = response.data.tarihlere_gore || [];
        
        console.log('Öğrenci geçmiş kayıtları yüklendi:', this.historicalAttendance.length, 'kayıt');
      } else {
        this.historicalAttendance = [];
        this.groupedAttendanceByDate = [];
      }
    } catch (error: any) {
      console.error('Geçmiş devamsızlık verileri yüklenirken hata:', error);
      this.historicalAttendance = [];
      this.groupedAttendanceByDate = [];
    }
  }

  // Tarih aralığına göre kayıtları yükle
  async loadHistoricalAttendanceByDateRange() {
    if (!this.currentUser || !this.currentUser.id || !this.startDate || !this.endDate) {
      return;
    }

    try {
      const response = await this.http.get<any>(`./server/api/devamsizlik_kayitlari.php`, {
        headers: this.getAuthHeaders(),
        params: {
          ogrenci_id: this.currentUser.id.toString(),
          baslangic_tarih: this.startDate,
          bitis_tarih: this.endDate
        }
      }).toPromise();

      if (response && response.success && response.data) {
        this.historicalAttendance = response.data.kayitlar || [];
        this.groupedAttendanceByDate = response.data.tarihlere_gore || [];
        
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
    } catch (error: any) {
      console.error('Tarih aralığına göre devamsızlık verileri yüklenirken hata:', error);
      this.toastr.error('Veriler yüklenirken hata oluştu', 'Hata');
    }
  }

  // Geçmiş verileri görüntüleme/gizleme
  toggleHistoricalView() {
    this.viewHistoricalData = !this.viewHistoricalData;
    if (this.viewHistoricalData && this.historicalAttendance.length === 0) {
      this.loadStudentHistoricalAttendance();
    }
  }

  // Hızlı tarih filtreleri
  setDateRangeLastWeek() {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - 7);

    this.startDate = startDate.toISOString().split('T')[0];
    this.endDate = endDate.toISOString().split('T')[0];

    this.loadHistoricalAttendanceByDateRange();
  }

  setDateRangeLastMonth() {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - 30);

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

  // Bütün devamsızlık kayıtlarını getir
  async loadAllAttendanceRecords() {
    if (!this.currentUser || !this.currentUser.id) {
      return;
    }

    try {
      const response = await this.http.get<any>(`./server/api/devamsizlik_kayitlari.php`, {
        headers: this.getAuthHeaders(),
        params: {
          ogrenci_id: this.currentUser.id.toString(),
          butun_kayitlar: 'true'
        }
      }).toPromise();

      if (response && response.success && response.data) {
        this.historicalAttendance = response.data.kayitlar || [];
        this.groupedAttendanceByDate = response.data.tarihlere_gore || [];

        // Tarih inputlarını temizle
        this.startDate = '';
        this.endDate = '';

        this.toastr.success('Tüm devamsızlık kayıtları yüklendi', 'Başarılı');
      } else {
        this.historicalAttendance = [];
        this.groupedAttendanceByDate = [];
        this.toastr.warning('Herhangi bir kayıt bulunamadı', 'Uyarı');
      }
    } catch (error: any) {
      console.error('Tüm devamsızlık kayıtları yüklenirken hata:', error);
      this.toastr.error('Kayıtlar yüklenirken hata oluştu', 'Hata');
    }
  }

  // Yardımcı fonksiyonlar
  getDayName(date: string): string {
    const days = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
    const day = new Date(date).getDay();
    return days[day];
  }

  // Devamsızlık analizi - ders tiplerini ayır
  getStudentAttendanceAnalysis(): any {
    if (!this.currentUser || this.historicalAttendance.length === 0) {
      return null;
    }

    // Present kayıtları
    const presentRecords = this.historicalAttendance.filter(record => record.durum === 'present');
    const presentNormal = presentRecords.filter(record => !record.ders_tipi || record.ders_tipi === 'normal').length;
    const presentEkDers = presentRecords.filter(record => record.ders_tipi === 'ek_ders').length;
    const presentEtutDersi = presentRecords.filter(record => record.ders_tipi === 'etut_dersi').length;
    const totalPresent = presentRecords.length;

    // Absent kayıtları
    const absentRecords = this.historicalAttendance.filter(record => record.durum === 'absent');
    const absentNormal = absentRecords.filter(record => !record.ders_tipi || record.ders_tipi === 'normal').length;
    const absentEkDers = absentRecords.filter(record => record.ders_tipi === 'ek_ders').length;
    const absentEtutDersi = absentRecords.filter(record => record.ders_tipi === 'etut_dersi').length;
    const totalAbsent = absentRecords.length;

    // Toplam
    const totalRecords = this.historicalAttendance.length;
    const attendancePercentage = totalRecords > 0 ? Math.round((totalPresent / totalRecords) * 100) : 0;

    return {
      id: this.currentUser.id,
      name: this.currentUser.name,
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
    };
  }

  // Aylık özet istatistikleri
  getTotalPresentInPeriod(): number {
    return this.historicalAttendance.filter(record => record.durum === 'present').length;
  }

  getTotalAbsentInPeriod(): number {
    return this.historicalAttendance.filter(record => record.durum === 'absent').length;
  }

  getTotalLessonsCount(): number {
    return this.groupedAttendanceByDate.length;
  }

  getAttendancePercentage(): number {
    const totalPresent = this.getTotalPresentInPeriod();
    const totalAbsent = this.getTotalAbsentInPeriod();
    const total = totalPresent + totalAbsent;

    if (total === 0) return 0;
    return Math.round((totalPresent / total) * 100);
  }
}
