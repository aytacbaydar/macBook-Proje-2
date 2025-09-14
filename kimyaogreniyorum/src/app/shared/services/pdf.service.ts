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
   * iPhone/iPad için süper basit ve kesinlikle çalışan PDF açma
   * @param pdfUrl - PDF dosyasının URL'i
   * @param fileName - Dosya adı (opsiyonel)
   */
  openPdfForIOS(pdfUrl: string, fileName?: string): void {
    console.log('📱 iPhone/iPad PDF açılıyor:', { pdfUrl, fileName });
    
    // iPhone için en güvenilir yöntem - direkt açma
    this.toastr.info('📄 PDF açılıyor... (iPhone/iPad)', 'Bilgi');
    
    // 1. Önce direkt yeni sekme dene
    const pdfWindow = window.open('about:blank', '_blank');
    
    if (pdfWindow) {
      // Başarılı - yeni pencere açıldı
      console.log('✅ iPhone: Yeni pencere başarıyla açıldı');
      
      // PDF'i direkt yükle
      pdfWindow.location.href = pdfUrl;
      
      this.toastr.success('✅ PDF yeni sekmede açıldı!', 'Başarılı');
      
      // 2 saniye sonra kontrol et
      setTimeout(() => {
        if (pdfWindow.closed) {
          console.log('ℹ️ PDF penceresi kapatıldı');
        } else {
          console.log('✅ PDF başarıyla görüntüleniyor');
        }
      }, 2000);
      
    } else {
      // Popup engellendi - aynı sekmede aç
      console.log('⚠️ iPhone: Popup engellendi, aynı sekmede açılıyor');
      this.toastr.warning('Popup engellendi. PDF aynı sekmede açılıyor.', 'Uyarı');
      
      // Direkt aynı sekmede aç
      window.location.href = pdfUrl;
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
   * @returns Direct path to PDF file
   */
  getLessonPdfUrl(fileName: string): string {
    // iPhone için direkt dosya yolu - static serving
    return `/dosyalar/pdf/${fileName}`;
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
    console.log('📄 PDF açılıyor:', { fileName, pdfUrl });
    
    // iPhone için doğrudan aç (test yapmadan)
    if (this.isIOSDevice()) {
      console.log('📱 iPhone/iPad tespit edildi, doğrudan PDF açılıyor');
      this.toastr.info('📄 PDF açılıyor...', 'Bilgi');
      this.openPdfUnified(pdfUrl, fileName);
      return;
    }
    
    // Diğer cihazlar için önce test yap
    fetch(pdfUrl, { method: 'HEAD' })
      .then(response => {
        console.log('📄 PDF URL testi:', response.status, response.statusText);
        if (response.ok) {
          this.openPdfUnified(pdfUrl, fileName);
        } else {
          console.error('📄 PDF bulunamadı:', response.status);
          this.toastr.error(`PDF dosyası bulunamadı: ${fileName} (${response.status})`, 'Hata');
          
          // Show helpful message
          this.toastr.info('PDF dosyasının yüklendiğinden emin olun veya öğretmeninizle iletişime geçin.', 'Bilgi');
        }
      })
      .catch(error => {
        console.error('📄 PDF URL test hatası:', error);
        this.toastr.info('PDF açmayı deniyoruz...', 'Bilgi');
        this.openPdfUnified(pdfUrl, fileName);
      });
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