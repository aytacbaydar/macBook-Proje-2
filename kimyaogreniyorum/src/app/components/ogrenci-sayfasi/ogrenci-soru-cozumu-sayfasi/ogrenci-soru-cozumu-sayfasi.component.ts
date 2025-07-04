
import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { HttpClient } from '@angular/common/http';

interface StudentInfo {
  id: number;
  adi_soyadi: string;
  email: string;
  sinifi: string;
  grup?: string;
  grubu?: string;
  ogretmeni?: string;
  avatar?: string;
}

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
}

@Component({
  selector: 'app-ogrenci-soru-cozumu-sayfasi',
  standalone: false,
  templateUrl: './ogrenci-soru-cozumu-sayfasi.component.html',
  styleUrl: './ogrenci-soru-cozumu-sayfasi.component.scss'
})
export class OgrenciSoruCozumuSayfasiComponent implements OnInit {
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('messageContainer') messageContainer!: ElementRef<HTMLDivElement>;

  // Student information
  studentInfo: StudentInfo | null = null;
  
  // Messages and communication
  mesajlar: SoruMesaj[] = [];
  yeniMesaj: string = '';
  selectedFile: File | null = null;
  previewUrl: string | null = null;
  
  // Loading states
  isLoading: boolean = false;
  isLoadingMessages: boolean = false;
  isSending: boolean = false;
  error: string | null = null;

  // Chat settings
  autoRefresh: boolean = true;
  refreshInterval: any;

