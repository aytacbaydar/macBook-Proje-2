import { Component } from '@angular/core';

@Component({
  selector: 'app-ogretmen-devamsizlik-sayfasi',
  standalone: false,
  templateUrl: './ogretmen-devamsizlik-sayfasi.component.html',
  styleUrl: './ogretmen-devamsizlik-sayfasi.component.scss'
})
export class OgretmenDevamsizlikSayfasiComponent {

}
import { Component, OnInit, ViewChild, ElementRef, OnDestroy } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
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

  // UI state
  selectedGroup: string = '';
  selectedDate: string = new Date().toISOString().split('T')[0];
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
    private toastr: ToastrService
  ) {}

  ngOnInit() {
    this.loadGroups();
  }

  ngOnDestroy() {
    this.stopQRScanner();
  }

  private getAuthHeaders(): HttpHeaders {
    const token = localStorage.getItem('auth_token');
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
          // Giriş yapan öğretmenin öğrencilerini filtrele
          const loggedInUser = this.getLoggedInUser();
          const loggedInTeacherName = loggedInUser?.adi_soyadi || '';

          this.groups = (response.data || []).filter((student: any) => 
            student.rutbe === 'ogrenci' && student.ogretmeni === loggedInTeacherName
          );
          // Group students by 'grubu' field
          const groupMap = new Map<string, Student[]>();

          response.data.forEach((student: Student) => {
            const groupName = student.grubu || 'Genel';
            if (!groupMap.has(groupName)) {
              groupMap.set(groupName, []);
            }
            groupMap.get(groupName)?.push(student);
          });

          // Convert to groups array
          this.groups = Array.from(groupMap.entries()).map(([name, students]) => ({
            name,
            students,
            color: this.getGroupColor(name)
          }));
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
    } else {
      this.groupStudents = [];
      this.attendanceRecords.clear();
    }
    this.hasChanges = false;
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
    if (Math.random() < 0.1) { // 10% chance to simulate QR detection
      const randomStudent = this.groupStudents[Math.floor(Math.random() * this.groupStudents.length)];
      return `student_${randomStudent.id}`;
    }
    return null;
  }

  private processQRCode(qrData: string) {
    // Parse QR code data
    const match = qrData.match(/student_(\d+)/);
    if (match) {
      const studentId = parseInt(match[1]);
      const student = this.groupStudents.find(s => s.id === studentId);

      if (student) {
        this.markAttendance(studentId, 'present', 'qr');
        this.toastr.success(`${student.adi_soyadi} QR kod ile katıldı olarak işaretlendi`, 'Başarılı');
      } else {
        this.toastr.warning('QR kodundaki öğrenci bu grupta bulunamadı', 'Uyarı');
      }
    }
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

  private getGroupColor(groupName: string): string {
    const colors = [
      '#3B82F6', '#EF4444', '#10B981', '#F59E0B',
      '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'
    ];
    const index = groupName.length % colors.length;
    return colors[index];
  }
}