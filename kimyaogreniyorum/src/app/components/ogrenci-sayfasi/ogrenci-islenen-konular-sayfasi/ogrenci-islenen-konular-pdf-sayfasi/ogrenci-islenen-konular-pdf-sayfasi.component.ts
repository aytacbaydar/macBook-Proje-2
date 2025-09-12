import { Component, OnInit } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { ToastrService } from 'ngx-toastr';

interface DersKaydi {
  id: number;
  pdf_adi: string;
  pdf_dosya_yolu: string;
  olusturma_zamani: string;
  sayfa_sayisi: number;
  ogretmen_adi: string;
  grup_adi: string;
}

@Component({
  selector: 'app-ogrenci-islenen-konular-pdf-sayfasi',
  standalone: false,
  templateUrl: './ogrenci-islenen-konular-pdf-sayfasi.component.html',
  styleUrl: './ogrenci-islenen-konular-pdf-sayfasi.component.scss',
})
export class OgrenciIslenenKonularPdfSayfasiComponent implements OnInit {
  dersKayitlari: DersKaydi[] = [];
  isLoading: boolean = true;
  error: string | null = null;
  selectedPdf: string | null = null;
  showPdfModal: boolean = false;
  pdfLoaded: boolean = false;
  studentInfo: any = null;

  constructor(private http: HttpClient, private toaster: ToastrService) {}

  ngOnInit(): void {
    this.loadData();
  }

  loadData() {
    this.isLoading = true;
    this.error = null;

    // Load student info first
    this.loadStudentInfo()
      .then(() => {
        if (this.studentInfo) {
          // Then load PDF lessons
          this.loadDersKayitlari()
            .then(() => {
              this.isLoading = false;
            })
            .catch((error) => {
              console.error('Error loading lessons:', error);
              this.toaster.error(
                'Ders kayıtları yüklenirken hata oluştu.',
                'Hata'
              );
              this.error = 'Ders kayıtları yüklenirken hata oluştu.';
              this.isLoading = false;
            });
        } else {
          this.toaster.error(
            'Öğrenci bilgileri alınamadı.',
            'Hata'
          );
          this.error = 'Öğrenci bilgileri alınamadı.';
          this.isLoading = false;
        }
      })
      .catch((error) => {
        console.error('Error loading student info:', error);
        this.toaster.error(
          'Öğrenci bilgileri yüklenirken hata oluştu.',
          'Hata'
        );
        this.error = 'Öğrenci bilgileri yüklenirken hata oluştu.';
        this.isLoading = false;
      });
  }

  loadStudentInfo(): Promise<void> {
    return new Promise((resolve, reject) => {
      const userStr =
        localStorage.getItem('user') || sessionStorage.getItem('user');
      if (userStr) {
        this.studentInfo = JSON.parse(userStr);
        resolve();
      } else {
        reject('Kullanıcı bilgisi bulunamadı.');
      }
    });
  }

  loadDersKayitlari(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.studentInfo || !this.studentInfo.grubu) {
        this.toaster.error(
          'Öğrenci grup bilgisi bulunamadı.',
          'Hata'
        );
        this.error = 'Öğrenci grup bilgisi bulunamadı';
        this.isLoading = false;
        reject('Öğrenci grup bilgisi bulunamadı');
        return;
      }

      let token = '';
      const userStr =
        localStorage.getItem('user') || sessionStorage.getItem('user');
      if (userStr) {
        const user = JSON.parse(userStr);
        token = user.token || '';
      }

      const headers = new HttpHeaders({
        Authorization: `Bearer ${token}`,
      });

