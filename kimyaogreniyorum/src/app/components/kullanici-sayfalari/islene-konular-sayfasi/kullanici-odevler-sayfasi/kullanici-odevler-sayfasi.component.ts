import { Component, OnInit } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { ToastrService } from 'ngx-toastr';
import { Router } from '@angular/router';
import { PdfService } from '../../../../shared/services/pdf.service';

@Component({
  selector: 'app-kullanici-odevler-sayfasi',
  templateUrl: './kullanici-odevler-sayfasi.component.html',
  styleUrl: './kullanici-odevler-sayfasi.component.scss',
  standalone: false,
})
export class KullaniciOdevlerSayfasiComponent implements OnInit {
  odevler: any[] = [];
  isLoading: boolean = false;
  currentUser: any = null;
  searchQuery: string = '';
  selectedStatus: string = 'all'; // all, active, completed, expired

  // Pagination
  currentPage: number = 1;
  itemsPerPage: number = 6;
  totalPages: number = 1;

  constructor(
    private http: HttpClient,
    private toastr: ToastrService,
    private router: Router,
    private pdfService: PdfService
  ) {}

  viewPdf(odev: any): void {
    if (!odev.pdf_exists || !odev.pdf_viewer_url) {
      this.toastr.error('PDF dosyası bulunamadı');
      return;
    }
    // Use centralized PDF service for iOS-optimized viewing
    this.pdfService.viewHomeworkPdf(odev.pdf_viewer_url);
  }

  downloadPdf(odev: any): void {
    if (!odev.pdf_exists || !odev.pdf_viewer_url) {
      this.toastr.error('PDF dosyası bulunamadı');
      return;
    }

    // Use centralized PDF service for cross-platform download
    this.pdfService.downloadHomeworkPdf(odev.pdf_viewer_url);
  }

  isIOSDevice(): boolean {
    return this.pdfService.isIOSDevice();
  }

  ngOnInit(): void {
    this.loadUserData();
    this.loadOdevler();
  }

  loadUserData(): void {
    const userStr = localStorage.getItem('user') || sessionStorage.getItem('user');
    if (userStr) {
      try {
        this.currentUser = JSON.parse(userStr);
        console.log('Öğrenci bilgileri yüklendi:', this.currentUser);
      } catch (error) {
        console.error('Kullanıcı bilgileri parse edilemedi:', error);
        this.toastr.error('Kullanıcı bilgileri yüklenemedi');
        this.router.navigate(['/']);
      }
    } else {
      this.toastr.error('Oturum bulunamadı. Lütfen giriş yapınız.');
      this.router.navigate(['/']);
    }
  }

