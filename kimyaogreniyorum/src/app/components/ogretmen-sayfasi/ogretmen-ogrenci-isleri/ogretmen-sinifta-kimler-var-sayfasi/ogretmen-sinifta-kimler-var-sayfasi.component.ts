import { Component } from '@angular/core';

@Component({
  selector: 'app-ogretmen-sinifta-kimler-var-sayfasi',
  standalone: false,
  templateUrl: './ogretmen-sinifta-kimler-var-sayfasi.component.html',
  styleUrl: './ogretmen-sinifta-kimler-var-sayfasi.component.scss'
})
export class OgretmenSiniftaKimlerVarSayfasiComponent {

}
import { Component, OnInit, ViewChild, ElementRef, OnDestroy } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';

interface Student {
  id: number;
  adi_soyadi: string;
  email: string;
  grubu?: string;
  avatar?: string;
  aktif: boolean;
}

interface AttendanceStatus {
  student_id: number;
  is_present: boolean;
  scan_time: Date;
}

@Component({
  selector: 'app-ogretmen-sinifta-kimler-var-sayfasi',
  standalone: false,
  templateUrl: './ogretmen-sinifta-kimler-var-sayfasi.component.html',
  styleUrl: './ogretmen-sinifta-kimler-var-sayfasi.component.scss'
})
export class OgretmenSiniftaKimlerVarSayfasiComponent implements OnInit, OnDestroy {
  @ViewChild('videoElement') videoElement!: ElementRef<HTMLVideoElement>;
  @ViewChild('canvasElement') canvasElement!: ElementRef<HTMLCanvasElement>;

  // Data properties
  selectedGroup: string = '';
  groups: string[] = [];
  groupStudents: Student[] = [];
  presentStudents: Set<number> = new Set();
  attendanceStatus: Map<number, AttendanceStatus> = new Map();

  // QR Scanner properties
  isQRScannerActive: boolean = false;
  private mediaStream: MediaStream | null = null;
  private qrScanInterval: any;

  // UI state
  isLoading: boolean = false;
  selectedDate: string = new Date().toISOString().split('T')[0];

  constructor(
    private http: HttpClient,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.loadGroups();
    
    // URL'den grup parametresi varsa al
    this.route.params.subscribe(params => {
      if (params['group']) {
        this.selectedGroup = decodeURIComponent(params['group']);
        this.loadGroupStudents();
      }
    });
  }

  ngOnDestroy(): void {
    this.stopQRScanner();
  }

