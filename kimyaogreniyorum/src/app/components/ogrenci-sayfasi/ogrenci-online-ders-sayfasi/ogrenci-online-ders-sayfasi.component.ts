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
    if (!this.canvasElement) {
      console.log('❌ Canvas element bulunamadı, 1 saniye sonra tekrar deniyor...');
      setTimeout(() => this.initializeCanvas(), 1000);
      return;
    }

    const canvasEl = this.canvasElement.nativeElement;
    const container = canvasEl.parentElement;

    if (!container) {
      console.log('❌ Canvas container bulunamadı');
      return;
    }

    const width = container.clientWidth - 40;
    const height = Math.min(width * 0.75, 700);

    if (width <= 0 || height <= 0) {
      console.log('❌ Canvas boyutu geçersiz, 1 saniye sonra tekrar deniyor...');
      setTimeout(() => this.initializeCanvas(), 1000);
      return;
    }

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

    console.log('✅ ÖĞRENCİ Canvas başlatıldı - Boyut:', width, 'x', height);
  }

  private loadAvailableLessons(): void {
    const token = this.getAuthToken();

    console.log('🔍 ÖĞRENCİ: Ders listesi yükleniyor...');
    console.log('👤 Öğrenci grubu:', this.studentInfo?.grubu);

    this.http.get<any>('/server/api/online_lesson_session.php?action=get_available_lessons', {
      headers: { Authorization: `Bearer ${token}` }
    }).subscribe({
      next: (response) => {
        console.log('📥 ÖĞRENCİ: Sunucudan gelen ders listesi:', response);
        
        if (response.success && response.lessons) {
          console.log('📚 Tüm aktif dersler:', response.lessons);
          
          // Grup adı eşleştirmesini daha esnek hale getir
          const studentGroup = this.studentInfo?.grubu?.toString().trim();
          console.log('👥 Aranan grup (öğrenci):', studentGroup);
          
          this.availableLessons = response.lessons.filter((lesson: any) => {
            const lessonGroup = lesson.group_name?.toString().trim();
            console.log('🎯 Ders grubu:', lessonGroup, '- Öğrenci grubu:', studentGroup);
            
            const isMatch = lessonGroup === studentGroup;
            console.log('✅ Grup eşleşti mi?', isMatch);
            
            return isMatch;
          }).map((lesson: any) => ({
            id: lesson.id,
            teacher_name: lesson.teacher_name,
            lesson_title: lesson.lesson_title,
            lesson_subject: lesson.lesson_subject,
            group_name: lesson.group_name,
            created_at: new Date(lesson.created_at)
          }));
          
          console.log('📋 Filtrelenmiş ders listesi:', this.availableLessons);
          console.log('🔢 Bulunan ders sayısı:', this.availableLessons.length);
        } else {
          console.log('❌ Sunucu success: false döndü veya lessons yok');
          this.availableLessons = [];
        }
      },
      error: (error) => {
        console.error('❌ Ders listesi yükleme hatası:', error);
        this.availableLessons = [];
      }
    });
  }

  private startLessonPolling(): void {
    this.lessonUpdateInterval = setInterval(() => {
      this.loadAvailableLessons();
    }, 5000); // Her 5 saniyede bir ders listesi güncelle
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
    console.log('🚀 ÖĞRENCİ: Canvas güncelleme başlatılıyor...');
    console.log('📋 ÖĞRENCİ: Mevcut ders:', this.currentLesson?.lesson_title);
    console.log('👥 ÖĞRENCİ: Grup:', this.currentLesson?.group_name);
    console.log('🎨 ÖĞRENCİ: Canvas hazır mı?', !!this.canvas);
    
    // Canvas hazır değilse bekle
    if (!this.canvas) {
      console.log('⏳ ÖĞRENCİ: Canvas hazır değil, 2 saniye bekliyor...');
      setTimeout(() => {
        if (this.canvas && this.isJoined && this.currentLesson) {
          this.startCanvasUpdates();
        } else {
          console.log('❌ ÖĞRENCİ: Canvas hala hazır değil veya ders bitmiş');
        }
      }, 2000);
      return;
    }
    
    // İlk güncellemeyi hemen yap
    setTimeout(() => {
      this.updateCanvas();
    }, 500);
    
    // Mevcut interval'ı temizle
    if (this.canvasUpdateInterval) {
      clearInterval(this.canvasUpdateInterval);
    }
    
    this.canvasUpdateInterval = setInterval(() => {
      if (this.isJoined && this.currentLesson && this.canvas) {
        this.updateCanvas();
      } else {
        console.log('❌ ÖĞRENCİ: Canvas güncelleme durdu - isJoined:', this.isJoined, 'currentLesson:', !!this.currentLesson, 'canvas:', !!this.canvas);
        if (this.canvasUpdateInterval) {
          clearInterval(this.canvasUpdateInterval);
          this.canvasUpdateInterval = null;
        }
      }
    }, 1000); // 1 saniyede bir güncelle - daha stabil
  }

  private startChatUpdates(): void {
    this.chatUpdateInterval = setInterval(() => {
      if (this.isJoined && this.currentLesson) {
        this.loadChatMessages();
      }
    }, 1000); // Her 1 saniyede chat güncelle
  }

  private updateCanvas(): void {
    // Güvenli kontroller
    if (!this.canvas) {
      console.log('❌ updateCanvas: Canvas henüz hazır değil - bekliyor...');
      return;
    }
    
    if (!this.currentLesson) {
      console.log('❌ updateCanvas: CurrentLesson yok - ders seçilmemiş');
      // Canvas güncellemesi durdur
      if (this.canvasUpdateInterval) {
        clearInterval(this.canvasUpdateInterval);
        this.canvasUpdateInterval = null;
      }
      return;
    }
    
    if (!this.isJoined) {
      console.log('❌ updateCanvas: Derse katılmamış durumda');
      return;
    }

    const token = this.getAuthToken();
    const url = `/server/api/online_lesson_session.php?action=get_canvas&group=${encodeURIComponent(this.currentLesson.group_name)}&t=${Date.now()}`;
    
    console.log('🔄 ÖĞRENCİ: Canvas güncelleme isteği gönderiliyor:', url);
    console.log('👥 Grup adı:', this.currentLesson.group_name);

    this.http.get(url, {
      headers: { 
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    }).subscribe({
      next: (response: any) => {
        console.log('📥 ÖĞRENCİ: Sunucudan gelen canvas yanıtı:', response);
        
        if (response.success) {
          if (response.canvas_data && response.canvas_data !== 'null' && response.canvas_data !== null && response.canvas_data.trim() !== '') {
            console.log('✅ ÖĞRENCİ: Canvas verisi mevcut');
            console.log('📏 Canvas veri uzunluğu:', response.canvas_data.length);
            console.log('👨‍🏫 Öğretmen:', response.teacher_name);
            console.log('⏰ Son güncelleme:', response.last_updated);
            
            try {
              const canvasData = JSON.parse(response.canvas_data);
              console.log('📊 ÖĞRENCİ: Parse edilen canvas verisi:', canvasData);
              console.log('🎨 Canvas objelerinde toplam item sayısı:', canvasData.objects ? canvasData.objects.length : 0);

              // Canvas'ı tamamen temizle ve yeniden yükle
              this.canvas.clear();
              
              // Background color'ı ayarla
              if (canvasData.background) {
                this.canvas.backgroundColor = canvasData.background;
              }

              this.canvas.loadFromJSON(canvasData, () => {
                // Canvas objelerini sadece görüntüleme modunda tut
                this.canvas.forEachObject((obj) => {
                  obj.selectable = false;
                  obj.evented = false;
                  obj.hoverCursor = 'default';
                  obj.moveCursor = 'default';
                });

                // Background image da varsa onu da görüntüleme modunda tut
                if (this.canvas.backgroundImage) {
                  this.canvas.backgroundImage.selectable = false;
                  this.canvas.backgroundImage.evented = false;
                }

                // Force render
                this.canvas.renderAll();
                
                console.log('✅ ÖĞRENCİ: CANVAS GÜNCELLENDİ - Yüklenen obje sayısı:', this.canvas.getObjects().length);
                console.log('🖼️ ÖĞRENCİ: Background image var mı?', !!this.canvas.backgroundImage);
              });
            } catch (error) {
              console.error('❌ ÖĞRENCİ: Canvas verisi parse edilemedi:', error);
              console.error('❌ ÖĞRENCİ: Hatalı veri:', response.canvas_data.substring(0, 200), '...');
            }
          } else {
            console.log('🧹 ÖĞRENCİ: Canvas verisi boş veya null - Canvas temizleniyor');
            this.canvas.clear();
            this.canvas.backgroundColor = '#ffffff';
            this.canvas.renderAll();
          }
        } else {
          console.error('❌ ÖĞRENCİ: Sunucu success: false döndü:', response);
        }
      },
      error: (error) => {
        console.error('❌ ÖĞRENCİ: Canvas güncelleme HTTP hatası:', error);
        console.error('❌ ÖĞRENCİ: Hata detayları:', error.error);
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
            sender_name: m.sender_name || 'Anonim',
            sender_type: m.sender_type || 'student',
            message: m.message,
            timestamp: new Date(m.timestamp)
          }));

          // Chat container'ı en alta kaydır
          setTimeout(() => {
            const chatContainer = document.querySelector('.chat-messages');
            if (chatContainer) {
              chatContainer.scrollTop = chatContainer.scrollHeight;
            }
          }, 100);
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