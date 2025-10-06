
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
}

interface Alert {
  id: number;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
}
