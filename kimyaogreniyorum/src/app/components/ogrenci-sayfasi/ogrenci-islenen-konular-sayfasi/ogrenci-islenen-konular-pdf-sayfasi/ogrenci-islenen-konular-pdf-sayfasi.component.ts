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
    this.loadData();
  }

  loadData() {
    this.isLoading = true;
    this.error = null;

    // Load student info first
    this.loadStudentInfo().then(() => {
      if (this.studentInfo) {
        // Then load PDF lessons
        this.loadDersKayitlari().then(() => {
          this.isLoading = false;
        }).catch(error => {
          console.error('Error loading lessons:', error);
          this.error = 'Ders kayıtları yüklenirken hata oluştu.';
          this.isLoading = false;
        });
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

  loadStudentInfo(): Promise<void> {
    return new Promise((resolve, reject) => {
      const userStr = localStorage.getItem('user') || sessionStorage.getItem('user');
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
        this.error = 'Öğrenci grup bilgisi bulunamadı';
        this.isLoading = false;
        reject('Öğrenci grup bilgisi bulunamadı');
        return;
      }

      let token = '';
      const userStr = localStorage.getItem('user') || sessionStorage.getItem('user');
      if (userStr) {
        const user = JSON.parse(userStr);
        token = user.token || '';
      }

      const headers = new HttpHeaders({
        'Authorization': `Bearer ${token}`
      });

      const apiUrl = `./server/api/grup_ders_kayitlari.php?grup=${encodeURIComponent(this.studentInfo.grubu)}`;
      this.http.get<any>(apiUrl, { headers }).subscribe({
        next: (response) => {
          if (response.success && response.data) {
            // Ders kayıtlarına öğretmen bilgisi ekle
            this.dersKayitlari = response.data.map((ders: any) => ({
              ...ders,
              ogretmen_adi: this.studentInfo?.ogretmeni || 'Bilinmeyen Öğretmen'
            }));
          } else {
            this.dersKayitlari = [];
          }
          resolve();
        },
        error: (error) => {
          this.error = 'Sunucu hatası: ' + (error.error?.message || error.message);
          this.isLoading = false;
          reject(error);
        }
      });
    });
  }

  viewLessonPdf(fileName: string): void {
    if (!fileName) {
      alert('PDF dosya adı bulunamadı!');
      return;
    }

    this.pdfLoaded = false;
    this.selectedPdf = null;

    this.showPdfModal = true;

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