
import { Component, OnInit, AfterViewInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import * as fabric from 'fabric';
import { HttpClient } from '@angular/common/http';
import { ToastrService } from 'ngx-toastr';

interface OnlineLesson {
  id: number;
  teacher_name: string;
  lesson_title: string;
  lesson_subject: string;
  group_name: string;
  created_at: Date;
}

interface ChatMessage {
  id: number;
  sender_name: string;
  sender_type: string;
  message: string;
  timestamp: Date;
}

@Component({
  selector: 'app-ogrenci-online-ders-sayfasi',
  standalone: false,
  templateUrl: './ogrenci-online-ders-sayfasi.component.html',
  styleUrl: './ogrenci-online-ders-sayfasi.component.scss'
})
export class OgrenciOnlineDersSayfasiComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('studentCanvas', { static: false }) canvasElement!: ElementRef<HTMLCanvasElement>;

  // Canvas özellikleri
  canvas!: fabric.Canvas;
  
  // Ders bilgileri
  availableLessons: OnlineLesson[] = [];
  currentLesson: OnlineLesson | null = null;
  isJoined: boolean = false;
  
  // Chat
  chatMessages: ChatMessage[] = [];
  newChatMessage: string = '';
  
  // Öğrenci bilgileri
  studentInfo: any = null;
  
  // Interval referansları
  private lessonUpdateInterval: any;
  private canvasUpdateInterval: any;
  private chatUpdateInterval: any;

  get getCurrentTime(): string {
    return new Date().toLocaleTimeString('tr-TR');
  }

  constructor(
    private http: HttpClient,
    private toastr: ToastrService
  ) {}

  ngOnInit(): void {
    this.loadStudentInfo();
    this.loadAvailableLessons();
    this.startLessonPolling();
  }

  ngAfterViewInit(): void {
    setTimeout(() => {
      this.initializeCanvas();
    }, 500);
  }

  ngOnDestroy(): void {
    this.leaveLesson();
    this.clearIntervals();
    if (this.canvas) {
      this.canvas.dispose();
    }
  }

  private clearIntervals(): void {
    if (this.lessonUpdateInterval) clearInterval(this.lessonUpdateInterval);
    if (this.canvasUpdateInterval) clearInterval(this.canvasUpdateInterval);
    if (this.chatUpdateInterval) clearInterval(this.chatUpdateInterval);
  }

  private loadStudentInfo(): void {
    const userStr = localStorage.getItem('user') || sessionStorage.getItem('user');
    if (userStr) {
      this.studentInfo = JSON.parse(userStr);
    }
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
        isDrawingMode: false,
        selection: false,
        width: width,
        height: height,
        backgroundColor: '#ffffff'
      });

      // Öğrenci canvas'ı sadece görüntüleme amaçlı
      this.canvas.forEachObject((obj) => {
        obj.selectable = false;
        obj.evented = false;
      });
    }
  }

  private loadAvailableLessons(): void {
    const token = this.getAuthToken();
    
    this.http.get<any>('/server/api/online_lesson_session.php?action=get_available_lessons', {
      headers: { Authorization: `Bearer ${token}` }
    }).subscribe({
      next: (response) => {
        if (response.success && response.lessons) {
          this.availableLessons = response.lessons.filter((lesson: any) => 
            lesson.group_name === this.studentInfo?.grubu
          ).map((lesson: any) => ({
            id: lesson.id,
            teacher_name: lesson.teacher_name,
            lesson_title: lesson.lesson_title,
            lesson_subject: lesson.lesson_subject,
            group_name: lesson.group_name,
            created_at: new Date(lesson.created_at)
          }));
        }
      },
      error: (error) => {
        console.error('Ders listesi yükleme hatası:', error);
      }
    });
  }

  private startLessonPolling(): void {
    this.lessonUpdateInterval = setInterval(() => {
      this.loadAvailableLessons();
      if (this.isJoined && this.currentLesson) {
        this.updateCanvas();
        this.loadChatMessages();
      }
    }, 3000); // Her 3 saniyede bir güncelle
  }

  joinLesson(lesson: OnlineLesson): void {
    const token = this.getAuthToken();
    const joinData = {
      action: 'student_join',
      student_id: this.studentInfo?.id,
      student_name: this.studentInfo?.adi_soyadi,
      group: lesson.group_name
    };

    this.http.post('/server/api/online_lesson_session.php', joinData, {
      headers: { Authorization: `Bearer ${token}` }
    }).subscribe({
      next: (response: any) => {
        if (response.success) {
          this.currentLesson = lesson;
          this.isJoined = true;
          this.startCanvasUpdates();
          this.startChatUpdates();
          this.toastr.success('Derse katıldınız!', 'Başarılı');
        }
      },
      error: (error) => {
        console.error('Derse katılım hatası:', error);
        this.toastr.error('Derse katılamadı!', 'Hata');
      }
    });
  }

  leaveLesson(): void {
    if (!this.isJoined || !this.currentLesson) return;

    const token = this.getAuthToken();
    const leaveData = {
      action: 'student_leave',
      student_id: this.studentInfo?.id,
      group: this.currentLesson.group_name
    };

    this.http.post('/server/api/online_lesson_session.php', leaveData, {
      headers: { Authorization: `Bearer ${token}` }
    }).subscribe({
      next: (response: any) => {
        this.currentLesson = null;
        this.isJoined = false;
        this.chatMessages = [];
        this.clearCanvas();
        this.toastr.info('Dersten ayrıldınız.', 'Bilgi');
      },
      error: (error) => {
        console.error('Dersten ayrılma hatası:', error);
      }
    });
  }

  private startCanvasUpdates(): void {
    this.canvasUpdateInterval = setInterval(() => {
      if (this.isJoined && this.currentLesson) {
        this.updateCanvas();
      }
    }, 2000); // Her 2 saniyede canvas güncelle
  }

  private startChatUpdates(): void {
    this.chatUpdateInterval = setInterval(() => {
      if (this.isJoined && this.currentLesson) {
        this.loadChatMessages();
      }
    }, 2000); // Her 2 saniyede chat güncelle
  }

  private updateCanvas(): void {
    if (!this.canvas || !this.currentLesson) return;

    const token = this.getAuthToken();
    
    this.http.get(`/server/api/online_lesson_session.php?action=get_canvas&group=${this.currentLesson.group_name}`, {
      headers: { Authorization: `Bearer ${token}` }
    }).subscribe({
      next: (response: any) => {
        if (response.success && response.canvas_data) {
          try {
            const canvasData = JSON.parse(response.canvas_data);
            this.canvas.loadFromJSON(canvasData, () => {
              this.canvas.renderAll();
              // Canvas objelerini sadece görüntüleme modunda tut
              this.canvas.forEachObject((obj) => {
                obj.selectable = false;
                obj.evented = false;
              });
            });
          } catch (error) {
            console.error('Canvas verisi parse edilemedi:', error);
          }
        }
      },
      error: (error) => {
        console.error('Canvas güncelleme hatası:', error);
      }
    });
  }

  private clearCanvas(): void {
    if (this.canvas) {
      this.canvas.clear();
      this.canvas.backgroundColor = '#ffffff';
      this.canvas.renderAll();
    }
  }

  sendChatMessage(): void {
    if (!this.newChatMessage.trim() || !this.isJoined || !this.currentLesson) return;

    const token = this.getAuthToken();
    const messageData = {
      action: 'send_message',
      student_id: this.studentInfo?.id,
      student_name: this.studentInfo?.adi_soyadi,
      group: this.currentLesson.group_name,
      message: this.newChatMessage,
      sender_type: 'student'
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
        this.toastr.error('Mesaj gönderilemedi!', 'Hata');
      }
    });
  }

  private loadChatMessages(): void {
    if (!this.currentLesson) return;

    const token = this.getAuthToken();

    this.http.get(`/server/api/online_lesson_session.php?action=get_messages&group=${this.currentLesson.group_name}`, {
      headers: { Authorization: `Bearer ${token}` }
    }).subscribe({
      next: (response: any) => {
        if (response.success && response.messages) {
          this.chatMessages = response.messages.map((m: any) => ({
            id: m.id,
            sender_name: m.sender_name,
            sender_type: m.sender_type,
            message: m.message,
            timestamp: new Date(m.timestamp)
          }));
        }
      },
      error: (error) => {
        console.error('Mesaj yükleme hatası:', error);
      }
    });
  }

  formatTime(date: Date): string {
    return date.toLocaleTimeString('tr-TR', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  }
}
