
import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-kullanici-ana-sayfa-sayfasi',
  templateUrl: './kullanici-ana-sayfa-sayfasi.component.html',
  styleUrls: ['./kullanici-ana-sayfa-sayfasi.component.scss'],
  standalone: false
})
export class KullaniciAnaSayfaSayfasiComponent implements OnInit {
  // Modal kontrolleri
  showPdfModal = false;
  showExamDetailModal = false;
  
  // Alert kontrolleri
  alerts: Alert[] = [];

  // Loading kontrolleri
  isLoading = false;
  loadingMessage = 'Yükleniyor...';
  
  // Empty state kontrolleri
  showEmptyState = false;
  emptyStateType: 'no-data' | 'no-results' | 'error' | 'success' = 'no-data';
  emptyStateTitle = 'Henüz Veri Yok';
  emptyStateMessage = 'Görünüşe göre henüz hiç kayıt bulunmuyor.';
  
  // Filter & Search kontrolleri
  searchTerm = '';
  selectedSinavTuru = '';
  selectedDurum = '';
  selectedKonu = '';
  selectedQuickFilter = 'ALL';
  activeFilters: ActiveFilter[] = [];

  constructor() { }

  ngOnInit(): void {
  }

  // Modal metodları
  openPdfModal(): void {
    this.showPdfModal = true;
  }

  closePdfModal(): void {
    this.showPdfModal = false;
  }

  openExamDetailModal(): void {
    this.showExamDetailModal = true;
  }

  closeExamDetailModal(): void {
    this.showExamDetailModal = false;
  }

  // Alert metodları
  showAlert(type: 'success' | 'error' | 'warning' | 'info', title: string, message: string): void {
    const alert: Alert = {
      id: Date.now(),
      type,
      title,
      message
    };
    
    this.alerts.push(alert);
    
    // 5 saniye sonra otomatik kapat
    setTimeout(() => {
      this.closeAlert(alert.id);
    }, 5000);
  }

  closeAlert(id: number): void {
    this.alerts = this.alerts.filter(alert => alert.id !== id);
  }

  // Örnek kullanım metodları
  testSuccessAlert(): void {
    this.showAlert('success', 'Başarılı!', 'İşlem başarıyla tamamlandı.');
  }

  testErrorAlert(): void {
    this.showAlert('error', 'Hata!', 'Bir hata oluştu, lütfen tekrar deneyin.');
  }

  testWarningAlert(): void {
    this.showAlert('warning', 'Uyarı!', 'Lütfen dikkat edin.');
  }

  testInfoAlert(): void {
    this.showAlert('info', 'Bilgi', 'İşleminiz devam ediyor...');
  }

  // Loading metodları
  showLoading(message: string = 'Yükleniyor...'): void {
    this.isLoading = true;
    this.loadingMessage = message;
  }

  hideLoading(): void {
    this.isLoading = false;
  }

  // Empty State metodları
  showEmpty(type: 'no-data' | 'no-results' | 'error' | 'success', title: string, message: string): void {
    this.showEmptyState = true;
    this.emptyStateType = type;
    this.emptyStateTitle = title;
    this.emptyStateMessage = message;
  }

  hideEmpty(): void {
    this.showEmptyState = false;
  }

  // Örnek veri yükleme simülasyonu
  loadData(): void {
    this.showLoading('Veriler yükleniyor...');
    
    // API çağrısı simülasyonu
    setTimeout(() => {
      this.hideLoading();
      
      // Eğer veri yoksa empty state göster
      const hasData = false; // API'den gelen veri kontrolü
      if (!hasData) {
        this.showEmpty('no-data', 'Henüz Veri Yok', 'Görünüşe göre henüz hiç sınav sonucu bulunmuyor.');
      }
    }, 2000);
  }
}

interface Alert {
  id: number;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
}

interface ActiveFilter {
  key: string;
  label: string;
  value: string;
}
