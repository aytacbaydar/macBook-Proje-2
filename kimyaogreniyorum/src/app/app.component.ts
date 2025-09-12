import { Component, OnInit } from '@angular/core';
import { PushNotificationService } from './shared/services/push-notification.service';
import { NativeFeaturesService } from './shared/services/native-features.service';
import { Platform } from '@angular/cdk/platform';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  standalone: false,
  styleUrl: './app.component.scss'
})
export class AppComponent implements OnInit {
  title = 'kimyaogreniyorum';

  constructor(
    private pushNotificationService: PushNotificationService,
    private nativeFeaturesService: NativeFeaturesService,
    private platform: Platform
  ) {
    // Global error handler for uncaught promises
    window.addEventListener('unhandledrejection', (event) => {
      console.error('Unhandled promise rejection:', event.reason);
      // Prevent the default browser behavior
      event.preventDefault();
    });
  }

  async ngOnInit() {
    // Mobil platform kontrolü
    if (this.platform.ANDROID || this.platform.IOS) {
      await this.initializeMobileFeatures();
    }
  }

  private async initializeMobileFeatures(): Promise<void> {
    try {
      // Push notification listeners kurulumu
      this.pushNotificationService.setupPushNotificationListeners();
      
      // App state listeners kurulumu
      this.nativeFeaturesService.setupAppStateListeners();
      
      // Push notification izni iste
      const permissionGranted = await this.pushNotificationService.requestPermissions();
      
      if (permissionGranted) {
        console.log('Push notifications enabled');
      } else {
        console.log('Push notifications disabled by user');
      }
      
      // Debug bilgileri (development için)
      const debugInfo = await this.nativeFeaturesService.getDebugInfo();
      console.log('Mobile app debug info:', debugInfo);
      
    } catch (error) {
      console.error('Mobile features initialization error:', error);
    }
  }
}
