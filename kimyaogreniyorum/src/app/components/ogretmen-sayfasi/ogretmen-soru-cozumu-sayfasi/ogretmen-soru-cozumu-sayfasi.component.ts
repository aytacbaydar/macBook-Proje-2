
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

  private apiBaseUrl = './server/api';

  constructor(private http: HttpClient) {}

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
  }

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
}
