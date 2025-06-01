
import { Component, OnInit, AfterViewInit, ViewChild, ElementRef } from '@angular/core';

@Component({
  selector: 'app-ogretmen-qr-generator',
  standalone: false,
  templateUrl: './ogretmen-qr-generator.component.html',
  styleUrl: './ogretmen-qr-generator.component.scss'
})
export class OgretmenQrGeneratorComponent implements OnInit, AfterViewInit {
  @ViewChild('entryQRCanvas', { static: false }) entryQRCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('exitQRCanvas', { static: false }) exitQRCanvas!: ElementRef<HTMLCanvasElement>;

  studentData = {
    id: 35,
    name: "Elif Elif",
    email: "elish263624@gmail.com"
  };

  currentDate: string = '';
  entryQRData: string = '';
  exitQRData: string = '';

  constructor() { }

  ngOnInit(): void {
    this.updateDateTime();
    setInterval(() => this.updateDateTime(), 1000);
  }

  ngAfterViewInit(): void {
    this.loadQRLibrary().then(() => {
      this.generateQRCodes();
    }).catch(error => {
      console.error('QR kütüphanesi yüklenemedi:', error);
    });
  }

  updateDateTime(): void {
    const now = new Date();
    this.currentDate = now.toLocaleDateString('tr-TR') + ' ' + now.toLocaleTimeString('tr-TR');
  }

  generateQRData(action: string): string {
    const timestamp = Date.now();
    return `${this.studentData.id}_${action}_${timestamp}`;
  }

  async loadQRLibrary(): Promise<void> {
    return new Promise((resolve, reject) => {
      if ((window as any).QRCode) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js';
      script.onload = () => {
        console.log('QRCode kütüphanesi yüklendi');
        resolve();
      };
      script.onerror = () => {
        // Yedek CDN deneyelim
        const backupScript = document.createElement('script');
        backupScript.src = 'https://unpkg.com/qrcode@1.5.3/build/qrcode.min.js';
        backupScript.onload = () => {
          console.log('Yedek QRCode kütüphanesi yüklendi');
          resolve();
        };
        backupScript.onerror = () => {
          reject(new Error('QRCode kütüphanesi yüklenemedi'));
        };
        document.head.appendChild(backupScript);
      };
      document.head.appendChild(script);
    });
  }

  generateQRCodes(): void {
    const QRCode = (window as any).QRCode;
    if (!QRCode) {
      console.error('QRCode kütüphanesi bulunamadı');
      return;
    }

    this.entryQRData = this.generateQRData('entry');
    this.exitQRData = this.generateQRData('exit');

    // Giriş QR kodu
    QRCode.toCanvas(this.entryQRCanvas.nativeElement, this.entryQRData, {
      width: 200,
      margin: 2,
      color: {
        dark: '#28a745',
        light: '#FFFFFF'
      }
    }, (error: any) => {
      if (error) console.error('Giriş QR kodu oluşturulamadı:', error);
      else console.log('Giriş QR kodu oluşturuldu');
    });

    // Çıkış QR kodu
    QRCode.toCanvas(this.exitQRCanvas.nativeElement, this.exitQRData, {
      width: 200,
      margin: 2,
      color: {
        dark: '#dc3545',
        light: '#FFFFFF'
      }
    }, (error: any) => {
      if (error) console.error('Çıkış QR kodu oluşturulamadı:', error);
      else console.log('Çıkış QR kodu oluşturuldu');
    });
  }

  printQRCodes(): void {
    window.print();
  }
}
