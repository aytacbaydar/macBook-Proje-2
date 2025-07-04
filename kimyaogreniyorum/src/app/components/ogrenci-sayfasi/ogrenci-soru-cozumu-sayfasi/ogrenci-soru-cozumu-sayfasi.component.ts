
import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';

interface StudentInfo {
  id: number;
  adi_soyadi: string;
  email: string;
  sinifi: string;
  grup?: string;
  grubu?: string;
  ogretmeni?: string;
  avatar?: string;
  token?: string;
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
            avatar: user.avatar,
            token: user.token
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
    
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${this.studentInfo.token}`
    });

    this.http.get<any>(`${this.apiBaseUrl}/soru_mesajlari.php?ogrenci_id=${this.studentInfo.id}`, { headers })
      .subscribe({
        next: (response) => {
          if (response.success) {
            this.mesajlar = response.data || [];
          } else {
            this.error = response.error || 'Mesajlar yüklenirken hata oluştu.';
          }
          this.isLoadingMessages = false;
          this.isLoading = false;
          
          // Scroll to bottom after loading messages
          setTimeout(() => {
            this.scrollToBottom();
          }, 100);
        },
        error: (error) => {
          console.error('Error loading messages:', error);
          this.error = 'Mesajlar yüklenirken hata oluştu.';
          this.isLoadingMessages = false;
          this.isLoading = false;
        }
      });
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

    const headers = new HttpHeaders({
      'Authorization': `Bearer ${this.studentInfo.token}`
    });

    const formData = new FormData();
    formData.append('ogrenci_id', this.studentInfo.id.toString());
    formData.append('mesaj_metni', this.yeniMesaj.trim());
    formData.append('gonderen_tip', 'ogrenci');
    formData.append('gonderen_adi', this.studentInfo.adi_soyadi);

    if (this.selectedFile) {
      formData.append('resim', this.selectedFile);
    }

    this.http.post<any>(`${this.apiBaseUrl}/soru_mesajlari.php`, formData, { headers })
      .subscribe({
        next: (response) => {
          if (response.success) {
            // Reset form
            this.yeniMesaj = '';
            this.removeSelectedFile();
            
            // Reload messages
            this.loadMesajlar();
          } else {
            this.error = response.error || 'Mesaj gönderilirken hata oluştu.';
          }
          this.isSending = false;
        },
        error: (error) => {
          console.error('Error sending message:', error);
          this.error = 'Mesaj gönderilirken hata oluştu.';
          this.isSending = false;
        }
      });
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
        this.loadMesajlar();
      }, 10000); // 10 saniyede bir yenile
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
      if (!this.studentInfo) return;

      const headers = new HttpHeaders({
        'Authorization': `Bearer ${this.studentInfo.token}`
      });

      // Tüm mesajları sil
      this.mesajlar.forEach(mesaj => {
        if (mesaj.id) {
          this.http.delete(`${this.apiBaseUrl}/soru_mesajlari.php?id=${mesaj.id}`, { headers })
            .subscribe({
              next: () => {
                // Mesajlar silindi, listeyi yenile
                this.loadMesajlar();
              },
              error: (error) => {
                console.error('Error deleting message:', error);
              }
            });
        }
      });
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
    // Resim URL'sini tam path'e çevir
    const fullImageUrl = imageUrl.startsWith('http') ? imageUrl : `./server/${imageUrl}`;
    
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
    img.src = fullImageUrl;
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

  getImageUrl(resimUrl: string): string {
    if (!resimUrl) return '';
    return resimUrl.startsWith('http') ? resimUrl : `./server/${resimUrl}`;
  }
}
