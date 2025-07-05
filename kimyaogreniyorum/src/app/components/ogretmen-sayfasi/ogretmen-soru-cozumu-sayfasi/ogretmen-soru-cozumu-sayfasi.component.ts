
import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';

interface SoruMesaj {
  id?: number;
  ogrenci_id: number;
  ogretmen_id?: number;
  mesaj_metni: string;
  resim_url?: string;
  gonderim_tarihi: string;
  gonderen_tip: 'ogrenci' | 'ogretmen';
  gonderen_adi: string;
  okundu: boolean;
  ogrenci_adi?: string; // Öğretmen görünümü için
}

interface Student {
  id: number;
  adi_soyadi: string;
  email: string;
  grubu?: string;
}

@Component({
  selector: 'app-ogretmen-soru-cozumu-sayfasi',
  standalone: false,
  templateUrl: './ogretmen-soru-cozumu-sayfasi.component.html',
  styleUrl: './ogretmen-soru-cozumu-sayfasi.component.scss'
})
export class OgretmenSoruCozumuSayfasiComponent implements OnInit {
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('messageContainer') messageContainer!: ElementRef<HTMLDivElement>;

  // Students and messages
  students: Student[] = [];
  selectedStudent: Student | null = null;
  allMessages: SoruMesaj[] = [];
  studentMessages: SoruMesaj[] = [];
  groupedMessages: { [studentId: number]: SoruMesaj[] } = {};
  
  // Message sending
  yeniMesaj: string = '';
  selectedFile: File | null = null;
  previewUrl: string | null = null;
  
  // Loading states
  isLoading: boolean = false;
  isLoadingMessages: boolean = false;
  isLoadingStudents: boolean = false;
  isSending: boolean = false;
  error: string | null = null;

  // View mode
  viewMode: 'all' | 'student' = 'all';

  // Notification settings
  notificationsEnabled: boolean = false;
  lastMessageCount: number = 0;

  // Toast notification
  showToast: boolean = false;
  toastMessage: string = '';
  toastType: 'success' | 'info' | 'warning' | 'error' = 'info';

  // Image modal
  showImageModal: boolean = false;
  selectedImageUrl: string = '';

  private apiBaseUrl = './server/api';

  constructor(private http: HttpClient) {
    this.requestNotificationPermission();
  }

  private getTokenFromStorage(): string {
    let token = localStorage.getItem('token');
    if (!token) {
      const userStr = localStorage.getItem('user') || sessionStorage.getItem('user');
      if (userStr) {
        try {
          const user = JSON.parse(userStr);
          token = user.token;
        } catch (error) {
          console.error('Error parsing user data:', error);
        }
      }
    }
    return token || '';
  }

  ngOnInit(): void {
    this.loadStudents();
    this.loadAllMessages();
    this.startMessageCheckInterval();
  }

  ngOnDestroy(): void {
    // Clear any intervals when component is destroyed
    if (this.messageCheckInterval) {
      clearInterval(this.messageCheckInterval);
    }
  }

