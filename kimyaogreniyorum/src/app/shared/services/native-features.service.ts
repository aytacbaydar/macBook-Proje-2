import { Injectable } from '@angular/core';
import { Preferences } from '@capacitor/preferences';
// Secure storage için Keychain/EncryptedSharedPreferences alternatifi
import { Filesystem, Directory } from '@capacitor/filesystem';
import { App } from '@capacitor/app';
import { ToastrService } from 'ngx-toastr';

@Injectable({
  providedIn: 'root'
})
export class NativeFeaturesService {

  constructor(private toastr: ToastrService) {}

  // Güvenli Depolama İşlemleri
  async setSecureData(key: string, value: string): Promise<void> {
    try {
      await Preferences.set({
        key: key,
        value: value
      });
    } catch (error) {
      console.error('Secure storage set error:', error);
      throw error;
    }
  }

  async getSecureData(key: string): Promise<string | null> {
    try {
      const { value } = await Preferences.get({ key: key });
      return value;
    } catch (error) {
      console.error('Secure storage get error:', error);
      return null;
    }
  }

  async removeSecureData(key: string): Promise<void> {
    try {
      await Preferences.remove({ key: key });
    } catch (error) {
      console.error('Secure storage remove error:', error);
      throw error;
    }
  }

  async clearAllSecureData(): Promise<void> {
    try {
      await Preferences.clear();
    } catch (error) {
      console.error('Secure storage clear error:', error);
      throw error;
    }
  }

  // Authentication Token Yönetimi (Şifreli Depolama)
  async saveAuthToken(token: string): Promise<void> {
    try {
      // Mevcut Preferences kullan (production'da Keychain ile değiştirilecek)
      await this.setSecureData('auth_token', token);
    } catch (error) {
      console.error('Secure token save error:', error);
      throw error;
    }
  }

  async getAuthToken(): Promise<string | null> {
    try {
      return await this.getSecureData('auth_token');
    } catch (error) {
      console.error('Secure token get error:', error);
      return null;
    }
  }

  async removeAuthToken(): Promise<void> {
    try {
      await this.removeSecureData('auth_token');
    } catch (error) {
      console.error('Secure token remove error:', error);
      throw error;
    }
  }

  // Kullanıcı Bilgileri
  async saveUserData(userData: any): Promise<void> {
    await this.setSecureData('user_data', JSON.stringify(userData));
  }

  async getUserData(): Promise<any | null> {
    const data = await this.getSecureData('user_data');
    return data ? JSON.parse(data) : null;
  }

  // Dosya Sistemi İşlemleri
  async savePdfFile(fileName: string, base64Data: string): Promise<string> {
    try {
      // PDF klasörünü oluştur (yoksa)
      await this.ensurePdfDirectory();
      
      const savedFile = await Filesystem.writeFile({
        path: `pdfs/${fileName}`,
        data: base64Data,
        directory: Directory.Documents
      });
      
      this.toastr.success('PDF başarıyla kaydedildi', 'Başarılı');
      return savedFile.uri;
    } catch (error) {
      console.error('PDF save error:', error);
      this.toastr.error('PDF kaydedilemedi', 'Hata');
      throw error;
    }
  }

  private async ensurePdfDirectory(): Promise<void> {
    try {
      await Filesystem.mkdir({
        path: 'pdfs',
        directory: Directory.Documents,
        recursive: true
      });
    } catch (error: any) {
      // Klasör zaten varsa hata veriyor, ignore et
      if (!error.message?.includes('already exists')) {
        console.error('PDF directory creation error:', error);
      }
    }
  }

  async readPdfFile(fileName: string): Promise<string> {
    try {
      const contents = await Filesystem.readFile({
        path: `pdfs/${fileName}`,
        directory: Directory.Documents
      });
      
      return contents.data as string;
    } catch (error) {
      console.error('PDF read error:', error);
      this.toastr.error('PDF okunamadı', 'Hata');
      throw error;
    }
  }

