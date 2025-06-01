
import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';

interface Student {
  id: number;
  adi_soyadi: string;
  email: string;
  grubu?: string;
  aktif: boolean;
}

interface ClassroomEntry {
  student_id: number;
  entry_time: Date;
  exit_time?: Date;
  is_present: boolean;
  qr_method: string;
}

@Component({
  selector: 'app-ogretmen-sinifta-kimler-var-sayfasi',
  standalone: false,
  templateUrl: './ogretmen-sinifta-kimler-var-sayfasi.component.html',
  styleUrl: './ogretmen-sinifta-kimler-var-sayfasi.component.scss'
})
export class OgretmenSiniftaKimlerVarSayfasiComponent implements OnInit {

  @ViewChild('videoElement') videoElement!: ElementRef<HTMLVideoElement>;
  @ViewChild('canvasElement') canvasElement!: ElementRef<HTMLCanvasElement>;

  groups: string[] = [];
  selectedGroup: string = '';
  selectedDate: string = '';
  groupStudents: Student[] = [];
  presentStudents = new Set<number>();
  classroomEntries = new Map<number, ClassroomEntry>();
  
  isQRScannerActive: boolean = false;
  mediaStream: MediaStream | null = null;
  scanInterval: any = null;
  currentTime: string = '';

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.loadGroups();
    this.setTodayDate();
    this.updateCurrentTime();
    setInterval(() => this.updateCurrentTime(), 1000);
  }

  updateCurrentTime(): void {
    const now = new Date();
    this.currentTime = now.toLocaleTimeString();
  }

  setTodayDate(): void {
    const today = new Date();
    const year = today.getFullYear();
    const month = (today.getMonth() + 1).toString().padStart(2, '0');
    const day = today.getDate().toString().padStart(2, '0');
    this.selectedDate = `${year}-${month}-${day}`;
  }

  loadGroups(): void {
    this.http.get<any>('./server/api/ogrenciler_listesi.php', {
      headers: this.getAuthHeaders()
    }).subscribe({
      next: (response) => {
        if (response.success) {
          const students = response.data;
          const uniqueGroups = [...new Set(students
            .filter((s: any) => s.rutbe === 'ogrenci' && s.grubu)
            .map((s: any) => s.grubu))];
          this.groups = uniqueGroups as string[];
        }
      },
      error: (error) => {
        console.error('Gruplar yüklenirken hata:', error);
      }
    });
  }

  onGroupChange(): void {
    if (this.selectedGroup) {
      this.loadGroupStudents();
      this.loadClassroomStatus();
    } else {
      this.groupStudents = [];
      this.presentStudents.clear();
      this.classroomEntries.clear();
    }
  }

  loadGroupStudents(): void {
    this.http.get<any>('./server/api/ogrenciler_listesi.php', {
      headers: this.getAuthHeaders()
    }).subscribe({
      next: (response) => {
        if (response.success) {
          this.groupStudents = response.data.filter((student: any) => 
            student.rutbe === 'ogrenci' && student.grubu === this.selectedGroup
          );
        }
      },
      error: (error) => {
        console.error('Grup öğrencileri yüklenirken hata:', error);
      }
    });
  }

  loadClassroomStatus(): void {
    if (!this.selectedGroup) return;

    this.http.get<any>(`./server/api/sinif_durumu.php`, {
      headers: this.getAuthHeaders(),
      params: {
        grup: this.selectedGroup,
        tarih: this.selectedDate
      }
    }).subscribe({
      next: (response) => {
        if (response && response.success && response.data) {
          this.presentStudents.clear();
          this.classroomEntries.clear();

          response.data.forEach((entry: any) => {
            if (entry.is_present) {
              this.presentStudents.add(entry.student_id);
            }

            this.classroomEntries.set(entry.student_id, {
              student_id: entry.student_id,
              entry_time: new Date(entry.entry_time),
              exit_time: entry.exit_time ? new Date(entry.exit_time) : undefined,
              is_present: entry.is_present,
              qr_method: entry.qr_method
            });
          });
        }
      },
      error: (error) => {
        console.error('Sınıf durumu yüklenirken hata:', error);
      }
    });
  }

  refreshClassroomStatus(): void {
    this.loadClassroomStatus();
  }

  toggleQRScanner(): void {
    if (this.isQRScannerActive) {
      this.stopQRScanner();
    } else {
      this.startQRScanner();
    }
  }

  async startQRScanner(): Promise<void> {
    try {
      // Önce cihazda kamera var mı kontrol et
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert('Bu cihazda kamera desteği bulunmuyor');
        return;
      }

      // Kamera izinlerini kontrol et
      const permission = await navigator.permissions.query({ name: 'camera' as PermissionName });
      
      if (permission.state === 'denied') {
        alert('Kamera erişimi reddedildi. Lütfen tarayıcı ayarlarından kamera iznini açın.');
        return;
      }

      // Kamera akışını başlat - önce arka kamera, sonra ön kamera denenir
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ 
          video: { 
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 }
          } 
        });
      } catch (backCameraError) {
        console.log('Arka kamera erişimi başarısız, ön kamerayı deniyor...', backCameraError);
        try {
          stream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
              facingMode: 'user',
              width: { ideal: 1280 },
              height: { ideal: 720 }
            } 
          });
        } catch (frontCameraError) {
          console.log('Ön kamera da başarısız, herhangi bir kamera deniyor...', frontCameraError);
          stream = await navigator.mediaDevices.getUserMedia({ video: true });
        }
      }

      this.mediaStream = stream;
      if (this.videoElement?.nativeElement) {
        this.videoElement.nativeElement.srcObject = stream;
        await this.videoElement.nativeElement.play();
        this.isQRScannerActive = true;
        this.startScanning();
        alert('QR kod tarayıcı başlatıldı. QR kodu kameraya gösterin.');
      }
    } catch (error: any) {
      console.error('Kamera erişim hatası:', error);
      let errorMessage = 'Kamera erişimi sağlanamadı. ';
      
      if (error.name === 'NotAllowedError') {
        errorMessage += 'Kamera izni verilmedi. Lütfen tarayıcı ayarlarından kamera iznini açın.';
      } else if (error.name === 'NotFoundError') {
        errorMessage += 'Bu cihazda kamera bulunamadı.';
      } else if (error.name === 'NotReadableError') {
        errorMessage += 'Kamera başka bir uygulama tarafından kullanılıyor.';
      } else if (error.name === 'SecurityError') {
        errorMessage += 'Güvenlik nedeniyle erişim engellendi. HTTPS bağlantı gerekli olabilir.';
      } else {
        errorMessage += 'Bilinmeyen hata: ' + error.message;
      }
      
      alert(errorMessage);
    }
  }

  stopQRScanner(): void {
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
    }
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
    }
    this.isQRScannerActive = false;
  }

  startScanning(): void {
    this.scanInterval = setInterval(() => {
      this.scanQRCode();
    }, 1000);
  }

  scanQRCode(): void {
    if (!this.videoElement?.nativeElement || !this.canvasElement?.nativeElement) return;

    const video = this.videoElement.nativeElement;
    const canvas = this.canvasElement.nativeElement;
    const ctx = canvas.getContext('2d');

    if (video.videoWidth === 0 || video.videoHeight === 0) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx?.drawImage(video, 0, 0, canvas.width, canvas.height);

    try {
      const imageData = ctx?.getImageData(0, 0, canvas.width, canvas.height);
      // QR kod okuma işlemi burada yapılacak
      // Şimdilik simülasyon için comment
    } catch (error) {
      console.error('QR kod okuma hatası:', error);
    }
  }

  processQRCode(qrData: string): void {
    const parts = qrData.split('_');
    if (parts.length !== 3) {
      alert('Geçersiz QR kod formatı');
      return;
    }

    const [studentIdStr, action, timestamp] = parts;
    const studentId = parseInt(studentIdStr);

    if (!studentId || !['entry', 'exit'].includes(action)) {
      alert('Geçersiz QR kod verisi');
      return;
    }

    const student = this.groupStudents.find(s => s.id === studentId);
    if (!student) {
      alert('Bu öğrenci seçili grupta bulunmuyor');
      return;
    }

    this.recordClassroomActivity(studentId, action);
  }

  recordClassroomActivity(studentId: number, action: string): void {
    const student = this.groupStudents.find(s => s.id === studentId);
    if (!student) return;

    const currentTime = new Date();
    const classroomData = {
      student_id: studentId,
      grup: this.selectedGroup,
      action: action,
      timestamp: currentTime.toISOString()
    };

    this.http.post('./server/api/sinif_giris_cikis.php', classroomData, {
      headers: this.getAuthHeaders()
    }).subscribe({
      next: (response: any) => {
        if (response.success) {
          if (action === 'entry') {
            this.presentStudents.add(studentId);
            this.classroomEntries.set(studentId, {
              student_id: studentId,
              entry_time: currentTime,
              is_present: true,
              qr_method: 'entry'
            });
            alert(`${student.adi_soyadi} sınıfa giriş yaptı! (${currentTime.toLocaleTimeString()})`);
          } else {
            this.presentStudents.delete(studentId);
            const existingEntry = this.classroomEntries.get(studentId);
            if (existingEntry) {
              existingEntry.exit_time = currentTime;
              existingEntry.is_present = false;
              existingEntry.qr_method = 'exit';
            }
            alert(`${student.adi_soyadi} sınıftan çıkış yaptı! (${currentTime.toLocaleTimeString()})`);
          }
        } else {
          alert('İşlem kaydedilemedi: ' + response.message);
        }
      },
      error: (error) => {
        console.error('QR işlem hatası:', error);
        alert('Bağlantı hatası oluştu');
      }
    });
  }

  manualToggleStudentPresence(studentId: number): void {
    const student = this.groupStudents.find(s => s.id === studentId);
    if (!student) return;

    const isPresent = this.presentStudents.has(studentId);
    const action = isPresent ? 'exit' : 'entry';
    this.recordClassroomActivity(studentId, action);
  }

  getPresentCount(): number {
    return this.presentStudents.size;
  }

  getAbsentCount(): number {
    return this.groupStudents.length - this.presentStudents.size;
  }

  getAttendancePercentage(): number {
    if (this.groupStudents.length === 0) return 0;
    return Math.round((this.getPresentCount() / this.groupStudents.length) * 100);
  }

  isStudentPresent(studentId: number): boolean {
    return this.presentStudents.has(studentId);
  }

  getStudentEntryTime(studentId: number): Date | undefined {
    return this.classroomEntries.get(studentId)?.entry_time;
  }

  getStudentExitTime(studentId: number): Date | undefined {
    return this.classroomEntries.get(studentId)?.exit_time;
  }

  getStudentAvatar(studentName: string): string {
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(studentName)}&background=4f46e5&color=fff&size=50&font-size=0.6&rounded=true`;
  }

  exportClassroomReport(): void {
    const presentList = this.groupStudents
      .filter(student => this.isStudentPresent(student.id))
      .map(student => {
        const entry = this.classroomEntries.get(student.id);
        return {
          name: student.adi_soyadi,
          entryTime: entry?.entry_time?.toLocaleTimeString(),
          exitTime: entry?.exit_time?.toLocaleTimeString() || 'Hala sınıfta'
        };
      });

    console.log('Sınıf raporu:', presentList);
    alert(`Sınıf raporu konsola yazdırıldı. Bulunan ${presentList.length} öğrenci.`);
  }

  private getAuthHeaders(): HttpHeaders {
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
}
