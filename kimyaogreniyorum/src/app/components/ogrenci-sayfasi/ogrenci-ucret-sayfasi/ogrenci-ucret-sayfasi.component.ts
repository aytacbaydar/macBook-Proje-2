
import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { ToastrService } from 'ngx-toastr';
import { ActivatedRoute, Router } from '@angular/router';

interface Student {
  id: number;
  adi_soyadi: string;
  email: string;
  grubu: string;
  avatar?: string;
  rutbe: string;
  ogretmeni: string;
  ucret: string;
}

interface Group {
  name: string;
  students: Student[];
  color: string;
}

interface AttendanceRecord {
  student_id: number;
  status: 'present' | 'absent' | 'pending';
  timestamp: Date;
  method: 'manual' | 'qr';
}

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

@Component({
  selector: 'app-ogrenci-ucret-sayfasi',
  standalone: false,
  templateUrl: './ogrenci-ucret-sayfasi.component.html',
  styleUrl: './ogrenci-ucret-sayfasi.component.scss'
})
export class OgrenciUcretSayfasiComponent implements OnInit, OnDestroy {
  @ViewChild('videoElement') videoElement!: ElementRef<HTMLVideoElement>;
  @ViewChild('canvasElement') canvasElement!: ElementRef<HTMLCanvasElement>;

  // Math nesnesini template'de kullanmak için expose et
  Math = Math;

  private apiBaseUrl = 'http://localhost:8000/api';
  private mediaStream: MediaStream | null = null;
  private qrScanInterval: any;

  // Data properties
  groups: Group[] = [];
  groupStudents: Student[] = [];
  attendanceRecords: Map<number, AttendanceRecord> = new Map();
  pastWeekAttendance: any[] = [];
  historicalAttendance: any[] = [];
  groupedAttendanceByDate: any[] = [];

  // UI state
  selectedGroup: string = '';
  selectedDate: string = new Date().toISOString().split('T')[0];
  viewHistoricalData: boolean = true;
  viewProcessedLessons: boolean = false;
  startDate: string = '';
  endDate: string = '';
  isQRScannerActive: boolean = false;
  isLoading: boolean = false;
  hasChanges: boolean = false;

  // İşlenen dersler için değişkenler
  processedLessons: any[] = [];
  processedLessonsGroupedByDate: any[] = [];

  // Etüt Dersi için değişkenler
  etutAttendanceRecords: Map<number, AttendanceRecord> = new Map();
  etutDersiTarih: string = new Date().toISOString().split('T')[0];
  etutDersiSaat: string = '19:00';
  hasEtutChanges: boolean = false;
  isEtutSaving: boolean = false;

  // Öğrenci bilgileri
  selectedStudentStats: any = null;
  showStudentStatsModal = false;
  selectedStudentId: number | null = null;
  studentAnalysis: StudentStats[] = [];
  
  // Kullanıcı bilgileri
  currentUser: any = null;
  
  // Öğrenci istatistik kartları
  studentStats: any[] = [];
  
  // Filtreleme için orijinal veriler
  originalHistoricalAttendance: any[] = [];
  originalGroupedAttendanceByDate: any[] = [];
  
  // Ders tipi filtreleme
  selectedDersType: string = 'all'; // 'all', 'normal', 'ek_ders', 'etut_dersi'

  // Computed properties
  get totalStudents(): number {
    return this.groupStudents.length;
  }

  get presentStudents(): number {
    return Array.from(this.attendanceRecords.values()).filter(
      (record) => record.status === 'present'
    ).length;
  }

  get absentStudents(): number {
    return Array.from(this.attendanceRecords.values()).filter(
      (record) => record.status === 'absent'
    ).length;
  }

  constructor(
    private http: HttpClient,
    private route: ActivatedRoute,
    private router: Router,
    private toastr: ToastrService
  ) {}

  ngOnInit() {
    this.loadUserData();
    this.loadStudentStats();
    this.loadStudentHistoricalAttendance();
    this.setTodayDate();
  }

