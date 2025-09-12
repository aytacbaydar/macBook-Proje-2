import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { PdfService } from '../../../../shared/services/pdf.service';

interface DersKaydi {
  id: number;
  pdf_adi: string;
  pdf_dosya_yolu: string;
  cizim_dosya_yolu: string;
  sayfa_sayisi: number;
  olusturma_zamani: string;
  ogretmen_adi: string;
}

interface DersProgram {
  gun: string;
  saat: string;
  ders_adi: string;
}

interface GroupDetail {
  name: string;
  students: any[];
  dersProgram: DersProgram[];
  dersKayitlari: DersKaydi[];
}
@Component({
  selector: 'app-ogretmen-gruplar-detay-sayfasi',
  standalone: false,
  templateUrl: './ogretmen-gruplar-detay-sayfasi.component.html',
  styleUrl: './ogretmen-gruplar-detay-sayfasi.component.scss',
})
export class OgretmenGruplarDetaySayfasiComponent implements OnInit {
  grupAdi: string = '';
  grupDetay: GroupDetail = {
    name: '',
    students: [],
    dersProgram: [],
    dersKayitlari: [],
  };
  isLoading: boolean = true;
  error: string | null = null;
  selectedPdf: string | null = null;
  showPdfModal: boolean = false;
  pdfLoaded: boolean = false;
  private apiBaseUrl = this.getApiBaseUrl();

  constructor(
    private route: ActivatedRoute, 
    private http: HttpClient,
    private pdfService: PdfService
  ) {}

