import { Injectable } from '@angular/core';
import { PushNotifications, Token } from '@capacitor/push-notifications';
import { ToastrService } from 'ngx-toastr';

@Injectable({
  providedIn: 'root'
})
export class PushNotificationService {

  constructor(private toastr: ToastrService) {}

  async requestPermissions(): Promise<boolean> {
    try {
      const permission = await PushNotifications.requestPermissions();
      
      if (permission.receive === 'granted') {
        await this.registerForPushNotifications();
        return true;
      } else {
        this.toastr.warning('Bildirim izni verilmedi. Duyuruları kaçırabilirsiniz.', 'Uyarı');
        return false;
      }
    } catch (error) {
      console.error('Push notification permission error:', error);
      this.toastr.error('Bildirim ayarları yüklenirken hata oluştu.', 'Hata');
      return false;
    }
  }

  private async registerForPushNotifications(): Promise<void> {
    try {
      await PushNotifications.register();
      this.toastr.success('Bildirimler aktif edildi! Artık duyuruları alacaksınız.', 'Başarılı');
    } catch (error) {
      console.error('Push notification registration error:', error);
      this.toastr.error('Bildirim kaydı başarısız oldu.', 'Hata');
    }
  }

  setupPushNotificationListeners(): void {
    // Token alındığında
    PushNotifications.addListener('registration', (token: Token) => {
      console.log('Push notification token:', token.value);
      this.saveTokenToServer(token.value);
    });

    // Kayıt hatası
    PushNotifications.addListener('registrationError', (error: any) => {
      console.error('Push notification registration error:', error);
      this.toastr.error('Bildirim servisi başlatılamadı.', 'Hata');
    });

    // Bildirim alındığında (uygulama açıkken)
    PushNotifications.addListener('pushNotificationReceived', (notification: any) => {
      console.log('Push notification received:', notification);
      this.showInAppNotification(notification);
    });

    // Bildiriğe tıklandığında
    PushNotifications.addListener('pushNotificationActionPerformed', (notification: any) => {
      console.log('Push notification action performed:', notification);
      this.handleNotificationAction(notification);
    });
  }

  private async saveTokenToServer(token: string): Promise<void> {
    try {
      // Bu kısımda token'ı backend'e göndereceksiniz
      // Örnek: API endpoint'e POST isteği
      console.log('Token backend\'e gönderilecek:', token);
      
      // Backend entegrasyonu için placeholder
      /*
      const response = await fetch('/api/push-tokens', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getAuthToken()}`
        },
        body: JSON.stringify({
          token: token,
          platform: this.getPlatform(),
          userId: this.getCurrentUserId()
        })
      });
      */
      
    } catch (error) {
      console.error('Token save error:', error);
    }
  }

  private showInAppNotification(notification: any): void {
    // Uygulama açıkken gelen bildirimler için
    this.toastr.info(
      notification.body || 'Yeni bir duyuru var!',
      notification.title || 'Kimya Öğreniyorum',
      {
        timeOut: 5000,
        positionClass: 'toast-top-right'
      }
    );
  }

  private handleNotificationAction(notification: any): void {
    // Bildiriğe tıklandığında yapılacak işlemler
    const data = notification.notification?.data;
    
    if (data?.action === 'open_announcement') {
      // Duyuru sayfasına yönlendir
      console.log('Duyuru sayfasına yönlendiriliyor...');
      // this.router.navigate(['/duyurular', data.announcementId]);
    } else if (data?.action === 'open_homework') {
      // Ödev sayfasına yönlendir
      console.log('Ödev sayfasına yönlendiriliyor...');
      // this.router.navigate(['/odevler', data.homeworkId]);
    } else {
      // Genel ana sayfaya yönlendir
      console.log('Ana sayfaya yönlendiriliyor...');
      // this.router.navigate(['/']);
    }
  }

  // Platform kontrolü
  private getPlatform(): string {
    // Capacitor platform detection
    return 'web'; // Bu kısım platform tespiti yapacak
  }

  // Kullanıcı ID'si (authentication service'den alınacak)
  private getCurrentUserId(): string {
    // Authentication service entegrasyonu
    return 'current-user-id';
  }

  // Auth token (authentication service'den alınacak)
  private getAuthToken(): string {
    // Authentication service entegrasyonu
    return 'auth-token';
  }

  // Test için notification gönderme
  async sendTestNotification(): Promise<void> {
    this.toastr.info(
      'Bu bir test bildirimidir. Gerçek bildirimler öğretmeninizden gelecektir.',
      'Test Bildirimi',
      {
        timeOut: 5000
      }
    );
  }
}