  private messageCheckInterval: any;

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('token');
    if (!token) {
      // Try to get token from user object
      const userStr = localStorage.getItem('user') || sessionStorage.getItem('user');
      if (userStr) {
        try {
          const user = JSON.parse(userStr);
          const userToken = user.token;
          if (userToken) {
            return new HttpHeaders({
              'Authorization': `Bearer ${userToken}`
            });
          }
        } catch (error) {
          console.error('Error parsing user data:', error);
        }
      }
    }
    return new HttpHeaders({
      'Authorization': `Bearer ${token || ''}`
    });
  }

  loadStudents() {
    this.isLoadingStudents = true;
    this.error = null;

    const headers = new HttpHeaders({
      'Authorization': `Bearer ${this.getTokenFromStorage()}`,
      'Content-Type': 'application/json'
    });

    this.http.get<any>(`${this.apiBaseUrl}/ogretmen_ogrencileri.php`, { headers })
      .subscribe({
        next: (response) => {
          if (response.success) {
            this.students = response.data;
          } else {
            this.error = response.message || 'Öğrenciler yüklenemedi';
          }
          this.isLoadingStudents = false;
        },
        error: (error) => {
          console.error('Students loading error:', error);
          this.error = 'Öğrenciler yüklenirken hata oluştu';
          this.isLoadingStudents = false;
        }
      });
  }

  loadAllMessages() {
    this.isLoadingMessages = true;
    this.error = null;

    const headers = new HttpHeaders({
      'Authorization': `Bearer ${this.getTokenFromStorage()}`,
      'Content-Type': 'application/json'
    });

    console.log('Loading all messages with token:', this.getTokenFromStorage().substring(0, 20) + '...');

    this.http.get<any>(`${this.apiBaseUrl}/soru_mesajlari.php`, { headers })
      .subscribe({
        next: (response) => {
          console.log('All messages response:', response);
          if (response.success) {
            this.allMessages = response.data || [];
            console.log('Loaded messages count:', this.allMessages.length);
            
            // Fix image URLs
            this.allMessages.forEach(message => {
              if (message.resim_url && !message.resim_url.startsWith('http')) {
                if (!message.resim_url.startsWith('./')) {
                  message.resim_url = './' + message.resim_url;
                }
              }
            });

            // Group messages by student
            this.groupMessagesByStudent();
          } else {
            this.error = response.message || response.error || 'Mesajlar yüklenemedi';
            console.error('API Error:', response);
          }
          this.isLoadingMessages = false;
        },
        error: (error) => {
          console.error('Messages loading error:', error);
          console.error('Error details:', error.error);
          this.error = 'Mesajlar yüklenirken hata oluştu: ' + (error.error?.error || error.message);
          this.isLoadingMessages = false;
        }
      });
  }

  selectStudent(student: Student) {
    this.selectedStudent = student;
    this.viewMode = 'student';
    this.loadStudentMessages(student.id);
    
    // Öğrenci seçildiğinde okunmamış mesajları okundu olarak işaretle
    setTimeout(() => {
      this.markStudentMessagesAsRead(student.id);
    }, 1000);
  }

  loadStudentMessages(studentId: number) {
    this.isLoadingMessages = true;
    this.error = null;

    const headers = new HttpHeaders({
      'Authorization': `Bearer ${this.getTokenFromStorage()}`,
      'Content-Type': 'application/json'
    });

    console.log('Loading messages for student ID:', studentId);

    this.http.get<any>(`${this.apiBaseUrl}/soru_mesajlari.php?ogrenci_id=${studentId}`, { headers })
      .subscribe({
        next: (response) => {
          console.log('Student messages response:', response);
          if (response.success) {
            this.studentMessages = response.data || [];
            
            // Fix image URLs
            this.studentMessages.forEach(message => {
              if (message.resim_url && !message.resim_url.startsWith('http')) {
                if (!message.resim_url.startsWith('./')) {
                  message.resim_url = './' + message.resim_url;
                }
              }
            });
            
            setTimeout(() => this.scrollToBottom(), 100);
          } else {
            this.error = response.message || response.error || 'Mesajlar yüklenemedi';
            console.error('API Error:', response);
          }
          this.isLoadingMessages = false;
        },
        error: (error) => {
          console.error('Student messages loading error:', error);
          console.error('Error details:', error.error);
          this.error = 'Mesajlar yüklenirken hata oluştu: ' + (error.error?.error || error.message);
          this.isLoadingMessages = false;
        }
      });
  }

  sendMessage() {
    if (!this.selectedStudent || (!this.yeniMesaj.trim() && !this.selectedFile)) {
      return;
    }

    this.isSending = true;
    const formData = new FormData();
    formData.append('ogrenci_id', this.selectedStudent.id.toString());
    formData.append('mesaj_metni', this.yeniMesaj);
    formData.append('gonderen_tip', 'ogretmen');

    if (this.selectedFile) {
      formData.append('resim', this.selectedFile);
    }

    // For FormData, don't set Content-Type header - let browser set it
    const token = localStorage.getItem('token');
    let authToken = token;
    
    if (!authToken) {
      const userStr = localStorage.getItem('user') || sessionStorage.getItem('user');
      if (userStr) {
        try {
          const user = JSON.parse(userStr);
          authToken = user.token;
        } catch (error) {
          console.error('Error parsing user data:', error);
        }
      }
    }

    const headers = new HttpHeaders({
      'Authorization': `Bearer ${authToken || ''}`
    });

    this.http.post<any>(`${this.apiBaseUrl}/soru_mesajlari.php`, formData, { headers })
      .subscribe({
        next: (response) => {
          if (response.success) {
            this.yeniMesaj = '';
            this.selectedFile = null;
            this.previewUrl = null;
            this.loadStudentMessages(this.selectedStudent!.id);
            this.loadAllMessages(); // Refresh all messages too
          } else {
            this.error = response.message || 'Mesaj gönderilemedi';
          }
          this.isSending = false;
        },
        error: (error) => {
          console.error('Message sending error:', error);
          this.error = 'Mesaj gönderilirken hata oluştu';
          this.isSending = false;
        }
      });
  }

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        this.error = 'Dosya boyutu 5MB\'dan büyük olamaz';
        return;
      }

      this.selectedFile = file;
      const reader = new FileReader();
      reader.onload = (e) => {
        this.previewUrl = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  }

  removeFile() {
    this.selectedFile = null;
    this.previewUrl = null;
    if (this.fileInput) {
      this.fileInput.nativeElement.value = '';
    }
  }

  backToAllMessages() {
    this.viewMode = 'all';
    this.selectedStudent = null;
    this.studentMessages = [];
    this.yeniMesaj = '';
    this.selectedFile = null;
    this.previewUrl = null;
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return 'Bugün ' + date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
      return 'Dün ' + date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
    } else {
      return date.toLocaleDateString('tr-TR') + ' ' + date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
    }
  }

  private scrollToBottom() {
    if (this.messageContainer) {
      setTimeout(() => {
        this.messageContainer.nativeElement.scrollTop = this.messageContainer.nativeElement.scrollHeight;
      }, 100);
    }
  }

  trackByMessageId(index: number, message: SoruMesaj): number {
    return message.id || index;
  }

  trackByStudentId(index: number, student: Student): number {
    return student.id || index;
  }

  trackByStudentIdNumber(index: number, studentId: number): number {
    return studentId;
  }

  selectStudentFromMessage(message: SoruMesaj) {
    const student = this.students.find(s => s.id === message.ogrenci_id);
    if (student) {
      this.selectStudent(student);
    }
  }

  getStudentMessageCount(studentId: number): number {
    return this.allMessages.filter(m => m.ogrenci_id === studentId).length;
  }

  getUnreadMessageCount(studentId: number): number {
    return this.allMessages.filter(m => m.ogrenci_id === studentId && !m.okundu && m.gonderen_tip === 'ogrenci').length;
  }

  private requestNotificationPermission(): void {
    if ('Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission().then(permission => {
          this.notificationsEnabled = permission === 'granted';
        });
      } else if (Notification.permission === 'granted') {
        this.notificationsEnabled = true;
      }
    }
  }

  private showNotification(title: string, body: string, studentName?: string): void {
    if (this.notificationsEnabled && 'Notification' in window && Notification.permission === 'granted') {
      const notification = new Notification(title, {
        body: body,
        icon: './assets/siyah-turuncu.png',
        badge: './assets/siyah-turuncu.png',
        tag: 'new-message',
        requireInteraction: true
      });

      notification.onclick = () => {
        window.focus();
        notification.close();
        
        // If student name is provided, select that student
        if (studentName) {
          const student = this.students.find(s => s.adi_soyadi === studentName);
          if (student) {
            this.selectStudent(student);
          }
        }
      };

      // Auto close after 5 seconds
      setTimeout(() => {
        notification.close();
      }, 5000);
    }
  }

  private startMessageCheckInterval(): void {
    // Check for new messages every 30 seconds
    this.messageCheckInterval = setInterval(() => {
      this.checkForNewMessages();
    }, 30000);
  }

  private groupMessagesByStudent(): void {
    this.groupedMessages = {};
    
    this.allMessages.forEach(message => {
      if (!this.groupedMessages[message.ogrenci_id]) {
        this.groupedMessages[message.ogrenci_id] = [];
      }
      this.groupedMessages[message.ogrenci_id].push(message);
    });

    // Sort messages within each group by date (newest first)
    Object.keys(this.groupedMessages).forEach(studentId => {
      this.groupedMessages[+studentId].sort((a, b) => 
        new Date(b.gonderim_tarihi).getTime() - new Date(a.gonderim_tarihi).getTime()
      );
    });
  }

  getGroupedStudentIds(): number[] {
    return Object.keys(this.groupedMessages).map(id => +id);
  }

  getLatestMessageForStudent(studentId: number): SoruMesaj | null {
    const messages = this.groupedMessages[studentId];
    return messages && messages.length > 0 ? messages[0] : null;
  }

  getMessageCountForStudent(studentId: number): number {
    const messages = this.groupedMessages[studentId];
    return messages ? messages.length : 0;
  }

  getStudentName(studentId: number): string {
    const student = this.students.find(s => s.id === studentId);
    if (student) return student.adi_soyadi;
    
    const messages = this.groupedMessages[studentId];
    if (messages && messages.length > 0) {
      return messages[0].ogrenci_adi || 'Bilinmeyen Öğrenci';
    }
    
    return 'Bilinmeyen Öğrenci';
  }

  selectStudentFromGroupedMessage(studentId: number): void {
    let student = this.students.find(s => s.id === studentId);
    
    if (!student) {
      // If student not found in students list, create a temporary student object
      const studentName = this.getStudentName(studentId);
      student = {
        id: studentId,
        adi_soyadi: studentName,
        email: '',
        grubu: ''
      };
    }
    
    this.selectStudent(student);
  }

  private showToastNotification(message: string, type: 'success' | 'info' | 'warning' | 'error' = 'info'): void {
    this.toastMessage = message;
    this.toastType = type;
    this.showToast = true;
    
    // Auto hide after 5 seconds
    setTimeout(() => {
      this.showToast = false;
    }, 5000);
  }

  hideToast(): void {
    this.showToast = false;
  }

  private checkForNewMessages(): void {
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${this.getTokenFromStorage()}`,
      'Content-Type': 'application/json'
    });

    this.http.get<any>(`${this.apiBaseUrl}/soru_mesajlari.php`, { headers })
      .subscribe({
        next: (response) => {
          if (response.success) {
            const newMessages = response.data || [];
            
            // Check if there are new messages
            if (this.lastMessageCount > 0 && newMessages.length > this.lastMessageCount) {
              const latestMessage = newMessages[0]; // Assuming newest first
              const studentName = latestMessage.ogrenci_adi || 'Bir öğrenci';
              
              // Show toast notification
              this.showToastNotification(
                `${studentName} size yeni bir mesaj gönderdi!`,
                'info'
              );
              
              // Also show browser notification if enabled
              this.showNotification(
                'Yeni Mesaj!', 
                `${studentName} size yeni bir mesaj gönderdi.`,
                studentName
              );
            }
            
            this.lastMessageCount = newMessages.length;
            
            // Update messages only if there are new ones
            if (newMessages.length !== this.allMessages.length) {
              this.allMessages = newMessages;
              
              // Fix image URLs
              this.allMessages.forEach(message => {
                if (message.resim_url && !message.resim_url.startsWith('http')) {
                  if (!message.resim_url.startsWith('./')) {
                    message.resim_url = './' + message.resim_url;
                  }
                }
              });

              // Re-group messages
              this.groupMessagesByStudent();
            }
          }
        },
        error: (error) => {
          console.error('Background message check error:', error);
        }
      });
  }

  toggleNotifications(event: any): void {
    const enabled = event.target.checked;
    
    if (enabled && 'Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission().then(permission => {
          this.notificationsEnabled = permission === 'granted';
          if (!this.notificationsEnabled) {
            event.target.checked = false;
          }
        });
      } else if (Notification.permission === 'granted') {
        this.notificationsEnabled = true;
      } else {
        this.notificationsEnabled = false;
        event.target.checked = false;
        alert('Tarayıcı ayarlarından bildirim izni vermelisiniz.');
      }
    } else {
      this.notificationsEnabled = enabled;
    }
  }

  openImageModal(imageUrl: string): void {
    this.selectedImageUrl = imageUrl;
    this.showImageModal = true;
    document.body.style.overflow = 'hidden'; // Prevent background scrolling
  }

  closeImageModal(): void {
    this.showImageModal = false;
    this.selectedImageUrl = '';
    document.body.style.overflow = 'auto'; // Restore scrolling
  }

  getImageFileName(url: string): string {
    if (!url) return 'resim.jpg';
    const parts = url.split('/');
    return parts[parts.length - 1] || 'resim.jpg';
  }

  // Mesajı okundu olarak işaretle
  markMessageAsRead(messageId: number): void {
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${this.getTokenFromStorage()}`,
      'Content-Type': 'application/json'
    });

    const payload = {
      mesaj_id: messageId,
      okundu: true
    };

    this.http.post<any>(`${this.apiBaseUrl}/mesaj_okundu_isaretle.php`, payload, { headers })
      .subscribe({
        next: (response) => {
          if (response.success) {
            // Mesajı yerel olarak da okundu olarak işaretle
            const message = this.studentMessages.find(m => m.id === messageId);
            if (message) {
              message.okundu = true;
            }
            
            // Tüm mesajlar listesinde de güncelle
            const allMessage = this.allMessages.find(m => m.id === messageId);
            if (allMessage) {
              allMessage.okundu = true;
            }
          }
        },
        error: (error) => {
          console.error('Mesaj okundu işaretlenirken hata:', error);
        }
      });
  }

  // Öğrenci seçildiğinde o öğrencinin okunmamış mesajlarını okundu olarak işaretle
  markStudentMessagesAsRead(studentId: number): void {
    const unreadMessages = this.studentMessages.filter(
      m => m.ogrenci_id === studentId && m.gonderen_tip === 'ogrenci' && !m.okundu
    );

    unreadMessages.forEach(message => {
      this.markMessageAsRead(message.id!);
    });
  }
}
