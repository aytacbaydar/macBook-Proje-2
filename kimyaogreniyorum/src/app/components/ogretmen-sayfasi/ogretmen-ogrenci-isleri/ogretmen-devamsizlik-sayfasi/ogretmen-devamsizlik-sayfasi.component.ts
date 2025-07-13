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
  startDate: string = '';
  endDate: string = '';
  isQRScannerActive: boolean = false;
  isLoading: boolean = false;
  hasChanges: boolean = false;

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
      }
    });

    this.loadGroups();
    this.setTodayDate();
    this.restoreLastState();
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
        console.log('Devamsızlık - Token bulundu:', token ? 'Evet' : 'Hayır');
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
            if (this.selectedGroup) {
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
      console.log('Tarih değişti:', this.selectedDate);

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

    // Son 30 gün için tarih aralığı belirle
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);

    const formattedStartDate = startDate.toISOString().split('T')[0];
    const formattedEndDate = endDate.toISOString().split('T')[0];

    this.http
      .get<any>(`./server/api/devamsizlik_kayitlari.php`, {
        headers: this.getAuthHeaders(),
        params: {
          grup: this.selectedGroup,
          baslangic_tarih: formattedStartDate,
          bitis_tarih: formattedEndDate,
        },
      })
      .subscribe({
        next: (response) => {
          if (response.success && response.data) {
            this.historicalAttendance = response.data.kayitlar || [];
            this.groupedAttendanceByDate = response.data.tarihlere_gore || [];

            // Eksik katılmayan öğrenci listelerini hesapla
            this.groupedAttendanceByDate.forEach(dateGroup => {
              // Eğer katilmayanlar listesi boş ama katilmayan_sayisi > 0 ise, hesapla
              if ((!dateGroup.katilmayanlar || dateGroup.katilmayanlar.length === 0) && dateGroup.katilmayan_sayisi > 0) {
                // O tarihteki tüm devamsızlık kayıtlarını bul
                const dateRecords = this.historicalAttendance.filter(record => 
                  record.tarih === dateGroup.tarih
                );

                // Katılan öğrenci ID'lerini al
                const presentStudentIds = dateRecords
                  .filter(record => record.durum === 'present')
                  .map(record => record.ogrenci_id);

                // Katılmayan öğrenci ID'lerini al
                const absentStudentIds = dateRecords
                  .filter(record => record.durum === 'absent')
                  .map(record => record.ogrenci_id);

                // Katılmayan öğrencilerin detaylarını bul
                dateGroup.katilmayanlar = this.groupStudents.filter(student => 
                  absentStudentIds.includes(student.id)
                );
              }

              console.log(`${dateGroup.tarih} tarihinde:`, {
                katilan_sayisi: dateGroup.katilan_sayisi,
                katilmayan_sayisi: dateGroup.katilmayan_sayisi,
                katilanlar: dateGroup.katilanlar?.length || 0,
                katilmayanlar: dateGroup.katilmayanlar?.length || 0,
                katilmayan_isimler: dateGroup.katilmayanlar?.map((s: Student) => s.adi_soyadi) || []
              });
            });
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

    console.log('Tarih aralığı filtresi:', {
      grup: this.selectedGroup,
      baslangic_tarih: this.startDate,
      bitis_tarih: this.endDate
    });

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
          console.log('Tarih aralığı filtre yanıtı:', response);
          if (response.success && response.data) {
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

    console.log('Son 1 hafta filtrelendi:', this.startDate, 'to', this.endDate);
    this.loadHistoricalAttendanceByDateRange();
  }

  setDateRangeLastMonth() {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - 30);

    this.startDate = startDate.toISOString().split('T')[0];
    this.endDate = endDate.toISOString().split('T')[0];

    console.log('Son 1 ay filtrelendi:', this.startDate, 'to', this.endDate);
    this.loadHistoricalAttendanceByDateRange();
  }

  setDateRangeThisMonth() {
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    this.startDate = startDate.toISOString().split('T')[0];
    this.endDate = endDate.toISOString().split('T')[0];

    console.log('Bu ay filtrelendi:', this.startDate, 'to', this.endDate);
    this.loadHistoricalAttendanceByDateRange();
  }

  setDateRangeThisYear() {
    const now = new Date();
    const startDate = new Date(now.getFullYear(), 0, 1);
    const endDate = new Date(now.getFullYear(), 11, 31);

    this.startDate = startDate.toISOString().split('T')[0];
    this.endDate = endDate.toISOString().split('T')[0];

    console.log('Bu yıl filtrelendi:', this.startDate, 'to', this.endDate);
    this.loadHistoricalAttendanceByDateRange();
  }

  // Bütün devamsızlık kayıtlarını getir
  loadAllAttendanceRecords() {
    if (!this.selectedGroup) return;

    console.log('Bütün devamsızlık kayıtları yükleniyor...');

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
          console.log('Tüm kayıtlar API yanıtı:', response);

          if (response.success && response.data) {
            this.historicalAttendance = response.data.kayitlar || [];
            this.groupedAttendanceByDate = response.data.tarihlere_gore || [];

            console.log('Toplam tüm kayıt:', this.historicalAttendance.length);
            console.log('Gruplandırılmış tarih sayısı:', this.groupedAttendanceByDate.length);
            console.log('API yanıtı toplam_kayit:', response.data.toplam_kayit);
            console.log('Seçilen grup:', this.selectedGroup);
            console.log('İlk 5 kayıt:', this.historicalAttendance.slice(0, 5));
            console.log('Son 5 kayıt:', this.historicalAttendance.slice(-5));

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

  // Aylık özet istatistikleri
  getTotalPresentInPeriod(): number {
    return this.groupedAttendanceByDate.reduce(
      (total, day) => total + day.katilan_sayisi,
      0
    );
  }

  getTotalAbsentInPeriod(): number {
    return this.groupedAttendanceByDate.reduce(
      (total, day) => total + day.katilmayan_sayisi,
      0
    );
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

  // Toplam ders sayısını getir (tarihlere göre)
  getTotalLessonsCount(): number {
    return this.groupedAttendanceByDate.length;
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

  // Öğrenci bazında katılım istatistiklerini getir
  getStudentAttendanceStats(): any[] {
    if (!this.selectedGroup || this.groupStudents.length === 0) {
      return [];
    }

    return this.groupStudents.map(student => {
      // Bu öğrencinin tüm devamsızlık kayıtlarını bul
      const studentRecords = this.historicalAttendance.filter(
        record => record.ogrenci_id === student.id
      );

      // Katıldığı dersleri say
      const presentCount = studentRecords.filter(
        record => record.durum === 'present'
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
        presentCount: presentCount,
        absentCount: absentCount,
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

  async loadStudentDetailedStats(studentId: number) {
    if (!this.selectedGroup) {
      this.toastr.error('Lütfen önce bir grup seçiniz', 'Hata');
      return;
    }

    console.log('Öğrenci detay istatistikleri yükleniyor:', { studentId, grup: this.selectedGroup });

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

      console.log('Öğrenci detay istatistik API yanıtı:', response);

      if (response && response.success) {
        this.selectedStudentStats = response.data;
        this.showStudentStatsModal = true;
        console.log('Modal açılıyor, seçilen öğrenci stats:', this.selectedStudentStats);
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

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: 'TRY'
    }).format(amount);
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('tr-TR');
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

            console.log('Mevcut yoklama verileri yüklendi:', attendanceData);

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

              console.log(`${this.selectedDate} tarihinde ${attendanceData.length} kayıt bulundu`);
            } else {
              console.log(`${this.selectedDate} tarihinde kayıt bulunamadı, yeni yoklama alınabilir`);
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

      if (student) {
        this.markAttendance(studentId, 'present', 'qr');
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
        console.log(`Öğrenci ${studentId} durumu ${status} olarak güncellendi`);
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
}