  ngOnDestroy() {
    this.stopQRScanner();
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
        console.log('Current user loaded:', this.currentUser);
      } catch (error) {
        console.error('Token parsing error:', error);
      }
    }
  }

  private getAuthHeaders(): HttpHeaders {
    const token = localStorage.getItem('token');
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
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

        // Grup bilgisini al ve groupStudents'ı sadece bu öğrenci ile doldur
        this.groupStudents = [{
          id: stats.student_info.id,
          adi_soyadi: stats.student_info.name,
          email: stats.student_info.email,
          grubu: stats.student_info.grubu || '',
          avatar: this.getDefaultAvatar(stats.student_info.name),
          rutbe: 'ogrenci',
          ogretmeni: '',
          ucret: stats.student_info.ucret.toString()
        }];

        this.selectedGroup = stats.student_info.grubu || '';
        this.initializeAttendanceRecords();
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
        // Orijinal verileri sakla
        this.originalHistoricalAttendance = response.data.kayitlar || [];
        this.originalGroupedAttendanceByDate = response.data.tarihlere_gore || [];
        
        // Filtrelenmiş verileri ayarla
        this.applyDersTypeFilter();
        
        console.log('Öğrenci geçmiş kayıtları yüklendi:', this.originalHistoricalAttendance.length, 'kayıt');
      } else {
        this.originalHistoricalAttendance = [];
        this.originalGroupedAttendanceByDate = [];
        this.historicalAttendance = [];
        this.groupedAttendanceByDate = [];
      }
    } catch (error: any) {
      console.error('Geçmiş devamsızlık verileri yüklenirken hata:', error);
      this.historicalAttendance = [];
      this.groupedAttendanceByDate = [];
    }
  }

  loadHistoricalAttendance() {
    this.loadStudentHistoricalAttendance();
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
        // Orijinal verileri sakla
        this.originalHistoricalAttendance = response.data.kayitlar || [];
        this.originalGroupedAttendanceByDate = response.data.tarihlere_gore || [];
        
        // Filtrelenmiş verileri ayarla
        this.applyDersTypeFilter();
        
        if (this.groupedAttendanceByDate.length === 0) {
          this.toastr.info('Seçilen tarih aralığında kayıt bulunamadı', 'Bilgi');
        } else {
          this.toastr.success(`${this.groupedAttendanceByDate.length} günlük kayıt yüklendi`, 'Başarılı');
        }
      } else {
        this.originalHistoricalAttendance = [];
        this.originalGroupedAttendanceByDate = [];
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
        // Orijinal verileri sakla
        this.originalHistoricalAttendance = response.data.kayitlar || [];
        this.originalGroupedAttendanceByDate = response.data.tarihlere_gore || [];
        
        // Filtrelenmiş verileri ayarla
        this.applyDersTypeFilter();

        // Tarih inputlarını temizle
        this.startDate = '';
        this.endDate = '';

        this.toastr.success('Tüm devamsızlık kayıtları yüklendi', 'Başarılı');
      } else {
        this.originalHistoricalAttendance = [];
        this.originalGroupedAttendanceByDate = [];
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
      // Veri yoksa sıfır değerlerle dolu obje döndür
      return {
        id: this.currentUser?.id || 0,
        name: this.currentUser?.name || 'Öğrenci',
        totalRecords: 0,
        present: {
          total: 0,
          normal: 0,
          ek_ders: 0,
          etut_dersi: 0
        },
        absent: {
          total: 0,
          normal: 0,
          ek_ders: 0,
          etut_dersi: 0
        },
        attendancePercentage: 0
      };
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

  // Ders tipi filtreleme
  applyDersTypeFilter() {
    if (this.selectedDersType === 'all') {
      // Tüm ders tiplerini göster
      this.historicalAttendance = [...this.originalHistoricalAttendance];
      this.groupedAttendanceByDate = [...this.originalGroupedAttendanceByDate];
    } else {
      // Seçilen ders tipine göre filtrele
      this.historicalAttendance = this.originalHistoricalAttendance.filter(record => {
        const dersType = record.ders_tipi || 'normal';
        return dersType === this.selectedDersType;
      });

      // Tarihlere göre gruplanan verileri yeniden oluştur
      this.regenerateGroupedByDate();
    }
  }

  // Tarihlere göre gruplama işlemini yeniden yap
  regenerateGroupedByDate() {
    const groupedByDate: any = {};
    
    this.historicalAttendance.forEach(record => {
      const date = record.tarih;
      if (!groupedByDate[date]) {
        groupedByDate[date] = {
          tarih: date,
          gun_adi: this.getDayName(date),
          katilan_sayisi: 0,
          katilmayan_sayisi: 0,
          ogrenciler: []
        };
      }

      groupedByDate[date].ogrenciler.push(record);

      if (record.durum === 'present') {
        groupedByDate[date].katilan_sayisi++;
      } else {
        groupedByDate[date].katilmayan_sayisi++;
      }
    });

    this.groupedAttendanceByDate = Object.values(groupedByDate);
  }

  // Ders tipi filtreleme fonksiyonları
  filterByDersType(dersType: string) {
    this.selectedDersType = dersType;
    this.applyDersTypeFilter();
    
    const typeNames: any = {
      'all': 'Tüm Dersler',
      'normal': 'Normal Dersler',
      'ek_ders': 'Ek Dersler',
      'etut_dersi': 'Etüt Dersleri'
    };
    
    this.toastr.info(`${typeNames[dersType]} gösteriliyor`, 'Filtre');
  }

  // Hızlı filtreleme butonları
  showAllLessons() {
    this.filterByDersType('all');
  }

  showNormalLessons() {
    this.filterByDersType('normal');
  }

  showEkDersLessons() {
    this.filterByDersType('ek_ders');
  }

  showEtutLessons() {
    this.filterByDersType('etut_dersi');
  }

  // Ders tipi görüntüleme
  getDersTypeDisplayName(dersType: string): string {
    const typeNames: any = {
      'normal': 'Normal Ders',
      'ek_ders': 'Ek Ders',
      'etut_dersi': 'Etüt Dersi'
    };
    
    return typeNames[dersType] || 'Normal Ders';
  }

  // Ders tipi badge class
  getDersTypeBadgeClass(dersType: string): string {
    const typeClasses: any = {
      'normal': 'badge-primary',
      'ek_ders': 'badge-success',
      'etut_dersi': 'badge-warning'
    };
    
    return typeClasses[dersType] || 'badge-primary';
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

  private initializeAttendanceRecords() {
    this.attendanceRecords.clear();
    this.groupStudents.forEach((student) => {
      this.attendanceRecords.set(student.id, {
        student_id: student.id,
        status: 'pending',
        timestamp: new Date(),
        method: 'manual',
      });
    });
  }

  // QR Scanner methods (disabled for student view but keeping for compatibility)
  toggleQRScanner() {
    this.toastr.info('QR kod tarayıcı öğrenci sayfasında kullanılamaz', 'Bilgi');
  }

  private async startQRScanner() {
    // Disabled for students
  }

  private stopQRScanner() {
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }

    if (this.qrScanInterval) {
      clearInterval(this.qrScanInterval);
      this.qrScanInterval = null;
    }

    this.isQRScannerActive = false;
  }

  // Disabled attendance marking methods for students
  markAttendance(studentId: number, status: 'present' | 'absent', method: 'manual' | 'qr' = 'manual') {
    this.toastr.warning('Öğrenci olarak devamsızlık işaretleyemezsiniz', 'Uyarı');
  }

  markAllPresent() {
    this.toastr.warning('Öğrenci olarak devamsızlık işaretleyemezsiniz', 'Uyarı');
  }

  markAllAbsent() {
    this.toastr.warning('Öğrenci olarak devamsızlık işaretleyemezsiniz', 'Uyarı');
  }

  saveAttendance() {
    this.toastr.warning('Öğrenci olarak devamsızlık kaydedemezsiniz', 'Uyarı');
  }

  // Dummy methods for compatibility
  getAttendanceStatus(studentId: number): string {
    return 'pending';
  }

  getAttendanceStatusText(studentId: number): string {
    return 'Bekliyor';
  }

  getAttendanceTime(studentId: number): Date | null {
    return null;
  }

  setTodayDate() {
    this.selectedDate = new Date().toISOString().split('T')[0];
  }

  // Processed lessons methods (view only for students)
  toggleProcessedLessonsView() {
    this.viewProcessedLessons = !this.viewProcessedLessons;
    if (this.viewProcessedLessons) {
      this.loadProcessedLessons();
    }
  }

  async loadProcessedLessons() {
    if (!this.currentUser || !this.currentUser.id) return;

    try {
      const response = await this.http.get<any>(`./server/api/devamsizlik_kayitlari.php`, {
        headers: this.getAuthHeaders(),
        params: {
          ogrenci_id: this.currentUser.id.toString(),
          ders_tipi: 'normal'
        }
      }).toPromise();

      if (response && response.success && response.data) {
        this.processedLessons = response.data.kayitlar || [];
        this.processedLessonsGroupedByDate = response.data.tarihlere_gore || [];
      }
    } catch (error: any) {
      console.error('İşlenen dersler yüklenirken hata:', error);
    }
  }

  // Student can only view their own data - no etüt creation
  openEtutDersiModal() {
    this.toastr.info('Öğrenci olarak etüt dersi oluşturamazsınız', 'Bilgi');
  }
}
