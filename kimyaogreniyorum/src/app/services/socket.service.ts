import { Injectable } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class SocketService {
  private socket!: Socket;
  private readonly SERVER_URL = 'http://localhost:3000'; // sunucu adresin (gerekirse değiştir)

  constructor() {}

  /**
   * Socket bağlantısını başlatır.
   * @param userRole 'ogretmen' veya 'ogrenci'
   * @param dersId Sınıf / ders odası kimliği
   */
  connect(userRole: 'ogretmen' | 'ogrenci', dersId: string): void {
    if (this.socket && this.socket.connected) return;

    this.socket = io(this.SERVER_URL, {
      query: { userRole, dersId },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    this.socket.on('connect', () => {
      console.log(`✅ Socket.IO bağlandı [${userRole}] → Oda: ${dersId}`);
    });

    this.socket.on('disconnect', (reason) => {
      console.warn('⚠️ Socket bağlantısı koptu:', reason);
    });

    this.socket.on('connect_error', (error) => {
      console.error('🚫 Socket bağlantı hatası:', error);
    });
  }

  /**
   * Belirtilen event türüyle mesaj gönderir.
   */
  emit(event: string, data: any): void {
    if (!this.socket || !this.socket.connected) {
      console.warn('Socket bağlı değil, veri gönderilemedi:', event);
      return;
    }
    this.socket.emit(event, data);
  }

  /**
   * Sunucudan gelen mesajları dinler.
   */
  listen<T>(event: string): Observable<T> {
    return new Observable((subscriber) => {
      if (!this.socket) return;
      this.socket.on(event, (data: T) => {
        subscriber.next(data);
      });
    });
  }

  /**
   * Socket bağlantısını kapatır.
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      console.log('🔌 Socket bağlantısı sonlandırıldı.');
    }
  }
}
