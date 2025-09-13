import { Injectable } from '@angular/core';
import { ToastrService } from 'ngx-toastr';

@Injectable({
  providedIn: 'root'
})
export class PdfService {

  constructor(private toastr: ToastrService) {}

  /**
   * Unified PDF opening method with robust iOS handling
   * @param pdfUrl - The URL of the PDF to open
   * @param fileName - Optional filename for download (used on iOS)
   */
  openPdfUnified(pdfUrl: string, fileName?: string): void {
    if (this.isIOSDevice()) {
      this.openPdfForIOS(pdfUrl, fileName);
    } else {
      // Standard behavior for all other platforms
      window.open(pdfUrl, '_blank');
    }
  }

  /**
   * iOS-specific PDF opening with improved fallback handling
   * @param pdfUrl - The URL of the PDF to open
   * @param fileName - Optional filename for user feedback
   */
  openPdfForIOS(pdfUrl: string, fileName?: string): void {
    try {
      // For iOS, try direct approach first (more reliable)
      this.toastr.info('PDF yeni sekmede açılıyor...', 'Bilgi');
      
      // Direct approach - let iOS Safari handle the PDF
      const newWindow = window.open(pdfUrl, '_blank');
      
      if (!newWindow) {
        // Popup was blocked, fallback to same tab
        this.toastr.warning('Popup engellendi. PDF aynı sekmede açılıyor.', 'Uyarı');
        window.location.href = pdfUrl;
        return;
      }

      // Additional fallback with timeout check
      setTimeout(() => {
        try {
          // Check if window is still loading or if we need to provide guidance
          if (newWindow && !newWindow.closed) {
            // Show user guidance in case PDF doesn't load
            const guideWindow = window.open('about:blank', '_blank');
            if (guideWindow) {
              guideWindow.document.write(`
                <html>
                  <head>
                    <title>PDF Görüntüleme Rehberi</title>
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                  </head>
                  <body style="margin:0; padding:20px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; background:#f5f5f5;">
                    <div style="max-width:400px; margin:20px auto; background:white; padding:30px; border-radius:15px; box-shadow:0 4px 20px rgba(0,0,0,0.1);">
                      <div style="text-align:center; margin-bottom:25px;">
                        <div style="width:60px; height:60px; margin:0 auto 15px; background:#ff6600; border-radius:50%; display:flex; align-items:center; justify-content:center;">
                          <span style="color:white; font-size:24px;">📄</span>
                        </div>
                        <h2 style="margin:0; color:#333; font-size:20px;">PDF Görüntüleme</h2>
                      </div>
                      
                      <div style="margin-bottom:20px;">
                        <h3 style="color:#ff6600; font-size:16px; margin-bottom:10px;">📱 iPhone/iPad'de PDF'i açmak için:</h3>
                        <div style="background:#f8f9fa; padding:15px; border-radius:10px; border-left:4px solid #ff6600;">
                          <p style="margin:5px 0; color:#555; font-size:14px;">1. Üstteki sekmeye geçin</p>
                          <p style="margin:5px 0; color:#555; font-size:14px;">2. PDF yüklenene kadar bekleyin</p>
                          <p style="margin:5px 0; color:#555; font-size:14px;">3. Paylaş butonu ile kaydedebilirsiniz</p>
                        </div>
                      </div>

                      <div style="margin-bottom:25px;">
                        <h3 style="color:#17a2b8; font-size:16px; margin-bottom:10px;">⚠️ PDF açılmazsa:</h3>
                        <div style="background:#e7f3ff; padding:15px; border-radius:10px; border-left:4px solid #17a2b8;">
                          <p style="margin:5px 0; color:#555; font-size:14px;">1. Safari ayarlarını kontrol edin</p>
                          <p style="margin:5px 0; color:#555; font-size:14px;">2. Popup engelleyicisini kapatın</p>
                          <p style="margin:5px 0; color:#555; font-size:14px;">3. Sayfayı yenilemiyi deneyin</p>
                        </div>
                      </div>

                      <div style="text-align:center;">
                        <button onclick="window.open('${pdfUrl}', '_blank')" style="background:#ff6600; color:white; border:none; padding:12px 24px; border-radius:8px; font-size:14px; cursor:pointer; margin:5px;">
                          🔄 PDF'i Tekrar Aç
                        </button>
                        <br><br>
                        <button onclick="window.close()" style="background:#6c757d; color:white; border:none; padding:10px 20px; border-radius:8px; font-size:14px; cursor:pointer;">
                          ✕ Bu Pencereyi Kapat
                        </button>
                      </div>

                      <div style="margin-top:25px; padding:15px; background:#fff3cd; border-radius:10px; border:1px solid #ffeaa7;">
                        <p style="margin:0; color:#856404; font-size:12px; text-align:center;">
                          <strong>💡 İpucu:</strong> Sorun devam ederse öğretmeninize bildirin.
                        </p>
                      </div>
                    </div>
                  </body>
                </html>
              `);
            }
          }
        } catch (e) {
          // Silently ignore errors in fallback guidance
          console.log('Guide window creation failed:', e);
        }
      }, 2000);
        
    } catch (error) {
      console.error('iOS PDF opening error:', error);
      this.toastr.error('PDF açılamadı. Lütfen tekrar deneyin.', 'Hata');
      
      // Final fallback: direct URL
      window.open(pdfUrl, '_blank');
    }
  }