  private getApiBaseUrl(): string {
    // Production'da kimyaogreniyorum.com, development'da localhost kullan
    const hostname = window.location.hostname;
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname.includes('replit')
    ) {
      return 'http://localhost/server/api';
    } else {
      return 'https://kimyaogreniyorum.com/server/api';
    }
  }

  ngOnInit(): void {
    this.route.params.subscribe((params) => {
      this.grupAdi = decodeURIComponent(params['grupAdi']);
      this.loadGrupDetay();
    });
  }

  loadGrupDetay(): void {
    this.isLoading = true;
    this.error = null;

    // Token'ı al
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

    // Önce öğrencileri yükle
    this.http
      .get<any>('./server/api/ogrenciler_listesi.php', { headers })
      .subscribe({
        next: (response) => {
          if (response.success) {
            // Bu gruba ait öğrencileri filtrele
            this.grupDetay.students = response.data.filter(
              (student: any) => student.grubu === this.grupAdi
            );
            this.grupDetay.name = this.grupAdi;

            // Ders kayıtlarını yükle
            this.loadDersKayitlari();
          } else {
            this.error =
              response.message || 'Öğrenci verileri yüklenirken hata oluştu.';
            this.isLoading = false;
          }
        },
        error: (error) => {
          this.error =
            'Sunucu hatası: ' + (error.error?.message || error.message);
          this.isLoading = false;
        },
      });
  }

  loadDersKayitlari(): void {
    // Token'ı al
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

    // Ders kayıtlarını getir
    this.http
      .get<any>(
        `./server/api/grup_ders_kayitlari.php?grup=${encodeURIComponent(
          this.grupAdi
        )}`,
        { headers }
      )
      .subscribe({
        next: (response) => {
          if (response.success) {
            this.grupDetay.dersKayitlari = response.data || [];
          }

          // Ders programını yükle (örnek veri - gerçek API'ye göre ayarlayabilirsiniz)
          this.loadDersProgram();
        },
        error: (error) => {
          console.error('Ders kayıtları yüklenirken hata:', error);
          this.loadDersProgram();
        },
      });
  }

  loadDersProgram(): void {
    // Örnek ders programı - gerçek API'den alabilirsiniz
    const programlar: { [key: string]: DersProgram[] } = {
      '9A Sınıfı': [
        { gun: 'Pazartesi', saat: '09:00-10:00', ders_adi: 'Kimya' },
        { gun: 'Çarşamba', saat: '14:00-15:00', ders_adi: 'Kimya' },
        { gun: 'Cuma', saat: '11:00-12:00', ders_adi: 'Kimya' },
      ],
      '10A Sınıfı': [
        { gun: 'Salı', saat: '10:00-11:00', ders_adi: 'Kimya' },
        { gun: 'Perşembe', saat: '13:00-14:00', ders_adi: 'Kimya' },
        { gun: 'Cumartesi', saat: '09:00-10:00', ders_adi: 'Kimya' },
      ],
      '11A Sınıfı': [
        { gun: 'Pazartesi', saat: '14:00-15:00', ders_adi: 'Kimya' },
        { gun: 'Çarşamba', saat: '10:00-11:00', ders_adi: 'Kimya' },
        { gun: 'Cuma', saat: '15:00-16:00', ders_adi: 'Kimya' },
      ],
      '12A Sınıfı': [
        { gun: 'Salı', saat: '13:00-14:00', ders_adi: 'Kimya' },
        { gun: 'Perşembe', saat: '09:00-10:00', ders_adi: 'Kimya' },
        { gun: 'Cumartesi', saat: '14:00-15:00', ders_adi: 'Kimya' },
      ],
    };

    this.grupDetay.dersProgram = programlar[this.grupAdi] || [
      { gun: 'Pazartesi', saat: '09:00-10:00', ders_adi: 'Kimya' },
      { gun: 'Çarşamba', saat: '14:00-15:00', ders_adi: 'Kimya' },
    ];

    this.isLoading = false;
  }

  openPdfViewer(pdfYolu: string): void {
    // Use centralized PDF service for iOS-optimized viewing
    this.pdfService.viewLessonPdf(pdfYolu);
  }

  closePdfViewer(): void {
    this.showPdfModal = false;
    this.selectedPdf = null;
    this.pdfLoaded = false;
    console.log('PDF modal kapatıldı');
  }

  onPdfLoad(): void {
    this.pdfLoaded = true;
    console.log('PDF başarıyla yüklendi');
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
      minute: '2-digit',
    });
  }

  viewLessonPdf(fileName: string): void {
    if (!fileName) {
      alert('PDF dosya adı bulunamadı!');
      return;
    }

    // Use centralized PDF service for iOS-optimized viewing
    this.pdfService.viewLessonPdf(fileName);
  }

  openPdfInNewTab(): void {
    if (this.selectedPdf) {
      // Use centralized PDF service for consistent cross-platform behavior
      this.pdfService.openPdfUnified(this.selectedPdf);
    }
  }

  downloadPdf(): void {
    if (this.selectedPdf) {
      // Use centralized PDF service for cross-platform download
      this.pdfService.downloadOrOpen(this.selectedPdf, 'ders_notlari.pdf');
    }
  }

  viewDrawingPng(fileName: string): void {
    if (fileName) {
      const pngFileName = fileName.replace('.pdf', '.png');
      const pngUrl = `${
        this.apiBaseUrl
      }/png_viewer.php?file=${encodeURIComponent(pngFileName)}`;
      window.open(pngUrl, '_blank');
    }
  }

  downloadFile(fileName: string, type: 'pdf' | 'png'): void {
    if (fileName) {
      if (type === 'pdf') {
        // Use centralized PDF service for PDF downloads
        this.pdfService.downloadLessonPdf(fileName);
      } else {
        // Keep original logic for PNG files
        const apiUrl = `${this.apiBaseUrl}/png_viewer.php?file=${encodeURIComponent(fileName)}`;
        const link = document.createElement('a');
        link.href = apiUrl;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    }
  }

    printPdf(): void {
    if (this.selectedPdf) {
      const printWindow = window.open(this.selectedPdf, '_blank');
      if (printWindow) {
        printWindow.onload = () => {
          printWindow.print();
        };
      }
    }
  }
}