import { Component, OnInit, ViewChild, ElementRef, OnDestroy } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';

interface Student {
  id: number;
  adi_soyadi: string;
  email: string;
  cep_telefonu?: string;
  okulu?: string;
  sinifi?: string;
  grubu?: string;
  ders_gunu?: string;
  ders_saati?: string;
  ucret?: string;
  aktif: boolean;
  avatar?: string;
  veli_adi?: string;
  veli_cep?: string;
  rutbe?: string;
  ogretmeni?: string;
}

interface ClassroomEntry {
  student_id: number;
  entry_time: Date;
  exit_time?: Date;
  is_present: boolean;
  qr_method: 'entry' | 'exit';
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

  groups: string[] = [];
  selectedGroup: string = '';
  selectedDate: string = new Date().toISOString().split('T')[0];
  groupStudents: Student[] = [];
  presentStudents = new Set<number>();
  classroomEntries = new Map<number, ClassroomEntry>();
  searchQuery: string = '';
  isLoading: boolean = false;
  error: string | null = null;

  // QR Scanner properties
  isQRScannerActive: boolean = false;
  mediaStream: MediaStream | null = null;
  scanInterval: any = null;

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.loadGroups();
  }

  ngOnDestroy(): void {
    this.stopQRScanner();
  }

  private getAuthHeaders(): HttpHeaders {
    let token = '';
    const userStr = localStorage.getItem('user') || sessionStorage.getItem('user');
    if (userStr) {
      const user = JSON.parse(userStr);
      token = user.token || '';
    }
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });
  }

  private loadGroups(): void {
    this.isLoading = true;

    let loggedInUser: any = null;
    const userStr = localStorage.getItem('user') || sessionStorage.getItem('user');
    if (userStr) {
      loggedInUser = JSON.parse(userStr);
    }

    this.http.get<any>('./server/api/ogrenciler_listesi.php', {
      headers: this.getAuthHeaders()
    }).subscribe({
      next: (response) => {
        if (response && response.success && response.data) {
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
          console.log('Öğretmenin grupları yüklendi:', this.groups);
        }
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Gruplar yüklenirken hata:', error);
        this.error = 'Gruplar yüklenirken hata oluştu';
        this.isLoading = false;
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

  private loadGroupStudents(): void {
    if (!this.selectedGroup) return;

    this.http.get<any>('./server/api/ogrenciler_listesi.php', {
      headers: this.getAuthHeaders()
    }).subscribe({
      next: (response) => {
        if (response && response.success && response.data) {
          this.groupStudents = response.data.filter(
            (student: any) => 
              student.rutbe === 'ogrenci' && 
              student.grubu === this.selectedGroup
          );
          console.log('Grup öğrencileri yüklendi:', this.groupStudents.length);
        }
      },
      error: (error) => {
        console.error('Grup öğrencileri yüklenirken hata:', error);
      }
    });
  }

  private loadClassroomStatus(): void {
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

          console.log('Sınıf durumu güncellendi:', {
            present: this.presentStudents.size,
            total: this.groupStudents.length
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

  private async startQRScanner(): Promise<void> {
    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });

      if (this.videoElement) {
        this.videoElement.nativeElement.srcObject = this.mediaStream;
        this.isQRScannerActive = true;

        // Mock QR scanning (gerçek implementasyon için jsQR kütüphanesi kullanılabilir)
        this.scanInterval = setInterval(() => {
          this.scanForQRCode();
        }, 1000);
      }
    } catch (error) {
      console.error('Kamera erişim hatası:', error);
      alert('Kamera erişimi reddedildi veya mevcut değil');
    }
  }

  private stopQRScanner(): void {
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }

    if (this.scanInterval) {
      clearInterval(this.scanInterval);
      this.scanInterval = null;
    }

    this.isQRScannerActive = false;
  }

  private scanForQRCode(): void {
    // Mock QR kod taraması - gerçek implementasyon için jsQR kullanılması gerekir
    if (Math.random() < 0.05) { // %5 şansla mock QR kod
      const mockQRData = this.generateMockQRData();
      if (mockQRData) {
        this.processQRCode(mockQRData);
      }
    }
  }

  private generateMockQRData(): string | null {
    if (Math.random() < 0.1) {
      const randomStudent = this.groupStudents[Math.floor(Math.random() * this.groupStudents.length)];
      const action = Math.random() < 0.5 ? 'entry' : 'exit';
      return `student_${randomStudent.id}_${action}`;
    }
    return null;
  }

  private processQRCode(qrData: string): void {
    const match = qrData.match(/student_(\d+)_(entry|exit)/);
    if (match) {
      const studentId = parseInt(match[1]);
      const action = match[2] as 'entry' | 'exit';
      const student = this.groupStudents.find(s => s.id === studentId);

      if (student) {
        this.handleStudentQRAction(studentId, action);
      } else {
        alert('QR kodundaki öğrenci bu grupta bulunamadı!');
      }
    }
  }

  private handleStudentQRAction(studentId: number, action: 'entry' | 'exit'): void {
    const student = this.groupStudents.find(s => s.id === studentId);
    if (!student) return;

    const currentTime = new Date();

    const classroomData = {
      student_id: studentId,
      grup: this.selectedGroup,
      tarih: this.selectedDate,
      action: action,
      zaman: currentTime.toISOString()
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

    const isCurrentlyPresent = this.presentStudents.has(studentId);
    const action = isCurrentlyPresent ? 'exit' : 'entry';

    if (confirm(`${student.adi_soyadi} için ${isCurrentlyPresent ? 'çıkış' : 'giriş'} işlemini manuel olarak kaydetmek istediğinizden emin misiniz?`)) {
      this.handleStudentQRAction(studentId, action);
    }
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

  getStudentEntryTime(studentId: number): Date | null {
    const entry = this.classroomEntries.get(studentId);
    return entry?.is_present ? entry.entry_time : null;
  }

  getStudentExitTime(studentId: number): Date | null {
    const entry = this.classroomEntries.get(studentId);
    return entry?.exit_time || null;
  }

  get filteredStudents(): Student[] {
    if (!this.searchQuery.trim()) {
      return this.groupStudents;
    }

    const query = this.searchQuery.toLowerCase().trim();
    return this.groupStudents.filter(student =>
      student.adi_soyadi.toLowerCase().includes(query) ||
      student.email.toLowerCase().includes(query)
    );
  }

  getDefaultAvatar(name: string): string {
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=4f46e5&color=fff&size=50&font-size=0.6&rounded=true`;
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
    alert(`Sınıf raporu konsola yazdırıldı. Toplam ${presentList.length} öğrenci sınıfta.`);
  }
}