import { Component, OnInit, AfterViewInit, OnDestroy, HostListener, ViewChild, ElementRef } from '@angular/core';
import * as fabric from 'fabric';
import { HttpClient } from '@angular/common/http';
import { jsPDF } from 'jspdf';
import * as pdfjsLib from 'pdfjs-dist';
import { ToastrService } from 'ngx-toastr';

interface OnlineStudent {
  id: number;
  name: string;
  isOnline: boolean;
  joinTime: Date;
  lastSeen: Date;
}

interface ChatMessage {
  id: number;
  studentId: number;
  studentName: string;
  message: string;
  timestamp: Date;
  isRead: boolean;
}

@Component({
  selector: 'app-ogretmen-online-ders-sayfasi',
  standalone: false,
  templateUrl: './ogretmen-online-ders-sayfasi.component.html',
  styleUrl: './ogretmen-online-ders-sayfasi.component.scss'
})
export class OgretmenOnlineDersSayfasiComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('onlineCanvas', { static: false }) canvasElement!: ElementRef<HTMLCanvasElement>;

  // Canvas ve çizim özellikleri
  canvas!: fabric.Canvas;
  isDrawingMode: boolean = true;
  penColor: string = '#000000';
  penWidth: number = 4;
  eraserMode: boolean = false;
  highlighterMode: boolean = false;
  textMode: boolean = false;

  // PDF özellikleri
  loadedPdf: any = null;
  pdfPages: number = 0;
  currentPdfPage: number = 1;
  pdfLoading: boolean = false;

  // Online ders özellikleri
  selectedGroup: string = '';
  lessonTitle: string = '';
  lessonSubject: string = '';
  isLessonActive: boolean = false;
  studentGroups: string[] = [];

  get getCurrentTime(): string {
    return new Date().toLocaleTimeString('tr-TR');
  }

  onlineStudents: OnlineStudent[] = [];
  chatMessages: ChatMessage[] = [];
  newChatMessage: string = '';

  // Ses ve görüntü
  isAudioEnabled: boolean = false;
  isVideoEnabled: boolean = false;
  mediaStream: MediaStream | null = null;

  // Öğretmen bilgileri
  teacherInfo: any = null;

  // Interval referansları
  private heartbeatInterval: any;
  private studentUpdateInterval: any;
  private canvasUpdateInterval: any;

  constructor(
    private http: HttpClient,
    private toastr: ToastrService
  ) {
    // PDF.js worker setup
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;
  }

  ngOnInit(): void {
    this.loadTeacherInfo();
    this.loadStudentGroups();
  }

  ngAfterViewInit(): void {
    setTimeout(() => {
      this.initializeCanvas();
    }, 500);
  }

  ngOnDestroy(): void {
    this.stopLesson();
    if (this.canvas) {
      this.canvas.dispose();
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
    }
    this.clearIntervals();
  }

  private clearIntervals(): void {
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
    if (this.studentUpdateInterval) clearInterval(this.studentUpdateInterval);
    if (this.canvasUpdateInterval) clearInterval(this.canvasUpdateInterval);
  }

  private loadTeacherInfo(): void {
    const userStr = localStorage.getItem('user') || sessionStorage.getItem('user');
    if (userStr) {
      this.teacherInfo = JSON.parse(userStr);
    }
  }

  private loadStudentGroups(): void {
    const token = this.getAuthToken();

    this.http.get<any>('/server/api/ogrenciler_listesi.php', {
      headers: { Authorization: `Bearer ${token}` }
    }).subscribe({
      next: (response) => {
        if (response && response.success && response.data) {
          const teacherName = this.teacherInfo?.adi_soyadi || '';
          const teacherStudents = response.data.filter(
            (student: any) => student.rutbe === 'ogrenci' && student.ogretmeni === teacherName
          );

          const groups = new Set<string>();
          teacherStudents.forEach((student: any) => {
            if (student.grubu && student.grubu.trim() !== '') {
              groups.add(student.grubu);
            }
          });

          this.studentGroups = Array.from(groups).sort();
        }
      },
      error: (error) => {
        console.error('Grup yükleme hatası:', error);
        this.toastr.error('Öğrenci grupları yüklenemedi', 'Hata');
      }
    });
  }

  private getAuthToken(): string {
    const userStr = localStorage.getItem('user') || sessionStorage.getItem('user');
    if (userStr) {
      const user = JSON.parse(userStr);
      return user.token || '';
    }
    return '';
  }

  private initializeCanvas(): void {
    if (!this.canvasElement) return;

    const canvasEl = this.canvasElement.nativeElement;
    const container = canvasEl.parentElement;

    if (container) {
      const width = container.clientWidth - 20;
      const height = Math.min(width * 0.7, 600);

      canvasEl.width = width;
      canvasEl.height = height;

      this.canvas = new fabric.Canvas(canvasEl, {
        isDrawingMode: true,
        width: width,
        height: height,
        backgroundColor: '#ffffff'
      });

      this.canvas.freeDrawingBrush = new fabric.PencilBrush(this.canvas);
      this.canvas.freeDrawingBrush.color = this.penColor;
      this.canvas.freeDrawingBrush.width = this.penWidth;

      // Canvas değişikliklerini dinle - daha kapsamlı event handling
      this.canvas.on('path:created', () => {
        if (this.isLessonActive) {
          console.log('Path created - broadcasting canvas update');
          this.broadcastCanvasUpdate();
        }
      });

      this.canvas.on('object:modified', () => {
        if (this.isLessonActive) {
          console.log('Object modified - broadcasting canvas update');
          this.broadcastCanvasUpdate();
        }
      });

      this.canvas.on('object:added', () => {
        if (this.isLessonActive) {
          console.log('Object added - broadcasting canvas update');
          this.broadcastCanvasUpdate();
        }
      });

      this.canvas.on('object:removed', () => {
        if (this.isLessonActive) {
          console.log('Object removed - broadcasting canvas update');
          this.broadcastCanvasUpdate();
        }
      });

      this.canvas.on('canvas:cleared', () => {
        if (this.isLessonActive) {
          console.log('Canvas cleared - broadcasting canvas update');
          this.broadcastCanvasUpdate();
        }
      });
    }
  }

  // PDF İşlemleri
  loadPdf(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.pdfLoading = true;
      const file = input.files[0];

      if (file.type !== 'application/pdf') {
        this.toastr.error('Lütfen sadece PDF dosyası seçin!', 'Hata');
        this.pdfLoading = false;
        return;
      }

      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const arrayBuffer = e.target?.result as ArrayBuffer;
          const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;

          this.loadedPdf = pdf;
          this.pdfPages = pdf.numPages;
          this.currentPdfPage = 1;

          await this.renderPdfPage(1);
          this.toastr.success('PDF başarıyla yüklendi', 'Başarılı');
          this.pdfLoading = false;
        } catch (error) {
          console.error('PDF yükleme hatası:', error);
          this.toastr.error('PDF yüklenemedi!', 'Hata');
          this.pdfLoading = false;
        }
      };

      reader.readAsArrayBuffer(file);
      input.value = '';
    }
  }

  private async renderPdfPage(pageNumber: number): Promise<void> {
    if (!this.loadedPdf || !this.canvas) return;

    try {
      const page = await this.loadedPdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1 });

      const scale = Math.min(
        this.canvas.width! / viewport.width,
        this.canvas.height! / viewport.height
      ) * 0.9;

      const scaledViewport = page.getViewport({ scale });

      const tempCanvas = document.createElement('canvas');
      const tempContext = tempCanvas.getContext('2d')!;
      tempCanvas.width = scaledViewport.width;
      tempCanvas.height = scaledViewport.height;

      await page.render({
        canvasContext: tempContext,
        viewport: scaledViewport
      }).promise;

      const dataURL = tempCanvas.toDataURL();
      fabric.Image.fromURL(dataURL, {
        crossOrigin: 'anonymous'
      }, (img: fabric.Image) => {
        this.canvas.clear();
        this.canvas.backgroundImage = img;
        this.canvas.renderAll();

        if (this.isLessonActive) {
          console.log('PDF loaded - forcing canvas update');
          // PDF yüklemesinden sonra canvas'ı hemen güncelle
          setTimeout(() => {
            this.broadcastCanvasUpdate();
          }, 100);
        }
      });

      this.currentPdfPage = pageNumber;
    } catch (error) {
      console.error('PDF sayfa render hatası:', error);
      this.toastr.error('PDF sayfası yüklenemedi!', 'Hata');
    }
  }

  nextPdfPage(): void {
    if (this.currentPdfPage < this.pdfPages) {
      this.renderPdfPage(this.currentPdfPage + 1);
    }
  }

  previousPdfPage(): void {
    if (this.currentPdfPage > 1) {
      this.renderPdfPage(this.currentPdfPage - 1);
    }
  }

  // Çizim araçları
  setPenMode(): void {
    this.isDrawingMode = true;
    this.eraserMode = false;
    this.highlighterMode = false;
    this.textMode = false;

    if (this.canvas) {
      this.canvas.isDrawingMode = true;
      this.canvas.freeDrawingBrush = new fabric.PencilBrush(this.canvas);
      this.canvas.freeDrawingBrush.color = this.penColor;
      this.canvas.freeDrawingBrush.width = this.penWidth;
    }
  }

  setEraserMode(): void {
    this.eraserMode = !this.eraserMode;
    this.highlighterMode = false;
    this.textMode = false;
    this.isDrawingMode = true;

    if (this.canvas) {
      this.canvas.isDrawingMode = true;
      this.canvas.freeDrawingBrush = new fabric.PencilBrush(this.canvas);
      this.canvas.freeDrawingBrush.color = this.eraserMode ? '#ffffff' : this.penColor;
      this.canvas.freeDrawingBrush.width = this.eraserMode ? Math.max(20, this.penWidth) : this.penWidth;
    }
  }

  setHighlighterMode(): void {
    this.highlighterMode = !this.highlighterMode;
    this.eraserMode = false;
    this.textMode = false;
    this.isDrawingMode = true;

    if (this.canvas) {
      this.canvas.isDrawingMode = true;
      this.canvas.freeDrawingBrush = new fabric.PencilBrush(this.canvas);
      this.canvas.freeDrawingBrush.color = this.highlighterMode ? '#ffff0080' : this.penColor;
      this.canvas.freeDrawingBrush.width = this.highlighterMode ? 16 : this.penWidth;
    }
  }

  clearCanvas(): void {
    if (this.canvas) {
      this.canvas.clear();
      this.canvas.backgroundColor = '#ffffff';
      this.canvas.renderAll();

      if (this.isLessonActive) {
        console.log('Canvas cleared - forcing canvas update');
        setTimeout(() => {
          this.broadcastCanvasUpdate();
        }, 100);
      }
    }
  }

  // Ders yönetimi
  startLesson(): void {
    if (!this.selectedGroup || !this.lessonTitle) {
      this.toastr.warning('Lütfen grup seçin ve ders başlığı girin!', 'Uyarı');
      return;
    }

    this.isLessonActive = true;
    this.createLessonSession();
    this.startHeartbeat();
    this.loadOnlineStudents();

    this.toastr.success('Ders başlatıldı! Öğrenciler bağlanabilir.', 'Başarılı');
  }

  stopLesson(): void {
    this.isLessonActive = false;
    this.endLessonSession();
    this.clearIntervals();
    this.onlineStudents = [];

    this.toastr.info('Ders sonlandırıldı.', 'Bilgi');
  }

  private createLessonSession(): void {
    const token = this.getAuthToken();
    const sessionData = {
      action: 'create_session',
      teacher_id: this.teacherInfo?.id,
      teacher_name: this.teacherInfo?.adi_soyadi,
      group: this.selectedGroup,
      lesson_title: this.lessonTitle,
      lesson_subject: this.lessonSubject,
      canvas_data: this.canvas ? JSON.stringify(this.canvas.toJSON()) : null
    };

    this.http.post('/server/api/online_lesson_session.php', sessionData, {
      headers: { Authorization: `Bearer ${token}` }
    }).subscribe({
      next: (response: any) => {
        if (response.success) {
          console.log('Ders oturumu oluşturuldu');
        }
      },
      error: (error) => {
        console.error('Ders oturumu oluşturma hatası:', error);
      }
    });
  }

  private endLessonSession(): void {
    const token = this.getAuthToken();
    const sessionData = {
      action: 'end_session',
      teacher_id: this.teacherInfo?.id,
      group: this.selectedGroup
    };

    this.http.post('/server/api/online_lesson_session.php', sessionData, {
      headers: { Authorization: `Bearer ${token}` }
    }).subscribe({
      next: (response: any) => {
        if (response.success) {
          console.log('Ders oturumu sonlandırıldı');
        }
      },
      error: (error) => {
        console.error('Ders oturumu sonlandırma hatası:', error);
      }
    });
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      if (this.isLessonActive) {
        this.sendHeartbeat();
        this.loadOnlineStudents();
        this.loadChatMessages();
      }
    }, 1000); // Her 1 saniyede bir - daha hızlı

    // Ayrıca canvas'ı periyodik olarak da gönder
    this.canvasUpdateInterval = setInterval(() => {
      if (this.isLessonActive && this.canvas) {
        console.log('Periodic canvas update - broadcasting');
        this.broadcastCanvasUpdate();
      }
    }, 500); // Her 0.5 saniyede canvas güncelle
  }

  private sendHeartbeat(): void {
    const token = this.getAuthToken();
    const heartbeatData = {
      action: 'teacher_heartbeat',
      teacher_id: this.teacherInfo?.id,
      group: this.selectedGroup,
      canvas_data: this.canvas ? JSON.stringify(this.canvas.toJSON()) : null
    };

    this.http.post('/server/api/online_lesson_session.php', heartbeatData, {
      headers: { Authorization: `Bearer ${token}` }
    }).subscribe({
      next: (response: any) => {
        // Heartbeat başarılı
      },
      error: (error) => {
        console.error('Heartbeat hatası:', error);
      }
    });
  }

  private loadOnlineStudents(): void {
    const token = this.getAuthToken();

    this.http.get(`/server/api/online_lesson_session.php?action=get_students&group=${this.selectedGroup}`, {
      headers: { Authorization: `Bearer ${token}` }
    }).subscribe({
      next: (response: any) => {
        if (response.success && response.students) {
          this.onlineStudents = response.students.map((s: any) => ({
            id: s.id,
            name: s.name,
            isOnline: true,
            joinTime: new Date(s.join_time),
            lastSeen: new Date(s.last_seen)
          }));
        }
      },
      error: (error) => {
        console.error('Öğrenci listesi yükleme hatası:', error);
      }
    });
  }

  private broadcastCanvasUpdate(): void {
    if (!this.canvas || !this.isLessonActive) {
      console.log('❌ ÖĞRETMEN: broadcastCanvasUpdate: Canvas yok veya ders aktif değil');
      return;
    }

    const token = this.getAuthToken();
    const canvasJSON = this.canvas.toJSON();
    const canvasData = JSON.stringify(canvasJSON);
    
    console.log('📤 ÖĞRETMEN: Canvas güncelleme gönderiliyor...');
    console.log('🎨 ÖĞRETMEN: Canvas obje sayısı:', this.canvas.getObjects().length);
    console.log('📏 ÖĞRETMEN: Canvas veri uzunluğu:', canvasData.length);
    console.log('🖼️ ÖĞRETMEN: Background image var mı?', !!this.canvas.backgroundImage);
    console.log('👥 ÖĞRETMEN: Hedef grup:', this.selectedGroup);
    console.log('👨‍🏫 ÖĞRETMEN: Öğretmen ID:', this.teacherInfo?.id);

    const updateData = {
      action: 'update_canvas',
      teacher_id: this.teacherInfo?.id,
      group: this.selectedGroup,
      canvas_data: canvasData,
      timestamp: Date.now()
    };

    this.http.post('/server/api/online_lesson_session.php', updateData, {
      headers: { 
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    }).subscribe({
      next: (response: any) => {
        console.log('✅ ÖĞRETMEN: Canvas güncelleme başarılı:', response);
        
        // Test amaçlı - canvas verisinin gerçekten kaydedildiğini kontrol et
        setTimeout(() => {
          this.http.get(`/server/api/online_lesson_session.php?action=get_canvas&group=${encodeURIComponent(this.selectedGroup)}`, {
            headers: { Authorization: `Bearer ${token}` }
          }).subscribe({
            next: (testResponse: any) => {
              console.log('🔍 ÖĞRETMEN: Kaydedilen canvas verisi kontrolü:', {
                success: testResponse.success,
                hasData: !!testResponse.canvas_data,
                dataLength: testResponse.canvas_data ? testResponse.canvas_data.length : 0
              });
            }
          });
        }, 100);
      },
      error: (error) => {
        console.error('❌ ÖĞRETMEN: Canvas güncelleme hatası:', error);
        console.error('❌ ÖĞRETMEN: Hata detayı:', error.error);
      }
    });
  }

  // Chat işlemleri
  sendChatMessage(): void {
    if (!this.newChatMessage.trim() || !this.isLessonActive) return;

    const token = this.getAuthToken();
    const messageData = {
      action: 'send_message',
      teacher_id: this.teacherInfo?.id,
      teacher_name: this.teacherInfo?.adi_soyadi,
      group: this.selectedGroup,
      message: this.newChatMessage,
      sender_type: 'teacher'
    };

    this.http.post('/server/api/online_lesson_session.php', messageData, {
      headers: { Authorization: `Bearer ${token}` }
    }).subscribe({
      next: (response: any) => {
        if (response.success) {
          this.newChatMessage = '';
          this.loadChatMessages();
        }
      },
      error: (error) => {
        console.error('Mesaj gönderme hatası:', error);
      }
    });
  }

  private loadChatMessages(): void {
    const token = this.getAuthToken();

    this.http.get(`/server/api/online_lesson_session.php?action=get_messages&group=${this.selectedGroup}`, {
      headers: { Authorization: `Bearer ${token}` }
    }).subscribe({
      next: (response: any) => {
        if (response.success && response.messages) {
          this.chatMessages = response.messages.map((m: any) => ({
            id: m.id,
            studentId: m.sender_type === 'teacher' ? 0 : m.sender_id,
            studentName: m.sender_name,
            message: m.message,
            timestamp: new Date(m.timestamp),
            isRead: m.is_read || false
          }));
        }
      },
      error: (error) => {
        console.error('Mesaj yükleme hatası:', error);
      }
    });
  }

  @HostListener('window:beforeunload', ['$event'])
  beforeUnloadHandler(event: any): void {
    if (this.isLessonActive) {
      event.returnValue = 'Ders devam ediyor. Sayfadan ayrılmak istediğinize emin misiniz?';
    }
  }

  @HostListener('window:resize', ['$event'])
  onResize(): void {
    if (this.canvas) {
      setTimeout(() => {
        const container = this.canvasElement.nativeElement.parentElement;
        if (container) {
          const width = container.clientWidth - 20;
          const height = Math.min(width * 0.7, 600);

          this.canvas.setDimensions({
            width: width,
            height: height
          });
        }
      }, 100);
    }
  }
}