      const apiUrl = `./server/api/grup_ders_kayitlari.php?grup=${encodeURIComponent(
        this.studentInfo.grubu
      )}`;
      this.http.get<any>(apiUrl, { headers }).subscribe({
        next: (response) => {
          if (response.success && response.data) {
            // Ders kayıtlarına öğretmen bilgisi ekle
            this.dersKayitlari = response.data.map((ders: any) => ({
              ...ders,
              ogretmen_adi:
                this.studentInfo?.ogretmeni || 'Bilinmeyen Öğretmen',
            }));
          } else {
            this.dersKayitlari = [];
          }
          resolve();
        },
        error: (error) => {
          this.toaster.error(
            'Ders kayıtları yüklenirken sunucu hatası oluştu.',
            'Hata'
          );
          this.error =
            'Sunucu hatası: ' + (error.error?.message || error.message);
          this.isLoading = false;
          reject(error);
        },
      });
    });
  }

  viewLessonPdf(fileName: string): void {
    if (!fileName) {
      this.toaster.error('PDF dosya adı bulunamadı!', 'Hata');
      return;
    }

    const pdfUrl = `./server/api/pdf_viewer.php?file=${encodeURIComponent(fileName)}`;
    this.openPdfUnified(pdfUrl);
  }

  // Unified PDF opening method with robust iOS handling
  openPdfUnified(pdfUrl: string): void {
    if (this.isIOSDevice()) {
      this.openPdfForIOS(pdfUrl);
    } else {
      // Standard behavior for all other platforms
      window.open(pdfUrl, '_blank');
    }
  }

  // iOS-specific PDF opening with synchronous window opening and async blob URL assignment
  openPdfForIOS(pdfUrl: string): void {
    try {
      // CRITICAL: Open window synchronously to avoid popup blocking
      const newWindow = window.open('about:blank', '_blank');
      
      if (!newWindow) {
        // Popup was blocked, fallback to direct URL
        this.toaster.warning('Popup engellendi. PDF\'i aynı sekmede açıyoruz.', 'Uyarı');
        window.location.href = pdfUrl;
        return;
      }

      // Set loading content while fetching PDF
      newWindow.document.write(`
        <html>
          <head><title>PDF Yükleniyor...</title></head>
          <body style="margin:0; padding:20px; font-family:Arial,sans-serif; text-align:center;">
            <div style="margin-top:50px;">
              <h3>PDF yükleniyor...</h3>
              <div style="border:4px solid #f3f3f3; border-top:4px solid #3498db; border-radius:50%; width:40px; height:40px; animation:spin 2s linear infinite; margin:20px auto;"></div>
              <style>@keyframes spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}</style>
            </div>
          </body>
        </html>
      `);

      // Now fetch PDF asynchronously and update the window content
      fetch(pdfUrl)
        .then(response => {
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
          return response.blob();
        })
        .then(blob => {
          const blobUrl = URL.createObjectURL(blob);
          
          // Update window location to blob URL
          newWindow.location.href = blobUrl;
          
          // Clean up blob URL after delay
          setTimeout(() => {
            URL.revokeObjectURL(blobUrl);
          }, 30000); // Increased timeout for better reliability
        })
        .catch(error => {
          console.error('PDF fetch error:', error);
          
          // Update window with error message and fallback
          newWindow.document.body.innerHTML = `
            <div style="margin:50px auto; max-width:400px; text-align:center;">
              <h3 style="color:#e74c3c;">PDF Yüklenemedi</h3>
              <p>PDF dosyası yüklenirken hata oluştu: ${error.message}</p>
              <button onclick="window.location.href='${pdfUrl}'" style="background:#3498db; color:white; border:none; padding:10px 20px; border-radius:5px; cursor:pointer;">
                Tekrar Dene
              </button>
              <br><br>
              <button onclick="window.close()" style="background:#95a5a6; color:white; border:none; padding:10px 20px; border-radius:5px; cursor:pointer;">
                Kapat
              </button>
            </div>
          `;
          
          this.toaster.error('PDF yüklenirken hata oluştu. Yeni sekmede tekrar deneyin.', 'Hata');
        });
        
    } catch (error) {
      console.error('iOS PDF opening error:', error);
      this.toaster.error('PDF açılamadı. Lütfen tekrar deneyin.', 'Hata');
      
      // Final fallback: direct URL
      window.open(pdfUrl, '_blank');
    }
  }

  closePdfViewer(): void {
    this.showPdfModal = false;
    this.selectedPdf = null;
    this.pdfLoaded = false;
  }

  onPdfLoad(): void {
    this.pdfLoaded = true;
  }

  onPdfLoadError(event: any): void {
    console.error('PDF yüklenemedi:', this.selectedPdf, event);
    this.pdfLoaded = false;
    this.toaster.error(
      'PDF dosyası yüklenirken hata oluştu. Dosya mevcut olmayabilir veya bozuk olabilir.',
      'Hata'
    );
    setTimeout(() => {
      alert(
        'PDF dosyası yüklenirken hata oluştu. Dosya mevcut olmayabilir veya bozuk olabilir.'
      );
    }, 100);
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('tr-TR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  

  // Robust iOS device detection including iPadOS 13+
  isIOSDevice(): boolean {
    const userAgent = navigator.userAgent;
    
    // Standard iOS devices
    if (/iPad|iPhone|iPod/.test(userAgent)) {
      return true;
    }
    
    // iPadOS 13+ detection (appears as desktop Safari)
    // Check for touch support + macOS-like userAgent + no mouse
    if (/Macintosh/.test(userAgent) && 'ontouchend' in document) {
      return true;
    }
    
    // Additional Safari iOS detection
    const isSafari = /Safari/.test(userAgent) && !/Chrome/.test(userAgent);
    const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    
    return isSafari && hasTouch && /Mobile/.test(userAgent);
  }

  // Unified PDF viewing method for modal context
  viewPdf(): void {
    if (this.selectedPdf) {
      this.openPdfUnified(this.selectedPdf);
    }
  }

  // Unified PDF download method
  downloadPdf(): void {
    if (this.selectedPdf) {
      if (this.isIOSDevice()) {
        // iOS: Open in new tab (iOS doesn't support programmatic downloads)
        this.openPdfUnified(this.selectedPdf);
        this.toaster.info('iOS\'ta PDF yeni sekmede açıldı. Paylaş menüsünden kaydedebilirsiniz.', 'Bilgi');
      } else {
        // Other platforms: Standard download
        const link = document.createElement('a');
        link.href = this.selectedPdf;
        link.download = 'ders_notlari.pdf';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    }
  }
}