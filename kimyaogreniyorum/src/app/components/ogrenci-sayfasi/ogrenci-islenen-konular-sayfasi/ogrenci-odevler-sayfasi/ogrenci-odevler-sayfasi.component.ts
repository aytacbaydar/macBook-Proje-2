
import { Component, OnInit } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { ToastrService } from 'ngx-toastr';
import { Router } from '@angular/router';

@Component({
  selector: 'app-ogrenci-odevler-sayfasi',
  standalone: false,
  templateUrl: './ogrenci-odevler-sayfasi.component.html',
  styleUrl: './ogrenci-odevler-sayfasi.component.scss'
})
export class OgrenciOdevlerSayfasiComponent implements OnInit {
  odevler: any[] = [];
  isLoading: boolean = false;
  currentUser: any = null;

  constructor(
    private http: HttpClient,
    private toastr: ToastrService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadCurrentUser();
    this.loadOdevler();
  }

  loadCurrentUser(): void {
    const userStr = localStorage.getItem('user') || sessionStorage.getItem('user');
    if (userStr) {
      this.currentUser = JSON.parse(userStr);
    }
  }

  getAuthHeaders(): HttpHeaders {
    let token = '';
    if (this.currentUser && this.currentUser.token) {
      token = this.currentUser.token;
    }

    return new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
  }

  loadOdevler(): void {
    if (!this.currentUser) {
      this.toastr.error('Kullanıcı bilgileri bulunamadı', 'Hata');
      return;
    }

    this.isLoading = true;

    this.http.get<any>('./server/api/ogrenci_odevleri.php', {
      headers: this.getAuthHeaders()
    }).subscribe({
      next: (response) => {
        if (response.success) {
          this.odevler = response.data || [];
          console.log('Ödevler yüklendi:', this.odevler);
        } else {
          this.toastr.error(response.message || 'Ödevler yüklenemedi', 'Hata');
          this.odevler = [];
        }
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Ödevler yüklenirken hata:', error);
        this.toastr.error('Ödevler yüklenirken hata oluştu', 'Hata');
        this.odevler = [];
        this.isLoading = false;
      }
    });
  }

  formatDate(dateString: string): string {
    if (!dateString) return 'Tarih belirtilmemiş';
    
    const date = new Date(dateString);
    return date.toLocaleDateString('tr-TR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  getProgressPercentage(odev: any): number {
    if (!odev.baslangic_tarihi || !odev.bitis_tarihi) return 0;
    
    const startDate = new Date(odev.baslangic_tarihi);
    const endDate = new Date(odev.bitis_tarihi);
    const currentDate = new Date();
    
    const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const remainingDays = Math.ceil((endDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24));
    
    if (remainingDays <= 0) return 100;
    if (remainingDays >= totalDays) return 0;
    
    return Math.round(((totalDays - remainingDays) / totalDays) * 100);
  }

  openPdfInNewTab(pdfFileName: string): void {
    if (!pdfFileName) {
      this.toastr.error('PDF dosyası bulunamadı', 'Hata');
      return;
    }

    const pdfUrl = `./server/uploads/odevler/${pdfFileName}`;
    window.open(pdfUrl, '_blank');
  }

  downloadPdf(pdfFileName: string): void {
    if (!pdfFileName) {
      this.toastr.error('PDF dosyası bulunamadı', 'Hata');
      return;
    }

    const pdfUrl = `./server/uploads/odevler/${pdfFileName}`;
    
    // Create a temporary anchor element for download
    const link = document.createElement('a');
    link.href = pdfUrl;
    link.download = pdfFileName;
    link.target = '_blank';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    this.toastr.success('PDF dosyası indiriliyor...', 'Başarılı');
  }
}
