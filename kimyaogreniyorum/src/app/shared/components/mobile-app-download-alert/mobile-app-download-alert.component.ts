import { Component, OnInit, Output, EventEmitter } from '@angular/core';
import { MobileDetectionService } from '../../services/mobile-detection.service';

@Component({
  selector: 'app-mobile-app-download-alert',
  templateUrl: './mobile-app-download-alert.component.html',
  styleUrls: ['./mobile-app-download-alert.component.scss'],
  standalone: false
})
export class MobileAppDownloadAlertComponent implements OnInit {
  @Output() closeAlert = new EventEmitter<void>();

  showAlert = false;
  platform: string = '';
  platformName: string = '';
  platformIcon: string = '';
  downloadUrl: string = '';

  constructor(private mobileDetectionService: MobileDetectionService) { }

  ngOnInit(): void {
    // Mobil cihazda ve PWA yüklü değilse alert göster
    if (this.mobileDetectionService.shouldShowInstallPrompt()) {
      // LocalStorage'da daha önce kapatılmış mı kontrol et
      const dismissed = localStorage.getItem('mobile-app-alert-dismissed');
      if (!dismissed) {
        this.initializeAlert();
      }
    }
  }

  private initializeAlert(): void {
    this.platform = this.mobileDetectionService.getPlatform();
    this.platformName = this.mobileDetectionService.getPlatformName();
    this.platformIcon = this.mobileDetectionService.getPlatformIcon();
    this.downloadUrl = this.mobileDetectionService.getDownloadUrl();
    
    // 2 saniye sonra alert'i göster
    setTimeout(() => {
      this.showAlert = true;
    }, 2000);
  }

  downloadApp(): void {
    if (this.platform === 'android') {
      // Android için APK indirme
      this.downloadAPK();
    } else if (this.platform === 'ios') {
      // iOS için App Store'a yönlendirme
      window.open(this.downloadUrl, '_blank');
    } else {
      // Web için PWA yükleme talimatları
      this.showPWAInstructions();
    }
    
    this.dismissAlert();
  }

  private downloadAPK(): void {
    const link = document.createElement('a');
    link.href = this.downloadUrl;
    link.download = 'kimya-ogreniyorum.apk';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  private showPWAInstructions(): void {
    // PWA yükleme talimatları göster
    alert('Ana ekrana eklemek için:\n\n' +
          '1. Tarayıcı menüsünü açın\n' +
          '2. "Ana ekrana ekle" seçeneğini tıklayın\n' +
          '3. "Ekle" butonuna basın');
  }

  dismissAlert(): void {
    this.showAlert = false;
    // 24 saat boyunca tekrar gösterme
    const dismissTime = new Date().getTime() + (24 * 60 * 60 * 1000);
    localStorage.setItem('mobile-app-alert-dismissed', dismissTime.toString());
    this.closeAlert.emit();
  }

  laterReminder(): void {
    this.showAlert = false;
    // 4 saat sonra tekrar hatırlat
    const remindTime = new Date().getTime() + (4 * 60 * 60 * 1000);
    localStorage.setItem('mobile-app-alert-dismissed', remindTime.toString());
    this.closeAlert.emit();
  }
}