  loadOdevler(): void {
    // Farklı grup alanlarını kontrol et
    const grup = this.currentUser?.grup || this.currentUser?.grubu || this.currentUser?.sinifi;

    if (!this.currentUser || !grup) {
      console.error('Kullanıcı verisi:', this.currentUser);
      this.toastr.error('Grup bilgisi bulunamadı. Lütfen tekrar giriş yapınız.');
      this.router.navigate(['/']);
      return;
    }

    this.isLoading = true;

    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.currentUser.token || ''}`
    });

    // Öğrencinin grubuna göre ödevleri getir
    this.http.get<any>(`./server/api/ogrenci_odevleri.php?grup=${encodeURIComponent(grup)}`, { headers })
      .subscribe({
        next: (response) => {
          console.log('Ödevler response:', response);
          if (response.success) {
            this.odevler = response.data || [];
            this.applyFilters();
            this.toastr.success(`${this.odevler.length} ödev yüklendi`);
          } else {
            this.toastr.error(response.message || 'Ödevler yüklenemedi');
          }
          this.isLoading = false;
        },
        error: (error) => {
          console.error('Ödevler yüklenirken hata:', error);
          this.toastr.error('Ödevler yüklenirken hata oluştu');
          this.isLoading = false;
        }
      });
  }

  applyFilters(): void {
    let filtered = [...this.odevler];

    // Arama filtresi
    if (this.searchQuery.trim()) {
      const query = this.searchQuery.toLowerCase();
      filtered = filtered.filter(odev =>
        odev.konu.toLowerCase().includes(query) ||
        odev.aciklama.toLowerCase().includes(query) ||
        odev.ogretmen_adi.toLowerCase().includes(query)
      );
    }

    // Durum filtresi
    if (this.selectedStatus !== 'all') {
      const today = new Date();
      filtered = filtered.filter(odev => {
        const bitisDate = new Date(odev.bitis_tarihi);
        const baslangicDate = new Date(odev.baslangic_tarihi);

        switch (this.selectedStatus) {
          case 'active':
            return baslangicDate <= today && bitisDate >= today;
          case 'completed':
            return bitisDate < today;
          case 'expired':
            return bitisDate < today;
          default:
            return true;
        }
      });
    }

    // Update pagination
    this.calculatePagination();
  }

  calculatePagination(): void {
    // Get filtered count for pagination calculation
    let filtered = [...this.odevler];

    // Apply search filter
    if (this.searchQuery.trim()) {
      const query = this.searchQuery.toLowerCase();
      filtered = filtered.filter(odev =>
        odev.konu.toLowerCase().includes(query) ||
        odev.aciklama?.toLowerCase().includes(query) ||
        odev.ogretmen_adi.toLowerCase().includes(query)
      );
    }

    // Apply status filter
    if (this.selectedStatus !== 'all') {
      filtered = filtered.filter(odev => this.getOdevStatus(odev) === this.selectedStatus);
    }

    this.totalPages = Math.ceil(filtered.length / this.itemsPerPage);
    if (this.currentPage > this.totalPages) {
      this.currentPage = 1;
    }
  }

  get paginatedOdevler(): any[] {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    return this.filteredOdevler.slice(startIndex, endIndex);
  }

  onSearchChange(): void {
    this.currentPage = 1;
    this.applyFilters();
  }

  onStatusChange(): void {
    this.currentPage = 1;
    this.applyFilters();
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
    }
  }

  previousPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
    }
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
    }
  }

  getOdevStatus(odev: any): string {
    const today = new Date();
    const bitisDate = new Date(odev.bitis_tarihi);
    const baslangicDate = new Date(odev.baslangic_tarihi);

    if (baslangicDate > today) {
      return 'upcoming';
    } else if (baslangicDate <= today && bitisDate >= today) {
      return 'active';
    } else {
      return 'expired';
    }
  }

  getStatusText(status: string): string {
    switch (status) {
      case 'upcoming':
        return 'Yaklaşan';
      case 'active':
        return 'Aktif';
      case 'expired':
        return 'Süresi Dolmuş';
      default:
        return 'Bilinmiyor';
    }
  }

  getRemainingDays(bitisDate: string): number {
    const today = new Date();
    const endDate = new Date(bitisDate);
    const diffTime = endDate.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  openPdfInNewTab(pdfFileName: string): void {
    if (pdfFileName) {
      // Use centralized service for consistent PDF handling
      this.pdfService.viewHomeworkPdf(pdfFileName);
    } else {
      this.toastr.warning('Bu ödev için PDF dosyası bulunmamaktadır');
    }
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('tr-TR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  refreshOdevler(): void {
    this.loadOdevler();
  }

  // Math object for template use
  Math = Math;

  // Computed properties
  get filteredOdevler(): any[] {
    let filtered = [...this.odevler];

    // Apply search filter
    if (this.searchQuery.trim()) {
      const query = this.searchQuery.toLowerCase();
      filtered = filtered.filter(odev =>
        odev.konu.toLowerCase().includes(query) ||
        odev.aciklama?.toLowerCase().includes(query)
      );
    }

    // Apply status filter
    if (this.selectedStatus !== 'all') {
      filtered = filtered.filter(odev => this.getOdevStatus(odev) === this.selectedStatus);
    }

    // Update pagination
    this.totalPages = Math.ceil(filtered.length / this.itemsPerPage);

    // Apply pagination
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;

    return filtered.slice(startIndex, endIndex);
  }

  // Helper methods for template calculations
  getActiveOdevCount(): number {
    return this.odevler.filter(o => this.getOdevStatus(o) === 'active').length;
  }

  getUpcomingOdevCount(): number {
    return this.odevler.filter(o => this.getOdevStatus(o) === 'upcoming').length;
  }

  getExpiredOdevCount(): number {
    return this.odevler.filter(o => this.getOdevStatus(o) === 'expired').length;
  }

  clearSearch(): void {
    this.searchQuery = '';
  }
}