  loadGroups(): void {
    let token = '';
    let loggedInUser: any = null;
    const userStr = localStorage.getItem('user') || sessionStorage.getItem('user');
    if (userStr) {
      loggedInUser = JSON.parse(userStr);
      token = loggedInUser.token || '';
    }

    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });

    this.http.get<any>('./server/api/ogrenciler_listesi.php', { headers })
      .subscribe({
        next: (response) => {
          if (response.success) {
            const loggedInTeacherName = loggedInUser?.adi_soyadi || '';
            const teacherStudents = response.data.filter(
              (student: any) =>
                student.rutbe === 'ogrenci' && student.ogretmeni === loggedInTeacherName
            );

            const gruplar = new Set<string>();
            teacherStudents.forEach((ogrenci: any) => {
              if (ogrenci.grubu && typeof ogrenci.grubu === 'string' && ogrenci.grubu.trim() !== '') {
                gruplar.add(ogrenci.grubu.trim());
              }
            });

            this.groups = Array.from(gruplar).sort((a, b) => a.localeCompare(b));
          }
        },
        error: (error) => {
          console.error('Gruplar yüklenirken hata:', error);
        }
      });
  }

  loadGroupStudents(): void {
    if (!this.selectedGroup) return;

    this.isLoading = true;
    let token = '';
    let loggedInUser: any = null;
    const userStr = localStorage.getItem('user') || sessionStorage.getItem('user');
    if (userStr) {
      loggedInUser = JSON.parse(userStr);
      token = loggedInUser.token || '';
    }

    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });

    this.http.get<any>('./server/api/ogrenciler_listesi.php', { headers })
      .subscribe({
        next: (response) => {
          if (response.success) {
            const loggedInTeacherName = loggedInUser?.adi_soyadi || '';
            this.groupStudents = response.data.filter(
              (student: any) =>
                student.rutbe === 'ogrenci' && 
                student.ogretmeni === loggedInTeacherName &&
                student.grubu === this.selectedGroup
            );

            // Initialize attendance status for all students
            this.groupStudents.forEach(student => {
              this.attendanceStatus.set(student.id, {
                student_id: student.id,
                is_present: false,
                scan_time: new Date()
              });
            });
          }
          this.isLoading = false;
        },
        error: (error) => {
          console.error('Öğrenciler yüklenirken hata:', error);
          this.isLoading = false;
        }
      });
  }

  onGroupChange(): void {
    this.presentStudents.clear();
    this.attendanceStatus.clear();
    this.loadGroupStudents();
  }

  toggleQRScanner(): void {
    if (this.isQRScannerActive) {
      this.stopQRScanner();
    } else {
      this.startQRScanner();
    }
  }

  private async startQRScanner(): Promise<void> {
    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });

      this.isQRScannerActive = true;

      setTimeout(() => {
        if (this.videoElement && this.videoElement.nativeElement) {
          this.videoElement.nativeElement.srcObject = this.mediaStream;
          this.videoElement.nativeElement.play();

          // Start QR scanning
          this.qrScanInterval = setInterval(() => {
            this.scanForQRCode();
          }, 1000);
        }
      }, 100);

    } catch (error) {
      console.error('Kamera erişim hatası:', error);
      alert('Kameraya erişim sağlanamadı. Lütfen kamera izinlerini kontrol edin.');
    }
  }

  private stopQRScanner(): void {
    this.isQRScannerActive = false;

    if (this.qrScanInterval) {
      clearInterval(this.qrScanInterval);
      this.qrScanInterval = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }

    if (this.videoElement && this.videoElement.nativeElement) {
      this.videoElement.nativeElement.srcObject = null;
    }
  }

  private scanForQRCode(): void {
    if (!this.videoElement || !this.canvasElement) return;

    const video = this.videoElement.nativeElement;
    const canvas = this.canvasElement.nativeElement;
    const context = canvas.getContext('2d');

    if (!context || video.readyState !== video.HAVE_ENOUGH_DATA) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Mock QR code detection - gerçek uygulamada jsQR library kullanılır
    const mockQRData = this.generateMockQRData();
    if (mockQRData) {
      this.processQRCode(mockQRData);
    }
  }

  private generateMockQRData(): string | null {
    // Mock function - gerçek QR detection için
    if (Math.random() < 0.1) { // %10 şansla QR kod simüle et
      const randomStudent = this.groupStudents[Math.floor(Math.random() * this.groupStudents.length)];
      return `student_${randomStudent.id}`;
    }
    return null;
  }

  private processQRCode(qrData: string): void {
    const match = qrData.match(/student_(\d+)/);
    if (match) {
      const studentId = parseInt(match[1]);
      const student = this.groupStudents.find(s => s.id === studentId);

      if (student && !this.presentStudents.has(studentId)) {
        this.markStudentPresent(studentId);
        alert(`${student.adi_soyadi} sınıfa girdi!`);
      }
    }
  }

  markStudentPresent(studentId: number): void {
    this.presentStudents.add(studentId);
    this.attendanceStatus.set(studentId, {
      student_id: studentId,
      is_present: true,
      scan_time: new Date()
    });
  }

  markStudentAbsent(studentId: number): void {
    this.presentStudents.delete(studentId);
    this.attendanceStatus.set(studentId, {
      student_id: studentId,
      is_present: false,
      scan_time: new Date()
    });
  }

  isStudentPresent(studentId: number): boolean {
    return this.presentStudents.has(studentId);
  }

  getPresentCount(): number {
    return this.presentStudents.size;
  }

  getAbsentCount(): number {
    return this.groupStudents.length - this.presentStudents.size;
  }

  getStudentScanTime(studentId: number): Date | null {
    const status = this.attendanceStatus.get(studentId);
    return status?.is_present ? status.scan_time : null;
  }

  getDefaultAvatar(name: string): string {
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=4f46e5&color=fff&size=50&font-size=0.6&rounded=true`;
  }

  exportAttendanceList(): void {
    const presentList = this.groupStudents
      .filter(student => this.isStudentPresent(student.id))
      .map(student => ({
        name: student.adi_soyadi,
        scanTime: this.getStudentScanTime(student.id)
      }));

    console.log('Sınıfta bulunanlar:', presentList);
    // Burada Excel export veya başka format eklenebilir
  }
}
