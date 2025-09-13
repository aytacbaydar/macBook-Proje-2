import { Component, OnInit, Output, EventEmitter } from '@angular/core';
import { trigger, state, style, transition, animate } from '@angular/animations';
import { MobileDetectionService } from '../../services/mobile-detection.service';

@Component({
  selector: 'app-mobile-app-download-alert',
  templateUrl: './mobile-app-download-alert.component.html',
  styleUrls: ['./mobile-app-download-alert.component.scss'],
  standalone: false,
  animations: [
    trigger('fadeInOut', [
      transition(':enter', [
        style({ opacity: 0 }),
        animate('300ms ease-in', style({ opacity: 1 }))
      ]),
      transition(':leave', [
        animate('300ms ease-out', style({ opacity: 0 }))
      ])
    ]),
    trigger('slideUp', [
      transition(':enter', [
        style({ transform: 'translateY(50px) scale(0.9)', opacity: 0 }),
        animate('400ms cubic-bezier(0.25, 0.8, 0.25, 1)', 
          style({ transform: 'translateY(0) scale(1)', opacity: 1 }))
      ]),
      transition(':leave', [
        animate('300ms ease-in', 
          style({ transform: 'translateY(-30px) scale(0.95)', opacity: 0 }))
      ])
    ])
  ]
})
export class MobileAppDownloadAlertComponent implements OnInit {
  @Output() closeAlert = new EventEmitter<void>();
  @Output() openInstallationGuide = new EventEmitter<void>();

  showAlert = false;
  platform: string = '';
  platformName: string = '';
  platformIcon: string = '';
  downloadUrl: string = '';

  constructor(private mobileDetectionService: MobileDetectionService) { }

  ngOnInit(): void {
    // Centralized visibility logic - check both mobile platform and TTL expiry
    if (this.mobileDetectionService.shouldShowInstallPrompt()) {
      this.checkDismissalStatus();
    }
  }

  private checkDismissalStatus(): void {
    const dismissed = localStorage.getItem('mobile-app-alert-dismissed');
    const currentTime = new Date().getTime();
    
    // Show alert if never dismissed OR dismissal has expired
    if (!dismissed || parseInt(dismissed) < currentTime) {
      this.initializeAlert();
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
      // iOS için PWA talimatları (App Store link henüz hazır değil)
      this.showPWAInstructions();
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

  showInstallationGuide(): void {
    this.openInstallationGuide.emit();
  }
}