  /**
   * Unified download or open method for different platforms
   * @param pdfUrl - The URL of the PDF
   * @param fileName - Optional filename for download
   */
  downloadOrOpen(pdfUrl: string, fileName?: string): void {
    if (this.isIOSDevice()) {
      // iOS: Open in new tab (iOS doesn't support programmatic downloads)
      this.openPdfUnified(pdfUrl, fileName);
      this.toastr.info('iOS\'ta PDF yeni sekmede açıldı. Paylaş menüsünden kaydedebilirsiniz.', 'Bilgi');
    } else {
      // Other platforms: Standard download
      const link = document.createElement('a');
      link.href = pdfUrl;
      link.download = fileName || 'document.pdf';
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }

  /**
   * Robust iOS device detection including iPadOS 13+
   * @returns boolean indicating if the device is iOS
   */
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

  /**
   * Generate PDF URL for lesson viewer endpoint
   * @param fileName - The PDF filename
   * @returns Full URL for pdf_viewer.php endpoint
   */
  getLessonPdfUrl(fileName: string): string {
    return `./server/api/pdf_viewer.php?file=${encodeURIComponent(fileName)}`;
  }

  /**
   * Generate PDF URL for homework/assignment viewer endpoint
   * @param fileName - The PDF filename
   * @returns Full URL for homework PDF endpoint
   */
  getHomeworkPdfUrl(fileName: string): string {
    return `./server/api/odev_odf_viewer.php?file=${encodeURIComponent(fileName)}`;
  }

  /**
   * View a lesson PDF with iOS-optimized handling
   * @param fileName - The lesson PDF filename
   */
  viewLessonPdf(fileName: string): void {
    if (!fileName) {
      this.toastr.error('PDF dosya adı bulunamadı!', 'Hata');
      return;
    }

    const pdfUrl = this.getLessonPdfUrl(fileName);
    this.openPdfUnified(pdfUrl, fileName);
  }

  /**
   * View a homework PDF with iOS-optimized handling
   * @param fileName - The homework PDF filename
   */
  viewHomeworkPdf(fileName: string): void {
    if (!fileName) {
      this.toastr.error('PDF dosya adı bulunamadı!', 'Hata');
      return;
    }

    const pdfUrl = this.getHomeworkPdfUrl(fileName);
    this.openPdfUnified(pdfUrl, fileName);
  }

  /**
   * Download a lesson PDF with platform-specific handling
   * @param fileName - The lesson PDF filename
   */
  downloadLessonPdf(fileName: string): void {
    if (!fileName) {
      this.toastr.error('PDF dosya adı bulunamadı!', 'Hata');
      return;
    }

    const pdfUrl = this.getLessonPdfUrl(fileName);
    this.downloadOrOpen(pdfUrl, fileName);
  }

  /**
   * Download a homework PDF with platform-specific handling
   * @param fileName - The homework PDF filename
   */
  downloadHomeworkPdf(fileName: string): void {
    if (!fileName) {
      this.toastr.error('PDF dosya adı bulunamadı!', 'Hata');
      return;
    }

    const pdfUrl = this.getHomeworkPdfUrl(fileName);
    this.downloadOrOpen(pdfUrl, fileName);
  }
}