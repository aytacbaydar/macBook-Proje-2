import { Component, OnInit, ViewChild, ElementRef, OnDestroy } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import jsQR from 'jsqr';

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
  styleUrl: './ogretmen-devamsizlik-sayfasi.component.scss'
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
    return Array.from(this.attendanceRecords.values())
      .filter(record => record.status === 'present').length;
  }

  get absentStudents(): number {
    return Array.from(this.attendanceRecords.values())
      .filter(record => record.status === 'absent').length;
  }

  constructor(
    private http: HttpClient,
    private route: ActivatedRoute,
    private toastr: ToastrService
  ) {}

  ngOnInit() {
    // URL parametresinden grup bilgisini al
    this.route.params.subscribe(params => {
      if (params['grupAdi']) {
        this.selectedGroup = decodeURIComponent(params['grupAdi']);
      }
    });

    this.loadGroups();
  }

  ngOnDestroy() {
    this.stopQRScanner();
  }

  private getAuthHeaders(): HttpHeaders {
    // Token'ı al - gruplar sayfasındaki gibi
    let token = '';
    const userStr = localStorage.getItem('user') || sessionStorage.getItem('user');
    if (userStr) {
      const user = JSON.parse(userStr);
      token = user.token || '';
    }

    return new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
  }

  loadGroups() {
    this.isLoading = true;

    this.http.get<any>('./server/api/ogrenciler_listesi.php', {
      headers: this.getAuthHeaders()
    }).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          // Giriş yapan öğretmenin bilgilerini al
          const loggedInUser = this.getLoggedInUser();
          const loggedInTeacherName = loggedInUser?.adi_soyadi || '';

          // Sadece öğrencileri filtrele (admin ve öğretmenleri hariç tut)
          const actualStudents = response.data.filter(
            (student: any) =>
              student.rutbe === 'ogrenci' && student.ogretmeni === loggedInTeacherName
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
          this.groups = Array.from(groupMap.entries()).map(([name, students]) => ({
            name,
            students,
            color: this.getGroupColor(name)
          }));

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
      }
    });
  }

  private getLoggedInUser(): any {
    const userStr = localStorage.getItem('user') || sessionStorage.getItem('user');
    if (userStr) {
      return JSON.parse(userStr);
    }
    return null;
  }

  onGroupChange() {
    if (this.selectedGroup) {
      const selectedGroupData = this.groups.find(g => g.name === this.selectedGroup);
      this.groupStudents = selectedGroupData ? selectedGroupData.students : [];
      this.initializeAttendanceRecords();
      this.loadAttendanceData();
      this.loadPastWeekAttendance();
      this.loadHistoricalAttendance();
    } else {
      this.groupStudents = [];
      this.attendanceRecords.clear();
      this.pastWeekAttendance = [];
      this.historicalAttendance = [];
      this.groupedAttendanceByDate = [];
    }
    this.hasChanges = false;
  }

  loadHistoricalAttendance() {
    if (!this.selectedGroup) return;

    // Son 30 gün için tarih aralığı belirle
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);

    const formattedStartDate = startDate.toISOString().split('T')[0];
    const formattedEndDate = endDate.toISOString().split('T')[0];

    this.http.get<any>(`./server/api/devamsizlik_kayitlari.php`, {
      headers: this.getAuthHeaders(),
      params: {
        grup: this.selectedGroup,
        baslangic_tarih: formattedStartDate,
        bitis_tarih: formattedEndDate
      }
    }).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.historicalAttendance = response.data.kayitlar || [];
          this.groupedAttendanceByDate = response.data.tarihlere_gore || [];
        } else {
          this.historicalAttendance = [];
          this.groupedAttendanceByDate = [];
        }
      },
      error: (error) => {
        console.error('Geçmiş devamsızlık verileri yüklenirken hata:', error);
        this.historicalAttendance = [];
        this.groupedAttendanceByDate = [];
      }
    });
  }

  loadHistoricalAttendanceByDateRange() {
    if (!this.selectedGroup || !this.startDate || !this.endDate) return;

    this.http.get<any>(`./server/api/devamsizlik_kayitlari.php`, {
      headers: this.getAuthHeaders(),
      params: {
        grup: this.selectedGroup,
        baslangic_tarih: this.startDate,
        bitis_tarih: this.endDate
      }
    }).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.historicalAttendance = response.data.kayitlar || [];
          this.groupedAttendanceByDate = response.data.tarihlere_gore || [];
        } else {
          this.historicalAttendance = [];
          this.groupedAttendanceByDate = [];
        }
      },
      error: (error) => {
        console.error('Tarih aralığına göre devamsızlık verileri yüklenirken hata:', error);
        this.historicalAttendance = [];
        this.groupedAttendanceByDate = [];
      }
    });
  }

  toggleHistoricalView() {
    this.viewHistoricalData = !this.viewHistoricalData;
    if (this.viewHistoricalData) {
      this.loadHistoricalAttendance();
    }
  }

  getDayName(date: string): string {
    const days = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
    const day = new Date(date).getDay();
    return days[day];
  }

  formatDate(date: string): string {
    return new Date(date).toLocaleDateString('tr-TR');
  }

  // Hızlı tarih filtreleri
  setDateRangeLastWeek() {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);

    this.startDate = startDate.toISOString().split('T')[0];
    this.endDate = endDate.toISOString().split('T')[0];
    this.loadHistoricalAttendanceByDateRange();
  }

  setDateRangeLastMonth() {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);

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

  // Aylık özet istatistikleri
  getTotalPresentInPeriod(): number {
    return this.groupedAttendanceByDate.reduce((total, day) => total + day.katilan_sayisi, 0);
  }

  getTotalAbsentInPeriod(): number {
    return this.groupedAttendanceByDate.reduce((total, day) => total + day.katilmayan_sayisi, 0);
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

  private initializeAttendanceRecords() {
    this.attendanceRecords.clear();
    this.groupStudents.forEach(student => {
      this.attendanceRecords.set(student.id, {
        student_id: student.id,
        status: 'pending',
        timestamp: new Date(),
        method: 'manual'
      });
    });
  }

  loadAttendanceData() {
    if (!this.selectedGroup || !this.selectedDate) return;

    this.isLoading = true;

    this.http.get<any>(`./server/api/devamsizlik_kayitlari.php?group=${encodeURIComponent(this.selectedGroup)}&tarih=${this.selectedDate}`, {
      headers: this.getAuthHeaders(),
      params: {
        grup: this.selectedGroup,
        tarih: this.selectedDate
      }
    }).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          // Update attendance records with saved data
          response.data.forEach((record: any) => {
            if (this.attendanceRecords.has(record.ogrenci_id)) {
              this.attendanceRecords.set(record.ogrenci_id, {
                student_id: record.ogrenci_id,
                status: record.durum,
                timestamp: new Date(record.zaman),
                method: record.yontem
              });
            }
          });
        }
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Devamsızlık verileri yüklenirken hata:', error);
        this.isLoading = false;
      }
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
        video: { facingMode: 'environment' }
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
      this.mediaStream.getTracks().forEach(track => track.stop());
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

    // Gerçek QR kod tespiti jsQR ile
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);

    try {
      const qrCode = jsQR(imageData.data, imageData.width, imageData.height);

      if (qrCode && qrCode.data) {
        console.log('QR Kod tespit edildi:', qrCode.data);
        this.processQRCode(qrCode.data);
      }
    } catch (error) {
      console.error('QR kod okuma hatası:', error);
    }
  }

  private generateMockQRData(): string | null {
    // Mock fonksiyon devre dışı - sadece gerçek QR kod okuma aktif
    return null;
  }

  processQRCode(data: string): void {
    try {
      // QR kod formatı: student_studentId
      const parts = data.split('_');

      if (parts.length < 2) {
        console.error('Geçersiz QR kod formatı:', data);
        return;
      }

      const studentId = parseInt(parts[1]);

      // Öğrenci bilgisini bul
      const student = this.groupStudents.find(s => s.id === studentId);
      if (!student) {
        console.error('Öğrenci bulunamadı:', studentId);
        return;
      }

      // Devamsızlık kaydı yap
      this.markAbsent(studentId, student.adi_soyadi);

    } catch (error) {
      console.error('QR kod işlenirken hata:', error);
    }
  }

  // Sesli mesaj çalma fonksiyonu
  private playVoiceMessage(message: string): void {
    if ('speechSynthesis' in window) {
      // Önceki konuşmayı durdur
      speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(message);

      // Türkçe ses ayarları
      utterance.lang = 'tr-TR';
      utterance.rate = 0.8; // Konuşma hızı
      utterance.pitch = 1.0; // Ses tonu
      utterance.volume = 0.8; // Ses seviyesi

      // Türkçe ses varsa kullan
      const voices = speechSynthesis.getVoices();
      const turkishVoice = voices.find(voice => 
        voice.lang.includes('tr') || voice.lang.includes('TR')
      );

      if (turkishVoice) {
        utterance.voice = turkishVoice;
      }

      speechSynthesis.speak(utterance);
    }
  }

  markAbsent(studentId: number, studentName: string): void {
    const today = new Date().toISOString().split('T')[0];

    const requestData = {
      student_id: studentId,
      grup: this.selectedGroup,
      tarih: today,
      durum: 'devamsiz'
    };

    this.http.post<any>('./server/api/devamsizlik_kaydet.php', requestData)
      .subscribe({
        next: (response) => {
          if (response.success) {
            const message = `${studentName} devamsız olarak kaydedildi`;
            console.log(message);
            this.playVoiceMessage(`${studentName} devamsız kaydedildi`);
            // UI'ı güncelle - öğrenciyi devamsız listesine ekle
            // Devamsız öğrenciler otomatik olarak güncellenecek
          } else {
            console.error('Devamsızlık kaydı hatası:', response.error);
            this.playVoiceMessage('Kayıt başarısız!');
          }
        },
        error: (error) => {
          console.error('Devamsızlık kaydı hatası:', error);
          this.playVoiceMessage('Bağlantı hatası!');
        }
      });
  }

  markAttendance(studentId: number, status: 'present' | 'absent', method: 'manual' | 'qr' = 'manual') {
    if (this.attendanceRecords.has(studentId)) {
      this.attendanceRecords.set(studentId, {
        student_id: studentId,
        status: status,
        timestamp: new Date(),
        method: method
      });
      this.hasChanges = true;
    }
  }

  markAllPresent() {
    this.groupStudents.forEach(student => {
      this.markAttendance(student.id, 'present');
    });
  }

  markAllAbsent() {
    this.groupStudents.forEach(student => {
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
      case 'present': return 'Katıldı';
      case 'absent': return 'Katılmadı';
      default: return 'Bekliyor';
    }
  }

  getAttendanceTime(studentId: number): Date | null {
    const record = this.attendanceRecords.get(studentId);
    return record && record.status !== 'pending' ? record.timestamp : null;
  }

  saveAttendance() {
    if (!this.selectedGroup || !this.hasChanges) return;

    this.isLoading = true;

    const attendanceData = Array.from(this.attendanceRecords.values())
      .filter(record => record.status !== 'pending')
      .map(record => ({
        ogrenci_id: record.student_id,
        grup: this.selectedGroup,
        tarih: this.selectedDate,
        durum: record.status,
        zaman: record.timestamp.toISOString(),
        yontem: record.method
      }));

    this.http.post<any>("./server/api/devamsizlik_kaydet.php", {
      records: attendanceData
    }, {
      headers: this.getAuthHeaders()
    }).subscribe({
      next: (response) => {
        if (response.success) {
          this.toastr.success('Devamsızlık kaydı başarıyla kaydedildi', 'Başarılı');
          this.hasChanges = false;
        } else {
          this.toastr.error('Kayıt sırasında hata oluştu', 'Hata');
        }
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Devamsızlık kaydedilirken hata:', error);
        this.toastr.error('Kayıt sırasında hata oluştu', 'Hata');
        this.isLoading = false;
      }
    });
  }

  loadPastWeekAttendance() {
    if (!this.selectedGroup) return;

    // Geçen haftanın tarihini hesapla
    const pastWeekDate = new Date();
    pastWeekDate.setDate(pastWeekDate.getDate() - 7);
    const formattedPastWeekDate = pastWeekDate.toISOString().split('T')[0];

    this.http.get<any>(`./server/api/devamsizlik_kayitlari.php?group=${encodeURIComponent(this.selectedGroup)}&tarih=${formattedPastWeekDate}`, {
      headers: this.getAuthHeaders(),
      params: {
        grup: this.selectedGroup,
        tarih: formattedPastWeekDate
      }
    }).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.pastWeekAttendance = response.data.map((record: any) => {
            const student = this.groupStudents.find(s => s.id === record.ogrenci_id);
            return {
              ...record,
              student: student,
              adi_soyadi: student?.adi_soyadi || 'Bilinmeyen Öğrenci',
              avatar: student?.avatar
            };
          });
        } else {
          this.pastWeekAttendance = [];
        }
      },
      error: (error) => {
        console.error('Geçen hafta devamsızlık verileri yüklenirken hata:', error);
        this.pastWeekAttendance = [];
      }
    });
  }

  getPastWeekDate(): Date {
    const pastWeekDate = new Date();
    pastWeekDate.setDate(pastWeekDate.getDate() - 7);
    return pastWeekDate;
  }

  getPastWeekPresentCount(): number {
    return this.pastWeekAttendance.filter(record => record.durum === 'present').length;
  }

  getPastWeekAbsentCount(): number {
    return this.pastWeekAttendance.filter(record => record.durum === 'absent').length;
  }

  getPastWeekPresentStudents(): any[] {
    return this.pastWeekAttendance.filter(record => record.durum === 'present');
  }

  getPastWeekAbsentStudents(): any[] {
    return this.pastWeekAttendance.filter(record => record.durum === 'absent');
  }

  getDefaultAvatar(name: string): string {
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=4f46e5&color=fff&size=40&font-size=0.6&rounded=true`;
  }

  private getGroupColor(groupName: string): string {
    const colors = [
      '#3B82F6', '#EF4444', '#10B981', '#F59E0B',
      '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'
    ];
    const index = groupName.length % colors.length;
    return colors[index];
  }
}