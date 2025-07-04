
import { Component, OnInit } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';

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
  styleUrl: './ogrenci-islenen-konular-pdf-sayfasi.component.scss'
})
export class OgrenciIslenenKonularPdfSayfasiComponent implements OnInit {
  dersKayitlari: DersKaydi[] = [];
  isLoading: boolean = true;
  error: string | null = null;
  selectedPdf: string | null = null;
  showPdfModal: boolean = false;
  pdfLoaded: boolean = false;
  studentInfo: any = null;

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.loadStudentInfo();
    this.loadDersKayitlari();
  }

  loadStudentInfo(): void {
    const userStr = localStorage.getItem('user') || sessionStorage.getItem('user');
    if (userStr) {
      this.studentInfo = JSON.parse(userStr);
    }
  }

  loadDersKayitlari(): void {
    this.isLoading = true;
    this.error = null;

    if (!this.studentInfo || !this.studentInfo.grubu) {
      this.error = 'Öğrenci grup bilgisi bulunamadı';
      this.isLoading = false;
      return;
    }

    // Token'ı al
    let token = '';
    const userStr = localStorage.getItem('user') || sessionStorage.getItem('user');
    if (userStr) {
      const user = JSON.parse(userStr);
      token = user.token || '';
    }

    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });

    // Ders kayıtlarını getir
    this.http.get<any>(`./server/api/grup_ders_kayitlari.php?grup=${encodeURIComponent(this.studentInfo.grubu)}`, { headers })
      .subscribe({
        next: (response) => {
          if (response.success) {
            this.dersKayitlari = response.data || [];
          } else {
            this.error = response.message || 'Ders kayıtları yüklenirken hata oluştu.';
          }
          this.isLoading = false;
        },
        error: (error) => {
          this.error = 'Sunucu hatası: ' + (error.error?.message || error.message);
          this.isLoading = false;
        }
      });
  }

  viewLessonPdf(fileName: string): void {
    if (!fileName) {
      alert('PDF dosya adı bulunamadı!');
      return;
    }

    // PDF state'ini sıfırla
    this.pdfLoaded = false;
    this.selectedPdf = null;

    // Modal'ı aç
    this.showPdfModal = true;

    // Kısa bir gecikme ile PDF URL'ini ayarla
    setTimeout(() => {
      this.selectedPdf = `./server/api/pdf_viewer.php?file=${encodeURIComponent(fileName)}`;
    }, 100);
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
    setTimeout(() => {
      alert('PDF dosyası yüklenirken hata oluştu. Dosya mevcut olmayabilir veya bozuk olabilir.');
    }, 100);
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('tr-TR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  openPdfInNewTab(): void {
    if (this.selectedPdf) {
      window.open(this.selectedPdf, '_blank');
    }
  }

  downloadPdf(): void {
    if (this.selectedPdf) {
      const link = document.createElement('a');
      link.href = this.selectedPdf;
      link.download = 'ders_notlari.pdf';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }
}