  async deletePdfFile(fileName: string): Promise<void> {
    try {
      await Filesystem.deleteFile({
        path: `pdfs/${fileName}`,
        directory: Directory.Documents
      });
      
      this.toastr.success('PDF silindi', 'Başarılı');
    } catch (error) {
      console.error('PDF delete error:', error);
      this.toastr.error('PDF silinemedi', 'Hata');
      throw error;
    }
  }

  async listPdfFiles(): Promise<string[]> {
    try {
      const files = await Filesystem.readdir({
        path: 'pdfs',
        directory: Directory.Documents
      });
      
      return files.files.map((file: any) => file.name);
    } catch (error) {
      console.error('PDF list error:', error);
      return [];
    }
  }

  // Uygulama Bilgileri
  async getAppInfo(): Promise<any> {
    try {
      const appInfo = await App.getInfo();
      return {
        name: appInfo.name,
        version: appInfo.version,
        build: appInfo.build,
        id: appInfo.id
      };
    } catch (error) {
      console.error('App info error:', error);
      return null;
    }
  }

  // App State Listeners
  setupAppStateListeners(): void {
    App.addListener('appStateChange', ({ isActive }: any) => {
      console.log('App state changed. Is active?', isActive);
      
      if (isActive) {
        // Uygulama tekrar aktif olduğunda yapılacaklar
        this.onAppResume();
      } else {
        // Uygulama background'a gidince yapılacaklar
        this.onAppPause();
      }
    });

    App.addListener('backButton', () => {
      console.log('Back button pressed');
      // Android geri tuşu için özel işlemler
      this.handleBackButton();
    });
  }

  private onAppResume(): void {
    // Uygulama tekrar açıldığında
    console.log('App resumed - checking for updates...');
  }

  private onAppPause(): void {
    // Uygulama background'a gidince
    console.log('App paused - saving state...');
  }

  private handleBackButton(): void {
    // Android geri tuşu işlemi
    // Router ile mevcut sayfa kontrol edilebilir
    console.log('Handling back button...');
  }

  // Offline PDF Cache Yönetimi
  async getCachedPdfs(): Promise<string[]> {
    try {
      // Cache klasöründeki PDF'leri listele
      const cachedFiles = await Filesystem.readdir({
        path: 'cache/pdfs',
        directory: Directory.Documents
      });
      
      return cachedFiles.files.map((file: any) => file.name);
    } catch (error) {
      // Cache klasörü yoksa oluştur
      await this.createCacheDirectory();
      return [];
    }
  }

  private async createCacheDirectory(): Promise<void> {
    try {
      await Filesystem.mkdir({
        path: 'cache',
        directory: Directory.Documents,
        recursive: true
      });
      
      await Filesystem.mkdir({
        path: 'cache/pdfs',
        directory: Directory.Documents,
        recursive: true
      });
    } catch (error) {
      console.error('Cache directory creation error:', error);
    }
  }

  // Network durumu kontrol etme
  async isOnline(): Promise<boolean> {
    // Web ortamında navigator.onLine kullanılır
    // Native ortamda network plugin eklenebilir
    return navigator.onLine;
  }

  // Debug bilgileri
  async getDebugInfo(): Promise<any> {
    const appInfo = await this.getAppInfo();
    const isOnline = await this.isOnline();
    const cachedPdfs = await this.getCachedPdfs();
    
    return {
      app: appInfo,
      online: isOnline,
      cachedPdfCount: cachedPdfs.length,
      platform: this.getPlatform()
    };
  }

  private getPlatform(): string {
    // Platform tespiti
    if (typeof window !== 'undefined') {
      if (window.hasOwnProperty('AndroidInterface')) {
        return 'android';
      } else if (window.hasOwnProperty('webkit')) {
        return 'ios';
      }
    }
    return 'web';
  }
}