  private apiBaseUrl = './server/api';

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.loadData();
    this.startAutoRefresh();
  }

  ngOnDestroy(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
  }

  loadData() {
    this.isLoading = true;
    this.error = null;

    this.loadStudentInfo().then(() => {
      if (this.studentInfo) {
        this.loadMesajlar();
      } else {
        this.error = 'Öğrenci bilgileri alınamadı.';
        this.isLoading = false;
      }
    }).catch(error => {
      console.error('Error loading student info:', error);
      this.error = 'Öğrenci bilgileri yüklenirken hata oluştu.';
      this.isLoading = false;
    });
  }

  private loadStudentInfo(): Promise<void> {
    return new Promise((resolve, reject) => {
      const userStr = localStorage.getItem('user') || sessionStorage.getItem('user');
      
      if (userStr) {
        try {
          const user = JSON.parse(userStr);
          this.studentInfo = {
            id: user.id,
            adi_soyadi: user.adi_soyadi || 'Öğrenci',
            email: user.email || '',
            sinifi: user.sinif || user.sinifi || 'Bilinmiyor',
            grup: user.grup || user.grubu,
            ogretmeni: user.ogretmeni,
            avatar: user.avatar
          };
          resolve();
        } catch (error) {
          reject(error);
        }
      } else {
        reject(new Error('User not found'));
      }
    });
  }

  loadMesajlar() {
    if (!this.studentInfo) return;

    this.isLoadingMessages = true;
    
    // Bu örnek implementasyonda localStorage kullanacağız
    // Gerçek uygulamada API çağrısı yapılacak
    const storedMessages = localStorage.getItem(`soru_mesajlari_${this.studentInfo.id}`);
    
    if (storedMessages) {
      try {
        this.mesajlar = JSON.parse(storedMessages);
      } catch (error) {
        console.error('Error parsing stored messages:', error);
        this.mesajlar = [];
      }
    } else {
      this.mesajlar = [];
    }

    this.isLoadingMessages = false;
    this.isLoading = false;
    
    // Scroll to bottom after loading messages
    setTimeout(() => {
      this.scrollToBottom();
    }, 100);
  }

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      // Check file type
      const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
      if (!allowedTypes.includes(file.type)) {
        this.error = 'Sadece JPG, PNG ve GIF dosyaları yükleyebilirsiniz.';
        return;
      }

      // Check file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        this.error = 'Dosya boyutu 5MB\'dan küçük olmalıdır.';
        return;
      }

      this.selectedFile = file;
      this.error = null;

      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        this.previewUrl = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  }

  removeSelectedFile() {
    this.selectedFile = null;
    this.previewUrl = null;
    if (this.fileInput) {
      this.fileInput.nativeElement.value = '';
    }
  }

  gonderMesaj() {
    if (!this.studentInfo || (!this.yeniMesaj.trim() && !this.selectedFile)) {
      return;
    }

    this.isSending = true;
    this.error = null;

    // Create new message
    const yeniMesajObj: SoruMesaj = {
      id: Date.now(),
      ogrenci_id: this.studentInfo.id,
      mesaj_metni: this.yeniMesaj.trim(),
      gonderim_tarihi: new Date().toISOString(),
      gonderen_tip: 'ogrenci',
      gonderen_adi: this.studentInfo.adi_soyadi,
      okundu: false
    };

    // Handle file upload if exists
    if (this.selectedFile && this.previewUrl) {
      yeniMesajObj.resim_url = this.previewUrl;
    }

    // Add to messages array
    this.mesajlar.push(yeniMesajObj);

    // Save to localStorage (in real app, this would be an API call)
    localStorage.setItem(`soru_mesajlari_${this.studentInfo.id}`, JSON.stringify(this.mesajlar));

    // Reset form
    this.yeniMesaj = '';
    this.removeSelectedFile();
    this.isSending = false;

    // Scroll to bottom
    setTimeout(() => {
      this.scrollToBottom();
    }, 100);

    // Simulate teacher response after 2-5 seconds (for demo purposes)
    setTimeout(() => {
      this.simulateTeacherResponse();
    }, Math.random() * 3000 + 2000);
  }

  private simulateTeacherResponse() {
    if (!this.studentInfo) return;

    const teacherResponses = [
      'Bu soruyu çözmek için hangi konuları bilmen gerekiyor?',
      'Önce denklemleri dengeleyelim. Hangi adımda zorlanıyorsun?',
      'Bu tür sorularda önce bilinenleri ve bilinmeyenleri ayıralım.',
      'Güzel soru! Bu konuyu daha detaylı anlatmam gerekiyor galiba.',
      'Formülü doğru yazmışsın, şimdi yerine değerleri koyalım.',
      'Bu soruyu adım adım çözelim. İlk önce ne yapmalıyız?'
    ];

    const randomResponse = teacherResponses[Math.floor(Math.random() * teacherResponses.length)];

    const teacherMessage: SoruMesaj = {
      id: Date.now() + 1,
      ogrenci_id: this.studentInfo.id,
      ogretmen_id: 1,
      mesaj_metni: randomResponse,
      gonderim_tarihi: new Date().toISOString(),
      gonderen_tip: 'ogretmen',
      gonderen_adi: this.studentInfo.ogretmeni || 'Öğretmen',
      okundu: false
    };

    this.mesajlar.push(teacherMessage);
    localStorage.setItem(`soru_mesajlari_${this.studentInfo.id}`, JSON.stringify(this.mesajlar));

    setTimeout(() => {
      this.scrollToBottom();
    }, 100);
  }

  private scrollToBottom() {
    if (this.messageContainer) {
      const element = this.messageContainer.nativeElement;
      element.scrollTop = element.scrollHeight;
    }
  }

  private startAutoRefresh() {
    if (this.autoRefresh) {
      this.refreshInterval = setInterval(() => {
        // In real app, this would check for new messages from API
        // For now, we'll just check localStorage
      }, 5000);
    }
  }

  toggleAutoRefresh() {
    this.autoRefresh = !this.autoRefresh;
    
    if (this.autoRefresh) {
      this.startAutoRefresh();
    } else if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (minutes < 1) return 'Şimdi';
    if (minutes < 60) return `${minutes} dakika önce`;
    if (hours < 24) return `${hours} saat önce`;
    if (days < 7) return `${days} gün önce`;
    
    return date.toLocaleDateString('tr-TR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  temizleMesajlar() {
    if (confirm('Tüm mesajları silmek istediğinizden emin misiniz?')) {
      this.mesajlar = [];
      if (this.studentInfo) {
        localStorage.removeItem(`soru_mesajlari_${this.studentInfo.id}`);
      }
    }
  }

  yeniSoruBaslat() {
    this.yeniMesaj = '';
    this.removeSelectedFile();
    this.error = null;
  }

  trackByMessageId(index: number, mesaj: SoruMesaj): any {
    return mesaj.id;
  }

  openImageModal(imageUrl: string) {
    // Simple image modal implementation
    const modal = document.createElement('div');
    modal.className = 'image-modal-overlay';
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.8);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9999;
      cursor: pointer;
    `;

    const img = document.createElement('img');
    img.src = imageUrl;
    img.style.cssText = `
      max-width: 90%;
      max-height: 90%;
      border-radius: 10px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
    `;

    modal.appendChild(img);
    document.body.appendChild(modal);

    modal.addEventListener('click', () => {
      document.body.removeChild(modal);
    });
  }
}
