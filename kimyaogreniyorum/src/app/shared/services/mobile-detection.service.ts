import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class MobileDetectionService {

  constructor() { }

  /**
   * Kullanıcının hangi platformda olduğunu tespit eder
   */
  getPlatform(): 'ios' | 'android' | 'web' {
    const userAgent = navigator.userAgent.toLowerCase();
    
    if (/iphone|ipad|ipod/.test(userAgent)) {
      return 'ios';
    } else if (/android/.test(userAgent)) {
      return 'android';
    } else {
      return 'web';
    }
  }

  /**
   * Mobil cihaz kontrolü
   */
  isMobile(): boolean {
    const platform = this.getPlatform();
    return platform === 'ios' || platform === 'android';
  }

  /**
   * PWA olarak yüklenmiş mi kontrolü
   */
  isPWAInstalled(): boolean {
    // Standalone mode kontrolü (PWA installed)
    return window.matchMedia('(display-mode: standalone)').matches ||
           // @ts-ignore
           window.navigator.standalone === true;
  }

  /**
   * PWA yükleme önerisinde bulunulmalı mı?
   */
  shouldShowInstallPrompt(): boolean {
    return this.isMobile() && !this.isPWAInstalled();
  }

  /**
   * iOS Safari browser kontrolü (PWA modal için)
   */
  isIOSSafari(): boolean {
    const userAgent = navigator.userAgent.toLowerCase();
    
    // iOS device kontrolü
    const isIOS = /iphone|ipad|ipod/.test(userAgent) || 
                  (/macintosh/.test(userAgent) && 'ontouchend' in document);
    
    // Safari browser kontrolü
    const isSafari = /safari/.test(userAgent) && !/chrome/.test(userAgent);
    
    // In-app browser'ları exclude et (Instagram, Facebook, etc.)
    const isInApp = /instagram|fbav|fban|twitter|line|wechat|linkedin|tiktok|snapchat/i.test(userAgent);
    
    return isIOS && isSafari && !isInApp;
  }

  /**
   * iOS PWA kurulum modal'ını göstermeli mi?
   */
  shouldShowIOSPWAModal(): boolean {
    // iOS Safari kontrolü
    if (!this.isIOSSafari()) {
      return false;
    }

    // PWA zaten yüklü mü?
    if (this.isPWAInstalled()) {
      return false;
    }

    // "Don't show again" seçili mi?
    const dontShow = localStorage.getItem('ios-pwa-dont-show');
    if (dontShow === 'true') {
      return false;
    }

    return true;
  }

  /**
   * Platform bazlı indirme URL'si
   */
  getDownloadUrl(): string {
    const platform = this.getPlatform();
    
    switch (platform) {
      case 'android':
        return '/public/downloads/kimya-ogreniyorum.apk'; // APK dosya yolu
      case 'ios':
        return 'https://apps.apple.com/app/kimya-ogreniyorum/id123456789'; // App Store link
      default:
        return window.location.origin; // Web versiyonu
    }
  }

  /**
   * Platform adı (Türkçe)
   */
  getPlatformName(): string {
    const platform = this.getPlatform();
    
    switch (platform) {
      case 'android':
        return 'Android';
      case 'ios':
        return 'iPhone';
      default:
        return 'Web Tarayıcısı';
    }
  }

  /**
   * Platform ikonu
   */
  getPlatformIcon(): string {
    const platform = this.getPlatform();
    
    switch (platform) {
      case 'android':
        return 'fab fa-android';
      case 'ios':
        return 'fab fa-apple';
      default:
        return 'fas fa-globe';
    }
  }
}