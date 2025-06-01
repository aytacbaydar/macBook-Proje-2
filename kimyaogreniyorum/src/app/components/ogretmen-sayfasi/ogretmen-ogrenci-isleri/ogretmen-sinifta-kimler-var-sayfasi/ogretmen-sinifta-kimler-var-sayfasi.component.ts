import { Component, OnInit, AfterViewInit, ViewChild, ElementRef } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { ToastrService } from 'ngx-toastr';
import jsQR from 'jsqr';



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
  styleUrl: './ogretmen-sinifta-kimler-var-sayfasi.component.scss',
})
export class OgretmenSiniftaKimlerVarSayfasiComponent
  implements OnInit, AfterViewInit
{
  @ViewChild('videoElement') videoElement!: ElementRef<HTMLVideoElement>;
  @ViewChild('canvasElement') canvasElement!: ElementRef<HTMLCanvasElement>;

  groups: string[] = [];
  selectedGroup: string = '';
  selectedDate: string = '';
  groupStudents: Student[] = [];
  presentStudents = new Set<number>();
  classroomEntries = new Map<number, ClassroomEntry>();
  private qrScanInterval: any;
  private readonly recentlyProcessedQR = new Map<string, number>();

  public isQRScannerActive: boolean = false;

  mediaStream: MediaStream | null = null;
  scanInterval: any = null;
  currentTime: string = '';

  constructor(private http: HttpClient, private toastr: ToastrService) {}

  ngOnInit(): void {
    this.loadGroups();
    this.setTodayDate();
    this.updateCurrentTime();
    setInterval(() => this.updateCurrentTime(), 1000);
    
    // Eski QR kod kayıtlarını her 10 saniyede bir temizle
    setInterval(() => this.cleanupOldQRRecords(), 10000);
  }

  ngAfterViewInit(): void {
    // ViewChild elementleri kullanıma hazır
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
    this.http
      .get<any>('./server/api/ogrenciler_listesi.php', {
        headers: this.getAuthHeaders(),
      })
      .subscribe({
        next: (response) => {
          if (response.success) {
            const students = response.data;
            const uniqueGroups = [
              ...new Set(
                students
                  .filter((s: any) => s.rutbe === 'ogrenci' && s.grubu)
                  .map((s: any) => s.grubu)
              ),
            ];
            this.groups = uniqueGroups as string[];
          }
        },
        error: (error) => {
          console.error('Gruplar yüklenirken hata:', error);
        },
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
    this.http
      .get<any>('./server/api/ogrenciler_listesi.php', {
        headers: this.getAuthHeaders(),
      })
      .subscribe({
        next: (response) => {
          if (response.success) {
            this.groupStudents = response.data.filter(
              (student: any) =>
                student.rutbe === 'ogrenci' &&
                student.grubu === this.selectedGroup
            );
          }
        },
        error: (error) => {
          console.error('Grup öğrencileri yüklenirken hata:', error);
        },
      });
  }

  loadClassroomStatus(): void {
    if (!this.selectedGroup) return;

    this.http
      .get<any>(`./server/api/sinif_durumu.php`, {
        headers: this.getAuthHeaders(),
        params: {
          grup: this.selectedGroup,
          tarih: this.selectedDate,
        },
      })
      .subscribe({
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
                exit_time: entry.exit_time
                  ? new Date(entry.exit_time)
                  : undefined,
                is_present: entry.is_present,
                qr_method: entry.qr_method,
              });
            });
          }
        },
        error: (error) => {
          console.error('Sınıf durumu yüklenirken hata:', error);
        },
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
        this.toastr.error('Bu cihazda kamera desteği bulunmuyor', 'Hata');
        return;
      }

      // Kamera izinlerini kontrol et (tarayıcı desteği varsa)
      try {
        if ('permissions' in navigator && 'query' in navigator.permissions) {
          const permission = await navigator.permissions.query({
            name: 'camera' as PermissionName,
          });
          if (permission.state === 'denied') {
            this.toastr.error(
              'Kamera erişimi reddedildi. Lütfen tarayıcı ayarlarından kamera iznini açın.',
              'Kamera İzni'
            );
            return;
          }
        }
      } catch (permissionError) {
        console.log(
          'Permission API desteklenmiyor, direkt kamera erişimi denenecek'
        );
      }

      // Kamera akışını başlat - önce arka kamera denenir
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });

      this.isQRScannerActive = true;
      this.toastr.success('QR kod tarayıcı başlatıldı', 'Başarılı');

      // Video elementini hazırla ve QR kod tespitini başlat
      setTimeout(() => {
        if (this.videoElement) {
          this.videoElement.nativeElement.srcObject = this.mediaStream;
          this.videoElement.nativeElement.play();
          this.startQRCodeDetection();
        }
      }, 100);
    } catch (error: any) {
      console.error('Kamera erişim hatası:', error);
      let errorMessage = 'Kameraya erişim sağlanamadı';

      if (error.name === 'NotAllowedError') {
        errorMessage = 'Kamera izni verilmedi';
      } else if (error.name === 'NotFoundError') {
        errorMessage = 'Bu cihazda kamera bulunamadı';
      } else if (error.name === 'NotReadableError') {
        errorMessage = 'Kamera başka bir uygulama tarafından kullanılıyor';
      } else if (error.name === 'SecurityError') {
        errorMessage = 'Güvenlik nedeniyle erişim engellendi';
      }

      this.toastr.error(errorMessage, 'Kamera Hatası');
    }
  }

  stopQRScanner(): void {
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
      this.scanInterval = null;
    }
    this.isQRScannerActive = false;
    
    // QR kod geçmişini temizle
    this.recentlyProcessedQR.clear();
    
    this.toastr.info('QR kod tarayıcı durduruldu', 'Bilgi');
  }

  private startQRCodeDetection(): void {
    // QR kod tespit simülasyonu - gerçek implementasyonda jsQR kütüphanesi kullanılır
    this.scanInterval = setInterval(() => {
      this.detectQRCode();
    }, 200);
  }

  private detectQRCode(): void {
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
        this.processQRCodeForClassroom(qrCode.data);
      }
    } catch (error) {
      console.error('QR kod okuma hatası:', error);
    }
  }

  private generateMockQRData(): string | null {
    // Mock fonksiyon devre dışı - sadece gerçek QR kod okuma aktif
    return null;
  }

  private processQRCodeForClassroom(qrData: string): void {
    console.log('QR Kod okundu:', qrData);

    // Aynı QR kodun son 3 saniye içinde işlenip işlenmediğini kontrol et
    const now = Date.now();
    const lastProcessed = this.recentlyProcessedQR.get(qrData);
    
    if (lastProcessed && (now - lastProcessed) < 3000) {
      console.log('QR kod son 3 saniye içinde işlendi, tekrar işlenmeyecek:', qrData);
      return;
    }

    // Bu QR kodun işlendiğini kaydet
    this.recentlyProcessedQR.set(qrData, now);

    // QR kod formatını parse et: studentId_action_timestamp
    const parts = qrData.split('_');
    if (parts.length !== 3) {
      this.toastr.error(
        'Geçersiz QR kod formatı. Beklenen format: id_action_timestamp',
        'Hata'
      );
      console.error('QR Kod parse hatası:', { qrData, parts });
      return;
    }

    const studentId = parseInt(parts[0]);
    const action = parts[1]; // 'entry' veya 'exit'
    const timestamp = parseInt(parts[2]);

    // Timestamp kontrolü (5 dakika geçerlilik)
    const currentTime = Date.now();
    const timeDiff = Math.abs(currentTime - timestamp);
    const fiveMinutes = 5 * 60 * 1000; // 5 dakika milisaniye cinsinden

    if (timeDiff > fiveMinutes) {
      this.toastr.error('QR kod süresi dolmuş. Yeni kod oluşturunuz.', 'Hata');
      return;
    }

    // Action kontrolü
    if (action !== 'entry' && action !== 'exit') {
      this.toastr.error('Geçersiz QR kod aksiyon türü', 'Hata');
      return;
    }

    // Öğrenciyi bul
    const student = this.groupStudents.find((s) => s.id === studentId);
    if (!student) {
      this.toastr.error(
        `Öğrenci (ID: ${studentId}) bu grupta bulunamadı`,
        'Hata'
      );
      console.error('Öğrenci bulunamadı:', {
        studentId,
        grupStudents: this.groupStudents,
      });
      return;
    }

    console.log('QR Kod işlemi başlatılıyor:', {
      studentId,
      action,
      studentName: student.adi_soyadi,
    });
    this.recordClassroomActivity(studentId, action);

    // QR kod başarıyla işlendi, tarayıcıyı durdur
    //this.stopQRScanner(); //QR kapatılmaması için yorum satırına aldım
  }

  recordClassroomActivity(studentId: number, action: string): void {
    const student = this.groupStudents.find((s) => s.id === studentId);
    if (!student) {
      this.toastr.error('Öğrenci bulunamadı', 'Hata');
      return;
    }

    // QR kod başarıyla okundu mesajı
    this.toastr.info(
      `QR Kod okundu: ${student.adi_soyadi} - ${
        action === 'entry' ? 'Giriş' : 'Çıkış'
      }`,
      'QR Kod Başarılı'
    );

    const currentTime = new Date();

    const classroomData = {
      student_id: studentId,
      grup: this.selectedGroup,
      action: action,
      tarih: currentTime.toISOString().split('T')[0], // YYYY-MM-DD formatı
      zaman: currentTime.toISOString(),
    };

    console.log('Sunucuya gönderilen veri:', classroomData);

    this.http
      .post('./server/api/sinif_giris_cikis.php', classroomData, {
        headers: this.getAuthHeaders(),
      })
      .subscribe({
        next: (response: any) => {
          console.log('Sunucu yanıtı:', response);
          if (response.success) {
            if (action === 'entry') {
              this.presentStudents.add(studentId);
              this.classroomEntries.set(studentId, {
                student_id: studentId,
                entry_time: currentTime,
                is_present: true,
                qr_method: 'entry',
              });
              this.toastr.success(
                `${
                  student.adi_soyadi
                } sınıfa giriş yaptı! (${currentTime.toLocaleTimeString()})`,
                'Giriş Kaydedildi'
              );
              // Sesli uyarı ekle
              this.speakMessage(`${student.adi_soyadi}, iyi dersler!`);
            } else {
              this.presentStudents.delete(studentId);
              const existingEntry = this.classroomEntries.get(studentId);
              if (existingEntry) {
                existingEntry.exit_time = currentTime;
                existingEntry.is_present = false;
                existingEntry.qr_method = 'exit';
              }
              this.toastr.info(
                `${
                  student.adi_soyadi
                } sınıftan çıkış yaptı! (${currentTime.toLocaleTimeString()})`,
                'Çıkış Kaydedildi'
              );
              // Sesli uyarı ekle
              this.speakMessage(`${student.adi_soyadi}, iyi günler!`);
            }
            // Başarılı işlem sonrası kamerayı kapat
            //this.stopQRScanner();//QR kapatılmaması için yorum satırına aldım
          } else {
            this.toastr.error(
              'İşlem kaydedilemedi: ' + response.message,
              'Hata'
            );
            this.speakMessage('İşlem başarısız!');
          }
        },
        error: (error) => {
          console.error('QR işlem hatası:', error);
          const errorMessage =
            error.error?.error ||
            error.error?.message ||
            error.message ||
            'Bilinmeyen hata';
          this.toastr.error('QR işlem hatası: ' + errorMessage, 'Hata');
          this.speakMessage('Bağlantı hatası!');
        },
      });
  }

  manualToggleStudentPresence(studentId: number): void {
    const student = this.groupStudents.find((s) => s.id === studentId);
    if (!student) return;

    const isPresent = this.presentStudents.has(studentId);
    const action = isPresent ? 'exit' : 'entry';

    // Manuel işlem mesajı
    const actionText = action === 'entry' ? 'giriş' : 'çıkış';
    this.toastr.info(
      `${student.adi_soyadi} manuel ${actionText} işlemi`,
      'Manuel İşlem'
    );

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
    return Math.round(
      (this.getPresentCount() / this.groupStudents.length) * 100
    );
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
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(
      studentName
    )}&background=4f46e5&color=fff&size=50&font-size=0.6&rounded=true`;
  }

  exportClassroomReport(): void {
    const presentList = this.groupStudents
      .filter((student) => this.isStudentPresent(student.id))
      .map((student) => {
        const entry = this.classroomEntries.get(student.id);
        return {
          name: student.adi_soyadi,
          entryTime: entry?.entry_time?.toLocaleTimeString(),
          exitTime: entry?.exit_time?.toLocaleTimeString() || 'Hala sınıfta',
        };
      });

    console.log('Sınıf raporu:', presentList);
    alert(
      `Sınıf raporu konsola yazdırıldı. Bulunan ${presentList.length} öğrenci.`
    );
  }

  private getAuthHeaders(): HttpHeaders {
    let token = '';
    const userStr =
      localStorage.getItem('user') || sessionStorage.getItem('user');
    if (userStr) {
      const user = JSON.parse(userStr);
      token = user.token || '';
    }

    return new HttpHeaders({
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    });
  }

  processQRData(data: string): void {
    try {
      // QR kod formatı: studentId_action_timestamp
      const parts = data.split('_');

      if (parts.length !== 3) {
        console.error('Geçersiz QR kod formatı:', data);
        return;
      }

      const studentId = parseInt(parts[0]);
      const action = parts[1]; // 'entry' veya 'exit'
      const timestamp = parseInt(parts[2]);

      // Öğrenci bilgisini bul
      const student = this.groupStudents.find((s) => s.id === studentId);
      if (!student) {
        console.error('Öğrenci bulunamadı:', studentId);
        return;
      }

      // API'ye gönder
      this.recordClassroomActivity(studentId, action);
    } catch (error) {
      console.error('QR kod işlenirken hata:', error);
    }
  }

  // Sesli mesaj çalma fonksiyonu
  private playVoiceMessage(message: string): void {
    console.log('Sesli mesaj çalınacak:', message);
    this.speakMessage(message);
  }

  private speakMessage(message: string): void {
    if ('speechSynthesis' in window) {
      // Önceki konuşmaları durdur
      speechSynthesis.cancel();

      // Seslerin yüklenmesini bekle
      const speakWhenReady = () => {
        const utterance = new SpeechSynthesisUtterance(message);

        // Türkçe ses ayarları
        utterance.lang = 'tr-TR';
        utterance.rate = 0.9; // Konuşma hızı
        utterance.pitch = 1.0; // Ses tonu
        utterance.volume = 1.0; // Ses seviyesi

        // Mevcut sesleri al
        const voices = speechSynthesis.getVoices();
        console.log(
          'Mevcut sesler:',
          voices.map((v) => `${v.name} (${v.lang})`)
        );

        // Türkçe ses ara
        const turkishVoice = voices.find(
          (voice) =>
            voice.lang.toLowerCase().includes('tr') ||
            voice.name.toLowerCase().includes('turkish') ||
            voice.name.toLowerCase().includes('türk')
        );

        if (turkishVoice) {
          utterance.voice = turkishVoice;
          console.log('Türkçe ses bulundu:', turkishVoice.name);
        } else {
          console.log('Türkçe ses bulunamadı, varsayılan ses kullanılıyor');
        }

        // Ses çalma olaylarını dinle
        utterance.onstart = () => console.log('Ses çalmaya başladı');
        utterance.onend = () => console.log('Ses çalma tamamlandı');
        utterance.onerror = (event) =>
          console.error('Ses hatası:', event.error);

        speechSynthesis.speak(utterance);
      };

      // Sesler henüz yüklenmediyse bekle
      const voices = speechSynthesis.getVoices();
      if (voices.length === 0) {
        speechSynthesis.addEventListener('voiceschanged', speakWhenReady, {
          once: true,
        });
      } else {
        speakWhenReady();
      }
    } else {
      console.error('Bu tarayıcı Text-to-Speech desteklemiyor');
    }
  }

  // Test için ses çalma fonksiyonu
  testSpeech(): void {
    this.speakMessage('Test mesajı. Ses çalışıyor mu?');
  }

  // Eski QR kod kayıtlarını temizle (5 saniyeden eski olanları)
  private cleanupOldQRRecords(): void {
    const now = Date.now();
    const maxAge = 5000; // 5 saniye

    for (const [qrData, timestamp] of this.recentlyProcessedQR.entries()) {
      if (now - timestamp > maxAge) {
        this.recentlyProcessedQR.delete(qrData);
      }
    }
  }
}