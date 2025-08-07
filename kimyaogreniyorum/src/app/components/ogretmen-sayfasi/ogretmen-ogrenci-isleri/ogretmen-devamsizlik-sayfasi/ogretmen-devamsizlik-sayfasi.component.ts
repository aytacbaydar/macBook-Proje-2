import {
  Component,
  OnInit,
  ViewChild,
  ElementRef,
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
  ucret?: string; // Öğrencinin ücreti (opsiyonel)
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

@Component({
  selector: 'app-ogretmen-devamsizlik-sayfasi',
  standalone: false,
  templateUrl: './ogretmen-devamsizlik-sayfasi.component.html',
  styleUrl: './ogretmen-devamsizlik-sayfasi.component.scss',
})
export class OgretmenDevamsizlikSayfasiComponent implements OnInit, OnDestroy {
  @ViewChild('videoElement') videoElement!: ElementRef<HTMLVideoElement>;
  @ViewChild('canvasElement') canvasElement!: ElementRef<HTMLCanvasElement>;

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
  viewHistoricalData: boolean = false;
  viewProcessedLessons: boolean = false;
  startDate: string = '';
  endDate: string = '';
  isQRScannerActive: boolean = false;
  isLoading: boolean = false;
  hasChanges: boolean = false;
  isGroupFromUrl: boolean = false;

  // İşlenen dersler için değişkenler
  processedLessons: any[] = [];
  processedLessonsGroupedByDate: any[] = [];

  // Etüt Dersi için değişkenler
  etutAttendanceRecords: Map<number, AttendanceRecord> = new Map();
  etutDersiTarih: string = new Date().toISOString().split('T')[0];
  etutDersiSaat: string = '19:00';
  hasEtutChanges: boolean = false;
  isEtutSaving: boolean = false;

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
    // URL parametresinden grup bilgisini al
    this.route.params.subscribe((params) => {
      if (params['grupAdi']) {
        this.selectedGroup = decodeURIComponent(params['grupAdi']);
        this.isGroupFromUrl = true;
        console.log('URL\'den grup parametresi alındı:', this.selectedGroup);
      } else {
        this.isGroupFromUrl = false;
      }
    });

    this.loadGroups();
    this.setTodayDate();
    
    // Eğer URL'den grup gelmiyorsa localStorage'dan state'i restore et
    if (!this.isGroupFromUrl) {
      this.restoreLastState();
    }
  }

  ngOnDestroy() {
    this.stopQRScanner();
  }

  private getAuthHeaders() {
    // localStorage veya sessionStorage'dan user objesini al
    const userStr = localStorage.getItem('user') || sessionStorage.getItem('user');
    let token = '';

    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        token = user.token || '';
      } catch (error) {
        console.error('Devamsızlık - User parse hatası:', error);
      }
    } else {
      console.error('Devamsızlık - User data bulunamadı!');
    }

    return new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
  }

  loadGroups() {
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

            // Sadece öğrencileri filtrele (admin ve öğretmenleri hariç tut)
            const actualStudents = response.data.filter(
              (student: any) =>
                student.rutbe === 'ogrenci' &&
                student.ogretmeni === loggedInTeacherName
            );

            // Öğrencileri gruplara ayır
            const groupMap = new Map<string, Student[]>();

            actualStudents.forEach((student: Student) => {
              const groupName = student.grubu || 'Grup Atanmamış';
              if (!groupMap.has(groupName)) {
                groupMap.set(groupName, []);
              }
              groupMap.get(groupName)?.push(student);
            });

            // Grup objelerini oluştur
            this.groups = Array.from(groupMap.entries()).map(
              ([name, students]) => ({
                name,
                students,
                color: this.getGroupColor(name),
              })
            );

            // Eğer URL'den grup parametresi geldiyse otomatik seç
            if (this.selectedGroup && this.isGroupFromUrl) {
              // URL'den gelen grup adının geçerli olup olmadığını kontrol et
              const groupExists = this.groups.some(group => group.name === this.selectedGroup);
              if (groupExists) {
                console.log('URL\'den gelen grup bulundu ve seçildi:', this.selectedGroup);
                this.onGroupChange();
              } else {
                console.error('URL\'den gelen grup bulunamadı:', this.selectedGroup);
                this.toastr.error(`"${this.selectedGroup}" adlı grup bulunamadı`, 'Hata');
                this.selectedGroup = '';
                this.isGroupFromUrl = false;
              }
            } else if (this.selectedGroup && !this.isGroupFromUrl) {
              // localStorage'dan gelen grup seçimi
              this.onGroupChange();
            }
          }
          this.isLoading = false;
        },
        error: (error) => {
          console.error('Gruplar yüklenirken hata:', error);
          this.toastr.error('Gruplar yüklenemedi', 'Hata');
          this.isLoading = false;
        },
      });
  }

  private getLoggedInUser(): any {
    const userStr =
      localStorage.getItem('user') || sessionStorage.getItem('user');
    if (userStr) {
      return JSON.parse(userStr);
    }
    return null;
  }

  onGroupChange() {
    if (this.selectedGroup) {
      const selectedGroupData = this.groups.find(
        (g) => g.name === this.selectedGroup
      );
      this.groupStudents = selectedGroupData ? selectedGroupData.students : [];
      this.initializeAttendanceRecords();
      this.loadAttendanceData();
      this.loadPastWeekAttendance();
      this.loadHistoricalAttendance();
      this.loadProcessedLessons();
      this.saveLastState(); // Save the state on group change
    } else {
      this.groupStudents = [];
      this.attendanceRecords.clear();
      this.pastWeekAttendance = [];
      this.historicalAttendance = [];
      this.groupedAttendanceByDate = [];
    }
    this.hasChanges = false;
  }

  onDateChange() {
    if (this.selectedGroup && this.selectedDate) {

      // Önce değişiklikleri sıfırla
      this.hasChanges = false;

      // Kayıtları başlat
      this.initializeAttendanceRecords();

      // Mevcut verileri yükle
      this.loadAttendanceData();
      this.saveLastState(); // Save the state on date change
    }
  }

  loadHistoricalAttendance() {
    if (!this.selectedGroup) return;

    this.http
      .get<any>(`./server/api/devamsizlik_kayitlari.php`, {
        headers: this.getAuthHeaders(),
        params: {
          grup: this.selectedGroup,
        },
      })
      .subscribe({
        next: (response) => {
          if (response.success && response.data) {
            // Sadece seçilen gruba ait kayıtları filtrele
            this.historicalAttendance = (response.data.kayitlar || []).filter((record: any) => 
              record.grup === this.selectedGroup
            );

            // Tarihlere göre gruplanan verileri al
            const allGroupedByDate = response.data.tarihlere_gore || [];

            // Sadece seçilen gruba ait tarihleri filtrele ve grup bazında sayıları yeniden hesapla
            this.groupedAttendanceByDate = [];

            // Tarihlere göre grupla ama sadece seçilen grup için
            const groupedByDate: { [key: string]: any } = {};

            this.historicalAttendance.forEach(record => {
              if (record.grup !== this.selectedGroup) return; // Sadece seçilen grup

              const date = record.tarih;
              if (!groupedByDate[date]) {
                groupedByDate[date] = {
                  tarih: date,
                  katilan_sayisi: 0,
                  katilmayan_sayisi: 0,
                  katilanlar: [],
                  katilmayanlar: []
                };
              }

              // Sadece normal ders kayıtlarını say
              if (!record.ders_tipi || record.ders_tipi === 'normal') {
                if (record.durum === 'present') {
                  groupedByDate[date].katilan_sayisi++;
                } else if (record.durum === 'absent') {
                  groupedByDate[date].katilmayan_sayisi++;
                }
              }
            });

            // Gerçek katılım olan günleri filtrele
            this.groupedAttendanceByDate = Object.values(groupedByDate).filter((dateGroup: any) => {
              const hasRealAttendance = dateGroup.katilan_sayisi > 0 || dateGroup.katilmayan_sayisi > 0;
              return hasRealAttendance;
            }).sort((a: any, b: any) => new Date(b.tarih).getTime() - new Date(a.tarih).getTime());
          } else {
            this.historicalAttendance = [];
            this.groupedAttendanceByDate = [];
          }
        },
        error: (error) => {
          console.error('Geçmiş devamsızlık verileri yüklenirken hata:', error);
          this.historicalAttendance = [];
          this.groupedAttendanceByDate = [];
        },
      });
  }

  loadHistoricalAttendanceByDateRange() {
    if (!this.selectedGroup || !this.startDate || !this.endDate) {
      console.warn('Eksik parametreler:', {
        selectedGroup: this.selectedGroup,
        startDate: this.startDate,
        endDate: this.endDate
      });
      return;
    }

    this.http
      .get<any>(`./server/api/devamsizlik_kayitlari.php`, {
        headers: this.getAuthHeaders(),
        params: {
          grup: this.selectedGroup,
          baslangic_tarih: this.startDate,
          bitis_tarih: this.endDate,
        },
      })
      .subscribe({
        next: (response) => {
          if (response.success && response.data) {
            // Sadece seçilen gruba ait kayıtları filtrele
            this.historicalAttendance = (response.data.kayitlar || []).filter((record: any) => 
              record.grup === this.selectedGroup
            );

            // Tarihlere göre gruplanan verileri al
            const allGroupedByDate = response.data.tarihlere_gore || [];

            // Sadece seçilen gruba ait tarihleri filtrele ve grup bazında sayıları yeniden hesapla
            this.groupedAttendanceByDate = [];

            // Tarihlere göre grupla ama sadece seçilen grup için
            const groupedByDate: { [key: string]: any } = {};

            this.historicalAttendance.forEach(record => {
              if (record.grup !== this.selectedGroup) return; // Sadece seçilen grup

              const date = record.tarih;
              if (!groupedByDate[date]) {
                groupedByDate[date] = {
                  tarih: date,
                  katilan_sayisi: 0,
                  katilmayan_sayisi: 0,
                  katilanlar: [],
                  katilmayanlar: []
                };
              }

              // Sadece normal ders kayıtlarını say
              if (!record.ders_tipi || record.ders_tipi === 'normal') {
                if (record.durum === 'present') {
                  groupedByDate[date].katilan_sayisi++;
                } else if (record.durum === 'absent') {
                  groupedByDate[date].katilmayan_sayisi++;
                }
              }
            });

            // Gerçek katılım olan günleri filtrele
            this.groupedAttendanceByDate = Object.values(groupedByDate).filter((dateGroup: any) => {
              const hasRealAttendance = dateGroup.katilan_sayisi > 0 || dateGroup.katilmayan_sayisi > 0;
              return hasRealAttendance;
            }).sort((a: any, b: any) => new Date(b.tarih).getTime() - new Date(a.tarih).getTime());

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
          console.error(
            'Tarih aralığına göre devamsızlık verileri yüklenirken hata:',
            error
          );
          this.historicalAttendance = [];
          this.groupedAttendanceByDate = [];
          this.toastr.error('Veriler yüklenirken hata oluştu', 'Hata');
        },
      });
  }

  toggleHistoricalView() {
    this.viewHistoricalData = !this.viewHistoricalData;
    if (this.viewHistoricalData) {
      this.loadHistoricalAttendance();
    }
  }

  getDayName(date: string): string {
    const days = [
      'Pazar',
      'Pazartesi',
      'Salı',
      'Çarşamba',
      'Perşembe',
      'Cuma',
      'Cumartesi',
    ];
    const day = new Date(date).getDay();
    return days[day];
  }

  //  formatDate(date: string): string {
  //    return new Date(date).toLocaleDateString('tr-TR');
  //  }

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
  loadAllAttendanceRecords() {
    if (!this.selectedGroup) return;

    this.http
      .get<any>(`./server/api/devamsizlik_kayitlari.php`, {
        headers: this.getAuthHeaders(),
        params: {
          grup: this.selectedGroup,
          butun_kayitlar: 'true'
        },
      })
      .subscribe({
        next: (response) => {
          if (response.success && response.data) {
            // Sadece seçilen gruba ait kayıtları filtrele
            this.historicalAttendance = (response.data.kayitlar || []).filter((record: any) => 
              record.grup === this.selectedGroup
            );

            // Tarihlere göre gruplanan verileri al ve filtrele
            const allGroupedByDate = response.data.tarihlere_gore || [];
            this.groupedAttendanceByDate = allGroupedByDate.filter((dateGroup: any) => {
              // O tarihteki kayıtları kontrol et - sadece seçilen gruba ait olanlar
              const dateRecords = this.historicalAttendance.filter(record => 
                record.tarih === dateGroup.tarih && record.grup === this.selectedGroup
              );
              return dateRecords.length > 0;
            });

            // Tarih inputlarını temizle
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

  // Aylık özet istatistikleri - sadece normal dersler
  getTotalPresentInPeriod(): number {
    if (!this.groupedAttendanceByDate || this.groupedAttendanceByDate.length === 0) {
      return 0;
    }

    let totalPresent = 0;

    this.groupedAttendanceByDate.forEach(dateGroup => {
      // O tarihteki kayıtları kontrol et
      const dateRecords = this.historicalAttendance.filter(record => 
        record.tarih === dateGroup.tarih
      );

      // Sadece normal ders kayıtlarında present olanları say
      const normalPresentCount = dateRecords.filter(record => 
        (!record.ders_tipi || record.ders_tipi === 'normal') && record.durum === 'present'
      ).length;

      totalPresent += normalPresentCount;
    });

    return totalPresent;
  }

  getTotalAbsentInPeriod(): number {
    if (!this.groupedAttendanceByDate || this.groupedAttendanceByDate.length === 0) {
      return 0;
    }

    let totalAbsent = 0;

    this.groupedAttendanceByDate.forEach(dateGroup => {
      // O tarihteki kayıtları kontrol et
      const dateRecords = this.historicalAttendance.filter(record => 
        record.tarih === dateGroup.tarih
      );

      // Sadece normal ders kayıtlarında absent olanları say
      const normalAbsentCount = dateRecords.filter(record => 
        (!record.ders_tipi || record.ders_tipi === 'normal') && record.durum === 'absent'
      ).length;

      totalAbsent += normalAbsentCount;
    });

    return totalAbsent;
  }

  getAttendancePercentage(): number {
    const totalPresent = this.getTotalPresentInPeriod();
    const totalAbsent = this.getTotalAbsentInPeriod();
    const total = totalPresent + totalAbsent;

    if (total === 0) return 0;
    return Math.round((totalPresent / total) * 100);
  }

  getAverageAttendanceRate(): number {
    if (this.groupedAttendanceByDate.length === 0) return 0;

    const totalPresent = this.getTotalPresentInPeriod();
    const totalAbsent = this.getTotalAbsentInPeriod();
    const total = totalPresent + totalAbsent;

    return total > 0 ? Math.round((totalPresent / total) * 100) : 0;
  }

  // Toplam ders sayısını getir (tarihlere göre) - sadece normal dersler
  getTotalLessonsCount(): number {
    if (!this.groupedAttendanceByDate || this.groupedAttendanceByDate.length === 0) {
      return 0;
    }

    // Normal derslerin olduğu tarihleri say
    let normalLessonsCount = 0;

    this.groupedAttendanceByDate.forEach(dateGroup => {
      // O tarihteki kayıtları kontrol et
      const dateRecords = this.historicalAttendance.filter(record => 
        record.tarih === dateGroup.tarih
      );

      // Normal ders kayıtları var mı kontrol et
      const hasNormalLessons = dateRecords.some(record => 
        !record.ders_tipi || record.ders_tipi === 'normal'
      );

      if (hasNormalLessons) {
        normalLessonsCount++;
      }
    });

    return normalLessonsCount;
  }

  // Toplam katılım sayısını getir
  getTotalAttendanceCount(): number {
    return this.getTotalPresentInPeriod();
  }

  // Toplam devamsızlık sayısını getir
  getTotalAbsenceCount(): number {
    return this.getTotalAbsentInPeriod();
  }

  // Genel katılım yüzdesini getir
  getOverallAttendancePercentage(): number {
    return this.getAttendancePercentage();
  }

  // Detaylı devamsızlık analizi - öğrenci bazında ders tiplerini ayır
  getStudentAttendanceAnalysis(): any[] {
    if (!this.selectedGroup || this.groupStudents.length === 0) {
      return [];
    }

    return this.groupStudents.map(student => {
      // Bu öğrencinin tüm devamsızlık kayıtlarını al
      const studentRecords = this.historicalAttendance.filter(
        record => record.ogrenci_id === student.id
      );



      // Present kayıtları
      const presentRecords = studentRecords.filter(record => record.durum === 'present');
      const presentNormal = presentRecords.filter(record => !record.ders_tipi || record.ders_tipi === 'normal').length;
      const presentEkDers = presentRecords.filter(record => record.ders_tipi === 'ek_ders').length;
      const presentEtutDersi = presentRecords.filter(record => record.ders_tipi === 'etut_dersi').length;
      const totalPresent = presentRecords.length;

      // Absent kayıtları
      const absentRecords = studentRecords.filter(record => record.durum === 'absent');
      const absentNormal = absentRecords.filter(record => !record.ders_tipi || record.ders_tipi === 'normal').length;
      const absentEkDers = absentRecords.filter(record => record.ders_tipi === 'ek_ders').length;
      const absentEtutDersi = absentRecords.filter(record => record.ders_tipi === 'etut_dersi').length;
      const totalAbsent = absentRecords.length;

      // Toplam
      const totalRecords = studentRecords.length;
      const attendancePercentage = totalRecords > 0 ? Math.round((totalPresent / totalRecords) * 100) : 0;



      return {
        id: student.id,
        name: student.adi_soyadi,
        email: student.email,
        avatar: student.avatar,
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
    }).sort((a, b) => b.attendancePercentage - a.attendancePercentage);
  }

  // Öğrenci bazında katılım istatistiklerini getir
  getStudentAttendanceStats(): any[] {
    if (!this.selectedGroup || this.groupStudents.length === 0) {
      return [];
    }

    return this.groupStudents.map(student => {
      // Bu öğrencinin devamsizlik_kayitlari tablosundaki toplam kayıt sayısını al
      const studentRecords = this.historicalAttendance.filter(
        record => record.ogrenci_id === student.id
      );

      // Toplam kayıt sayısı (normal + ek ders = toplam)
      const totalRecordsCount = studentRecords.length;

      // Katıldığı dersleri say (sadece normal ders ve ek ders)
      const presentCount = studentRecords.filter(
        record => record.durum === 'present' && 
        (!record.ders_tipi || record.ders_tipi === 'normal' || record.ders_tipi === 'ek_ders')
      ).length;

      // Katılmadığı dersleri say
      const absentCount = studentRecords.filter(
        record => record.durum === 'absent'
      ).length;

      // Toplam ders sayısı
      const totalLessons = presentCount + absentCount;

      // Katılım yüzdesi
      const attendancePercentage = totalLessons > 0 
        ? Math.round((presentCount / totalLessons) * 100) 
        : 0;

      // Ödeme hesaplamaları
      const ucret = parseFloat(student.ucret || '0');
      const expectedPaymentCycles = Math.floor(presentCount / 4);
      const expectedTotalAmount = expectedPaymentCycles * ucret;
      const lessonsUntilNextPayment = presentCount > 0 ? 4 - (presentCount % 4) : 4;

      return {
        id: student.id,
        name: student.adi_soyadi,
        email: student.email,
        avatar: student.avatar,
        ucret: ucret,
        presentCount: presentCount, // Sadece 'present' durumundaki kayıtlar
        absentCount: absentCount,   // Sadece 'absent' durumundaki kayıtlar
        totalLessons: totalLessons,
        attendancePercentage: attendancePercentage,
        expectedPaymentCycles: expectedPaymentCycles,
        expectedTotalAmount: expectedTotalAmount,
        lessonsUntilNextPayment: lessonsUntilNextPayment === 4 ? 0 : lessonsUntilNextPayment
      };
    }).sort((a, b) => b.attendancePercentage - a.attendancePercentage); // Katılım oranına göre sırala
  }

  // Detaylı öğrenci istatistiklerini getir
  selectedStudentStats: any = null;
  showStudentStatsModal = false;
  selectedStudentId: number | null = null;

  async loadStudentDetailedStats(studentId: number) {
    if (!this.selectedGroup) {
      this.toastr.error('Lütfen önce bir grup seçiniz', 'Hata');
      return;
    }


    this.isLoading = true;

    try {
      const response = await this.http.get<any>(`./server/api/ogrenci_detay_istatistik.php`, {
        headers: this.getAuthHeaders(),
        params: {
          grup: this.selectedGroup,
          ogrenci_id: studentId.toString()
        },
        responseType: 'json'
      }).toPromise();


      if (response && response.success) {
        this.selectedStudentStats = response.data;
        this.showStudentStatsModal = true;
      } else {
        this.toastr.error(response?.message || 'Öğrenci istatistikleri yüklenemedi', 'Hata');
      }
    } catch (error: any) {
      console.error('Öğrenci istatistikleri yüklenirken hata:', error);

      // HTML response kontrolü
      if (error.error && typeof error.error.text === 'string' && error.error.text.includes('<!doctype html>')) {
        console.error('Server HTML döndürdü, muhtemelen PHP hatası var');
        this.toastr.error('Server hatası: API PHP hatası döndürüyor', 'Hata');
      } else if (error.status === 200 && error.error?.error) {
        this.toastr.error('JSON parse hatası: ' + error.error.error.message, 'Hata');
      } else {
        this.toastr.error('İstatistikler yüklenirken hata oluştu', 'Hata');
      }
    } finally {
      this.isLoading = false;
    }
  }

  closeStudentStatsModal() {
    this.showStudentStatsModal = false;
    this.selectedStudentStats = null;
  }

  // Öğrenci seçildiğinde detayları göster
  selectStudent(student: any): void {
    this.selectedStudentId = student.id;
    this.loadStudentDetailedStats(student.id);
  }

  // Debug: Öğrenci kayıtlarını detaylı analiz et
  debugStudentRecords(studentId?: number): void {
    if (!this.selectedGroup) {
      return;
    }

    // Eğer studentId verilmemişse, tüm öğrencileri analiz et
    const targetStudents = studentId ? 
      [this.groupStudents.find(s => s.id === studentId)] : 
      this.groupStudents;

    targetStudents.forEach(student => {
      if (!student) return;

      // Bu öğrencinin tüm kayıtlarını filtrele
      const studentRecords = this.historicalAttendance.filter(
        record => record.ogrenci_id === student.id
      );



      // Kayıtları ders tipine göre grupla
      const normalRecords = studentRecords.filter(r => !r.ders_tipi || r.ders_tipi === 'normal');
      const ekDersRecords = studentRecords.filter(r => r.ders_tipi === 'ek_ders');


      // Durum bazında analiz
      const presentRecords = studentRecords.filter(r => r.durum === 'present');
      const absentRecords = studentRecords.filter(r => r.durum === 'absent');


      // Ders tipi bazında durum analizi
      const normalPresent = studentRecords.filter(r => (!r.ders_tipi || r.ders_tipi === 'normal') && r.durum === 'present');
      const ekDersPresent = studentRecords.filter(r => r.ders_tipi === 'ek_ders' && r.durum === 'present');
      const normalAbsent = studentRecords.filter(r => (!r.ders_tipi || r.ders_tipi === 'normal') && r.durum === 'absent');
      const ekDersAbsent = studentRecords.filter(r => r.ders_tipi === 'ek_ders' && r.durum === 'absent');

    });
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: 'TRY'
    }).format(amount);
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('tr-TR');
  }

  getTimeFromDate(dateString: string): string {
    return new Date(dateString).toLocaleTimeString('tr-TR', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  }

  toggleLessonDetails(index: number): void {
    if (this.processedLessons[index]) {
      this.processedLessons[index].showDetails = !this.processedLessons[index].showDetails;
    }
  }

  getAttendanceCountByLesson(lesson: any, status: string): number {
    if (!lesson || !lesson.ogrenci_listesi) return 0;
    return lesson.ogrenci_listesi.filter((student: any) => student.durum === status).length;
  }

  getStudentsByLesson(lesson: any): any[] {
    return lesson.ogrenci_listesi || [];
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

  loadAttendanceData() {
    if (!this.selectedGroup || !this.selectedDate) return;

    this.isLoading = true;

    this.http
      .get<any>(
        `./server/api/devamsizlik_kayitlari.php?group=${encodeURIComponent(
          this.selectedGroup
        )}&tarih=${this.selectedDate}`,
        {
          headers: this.getAuthHeaders(),
          params: {
            grup: this.selectedGroup,
            tarih: this.selectedDate,
          },
        }
      )
      .subscribe({
        next: (response) => {
          console.log('API yanıtı tam yapısı:', response);

          if (response.success) {
            // Veri yapısını kontrol et
            let attendanceData = [];

            if (response.data && Array.isArray(response.data)) {
              attendanceData = response.data;
            } else if (response.kayitlar && Array.isArray(response.kayitlar)) {
              attendanceData = response.kayitlar;
            } else if (Array.isArray(response.data)) {
              attendanceData = response.data;
            }


            // Mevcut kayıtları güncelle
            if (attendanceData && attendanceData.length > 0) {
              attendanceData.forEach((record: any) => {
                if (this.attendanceRecords.has(record.ogrenci_id)) {
                  this.attendanceRecords.set(record.ogrenci_id, {
                    student_id: record.ogrenci_id,
                    status: record.durum,
                    timestamp: new Date(record.zaman),
                    method: record.yontem,
                  });
                }
              });

            } else {
            }

            // Veri yüklendikten sonra hasChanges'i false yap
            this.hasChanges = false;
          } else {
            console.log(`${this.selectedDate} tarihinde mevcut yoklama kaydı yok veya hata:`, response.message || 'Bilinmeyen hata');
            // Veri yoksa da hasChanges false olmalı
            this.hasChanges = false;
          }
          this.isLoading = false;
        },
        error: (error) => {
          console.error('Devamsızlık verileri yüklenirken hata:', error);
          this.hasChanges = false;
          this.isLoading = false;
        },
      });
  }

  toggleQRScanner() {
    if (this.isQRScannerActive) {
      this.stopQRScanner();
    } else {
      this.startQRScanner();
    }
  }

  private async startQRScanner() {
    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });

      this.isQRScannerActive = true;

      // Wait for view to update
      setTimeout(() => {
        if (this.videoElement) {
          this.videoElement.nativeElement.srcObject = this.mediaStream;
          this.videoElement.nativeElement.play();
          this.startQRCodeDetection();
        }
      }, 100);
    } catch (error) {
      console.error('Kamera erişim hatası:', error);
      this.toastr.error('Kameraya erişim sağlanamadı', 'Hata');
    }
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

  private startQRCodeDetection() {
    // Simple QR code detection simulation
    // In a real implementation, you would use a library like jsQR
    this.qrScanInterval = setInterval(() => {
      this.detectQRCode();
    }, 1000);
  }

  private detectQRCode() {
    if (!this.videoElement || !this.canvasElement) return;

    const video = this.videoElement.nativeElement;
    const canvas = this.canvasElement.nativeElement;
    const context = canvas.getContext('2d');

    if (!context || video.readyState !== video.HAVE_ENOUGH_DATA) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Simulate QR code detection
    // In real implementation, use jsQR library here
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);

    // Mock QR code data - in real app this would come from jsQR
    const mockQRData = this.generateMockQRData();
    if (mockQRData) {
      this.processQRCode(mockQRData);
    }
  }

  private generateMockQRData(): string | null {
    // This is a mock function for demonstration
    // In real implementation, this would be replaced with actual QR detection
    if (Math.random() < 0.1) {
      // 10% chance to simulate QR detection
      const randomStudent =
        this.groupStudents[
          Math.floor(Math.random() * this.groupStudents.length)
        ];
      return `student_${randomStudent.id}`;
    }
    return null;
  }

  private processQRCode(qrData: string) {
    // Parse QR code data
    const match = qrData.match(/student_(\d+)/);
    if (match) {
      const studentId = parseInt(match[1]);
      const student = this.groupStudents.find((s) => s.id === studentId);

      if (student) {        this.markAttendance(studentId, 'present', 'qr');
        this.toastr.success(
          `${student.adi_soyadi} QR kod ile katıldı olarak işaretlendi`,
          'Başarılı'
        );
      } else {
        this.toastr.warning(
          'QR kodundaki öğrenci bu grupta bulunamadı',
          'Uyarı'
        );
      }
    }
  }

  markAttendance(
    studentId: number,
    status: 'present' | 'absent',
    method: 'manual' | 'qr' = 'manual'
  ) {
    if (this.attendanceRecords.has(studentId)) {
      const currentRecord = this.attendanceRecords.get(studentId);

      // Eğer durum gerçekten değişiyorsa hasChanges'i true yap
      if (!currentRecord || currentRecord.status !== status) {
        this.attendanceRecords.set(studentId, {
          student_id: studentId,
          status: status,
          timestamp: new Date(),
          method: method,
        });
        this.hasChanges = true;
      }
    }
  }

  markAllPresent() {
    this.groupStudents.forEach((student) => {
      this.markAttendance(student.id, 'present');
    });
  }

  markAllAbsent() {
    this.groupStudents.forEach((student) => {
      this.markAttendance(student.id, 'absent');
    });
  }

  getAttendanceStatus(studentId: number): string {
    const record = this.attendanceRecords.get(studentId);
    return record ? record.status : 'pending';
  }

  getAttendanceStatusText(studentId: number): string {
    const status = this.getAttendanceStatus(studentId);
    switch (status) {
      case 'present':
        return 'Katıldı';
      case 'absent':
        return 'Katılmadı';
      default:
        return 'Bekliyor';
    }
  }

  getAttendanceTime(studentId: number): Date | null {
    const record = this.attendanceRecords.get(studentId);
    return record && record.status !== 'pending' ? record.timestamp : null;
  }

  saveAttendance() {
    if (!this.selectedGroup || !this.hasChanges) return;

    // Seçilen tarihi kontrol et
    if (!this.selectedDate) {
      this.toastr.error('Lütfen tarih seçiniz', 'Hata');
      return;
    }

    // Eski tarih kontrolü
    const selectedDateObj = new Date(this.selectedDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Bugünün başlangıcına ayarla

    if (selectedDateObj < today) {
      // Geçmiş tarih için onay iste
      const confirmMessage = `Seçilen tarih (${this.formatDate(this.selectedDate)}) geçmiş bir tarih. Geçmiş tarihli yoklama kaydı yapmak istediğinizden emin misiniz?`;

      if (!confirm(confirmMessage)) {
        this.toastr.info('Yoklama kaydı iptal edildi', 'Bilgi');
        return;
      }

      this.toastr.warning('Geçmiş tarihli kayıt yapılıyor...', 'Uyarı');
    }

    // Kayıt edilecek veri var mı kontrol et
    const recordsToSave = Array.from(this.attendanceRecords.values())
      .filter((record) => record.status !== 'pending');

    if (recordsToSave.length === 0) {
      this.toastr.warning('Kaydedilecek devamsızlık kaydı bulunamadı', 'Uyarı');
      return;
    }


    this.isLoading = true;

    const attendanceData = recordsToSave.map((record) => ({
      ogrenci_id: record.student_id,
      grup: this.selectedGroup,
      tarih: this.selectedDate,
      durum: record.status,
      zaman: record.timestamp.toISOString(),
      yontem: record.method,
    }));

    console.log('Kaydedilecek devamsızlık verisi:', {
      grup: this.selectedGroup,
      tarih: this.selectedDate,
      kayit_sayisi: attendanceData.length,
      data: attendanceData
    });

    this.http
      .post<any>(
        './server/api/devamsizlik_kaydet.php',
        {
          records: attendanceData,
        },
        {
          headers: this.getAuthHeaders(),
        }
      )
      .subscribe({
        next: (response) => {
          console.log('Devamsızlık kaydet API yanıtı:', response);

          if (response.success) {
            this.toastr.success(
              `${attendanceData.length} öğrencinin devamsızlık kaydı başarıyla kaydedildi`,
              'Başarılı'
            );
            this.hasChanges = false;

            // Geçmiş verileri yeniden yükle
            this.loadHistoricalAttendance();
            this.saveLastState(); //Save the state after the save
            this.loadAttendanceData();// Load attendance data after save
          } else {
            this.toastr.error(response.message || 'Kayıt sırasında hata oluştu', 'Hata');
          }
          this.isLoading = false;
        },
        error: (error) => {
          console.error('Devamsızlık kaydedilirken hata:', error);
          this.toastr.error('Kayıt sırasında hata oluştu', 'Hata');
          this.isLoading = false;
        },
      });
  }

  loadPastWeekAttendance() {
    if (!this.selectedGroup) return;

    // Geçen haftanın tarihini hesapla
    const pastWeekDate = new Date();
    pastWeekDate.setDate(pastWeekDate.getDate() - 7);
    const formattedPastWeekDate = pastWeekDate.toISOString().split('T')[0];

    this.http
      .get<any>(
        `./server/api/devamsizlik_kayitlari.php?group=${encodeURIComponent(
          this.selectedGroup
        )}&tarih=${formattedPastWeekDate}`,
        {
          headers: this.getAuthHeaders(),
          params: {
            grup: this.selectedGroup,
            tarih: formattedPastWeekDate,
          },
        }
      )
      .subscribe({
        next: (response) => {
          if (response.success && response.data) {
            this.pastWeekAttendance = response.data.map((record: any) => {
              const student = this.groupStudents.find(
                (s) => s.id === record.ogrenci_id
              );
              return {
                ...record,
                student: student,
                adi_soyadi: student?.adi_soyadi || 'Bilinmeyen Öğrenci',
                avatar: student?.avatar,
              };
            });
          } else {
            this.pastWeekAttendance = [];
          }
        },
        error: (error) => {
          console.error(
            'Geçen hafta devamsızlık verileri yüklenirken hata:',
            error
          );
          this.pastWeekAttendance = [];
        },
      });
  }

  getPastWeekDate(): Date {
    const pastWeekDate = new Date();
    pastWeekDate.setDate(pastWeekDate.getDate() - 7);
    return pastWeekDate;
  }

  getPastWeekPresentCount(): number {
    return this.pastWeekAttendance.filter(
      (record) => record.durum === 'present'
    ).length;
  }

  getPastWeekAbsentCount(): number {
    return this.pastWeekAttendance.filter((record) => record.durum === 'absent')
      .length;
  }

  getPastWeekPresentStudents(): any[] {
    return this.pastWeekAttendance.filter(
      (record) => record.durum === 'present'
    );
  }

  getPastWeekAbsentStudents(): any[] {
    return this.pastWeekAttendance.filter(
      (record) => record.durum === 'absent'
    );
  }

  getDefaultAvatar(name: string): string {
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(
      name
    )}&background=4f46e5&color=fff&size=40&font-size=0.6&rounded=true`;
  }

  private getGroupColor(groupName: string): string {
    const colors = [
      '#3B82F6',
      '#EF4444',
      '#10B981',
      '#F59E0B',
      '#8B5CF6',
      '#EC4899',
      '#06B6D4',
      '#84CC16',
    ];
    const index = groupName.length % colors.length;
    return colors[index];
  }

  private saveLastState() {
    // URL'den gelen grup varsa state kaydetme
    if (this.isGroupFromUrl) {
      return;
    }
    
    const state = {
      selectedGroup: this.selectedGroup,
      selectedDate: this.selectedDate,
    };
    localStorage.setItem('attendanceState', JSON.stringify(state));
  }

  private restoreLastState() {
    const storedState = localStorage.getItem('attendanceState');
    if (storedState) {
      const state = JSON.parse(storedState);
      this.selectedGroup = state.selectedGroup;
      this.selectedDate = state.selectedDate;
      if (this.selectedGroup) {
        this.onGroupChange();
      }
      if (this.selectedDate) {
        this.onDateChange();
      }
    }
  }
  setTodayDate() {
    this.selectedDate = new Date().toISOString().split('T')[0];
  }

  navigateToEkDers() {
    if (this.selectedGroup) {
      // Ek ders yoklama sayfasına grup adı ile yönlendir
      this.router.navigate(['/ogretmen-sayfasi/ogretmen-ek-ders-girisi-sayfasi', this.selectedGroup]);
    } else {
      this.toastr.warning('Lütfen önce bir grup seçiniz', 'Uyarı');
    }
  }

  // İşlenen dersleri görünüm değiştirme
  toggleProcessedLessonsView() {
    this.viewProcessedLessons = !this.viewProcessedLessons;
    if (this.viewProcessedLessons) {
      this.loadProcessedLessons();
    }
  }

  // İşlenen dersleri yükle (sadece normal dersler)
  loadProcessedLessons() {
    if (!this.selectedGroup) return;

    const params = new URLSearchParams({
      grup: this.selectedGroup,
      ders_tipi: 'normal'  // Sadece normal dersleri getir
    });

    // Tarih aralığı varsa ekle
    if (this.startDate) {
      params.append('baslangic_tarih', this.startDate);
    }
    if (this.endDate) {
      params.append('bitis_tarih', this.endDate);
    }

    this.http.get<any>(`./server/api/devamsizlik_kayitlari.php?${params.toString()}`, {
      headers: this.getAuthHeaders()
    }).subscribe({
      next: (response) => {
        if (response.success) {
          // Sadece normal ders kayıtlarını filtrele
          this.processedLessons = (response.data.kayitlar || []).filter((record: any) => 
            !record.ders_tipi || record.ders_tipi === 'normal'
          );

          this.processedLessonsGroupedByDate = response.data.tarihlere_gore || [];

          // Tarihlere göre gruplanan verilerde de normal ders filtresi uygula
          this.processedLessonsGroupedByDate = this.processedLessonsGroupedByDate.filter((dateGroup: any) => {
            const dateRecords = this.processedLessons.filter(record => 
              record.tarih === dateGroup.tarih
            );
            return dateRecords.length > 0;
          });

          // Her tarih grubu için katılan ve katılmayan öğrenci detaylarını hazırla
          this.processedLessonsGroupedByDate.forEach(dateGroup => {
            const dateRecords = this.processedLessons.filter(record => 
              record.tarih === dateGroup.tarih
            );

            // Katılan öğrenciler
            const presentStudentIds = dateRecords
              .filter(record => record.durum === 'present')
              .map(record => record.ogrenci_id);

            // Katılmayan öğrenciler  
            const absentStudentIds = dateRecords
              .filter(record => record.durum === 'absent')
              .map(record => record.ogrenci_id);

            // Öğrenci detaylarını bul
            dateGroup.katilanlar = this.groupStudents.filter(student => 
              presentStudentIds.includes(student.id)
            );

            dateGroup.katilmayanlar = this.groupStudents.filter(student => 
              absentStudentIds.includes(student.id)
            );

            // Sayıları güncelle
            dateGroup.katilan_sayisi = dateGroup.katilanlar.length;
            dateGroup.katilmayan_sayisi = dateGroup.katilmayanlar.length;
          });

          console.log('İşlenen dersler yüklendi:', this.processedLessons.length, 'kayıt');
        }
      },
      error: (error) => {
        console.error('İşlenen dersler yüklenirken hata:', error);
        this.toastr.error('İşlenen dersler yüklenemedi', 'Hata');
      }
    });
  }

  // İşlenen dersler için tarih aralığı ile yükleme
  loadProcessedLessonsByDateRange() {
    if (!this.selectedGroup || !this.startDate || !this.endDate) {
      console.warn('İşlenen dersler için eksik parametreler:', {
        selectedGroup: this.selectedGroup,
        startDate: this.startDate,
        endDate: this.endDate
      });
      return;
    }

    const params = new URLSearchParams({
      grup: this.selectedGroup,
      ders_tipi: 'normal',  // Sadece normal dersleri getir
      baslangic_tarih: this.startDate,
      bitis_tarih: this.endDate
    });

    this.http.get<any>(`./server/api/devamsizlik_kayitlari.php?${params.toString()}`, {
      headers: this.getAuthHeaders()
    }).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          // Sadece normal ders kayıtlarını filtrele
          this.processedLessons = (response.data.kayitlar || []).filter((record: any) => 
            !record.ders_tipi || record.ders_tipi === 'normal'
          );

          this.processedLessonsGroupedByDate = response.data.tarihlere_gore || [];

          // Tarihlere göre gruplanan verilerde de normal ders filtresi uygula
          this.processedLessonsGroupedByDate = this.processedLessonsGroupedByDate.filter((dateGroup: any) => {
            const dateRecords = this.processedLessons.filter(record => 
              record.tarih === dateGroup.tarih
            );
            return dateRecords.length > 0;
          });

          // Her tarih grubu için öğrenci detaylarını hazırla
          this.processedLessonsGroupedByDate.forEach(dateGroup => {
            const dateRecords = this.processedLessons.filter(record => 
              record.tarih === dateGroup.tarih
            );

            const presentStudentIds = dateRecords
              .filter(record => record.durum === 'present')
              .map(record => record.ogrenci_id);

            const absentStudentIds = dateRecords
              .filter(record => record.durum === 'absent')
              .map(record => record.ogrenci_id);

            dateGroup.katilanlar = this.groupStudents.filter(student => 
              presentStudentIds.includes(student.id)
            );

            dateGroup.katilmayanlar = this.groupStudents.filter(student => 
              absentStudentIds.includes(student.id)
            );

            dateGroup.katilan_sayisi = dateGroup.katilanlar.length;
            dateGroup.katilmayan_sayisi = dateGroup.katilmayanlar.length;
          });

          if (this.processedLessonsGroupedByDate.length === 0) {
            this.toastr.info('Seçilen tarih aralığında işlenen normal ders bulunamadı', 'Bilgi');
          } else {
            this.toastr.success(`${this.processedLessonsGroupedByDate.length} günlük işlenen ders kaydı yüklendi`, 'Başarılı');
          }
        } else {
          this.processedLessons = [];
          this.processedLessonsGroupedByDate = [];
          this.toastr.warning('Seçilen tarih aralığında işlenen ders bulunamadı', 'Uyarı');
        }
      },
      error: (error) => {
        console.error('İşlenen dersler tarih aralığı yüklenirken hata:', error);
        this.processedLessons = [];
        this.processedLessonsGroupedByDate = [];
        this.toastr.error('İşlenen dersler yüklenirken hata oluştu', 'Hata');
      }
    });
  }

  // İşlenen dersler için tüm kayıtları getir
  loadAllProcessedLessons() {
    if (!this.selectedGroup) return;

    const params = new URLSearchParams({
      grup: this.selectedGroup,
      ders_tipi: 'normal',  // Sadece normal dersleri getir
      butun_kayitlar: 'true'
    });

    this.http.get<any>(`./server/api/devamsizlik_kayitlari.php?${params.toString()}`, {
      headers: this.getAuthHeaders()
    }).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          // Sadece normal ders kayıtlarını filtrele
          this.processedLessons = (response.data.kayitlar || []).filter((record: any) => 
            !record.ders_tipi || record.ders_tipi === 'normal'
          );

          this.processedLessonsGroupedByDate = response.data.tarihlere_gore || [];

          // Tarihlere göre gruplanan verilerde de normal ders filtresi uygula
          this.processedLessonsGroupedByDate = this.processedLessonsGroupedByDate.filter((dateGroup: any) => {
            const dateRecords = this.processedLessons.filter(record => 
              record.tarih === dateGroup.tarih
            );
            return dateRecords.length > 0;
          });

          // Her tarih grubu için öğrenci detaylarını hazırla
          this.processedLessonsGroupedByDate.forEach(dateGroup => {
            const dateRecords = this.processedLessons.filter(record => 
              record.tarih === dateGroup.tarih
            );

            const presentStudentIds = dateRecords
              .filter(record => record.durum === 'present')
              .map(record => record.ogrenci_id);

            const absentStudentIds = dateRecords
              .filter(record => record.durum === 'absent')
              .map(record => record.ogrenci_id);

            dateGroup.katilanlar = this.groupStudents.filter(student => 
              presentStudentIds.includes(student.id)
            );

            dateGroup.katilmayanlar = this.groupStudents.filter(student => 
              absentStudentIds.includes(student.id)
            );

            dateGroup.katilan_sayisi = dateGroup.katilanlar.length;
            dateGroup.katilmayan_sayisi = dateGroup.katilmayanlar.length;
          });

          // Tarih inputlarını temizle
          this.startDate = '';
          this.endDate = '';

          this.toastr.success('Tüm işlenen normal ders kayıtları yüklendi', 'Başarılı');
        } else {
          this.processedLessons = [];
          this.processedLessonsGroupedByDate = [];
          this.toastr.warning('Herhangi bir işlenen ders kaydı bulunamadı', 'Uyarı');
        }
      },
      error: (error) => {
        console.error('Tüm işlenen dersler yüklenirken hata:', error);
        this.processedLessons = [];
        this.processedLessonsGroupedByDate = [];
        this.toastr.error('İşlenen ders kayıtları yüklenirken hata oluştu', 'Hata');
      }
    });
  }

  // İşlenen dersler için hızlı tarih filtreleri
  setProcessedLessonsDateRangeLastWeek() {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - 7);

    this.startDate = startDate.toISOString().split('T')[0];
    this.endDate = endDate.toISOString().split('T')[0];

    this.loadProcessedLessonsByDateRange();
  }

  setProcessedLessonsDateRangeLastMonth() {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - 30);

    this.startDate = startDate.toISOString().split('T')[0];
    this.endDate = endDate.toISOString().split('T')[0];

    this.loadProcessedLessonsByDateRange();
  }

  setProcessedLessonsDateRangeThisMonth() {
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    this.startDate = startDate.toISOString().split('T')[0];
    this.endDate = endDate.toISOString().split('T')[0];

    this.loadProcessedLessonsByDateRange();
  }

  setProcessedLessonsDateRangeThisYear() {
    const now = new Date();
    const startDate = new Date(now.getFullYear(), 0, 1);
    const endDate = new Date(now.getFullYear(), 11, 31);

    this.startDate = startDate.toISOString().split('T')[0];
    this.endDate = endDate.toISOString().split('T')[0];

    this.loadProcessedLessonsByDateRange();
  }

  // Etüt Dersi Modal İşlemleri
  openEtutDersiModal() {
    if (!this.selectedGroup) {
      this.toastr.warning('Lütfen önce bir grup seçiniz', 'Uyarı');
      return;
    }

    // Etüt yoklama kayıtlarını başlat
    this.initializeEtutAttendanceRecords();

    // Bootstrap modal'ını aç
    const modalElement = document.getElementById('etutDersiModal');
    if (modalElement) {
      const modal = new (window as any).bootstrap.Modal(modalElement);
      modal.show();
    }
  }

  private initializeEtutAttendanceRecords() {
    this.etutAttendanceRecords.clear();
    this.groupStudents.forEach((student) => {
      this.etutAttendanceRecords.set(student.id, {
        student_id: student.id,
        status: 'pending',
        timestamp: new Date(),
        method: 'manual',
      });
    });
    this.hasEtutChanges = false;
  }

  markEtutAttendance(studentId: number, status: 'present' | 'absent') {
    if (this.etutAttendanceRecords.has(studentId)) {
      const currentRecord = this.etutAttendanceRecords.get(studentId);

      if (!currentRecord || currentRecord.status !== status) {
        this.etutAttendanceRecords.set(studentId, {
          student_id: studentId,
          status: status,
          timestamp: new Date(),
          method: 'manual',
        });
        this.hasEtutChanges = true;
      }
    }
  }

  markAllEtutPresent() {
    this.groupStudents.forEach((student) => {
      this.markEtutAttendance(student.id, 'present');
    });
  }

  markAllEtutAbsent() {
    this.groupStudents.forEach((student) => {
      this.markEtutAttendance(student.id, 'absent');
    });
  }

  getEtutAttendanceStatus(studentId: number): string {
    const record = this.etutAttendanceRecords.get(studentId);
    return record ? record.status : 'pending';
  }

  getEtutAttendanceStatusText(studentId: number): string {
    const status = this.getEtutAttendanceStatus(studentId);
    switch (status) {
      case 'present':
        return 'Katıldı';
      case 'absent':
        return 'Katılmadı';
      default:
        return 'Bekliyor';
    }
  }

  getEtutAttendanceStatusClass(studentId: number): string {
    const status = this.getEtutAttendanceStatus(studentId);
    switch (status) {
      case 'present':
        return 'badge bg-success';
      case 'absent':
        return 'badge bg-danger';
      default:
        return 'badge bg-secondary';
    }
  }

  getEtutPresentCount(): number {
    return Array.from(this.etutAttendanceRecords.values()).filter(
      (record) => record.status === 'present'
    ).length;
  }

  getEtutAbsentCount(): number {
    return Array.from(this.etutAttendanceRecords.values()).filter(
      (record) => record.status === 'absent'
    ).length;
  }

  saveEtutAttendance() {
    if (!this.selectedGroup || !this.hasEtutChanges) return;

    if (!this.etutDersiTarih) {
      this.toastr.error('Lütfen etüt dersi tarihi seçiniz', 'Hata');
      return;
    }

    // Kayıt edilecek veri var mı kontrol et
    const recordsToSave = Array.from(this.etutAttendanceRecords.values())
      .filter((record) => record.status !== 'pending');

    if (recordsToSave.length === 0) {
      this.toastr.warning('Kaydedilecek etüt dersi kaydı bulunamadı', 'Uyarı');
      return;
    }

    this.isEtutSaving = true;

    // Etüt dersi için özel zaman damgası oluştur
    const etutDateTime = `${this.etutDersiTarih} ${this.etutDersiSaat}:00`;

    const attendanceData = recordsToSave.map((record) => ({
      ogrenci_id: record.student_id,
      grup: this.selectedGroup,
      tarih: this.etutDersiTarih,
      durum: record.status,
      zaman: etutDateTime,
      yontem: record.method,
      ders_tipi: 'etut_dersi'
    }));

    console.log('Kaydedilecek etüt dersi verisi:', {
      grup: this.selectedGroup,
      tarih: this.etutDersiTarih,
      saat: this.etutDersiSaat,
      kayit_sayisi: attendanceData.length,
      data: attendanceData
    });

    this.http
      .post<any>(
        './server/api/devamsizlik_kaydet.php',
        {
          records: attendanceData,
        },
        {
          headers: this.getAuthHeaders(),
        }
      )
      .subscribe({
        next: (response) => {
          console.log('Etüt dersi kaydet API yanıtı:', response);

          if (response.success) {
            this.toastr.success(
              `${attendanceData.length} öğrencinin etüt dersi kaydı başarıyla kaydedildi`,
              'Başarılı'
            );
            this.hasEtutChanges = false;

            // Modal'ı kapat
            const modalElement = document.getElementById('etutDersiModal');
            if (modalElement) {
              const modal = (window as any).bootstrap.Modal.getInstance(modalElement);
              if (modal) {
                modal.hide();
              }
            }

            // Geçmiş verileri yeniden yükle
            this.loadHistoricalAttendance();
          } else {
            this.toastr.error(response.message || 'Etüt dersi kaydı sırasında hata oluştu', 'Hata');
          }
          this.isEtutSaving = false;
        },
        error: (error) => {
          console.error('Etüt dersi kaydedilirken hata:', error);
          this.toastr.error('Etüt dersi kaydı sırasında hata oluştu', 'Hata');
          this.isEtutSaving = false;
        },
      });
  }
}