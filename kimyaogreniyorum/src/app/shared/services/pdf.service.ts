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
   * iOS-specific PDF opening with synchronous window opening and async blob URL assignment
   * @param pdfUrl - The URL of the PDF to open
   * @param fileName - Optional filename for user feedback
   */
  openPdfForIOS(pdfUrl: string, fileName?: string): void {
    try {
      // CRITICAL: Open window synchronously to avoid popup blocking
      const newWindow = window.open('about:blank', '_blank');
      
      if (!newWindow) {
        // Popup was blocked, fallback to direct URL
        this.toastr.warning('Popup engellendi. PDF\'i aynı sekmede açıyoruz.', 'Uyarı');
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
          
          this.toastr.error('PDF yüklenirken hata oluştu. Yeni sekmede tekrar deneyin.', 'Hata');
        });
        
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