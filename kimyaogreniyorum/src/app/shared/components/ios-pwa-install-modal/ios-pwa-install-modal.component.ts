import { Component, OnInit, OnDestroy, Output, EventEmitter } from '@angular/core';
import { MobileDetectionService } from '../../services/mobile-detection.service';
import { trigger, state, style, transition, animate } from '@angular/animations';

@Component({
  selector: 'app-ios-pwa-install-modal',
  templateUrl: './ios-pwa-install-modal.component.html',
  styleUrls: ['./ios-pwa-install-modal.component.scss'],
  standalone: false,
  animations: [
    trigger('modalAnimation', [
      transition(':enter', [
        style({ opacity: 0, transform: 'scale(0.9) translateY(20px)' }),
        animate('300ms ease-out', style({ opacity: 1, transform: 'scale(1) translateY(0)' }))
      ]),
      transition(':leave', [
        animate('200ms ease-in', style({ opacity: 0, transform: 'scale(0.9) translateY(20px)' }))
      ])
    ])
  ]
})
export class IosPwaInstallModalComponent implements OnInit, OnDestroy {
  @Output() closeModalEvent = new EventEmitter<void>();

  showModal = false;
  private hasShownBefore = false;
  private dontShowAgain = false;

  constructor(
    private mobileDetectionService: MobileDetectionService
  ) { }

  ngOnInit(): void {
    this.checkAndShowModal();
  }

  ngOnDestroy(): void {
    // Cleanup if needed
  }

  /**
   * Modal gösterilmeli mi kontrol et
   */
  private checkAndShowModal(): void {
    // Local storage'dan "don't show again" kontrolü
    const dontShow = localStorage.getItem('ios-pwa-dont-show');
    if (dontShow === 'true') {
      return;
    }

    // iOS Safari kontrolü ve PWA durumu
    if (this.shouldShowInstallModal()) {
      // 2 saniye gecikme ile modal'ı göster
      setTimeout(() => {
        this.showModal = true;
      }, 2000);
    }
  }

  /**
   * iOS PWA kurulum modal'ını göstermeli mi?
   */
  private shouldShowInstallModal(): boolean {
    // iOS device mi?
    const platform = this.mobileDetectionService.getPlatform();
    if (platform !== 'ios') {
      return false;
    }

    // Safari browser mi? (in-app browser'ları exclude et)
    if (!this.isStandaloneSafari()) {
      return false;
    }

    // PWA olarak zaten yüklü mü?
    if (this.mobileDetectionService.isPWAInstalled()) {
      return false;
    }

    return true;
  }

  /**
   * Standalone Safari browser kontrolü (Instagram, Facebook vb. in-app browser'ları exclude et)
   */
  private isStandaloneSafari(): boolean {
    const userAgent = navigator.userAgent.toLowerCase();
    
    // Safari mi?
    const isSafari = /safari/.test(userAgent) && !/chrome/.test(userAgent);
    
    // In-app browser'ları exclude et
    const isInApp = /instagram|fbav|fban|twitter|line|wechat|linkedin/i.test(userAgent);
    
    return isSafari && !isInApp;
  }

  /**
   * Modal'ı kapat
   */
  closeModal(): void {
    this.showModal = false;
    this.closeModalEvent.emit();
  }

  /**
   * "Bir daha gösterme" seçeneği
   */
  dontShowAgainClick(): void {
    localStorage.setItem('ios-pwa-dont-show', 'true');
    this.closeModal();
  }

  /**
   * Ana Ekrana Ekle butonuna tıkla - sadece bilgilendirme
   */
  addToHomeScreen(): void {
    // iOS'ta programatik olarak install prompt gösteremeyiz
    // Modal zaten nasıl yapılacağını gösteriyor
    this.closeModal();
  }
}